import { Injectable, NotFoundException } from '@nestjs/common';
import { PostAudience, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: CreatePostDto) {
    const { targetUserIds, ...data } = dto;
    return this.prisma.post.create({
      data: {
        ...data,
        authorId,
        targets: targetUserIds?.length
          ? { create: targetUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: true,
        targets: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }

  async feed(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
  }) {
    const posts = await this.prisma.post.findMany({
      where: { isPublished: true },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        targetClass: true,
        targets: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return posts.filter((post) => {
      switch (post.audience) {
        case PostAudience.ALL:
          return true;
        case PostAudience.ADMIN:
          return user.role === UserRole.ADMIN;
        case PostAudience.STAFF:
          return user.role === UserRole.STAFF || user.role === UserRole.ADMIN;
        case PostAudience.STUDENT:
          return user.role === UserRole.STUDENT || user.role === UserRole.ADMIN;
        case PostAudience.CLASS:
          return (
            user.role === UserRole.ADMIN ||
            user.studentProfile?.schoolClassId === post.targetClassId
          );
        case PostAudience.CUSTOM:
          return (
            user.role === UserRole.ADMIN ||
            post.authorId === user.id ||
            post.targets.some((t) => t.userId === user.id)
          );
        default:
          return false;
      }
    });
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
    return this.prisma.post.delete({ where: { id } });
  }
}
