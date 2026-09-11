import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  findAll(@Query('role') role?: UserRole) {
    return this.users.findAll(role);
  }

  @Get('my-students')
  @Roles(UserRole.STAFF)
  myStudents(@CurrentUser() user: { id: string }) {
    return this.users.getAssignedStudents(user.id);
  }

  @Post('students')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  createStudent(
    @CurrentUser() user: { id: string; role: UserRole },
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      studentId: string;
      parentName?: string;
      parentPhone?: string;
      address?: string;
      schoolClassId?: string;
      teacherEmail?: string;
      enrollmentDate?: string;
    },
  ) {
    return this.users.createStudent(user, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch('students/:studentUserId')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  updateStudent(
    @CurrentUser() user: { id: string; role: UserRole },
    @Param('studentUserId') studentUserId: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      studentId?: string;
      parentName?: string;
      parentPhone?: string;
      address?: string;
      schoolClassId?: string;
      teacherEmail?: string;
      enrollmentDate?: string;
    },
  ) {
    if (user.role === UserRole.ADMIN) {
      return this.users.adminUpdateStudent(studentUserId, body);
    }
    return this.users.updateStudent(user.id, studentUserId, body);
  }

  @Patch('staff/:staffUserId')
  @Roles(UserRole.ADMIN)
  updateStaff(
    @Param('staffUserId') staffUserId: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      employeeId?: string;
      assignedClassId?: string | null;
      department?: string;
      subject?: string;
      phone?: string;
    },
  ) {
    return this.users.updateStaff(staffUserId, body);
  }

  @Patch('admins/:adminUserId')
  @Roles(UserRole.ADMIN)
  updateAdmin(
    @Param('adminUserId') adminUserId: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
    },
  ) {
    return this.users.updateAdmin(adminUserId, body);
  }

  @Patch(':id/active')
  @Roles(UserRole.ADMIN)
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.users.setActive(id, isActive);
  }
}
