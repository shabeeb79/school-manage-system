import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Post()
  send(@CurrentUser() user: { id: string }, @Body() dto: SendMessageDto) {
    return this.messages.send(user.id, dto);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: { id: string }) {
    return this.messages.inbox(user.id);
  }

  @Get('sent')
  sent(@CurrentUser() user: { id: string }) {
    return this.messages.sent(user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.messages.markRead(id, user.id);
  }
}
