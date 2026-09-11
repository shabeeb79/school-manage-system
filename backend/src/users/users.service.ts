import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll(role?: UserRole) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        studentProfile: { include: { schoolClass: true } },
        staffProfile: { include: { assignedClass: true } },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        studentProfile: { include: { schoolClass: true } },
        staffProfile: { include: { assignedClass: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getAssignedStudents(staffUserId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
    });
    if (!staff?.assignedClassId) {
      return [];
    }
    return this.prisma.studentProfile.findMany({
      where: { schoolClassId: staff.assignedClassId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
        schoolClass: true,
      },
      orderBy: { studentId: 'asc' },
    });
  }

  async createStudent(
    actor: { id: string; role: UserRole },
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      studentId: string;
      parentName?: string;
      parentPhone?: string;
      address?: string;
      schoolClassId?: string;
    },
  ) {
    const email = data.email.toLowerCase().trim();
    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    if (!data.studentId?.trim()) {
      throw new BadRequestException('studentId is required');
    }

    let schoolClassId = data.schoolClassId;
    if (actor.role === UserRole.STAFF) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: actor.id },
      });
      if (!staff?.assignedClassId) {
        throw new BadRequestException('You have no assigned class');
      }
      schoolClassId = staff.assignedClassId;
    } else if (!schoolClassId) {
      throw new BadRequestException('schoolClassId is required');
    }

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email already registered');

    const studentIdTaken = await this.prisma.studentProfile.findUnique({
      where: { studentId: data.studentId.trim() },
    });
    if (studentIdTaken) {
      throw new BadRequestException('Student ID already exists');
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashed,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            studentId: data.studentId.trim(),
            schoolClassId,
            parentName: data.parentName?.trim() || undefined,
            parentPhone: data.parentPhone?.trim() || undefined,
            address: data.address?.trim() || undefined,
          },
        },
      },
      include: {
        studentProfile: { include: { schoolClass: true } },
      },
    });

    const { password: _, ...safe } = user;
    return safe;
  }

  async updateStudent(
    staffUserId: string,
    studentUserId: string,
    data: {
      firstName?: string;
      lastName?: string;
      parentName?: string;
      parentPhone?: string;
      address?: string;
      schoolClassId?: string;
    },
  ) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
    });
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (
      staff &&
      staff.assignedClassId &&
      student.schoolClassId !== staff.assignedClassId
    ) {
      throw new ForbiddenException('Student is not in your assigned class');
    }

    const { firstName, lastName, ...profileData } = data;
    if (firstName !== undefined || lastName !== undefined) {
      await this.prisma.user.update({
        where: { id: studentUserId },
        data: {
          ...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
          ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
        },
      });
    }

    return this.prisma.studentProfile.update({
      where: { userId: studentUserId },
      data: profileData,
      include: { user: true, schoolClass: true },
    });
  }

  async adminUpdateStudent(
    studentUserId: string,
    data: {
      firstName?: string;
      lastName?: string;
      parentName?: string;
      parentPhone?: string;
      address?: string;
      schoolClassId?: string;
    },
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const { firstName, lastName, ...profileData } = data;
    if (firstName !== undefined || lastName !== undefined) {
      await this.prisma.user.update({
        where: { id: studentUserId },
        data: {
          ...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
          ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
        },
      });
    }

    return this.prisma.studentProfile.update({
      where: { userId: studentUserId },
      data: profileData,
      include: { user: true, schoolClass: true },
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }
}
