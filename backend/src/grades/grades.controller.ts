import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpsertStaffMarkDto } from './dto/upsert-staff-mark.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(private grades: GradesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateGradeDto) {
    return this.grades.create(user.id, dto);
  }

  @Put('my-mark')
  @Roles(UserRole.STAFF)
  upsertMyMark(
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertStaffMarkDto,
  ) {
    return this.grades.upsertStaffMark(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: { id: string; role: UserRole },
    @Query('studentId') studentId?: string,
  ) {
    return this.grades.list(user, studentId);
  }

  @Get('my-class')
  @Roles(UserRole.STAFF)
  myClass(
    @CurrentUser() user: { id: string },
    @Query('schoolClassId') schoolClassId?: string,
  ) {
    return this.grades.staffClassMarks(user.id, schoolClassId);
  }

  @Get('toppers')
  @Roles(UserRole.ADMIN)
  toppers() {
    return this.grades.toppers();
  }

  @Get('card/:studentId')
  gradeCard(
    @CurrentUser() user: { id: string; role: UserRole },
    @Param('studentId') studentId: string,
  ) {
    const id = user.role === UserRole.STUDENT ? user.id : studentId;
    return this.grades.gradeCard(id);
  }

  @Get('my-card')
  @Roles(UserRole.STUDENT)
  myCard(@CurrentUser() user: { id: string }) {
    return this.grades.gradeCard(user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  remove(@Param('id') id: string) {
    return this.grades.remove(id);
  }
}
