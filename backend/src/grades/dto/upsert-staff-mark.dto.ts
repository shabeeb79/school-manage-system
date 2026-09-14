import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpsertStaffMarkDto {
  @IsUUID()
  studentId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(999)
  score: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(999)
  maxScore?: number;
}
