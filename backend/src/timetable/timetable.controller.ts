import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { TimetableService } from './timetable.service';
import {
  CreateTimetablePeriodDto,
  UpdateTimetablePeriodDto,
  UpsertTimetableEntryDto,
} from './dto/timetable.dto';

@Controller('timetable')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF)
export class TimetableController {
  constructor(private timetable: TimetableService) {}

  @Get('mine')
  mine(@CurrentUser() user: { id: string }) {
    return this.timetable.getMine(user.id);
  }

  @Post('periods')
  addPeriod(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTimetablePeriodDto,
  ) {
    return this.timetable.addPeriod(user.id, dto);
  }

  @Patch('periods/:id')
  updatePeriod(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateTimetablePeriodDto,
  ) {
    return this.timetable.updatePeriod(user.id, id, dto);
  }

  @Delete('periods/:id')
  removePeriod(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.timetable.removePeriod(user.id, id);
  }

  @Put('entries')
  upsertEntry(
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertTimetableEntryDto,
  ) {
    return this.timetable.upsertEntry(user.id, dto);
  }
}
