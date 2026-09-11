import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LeaveStatus } from '@prisma/client';

export class CreateLeaveDto {
  @IsString()
  reason: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

export class ReviewLeaveDto {
  @IsEnum(LeaveStatus)
  status: LeaveStatus;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
