import { Injectable, NotFoundException } from '@nestjs/common';
import { FeeStatus, UserRole } from '@prisma/client';
import { listTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeeDto, PayFeeDto } from './dto/fee.dto';

@Injectable()
export class FeesService {
  constructor(private prisma: PrismaService) {}

  create(createdById: string, dto: CreateFeeDto) {
    return this.prisma.fee.create({
      data: {
        studentId: dto.studentId,
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdById,
        status: FeeStatus.PENDING,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async list(user: { id: string; role: UserRole }, studentId?: string) {
    const where: { studentId?: string } = {};
    if (user.role === UserRole.STUDENT) where.studentId = user.id;
    else if (studentId) where.studentId = studentId;

    return this.prisma.fee.findMany({
      where,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(undefined, 100, 200),
    });
  }

  async pay(id: string, dto: PayFeeDto) {
    const fee = await this.prisma.fee.findUnique({ where: { id } });
    if (!fee) throw new NotFoundException('Fee not found');

    const amountPaid = Number(fee.amountPaid) + dto.amount;
    const total = Number(fee.amount);
    let status: FeeStatus = FeeStatus.PARTIAL;
    let paidAt: Date | undefined;

    if (amountPaid >= total) {
      status = FeeStatus.PAID;
      paidAt = new Date();
    } else if (amountPaid <= 0) {
      status = FeeStatus.PENDING;
    }

    return this.prisma.fee.update({
      where: { id },
      data: {
        amountPaid: Math.min(amountPaid, total),
        status,
        paidAt,
      },
    });
  }

  async remove(id: string) {
    const fee = await this.prisma.fee.findUnique({ where: { id } });
    if (!fee) throw new NotFoundException('Fee not found');
    return this.prisma.fee.delete({ where: { id } });
  }
}
