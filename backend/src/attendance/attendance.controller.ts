import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  mark(@CurrentUser() user: { id: string }, @Body() dto: MarkAttendanceDto) {
    return this.attendance.mark(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: { id: string; role: UserRole },
    @Query('date') date?: string,
    @Query('studentId') studentId?: string,
    @Query('schoolClassId') schoolClassId?: string,
  ) {
    return this.attendance.list({
      userId: user.id,
      role: user.role,
      date,
      studentId,
      schoolClassId,
    });
  }
}
