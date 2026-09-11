import { IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  receiverId: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;
}
