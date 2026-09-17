import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { listTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { resolveClassTeacherClassId } from '../users/staff-classes';

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

  async mark(
    markedById: string,
    dto: MarkAttendanceDto,
    staffHomeroomId?: string | null,
  ) {
    const homeroomId =
      staffHomeroomId ??
      (await resolveClassTeacherClassId(this.prisma, markedById));
    if (!homeroomId) {
      throw new ForbiddenException(
        'Only class teachers can mark attendance',
      );
    }

    const schoolClassId = dto.schoolClassId ?? homeroomId;
    if (schoolClassId !== homeroomId) {
      throw new ForbiddenException(
        'You can only mark attendance for your class-teacher class',
      );
    }

    const classStudents = await this.prisma.studentProfile.findMany({
      where: { schoolClassId },
      select: { userId: true },
    });
    const allowed = new Set(classStudents.map((s) => s.userId));
    const date = parseDateOnly(dto.date);
    const entries = dto.entries.filter((entry) => allowed.has(entry.studentId));
    if (!entries.length) return [];

    // Parallel upserts in one transaction (N queries, one round-trip batch).
    const results = await this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.attendance.upsert({
          where: {
            studentId_date: { studentId: entry.studentId, date },
          },
          create: {
            studentId: entry.studentId,
            date,
            status: entry.status,
            remarks: entry.remarks,
            schoolClassId,
            markedById,
          },
          update: {
            status: entry.status,
            remarks: entry.remarks,
            schoolClassId,
            markedById,
          },
          select: {
            id: true,
            studentId: true,
            date: true,
            status: true,
            remarks: true,
            schoolClassId: true,
            student: {
              select: { id: true, firstName: true, lastName: true },
            },
            schoolClass: {
              select: { id: true, name: true, section: true },
            },
          },
        }),
      ),
    );
    return results;
  }

  async list(params: {
    userId: string;
    role: UserRole;
    date?: string;
    studentId?: string;
    schoolClassId?: string;
    staffHomeroomId?: string | null;
  }) {
    const where: Record<string, unknown> = {};
    if (params.date) where.date = parseDateOnly(params.date);
    if (params.schoolClassId) where.schoolClassId = params.schoolClassId;

    if (params.role === UserRole.STUDENT) {
      where.studentId = params.userId;
    } else if (params.studentId) {
      where.studentId = params.studentId;
    } else if (params.role === UserRole.STAFF) {
      const homeroomId =
        params.staffHomeroomId !== undefined
          ? params.staffHomeroomId
          : await resolveClassTeacherClassId(this.prisma, params.userId);
      if (!homeroomId) {
        return [];
      } else if (params.schoolClassId && params.schoolClassId !== homeroomId) {
        throw new ForbiddenException(
          'You can only view attendance for your class-teacher class',
        );
      } else {
        const classStudents = await this.prisma.studentProfile.findMany({
          where: { schoolClassId: homeroomId },
          select: { userId: true },
        });
        const studentIds = classStudents.map((s) => s.userId);
        where.OR = [
          { schoolClassId: homeroomId },
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
        schoolClass: {
          select: { id: true, name: true, section: true, academicYear: true },
        },
        markedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
      take: listTake(undefined, 200, 500),
    });
  }
}
