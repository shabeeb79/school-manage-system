import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FeesService } from './fees.service';
import { CreateFeeDto, PayFeeDto } from './dto/fee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('fees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeesController {
  constructor(private fees: FeesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateFeeDto) {
    return this.fees.create(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: { id: string; role: UserRole },
    @Query('studentId') studentId?: string,
  ) {
    return this.fees.list(user, studentId);
  }

  @Patch(':id/pay')
  @Roles(UserRole.ADMIN, UserRole.STUDENT)
  pay(@Param('id') id: string, @Body() dto: PayFeeDto) {
    return this.fees.pay(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.fees.remove(id);
  }
}
