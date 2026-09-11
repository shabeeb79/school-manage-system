import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, ReviewLeaveDto } from './dto/leave.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('leave')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(private leave: LeaveService) {}

  @Post()
  @Roles(UserRole.STAFF, UserRole.STUDENT)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateLeaveDto) {
    return this.leave.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: { id: string; role: UserRole }) {
    return this.leave.list(user);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  review(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.leave.review(id, user, dto);
  }
}
