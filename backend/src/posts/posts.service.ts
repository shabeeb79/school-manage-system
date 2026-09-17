import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PostAudience, Prisma, UserRole } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { listTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

type FeedUser = {
  id: string;
  role: UserRole;
  studentProfile?: { schoolClassId?: string | null } | null;
  staffProfile?: {
    assignedClassId?: string | null;
    classAssignments?: { schoolClassId: string }[];
  } | null;
};

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(
    authorId: string,
    dto: CreatePostDto,
    file?: Express.Multer.File,
  ) {
    if (dto.audience === PostAudience.CLASS && !dto.targetClassId) {
      throw new BadRequestException('targetClassId is required for CLASS audience');
    }

    let fileUrl: string | undefined;
    let mediaType: string | undefined;
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        throw new BadRequestException('File must be 2MB or smaller');
      }
      fileUrl = `/uploads/posts/${file.filename}`;
      mediaType = file.mimetype.startsWith('video/') ? 'VIDEO' : 'PHOTO';
    }

    const { targetUserIds, ...data } = dto;
    const targetClassId =
      data.targetClassId && String(data.targetClassId).trim()
        ? String(data.targetClassId).trim()
        : undefined;

    return this.prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        audience: data.audience,
        isPublished: data.isPublished ?? true,
        targetClassId,
        authorId,
        ...(fileUrl ? { fileUrl, mediaType } : {}),
        targets: targetUserIds?.length
          ? { create: targetUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: {
          select: { id: true, name: true, section: true, academicYear: true },
        },
        targets: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  private feedVisibilityWhere(user: FeedUser): Prisma.PostWhereInput {
    const staffClassIds = [
      user.staffProfile?.assignedClassId,
      ...(user.staffProfile?.classAssignments ?? []).map((a) => a.schoolClassId),
    ].filter((id): id is string => Boolean(id));
    const studentClassId = user.studentProfile?.schoolClassId ?? undefined;

    const audienceOr: Prisma.PostWhereInput[] = [
      { audience: PostAudience.ALL },
      {
        audience: PostAudience.CUSTOM,
        OR: [
          { authorId: user.id },
          { targets: { some: { userId: user.id } } },
        ],
      },
    ];

    if (user.role === UserRole.ADMIN) {
      audienceOr.push(
        { audience: PostAudience.ADMIN },
        { audience: PostAudience.STAFF },
        { audience: PostAudience.STUDENT },
        { audience: PostAudience.CLASS },
      );
    } else if (user.role === UserRole.STAFF) {
      audienceOr.push({ audience: PostAudience.STAFF });
      if (staffClassIds.length) {
        audienceOr.push({
          audience: PostAudience.CLASS,
          targetClassId: { in: staffClassIds },
        });
      }
    } else {
      audienceOr.push({ audience: PostAudience.STUDENT });
      if (studentClassId) {
        audienceOr.push({
          audience: PostAudience.CLASS,
          targetClassId: studentClassId,
        });
      }
    }

    return { isPublished: true, OR: audienceOr };
  }

  private unreadWhere(user: FeedUser): Prisma.PostWhereInput {
    return {
      AND: [
        this.feedVisibilityWhere(user),
        { authorId: { not: user.id } },
        { reads: { none: { userId: user.id } } },
      ],
    };
  }

  async feed(user: FeedUser) {
    const posts = await this.prisma.post.findMany({
      where: this.feedVisibilityWhere(user),
      select: {
        id: true,
        title: true,
        content: true,
        audience: true,
        targetClassId: true,
        authorId: true,
        fileUrl: true,
        mediaType: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: {
          select: { id: true, name: true, section: true },
        },
        reads: {
          where: { userId: user.id },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(undefined, 40, 60),
    });

    return posts.map(({ reads, ...post }) => ({
      ...post,
      isUnread: post.authorId !== user.id && reads.length === 0,
    }));
  }

  /** Lightweight count — does not load post bodies. */
  async unreadCount(user: FeedUser) {
    const count = await this.prisma.post.count({
      where: this.unreadWhere(user),
    });
    return { count };
  }

  /** Mark unread visible posts as read without loading full feed payloads. */
  async markFeedRead(user: FeedUser) {
    const unread = await this.prisma.post.findMany({
      where: this.unreadWhere(user),
      select: { id: true },
      take: 200,
    });
    if (!unread.length) return { marked: 0 };

    await this.prisma.postRead.createMany({
      data: unread.map((post) => ({ postId: post.id, userId: user.id })),
      skipDuplicates: true,
    });

    return { marked: unread.length };
  }

  findAll() {
    return this.prisma.post.findMany({
      select: {
        id: true,
        title: true,
        content: true,
        audience: true,
        targetClassId: true,
        authorId: true,
        fileUrl: true,
        mediaType: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: {
          select: { id: true, name: true, section: true, academicYear: true },
        },
        targets: {
          select: {
            userId: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(undefined, 50, 100),
    });
  }

  async remove(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');

    if (post.fileUrl?.startsWith('/uploads/posts/')) {
      const absolute = join(process.cwd(), post.fileUrl.replace(/^\//, ''));
      await unlink(absolute).catch(() => undefined);
    }

    return this.prisma.post.delete({ where: { id } });
  }
}
