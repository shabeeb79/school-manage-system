import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'posts');

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

type FeedUser = {
  id: string;
  role: UserRole;
  studentProfile?: { schoolClassId?: string | null } | null;
  staffProfile?: {
    assignedClassId?: string | null;
    classAssignments?: { schoolClassId: string }[];
  } | null;
};

@Controller('posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostsController {
  constructor(private posts: PostsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: MAX_MEDIA_BYTES },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('video/')
        ) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException('Only photo or video uploads are allowed') as any,
          false,
        );
      },
    }),
  )
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.posts.create(user.id, dto, file);
  }

  @Get('feed')
  feed(@CurrentUser() user: FeedUser) {
    return this.posts.feed(user);
  }

  @Get('feed/unread-count')
  unreadCount(@CurrentUser() user: FeedUser) {
    return this.posts.unreadCount(user);
  }

  @Patch('feed/read')
  markFeedRead(@CurrentUser() user: FeedUser) {
    return this.posts.markFeedRead(user);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.posts.findAll();
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.posts.remove(id);
  }
}
