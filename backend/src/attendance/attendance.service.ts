import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async mark(markedById: string, dto: MarkAttendanceDto) {
    const date = new Date(dto.date);
    const results = [];
    for (const entry of dto.entries) {
      const record = await this.prisma.attendance.upsert({
        where: {
          studentId_date: { studentId: entry.studentId, date },
        },
        create: {
          studentId: entry.studentId,
          date,
          status: entry.status,
          remarks: entry.remarks,
          schoolClassId: dto.schoolClassId,
          markedById,
        },
        update: {
          status: entry.status,
          remarks: entry.remarks,
          schoolClassId: dto.schoolClassId,
          markedById,
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
      results.push(record);
    }
    return results;
  }

  async list(params: {
    userId: string;
    role: UserRole;
    date?: string;
    studentId?: string;
    schoolClassId?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.date) where.date = new Date(params.date);
    if (params.schoolClassId) where.schoolClassId = params.schoolClassId;

    if (params.role === UserRole.STUDENT) {
      where.studentId = params.userId;
    } else if (params.studentId) {
      where.studentId = params.studentId;
    } else if (params.role === UserRole.STAFF) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: params.userId },
      });
      if (staff?.assignedClassId) {
        where.schoolClassId = staff.assignedClassId;
      }
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        schoolClass: true,
        markedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
    });
  }
}
