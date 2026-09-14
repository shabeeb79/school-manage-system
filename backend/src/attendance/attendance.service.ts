import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

/** Parse YYYY-MM-DD as a calendar date (no timezone shift). */
function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return new Date(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async mark(markedById: string, dto: MarkAttendanceDto) {
    const date = parseDateOnly(dto.date);
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
          schoolClass: true,
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
    if (params.date) where.date = parseDateOnly(params.date);
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
        const classStudents = await this.prisma.studentProfile.findMany({
          where: { schoolClassId: staff.assignedClassId },
          select: { userId: true },
        });
        const studentIds = classStudents.map((s) => s.userId);
        // Match by class id OR by students in the assigned class (covers older rows)
        where.OR = [
          { schoolClassId: staff.assignedClassId },
          ...(studentIds.length ? [{ studentId: { in: studentIds } }] : []),
        ];
      }
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentProfile: { select: { studentId: true } },
          },
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
