import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto, ReviewLeaveDto } from './dto/leave.dto';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  create(requesterId: string, dto: CreateLeaveDto) {
    return this.prisma.leaveRequest.create({
      data: {
        requesterId,
        reason: dto.reason,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
  }

  async list(user: { id: string; role: UserRole }) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.leaveRequest.findMany({
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === UserRole.STAFF) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: user.id },
      });
      const studentIds = staff?.assignedClassId
        ? (
            await this.prisma.studentProfile.findMany({
              where: { schoolClassId: staff.assignedClassId },
              select: { userId: true },
            })
          ).map((s) => s.userId)
        : [];

      return this.prisma.leaveRequest.findMany({
        where: {
          OR: [{ requesterId: user.id }, { requesterId: { in: studentIds } }],
        },
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              email: true,
            },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.leaveRequest.findMany({
      where: { requesterId: user.id },
      include: {
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(id: string, reviewerId: string, dto: ReviewLeaveDto) {
    if (dto.status === LeaveStatus.PENDING) {
      throw new BadRequestException('Status must be APPROVED or REJECTED');
    }
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Leave request not found');

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
