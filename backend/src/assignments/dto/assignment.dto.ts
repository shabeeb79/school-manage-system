import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { SubmissionStatus } from '@prisma/client';

export class CreateAssignmentDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  subject: string;

  @IsString()
  dueDate: string;

  @IsUUID()
  schoolClassId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;
}

export class SubmitAssignmentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;
}

export class GradeSubmissionDto {
  @IsNumber()
  @Min(0)
  score: number;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class ReviewSubmissionDto {
  @IsEnum(SubmissionStatus)
  status: SubmissionStatus;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;
}
