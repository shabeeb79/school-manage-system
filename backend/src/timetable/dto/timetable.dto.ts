import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { WeekDay } from '@prisma/client';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateTimetablePeriodDto {
  @IsString()
  @Matches(TIME_RE, { message: 'startTime must be HH:mm (24h)' })
  startTime!: string;

  @IsString()
  @Matches(TIME_RE, { message: 'endTime must be HH:mm (24h)' })
  endTime!: string;
}

export class UpdateTimetablePeriodDto {
  @IsOptional()
  @IsString()
  @Matches(TIME_RE, { message: 'startTime must be HH:mm (24h)' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_RE, { message: 'endTime must be HH:mm (24h)' })
  endTime?: string;
}

export class UpsertTimetableEntryDto {
  @IsString()
  periodId!: string;

  @IsEnum(WeekDay)
  dayOfWeek!: WeekDay;

  /** Pass null or omit to clear the cell. */
  @IsOptional()
  schoolClassId?: string | null;
}
