import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

class AttendanceEntryDto {
  @IsUUID()
  studentId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class MarkAttendanceDto {
  @IsString()
  date: string;

  @IsOptional()
  @IsUUID()
  schoolClassId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}
