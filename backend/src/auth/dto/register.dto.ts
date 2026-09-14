import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TeachingSubject, UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  schoolClassId?: string;

  /** @deprecated Prefer assignedClassIds */
  @IsOptional()
  @IsString()
  assignedClassId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedClassIds?: string[];

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(TeachingSubject)
  subject?: TeachingSubject;

  @IsOptional()
  @IsString()
  parentName?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  enrollmentDate?: string;
}
