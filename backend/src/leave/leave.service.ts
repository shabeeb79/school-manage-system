import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveDto, ReviewLeaveDto } from './dto/leave.dto';

const requesterSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  email: true,
  studentProfile: {
    select: {
      studentId: true,
      schoolClass: { select: { id: true, name: true, section: true } },
    },
  },
  staffProfile: {
    select: {
      employeeId: true,
      assignedClass: { select: { id: true, name: true } },
    },
  },
} as const;

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  create(requesterId: string, dto: CreateLeaveDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid leave dates');
    }
    if (end < start) {
      throw new BadRequestException('End date must be on or after start date');
    }

    return this.prisma.leaveRequest.create({
      data: {
        requesterId,
        reason: dto.reason.trim(),
        startDate: start,
        endDate: end,
      },
      include: {
        requester: { select: requesterSelect },
      },
    });
  }

  async list(user: { id: string; role: UserRole }) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.leaveRequest.findMany({
        include: {
          requester: { select: requesterSelect },
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
          requester: { select: requesterSelect },
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
        requester: { select: requesterSelect },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(
    id: string,
    reviewer: { id: string; role: UserRole },
    dto: ReviewLeaveDto,
  ) {
    if (dto.status === LeaveStatus.PENDING) {
      throw new BadRequestException('Status must be APPROVED or REJECTED');
    }

    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            role: true,
            studentProfile: { select: { schoolClassId: true } },
          },
        },
      },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Leave request was already reviewed');
    }
    if (leave.requesterId === reviewer.id) {
      throw new ForbiddenException('You cannot review your own leave request');
    }

    if (leave.requester.role === UserRole.STUDENT) {
      if (reviewer.role !== UserRole.STAFF) {
        throw new ForbiddenException(
          'Only the class teacher can review student leave',
        );
      }
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: reviewer.id },
      });
      if (
        !staff?.assignedClassId ||
        staff.assignedClassId !== leave.requester.studentProfile?.schoolClassId
      ) {
        throw new ForbiddenException(
          'You can only review leave for students in your assigned class',
        );
      }
    } else if (leave.requester.role === UserRole.STAFF) {
      if (reviewer.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only admin can review teacher leave');
      }
    } else {
      throw new ForbiddenException('This leave request cannot be reviewed');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewNote: dto.reviewNote?.trim() || undefined,
        reviewedById: reviewer.id,
        reviewedAt: new Date(),
      },
      include: {
        requester: { select: requesterSelect },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
