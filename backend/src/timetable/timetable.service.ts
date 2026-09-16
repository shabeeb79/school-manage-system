import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WeekDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assignedClassIdsFromStaff } from '../users/staff-classes';
import {
  CreateTimetablePeriodDto,
  UpdateTimetablePeriodDto,
  UpsertTimetableEntryDto,
} from './dto/timetable.dto';

const WEEK_DAYS: WeekDay[] = [
  WeekDay.MONDAY,
  WeekDay.TUESDAY,
  WeekDay.WEDNESDAY,
  WeekDay.THURSDAY,
  WeekDay.FRIDAY,
  WeekDay.SATURDAY,
  WeekDay.SUNDAY,
];

const DEFAULT_PERIODS = [
  { startTime: '09:00', endTime: '10:00' },
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '11:30', endTime: '12:30' },
  { startTime: '13:30', endTime: '14:30' },
  { startTime: '14:30', endTime: '15:30' },
];

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class TimetableService {
  constructor(private prisma: PrismaService) {}

  private async assertStaff(userId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: {
        assignedClass: true,
        classAssignments: { select: { schoolClassId: true } },
      },
    });
    if (!staff) {
      throw new ForbiddenException('Staff profile required');
    }
    return staff;
  }

  private periodInclude() {
    return {
      entries: {
        include: {
          schoolClass: {
            select: { id: true, name: true, section: true },
          },
        },
      },
    } as const;
  }

  private validateTimes(startTime: string, endTime: string) {
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }
  }

  async getMine(staffUserId: string) {
    await this.assertStaff(staffUserId);
    let periods = await this.prisma.timetablePeriod.findMany({
      where: { staffUserId },
      include: this.periodInclude(),
      orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
    });

    if (!periods.length) {
      periods = await this.seedDefaults(staffUserId);
    }

    return {
      days: WEEK_DAYS,
      periods: periods.map((period) => this.shapePeriod(period)),
    };
  }

  private shapePeriod(period: {
    id: string;
    startTime: string;
    endTime: string;
    sortOrder: number;
    entries: Array<{
      id: string;
      dayOfWeek: WeekDay;
      schoolClassId: string | null;
      schoolClass: { id: string; name: string; section: string } | null;
    }>;
  }) {
    const byDay = Object.fromEntries(
      WEEK_DAYS.map((day) => [
        day,
        null as null | {
          id: string;
          schoolClassId: string | null;
          schoolClass: { id: string; name: string; section: string } | null;
        },
      ]),
    );
    for (const entry of period.entries) {
      byDay[entry.dayOfWeek] = {
        id: entry.id,
        schoolClassId: entry.schoolClassId,
        schoolClass: entry.schoolClass,
      };
    }
    return {
      id: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
      sortOrder: period.sortOrder,
      entriesByDay: byDay,
    };
  }

  private async seedDefaults(staffUserId: string) {
    await this.prisma.$transaction(
      DEFAULT_PERIODS.map((slot, index) =>
        this.prisma.timetablePeriod.create({
          data: {
            staffUserId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            sortOrder: index,
            entries: {
              create: WEEK_DAYS.map((dayOfWeek) => ({ dayOfWeek })),
            },
          },
        }),
      ),
    );

    return this.prisma.timetablePeriod.findMany({
      where: { staffUserId },
      include: this.periodInclude(),
      orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
    });
  }

  async addPeriod(staffUserId: string, dto: CreateTimetablePeriodDto) {
    await this.assertStaff(staffUserId);
    this.validateTimes(dto.startTime, dto.endTime);

    const last = await this.prisma.timetablePeriod.findFirst({
      where: { staffUserId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const period = await this.prisma.timetablePeriod.create({
      data: {
        staffUserId,
        startTime: dto.startTime,
        endTime: dto.endTime,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        entries: {
          create: WEEK_DAYS.map((dayOfWeek) => ({ dayOfWeek })),
        },
      },
      include: this.periodInclude(),
    });

    return this.shapePeriod(period);
  }

  async updatePeriod(
    staffUserId: string,
    periodId: string,
    dto: UpdateTimetablePeriodDto,
  ) {
    const period = await this.prisma.timetablePeriod.findUnique({
      where: { id: periodId },
    });
    if (!period || period.staffUserId !== staffUserId) {
      throw new NotFoundException('Period not found');
    }

    const startTime = dto.startTime ?? period.startTime;
    const endTime = dto.endTime ?? period.endTime;
    this.validateTimes(startTime, endTime);

    const updated = await this.prisma.timetablePeriod.update({
      where: { id: periodId },
      data: { startTime, endTime },
      include: this.periodInclude(),
    });
    return this.shapePeriod(updated);
  }

  async removePeriod(staffUserId: string, periodId: string) {
    const period = await this.prisma.timetablePeriod.findUnique({
      where: { id: periodId },
    });
    if (!period || period.staffUserId !== staffUserId) {
      throw new NotFoundException('Period not found');
    }
    await this.prisma.timetablePeriod.delete({ where: { id: periodId } });
    return { ok: true };
  }

  async upsertEntry(staffUserId: string, dto: UpsertTimetableEntryDto) {
    const staff = await this.assertStaff(staffUserId);
    const period = await this.prisma.timetablePeriod.findUnique({
      where: { id: dto.periodId },
    });
    if (!period || period.staffUserId !== staffUserId) {
      throw new NotFoundException('Period not found');
    }

    const classId = dto.schoolClassId || null;
    if (classId) {
      const allowed = assignedClassIdsFromStaff(staff);
      if (!allowed.includes(classId)) {
        throw new ForbiddenException(
          'You can only assign your teaching classes to the timetable',
        );
      }
    }

    const entry = await this.prisma.timetableEntry.upsert({
      where: {
        periodId_dayOfWeek: {
          periodId: dto.periodId,
          dayOfWeek: dto.dayOfWeek,
        },
      },
      create: {
        periodId: dto.periodId,
        dayOfWeek: dto.dayOfWeek,
        schoolClassId: classId,
      },
      update: { schoolClassId: classId },
      include: {
        schoolClass: { select: { id: true, name: true, section: true } },
      },
    });

    return entry;
  }
}
