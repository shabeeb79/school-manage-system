import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateClassDto) {
    return this.prisma.schoolClass.create({ data: dto });
  }

  findAll() {
    return this.prisma.schoolClass.findMany({
      include: {
        _count: {
          select: {
            students: true,
            staff: true,
            classAssignments: true,
          },
        },
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        classAssignments: {
          include: {
            staffProfile: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const schoolClass = await this.prisma.schoolClass.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        staff: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        classAssignments: {
          include: {
            staffProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!schoolClass) throw new NotFoundException('Class not found');
    return schoolClass;
  }

  async update(id: string, dto: Partial<CreateClassDto>) {
    await this.findOne(id);
    return this.prisma.schoolClass.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.schoolClass.delete({ where: { id } });
  }
}
