import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private classes: ClassesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateClassDto) {
    return this.classes.create(dto);
  }

  @Get()
  findAll() {
    return this.classes.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classes.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateClassDto>) {
    return this.classes.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.classes.remove(id);
  }
}
