import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('posts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PostsController {
  constructor(private posts: PostsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreatePostDto) {
    return this.posts.create(user.id, dto);
  }

  @Get('feed')
  feed(
    @CurrentUser()
    user: {
      id: string;
      role: UserRole;
      studentProfile?: { schoolClassId?: string | null } | null;
    },
  ) {
    return this.posts.feed(user);
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
