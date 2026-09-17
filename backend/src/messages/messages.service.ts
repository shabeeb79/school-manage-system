import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageKind, Prisma, UserRole } from '@prisma/client';
import { unlink, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { listTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesRealtimeService } from './messages-realtime.service';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private realtime: MessagesRealtimeService,
  ) {}

  private includePeers() {
    return {
      sender: { select: userSelect },
      receiver: { select: userSelect },
    };
  }

  /**
   * Who may message whom:
   * - Admin → everyone
   * - Student → admin + their class teacher
   * - Staff → admin + other staff + students in their assigned class
   */
  private async allowedContactsWhere(
    userId: string,
  ): Promise<Prisma.UserWhereInput> {
    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        studentProfile: { select: { schoolClassId: true } },
        staffProfile: {
          select: {
            assignedClassId: true,
            classAssignments: { select: { schoolClassId: true } },
          },
        },
      },
    });
    if (!sender) throw new NotFoundException('User not found');

    const base: Prisma.UserWhereInput = {
      id: { not: userId },
      isActive: true,
    };

    if (sender.role === UserRole.ADMIN) {
      return base;
    }

    if (sender.role === UserRole.STUDENT) {
      const classId = sender.studentProfile?.schoolClassId;
      const or: Prisma.UserWhereInput[] = [{ role: UserRole.ADMIN }];
      if (classId) {
        or.push({
          role: UserRole.STAFF,
          staffProfile: {
            OR: [
              { assignedClassId: classId },
              { classAssignments: { some: { schoolClassId: classId } } },
            ],
          },
        });
      }
      return { ...base, OR: or };
    }

    // STAFF
    const classIds = [
      ...new Set(
        [
          sender.staffProfile?.assignedClassId,
          ...(sender.staffProfile?.classAssignments ?? []).map(
            (a) => a.schoolClassId,
          ),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    const or: Prisma.UserWhereInput[] = [
      { role: UserRole.ADMIN },
      { role: UserRole.STAFF },
    ];
    if (classIds.length) {
      or.push({
        role: UserRole.STUDENT,
        studentProfile: { schoolClassId: { in: classIds } },
      });
    }
    return { ...base, OR: or };
  }

  private async assertCanMessage(senderId: string, receiverId: string) {
    if (receiverId === senderId) {
      throw new BadRequestException('Cannot message yourself');
    }
    const where = await this.allowedContactsWhere(senderId);
    const allowed = await this.prisma.user.findFirst({
      where: { ...where, id: receiverId },
      select: { id: true },
    });
    if (!allowed) {
      throw new ForbiddenException('You are not allowed to message this user');
    }
  }

  private previewOf(message: {
    kind: MessageKind;
    body: string;
    subject: string;
  }) {
    if (message.kind === MessageKind.VOICE) return 'Voice message';
    if (message.kind === MessageKind.PHOTO) return 'Photo';
    const text = message.body?.trim() || message.subject?.trim();
    return text || 'Message';
  }

  private emitCreated(message: {
    id: string;
    senderId: string;
    receiverId: string;
  }) {
    this.realtime.publish({
      type: 'message.created',
      userIds: [message.senderId],
      peerId: message.receiverId,
      messageId: message.id,
    });
    this.realtime.publish({
      type: 'message.created',
      userIds: [message.receiverId],
      peerId: message.senderId,
      messageId: message.id,
    });
  }

  private emitRead(args: {
    readerId: string;
    senderId: string;
    messageId?: string;
  }) {
    this.realtime.publish({
      type: 'message.read',
      userIds: [args.senderId],
      peerId: args.readerId,
      messageId: args.messageId,
    });
    this.realtime.publish({
      type: 'message.read',
      userIds: [args.readerId],
      peerId: args.senderId,
      messageId: args.messageId,
    });
  }

  async send(senderId: string, dto: SendMessageDto) {
    await this.assertCanMessage(senderId, dto.receiverId);

    const body = (dto.body ?? '').trim();
    const subject = (dto.subject ?? '').trim();
    if (!body && !subject) {
      throw new BadRequestException('Message text is required');
    }

    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        subject,
        body: body || subject,
        kind: MessageKind.TEXT,
      },
      include: this.includePeers(),
    });
    this.emitCreated(message);
    return message;
  }

  async sendMedia(
    senderId: string,
    receiverId: string,
    kind: MessageKind,
    file: Express.Multer.File,
    caption?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    try {
      await this.assertCanMessage(senderId, receiverId);
    } catch (err) {
      this.deleteUploaded(file);
      throw err;
    }
    if (kind !== MessageKind.VOICE && kind !== MessageKind.PHOTO) {
      this.deleteUploaded(file);
      throw new BadRequestException('Invalid media kind');
    }

    if (kind === MessageKind.PHOTO) {
      if (!file.mimetype.startsWith('image/')) {
        this.deleteUploaded(file);
        throw new BadRequestException('Only image files are allowed for photos');
      }
      if (file.size > 1024 * 1024) {
        this.deleteUploaded(file);
        throw new BadRequestException('Photo must be 1MB or smaller');
      }
    }

    if (kind === MessageKind.VOICE) {
      if (
        !file.mimetype.startsWith('audio/') &&
        file.mimetype !== 'video/webm'
      ) {
        this.deleteUploaded(file);
        throw new BadRequestException('Only audio files are allowed for voice');
      }
      if (file.size > 5 * 1024 * 1024) {
        this.deleteUploaded(file);
        throw new BadRequestException('Voice message must be 5MB or smaller');
      }
    }

    const mediaUrl = `/uploads/messages/${file.filename}`;
    const body = (caption ?? '').trim();

    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        subject: '',
        body,
        kind,
        mediaUrl,
        mediaMime: file.mimetype,
      },
      include: this.includePeers(),
    });
    this.emitCreated(message);
    return message;
  }

  private deleteUploaded(file?: Express.Multer.File) {
    if (!file?.filename) return;
    const fullPath = join(process.cwd(), 'uploads', 'messages', file.filename);
    void access(fullPath, constants.F_OK)
      .then(() => unlink(fullPath))
      .catch(() => undefined);
  }

  inbox(userId: string) {
    return this.prisma.message.findMany({
      where: { receiverId: userId },
      include: {
        sender: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(undefined, 100, 200),
    });
  }

  sent(userId: string) {
    return this.prisma.message.findMany({
      where: { senderId: userId },
      include: {
        receiver: { select: userSelect },
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(undefined, 100, 200),
    });
  }

  async contacts(userId: string) {
    const where = await this.allowedContactsWhere(userId);
    return this.prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: listTake(undefined, 200, 500),
    });
  }

  async conversations(userId: string) {
    type LastRow = {
      id: string;
      peer_id: string;
      senderId: string;
      receiverId: string;
      subject: string;
      body: string;
      kind: MessageKind;
      mediaUrl: string | null;
      mediaMime: string | null;
      isRead: boolean;
      readAt: Date | null;
      createdAt: Date;
    };

    const lastRows = await this.prisma.$queryRaw<LastRow[]>`
      SELECT DISTINCT ON (peer_id)
        m.id,
        CASE
          WHEN m."senderId" = ${userId} THEN m."receiverId"
          ELSE m."senderId"
        END AS peer_id,
        m."senderId",
        m."receiverId",
        m.subject,
        m.body,
        m.kind,
        m."mediaUrl",
        m."mediaMime",
        m."isRead",
        m."readAt",
        m."createdAt"
      FROM messages m
      WHERE m."senderId" = ${userId} OR m."receiverId" = ${userId}
      ORDER BY peer_id, m."createdAt" DESC
    `;

    if (!lastRows.length) return [];

    const peerIds = lastRows.map((r) => r.peer_id);
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const [peers, unreadGroups, allowed] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: peerIds }, isActive: true },
        select: userSelect,
      }),
      this.prisma.message.groupBy({
        by: ['senderId'],
        where: { receiverId: userId, isRead: false, senderId: { in: peerIds } },
        _count: { _all: true },
      }),
      me?.role === UserRole.ADMIN
        ? Promise.resolve(null)
        : this.contacts(userId),
    ]);

    const allowedIds =
      allowed === null
        ? new Set(peerIds)
        : new Set(allowed.map((u) => u.id));
    const peerById = new Map(peers.map((p) => [p.id, p]));
    const unreadBySender = new Map(
      unreadGroups.map((g) => [g.senderId, g._count._all]),
    );

    return lastRows
      .filter((row) => allowedIds.has(row.peer_id) && peerById.has(row.peer_id))
      .map((row) => {
        const peer = peerById.get(row.peer_id)!;
        const lastMessage = {
          id: row.id,
          senderId: row.senderId,
          receiverId: row.receiverId,
          subject: row.subject,
          body: row.body,
          kind: row.kind,
          mediaUrl: row.mediaUrl,
          mediaMime: row.mediaMime,
          isRead: row.isRead,
          readAt: row.readAt,
          createdAt: row.createdAt,
          sender:
            row.senderId === userId
              ? { id: userId, firstName: '', lastName: '', role: '' }
              : peer,
          receiver:
            row.receiverId === userId
              ? { id: userId, firstName: '', lastName: '', role: '' }
              : peer,
        };
        return {
          peerId: peer.id,
          peer,
          preview: this.previewOf(lastMessage),
          lastMessageAt: row.createdAt,
          unreadCount: unreadBySender.get(peer.id) ?? 0,
          lastMessage,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.message.count({
      where: { receiverId: userId, isRead: false },
    });
    return { count };
  }

  async thread(userId: string, peerId: string) {
    await this.assertCanMessage(userId, peerId);

    const peer = await this.prisma.user.findUnique({
      where: { id: peerId },
      select: userSelect,
    });
    if (!peer) throw new NotFoundException('User not found');

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: peerId },
          { senderId: peerId, receiverId: userId },
        ],
      },
      include: this.includePeers(),
      orderBy: { createdAt: 'desc' },
      take: listTake(undefined, 200, 300),
    });

    return { peer, messages: messages.reverse() };
  }

  async markRead(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message || message.receiverId !== userId) {
      throw new NotFoundException('Message not found');
    }
    if (message.isRead) return message;
    const updated = await this.prisma.message.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
      include: this.includePeers(),
    });
    this.emitRead({
      readerId: userId,
      senderId: message.senderId,
      messageId: message.id,
    });
    return updated;
  }

  async markThreadRead(userId: string, peerId: string) {
    const result = await this.prisma.message.updateMany({
      where: {
        senderId: peerId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
    this.emitRead({ readerId: userId, senderId: peerId });
    return { marked: result.count, peerId };
  }
}
