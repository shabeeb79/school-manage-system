import { IsOptional, IsString } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name: string;

  @IsString()
  gradeLevel: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  academicYear?: string;
}
