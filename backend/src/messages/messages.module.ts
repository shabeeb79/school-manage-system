import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesRealtimeService } from './messages-realtime.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRealtimeService],
  exports: [MessagesRealtimeService],
})
export class MessagesModule {}
