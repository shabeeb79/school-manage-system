import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MessageKind } from '@prisma/client';

export class SendMessageDto {
  @IsUUID()
  receiverId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsEnum(MessageKind)
  kind?: MessageKind;
}
