import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PostAudience, UserRole } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

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
    return this.prisma.post.create({
      data: {
        ...data,
        targetClassId: data.targetClassId || undefined,
        authorId,
        fileUrl,
        mediaType,
        targets: targetUserIds?.length
          ? { create: targetUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: true,
        targets: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async feed(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
    staffProfile?: {
      assignedClassId?: string | null;
      classAssignments?: { schoolClassId: string }[];
    } | null;
  }) {
    const posts = await this.prisma.post.findMany({
      where: { isPublished: true },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: true,
        targets: true,
        reads: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return posts
      .filter((post) => this.isVisibleTo(post, user))
      .map(({ reads, ...post }) => ({
        ...post,
        isUnread: post.authorId !== user.id && reads.length === 0,
      }));
  }

  private isVisibleTo(
    post: {
      audience: PostAudience;
      targetClassId: string | null;
      authorId: string;
      targets: { userId: string }[];
    },
    user: {
      id: string;
      role: UserRole;
      studentProfile?: { schoolClassId?: string | null } | null;
      staffProfile?: {
        assignedClassId?: string | null;
        classAssignments?: { schoolClassId: string }[];
      } | null;
    },
  ) {
    switch (post.audience) {
      case PostAudience.ALL:
        return true;
      case PostAudience.ADMIN:
        return user.role === UserRole.ADMIN;
      case PostAudience.STAFF:
        return user.role === UserRole.STAFF || user.role === UserRole.ADMIN;
      case PostAudience.STUDENT:
        return user.role === UserRole.STUDENT || user.role === UserRole.ADMIN;
      case PostAudience.CLASS: {
        if (user.role === UserRole.ADMIN) return true;
        if (user.studentProfile?.schoolClassId === post.targetClassId) {
          return true;
        }
        const staffClassIds = [
          user.staffProfile?.assignedClassId,
          ...(user.staffProfile?.classAssignments ?? []).map(
            (a) => a.schoolClassId,
          ),
        ].filter(Boolean);
        return staffClassIds.includes(post.targetClassId ?? undefined);
      }
      case PostAudience.CUSTOM:
        return (
          user.role === UserRole.ADMIN ||
          post.authorId === user.id ||
          post.targets.some((t) => t.userId === user.id)
        );
      default:
        return false;
    }
  }

  async unreadCount(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
    staffProfile?: {
      assignedClassId?: string | null;
      classAssignments?: { schoolClassId: string }[];
    } | null;
  }) {
    const feed = await this.feed(user);
    return { count: feed.filter((post) => post.isUnread).length };
  }

  async markFeedRead(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
    staffProfile?: {
      assignedClassId?: string | null;
      classAssignments?: { schoolClassId: string }[];
    } | null;
  }) {
    const feed = await this.feed(user);
    const unreadIds = feed.filter((post) => post.isUnread).map((post) => post.id);
    if (!unreadIds.length) return { marked: 0 };

    await this.prisma.postRead.createMany({
      data: unreadIds.map((postId) => ({ postId, userId: user.id })),
      skipDuplicates: true,
    });

    return { marked: unreadIds.length };
  }

  findAll() {
    return this.prisma.post.findMany({
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: true,
        targets: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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
