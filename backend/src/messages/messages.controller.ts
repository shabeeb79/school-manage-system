import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessageKind } from '@prisma/client';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { Observable } from 'rxjs';
import { MessagesService } from './messages.service';
import { MessagesRealtimeService } from './messages-realtime.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageWebhookDto } from './dto/message-webhook.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

const MAX_VOICE_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'messages');

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private messages: MessagesService,
    private realtime: MessagesRealtimeService,
  ) {}

  @Post()
  send(@CurrentUser() user: { id: string }, @Body() dto: SendMessageDto) {
    return this.messages.send(user.id, dto);
  }

  @Post('media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = extname(file.originalname).toLowerCase() || '.bin';
          cb(null, `${unique}${ext}`);
        },
      }),
      limits: { fileSize: MAX_VOICE_BYTES },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('audio/') ||
          file.mimetype === 'video/webm';
        if (ok) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'Only photo or voice audio uploads are allowed',
          ) as any,
          false,
        );
      },
    }),
  )
  sendMedia(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
    @Body('receiverId') receiverId: string,
    @Body('kind') kindRaw: string,
    @Body('body') body?: string,
  ) {
    if (!receiverId) {
      throw new BadRequestException('receiverId is required');
    }
    const kind =
      kindRaw === 'VOICE'
        ? MessageKind.VOICE
        : kindRaw === 'PHOTO'
          ? MessageKind.PHOTO
          : null;
    if (!kind) {
      throw new BadRequestException('kind must be VOICE or PHOTO');
    }
    return this.messages.sendMedia(user.id, receiverId, kind, file, body);
  }

  /** External/internal webhook: push a refresh signal to connected clients. */
  @Post('webhook')
  webhook(@Body() dto: MessageWebhookDto) {
    return this.realtime.notifyWebhook(dto);
  }

  /** SSE stream — browser listens here; events trigger a poll/refresh. */
  @Sse('events')
  events(@CurrentUser() user: { id: string }): Observable<MessageEvent> {
    return this.realtime.streamFor(user.id);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: { id: string }) {
    return this.messages.inbox(user.id);
  }

  @Get('sent')
  sent(@CurrentUser() user: { id: string }) {
    return this.messages.sent(user.id);
  }

  @Get('contacts')
  contacts(@CurrentUser() user: { id: string }) {
    return this.messages.contacts(user.id);
  }

  @Get('conversations')
  conversations(@CurrentUser() user: { id: string }) {
    return this.messages.conversations(user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { id: string }) {
    return this.messages.unreadCount(user.id);
  }

  @Get('with/:peerId')
  thread(
    @CurrentUser() user: { id: string },
    @Param('peerId') peerId: string,
  ) {
    return this.messages.thread(user.id, peerId);
  }

  @Patch('with/:peerId/read')
  markThreadRead(
    @CurrentUser() user: { id: string },
    @Param('peerId') peerId: string,
  ) {
    return this.messages.markThreadRead(user.id, peerId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.messages.markRead(id, user.id);
  }
}
