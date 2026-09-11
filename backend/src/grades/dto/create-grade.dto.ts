import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateGradeDto {
  @IsUUID()
  studentId: string;

  @IsString()
  subject: string;

  @IsString()
  examName: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(1)
  maxScore: number;

  @IsOptional()
  @IsString()
  gradeLetter?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  term?: string;
}
