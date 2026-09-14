import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class MessageWebhookDto {
  @IsOptional()
  @IsIn(['message.created', 'message.read', 'messages.refresh'])
  type?: 'message.created' | 'message.read' | 'messages.refresh';

  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsOptional()
  @IsUUID()
  peerId?: string;

  @IsOptional()
  @IsString()
  messageId?: string;
}
