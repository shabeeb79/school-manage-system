import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PostAudience } from '@prisma/client';

export class CreatePostDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(PostAudience)
  audience: PostAudience;

  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
