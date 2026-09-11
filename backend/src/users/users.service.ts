import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

type StudentWriteInput = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  schoolClassId?: string;
  teacherEmail?: string;
  enrollmentDate?: string;
};

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

  private async resolveClassFromTeacherEmail(teacherEmail?: string) {
    if (!teacherEmail?.trim()) return undefined;
    const teacher = await this.prisma.user.findUnique({
      where: { email: teacherEmail.toLowerCase().trim() },
      include: { staffProfile: true },
    });
    if (!teacher?.staffProfile) {
      throw new BadRequestException('Teacher email not found');
    }
    if (!teacher.staffProfile.assignedClassId) {
      throw new BadRequestException('Teacher has no assigned class');
    }
    return teacher.staffProfile.assignedClassId;
  }

  private parseEnrollmentDate(value?: string) {
    if (!value?.trim()) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid enrollment date');
    }
    return date;
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
      teacherEmail?: string;
      enrollmentDate?: string;
    },
  ) {
    const email = data.email.toLowerCase().trim();
    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    if (!data.studentId?.trim()) {
      throw new BadRequestException('studentId is required');
    }

    let schoolClassId =
      (await this.resolveClassFromTeacherEmail(data.teacherEmail)) ??
      data.schoolClassId;

    if (actor.role === UserRole.STAFF) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: actor.id },
      });
      if (!staff?.assignedClassId) {
        throw new BadRequestException('You have no assigned class');
      }
      schoolClassId = staff.assignedClassId;
    } else if (!schoolClassId) {
      throw new BadRequestException('schoolClassId or teacherEmail is required');
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
            enrollmentDate:
              this.parseEnrollmentDate(data.enrollmentDate) ?? new Date(),
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

  private async applyStudentUpdate(
    studentUserId: string,
    data: StudentWriteInput,
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const schoolClassId =
      (await this.resolveClassFromTeacherEmail(data.teacherEmail)) ??
      data.schoolClassId;

    const { firstName, lastName, enrollmentDate, studentId, ...rest } = data;
    if (firstName !== undefined || lastName !== undefined) {
      await this.prisma.user.update({
        where: { id: studentUserId },
        data: {
          ...(firstName !== undefined ? { firstName: firstName.trim() } : {}),
          ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
        },
      });
    }

    if (studentId !== undefined) {
      const trimmed = studentId.trim();
      if (!trimmed) throw new BadRequestException('studentId is required');
      const taken = await this.prisma.studentProfile.findUnique({
        where: { studentId: trimmed },
      });
      if (taken && taken.userId !== studentUserId) {
        throw new BadRequestException('Student ID already exists');
      }
    }

    return this.prisma.studentProfile.update({
      where: { userId: studentUserId },
      data: {
        ...(rest.parentName !== undefined
          ? { parentName: rest.parentName?.trim() || null }
          : {}),
        ...(rest.parentPhone !== undefined
          ? { parentPhone: rest.parentPhone?.trim() || null }
          : {}),
        ...(rest.address !== undefined
          ? { address: rest.address?.trim() || null }
          : {}),
        ...(schoolClassId !== undefined ? { schoolClassId } : {}),
        ...(studentId !== undefined ? { studentId: studentId.trim() } : {}),
        ...(enrollmentDate !== undefined
          ? { enrollmentDate: this.parseEnrollmentDate(enrollmentDate) ?? null }
          : {}),
      },
      include: { user: true, schoolClass: true },
    });
  }

  async updateStudent(
    staffUserId: string,
    studentUserId: string,
    data: StudentWriteInput,
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

    return this.applyStudentUpdate(studentUserId, {
      ...data,
      schoolClassId: undefined,
      teacherEmail: undefined,
      studentId: undefined,
      enrollmentDate: undefined,
    });
  }

  async adminUpdateStudent(studentUserId: string, data: StudentWriteInput) {
    return this.applyStudentUpdate(studentUserId, data);
  }

  async updateStaff(
    staffUserId: string,
    data: {
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
    const user = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { staffProfile: true },
    });
    if (!user || user.role !== UserRole.STAFF || !user.staffProfile) {
      throw new NotFoundException('Teacher not found');
    }

    if (data.email) {
      const email = data.email.toLowerCase().trim();
      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists && exists.id !== staffUserId) {
        throw new BadRequestException('Email already registered');
      }
    }

    if (data.employeeId) {
      const trimmed = data.employeeId.trim();
      const taken = await this.prisma.staffProfile.findUnique({
        where: { employeeId: trimmed },
      });
      if (taken && taken.userId !== staffUserId) {
        throw new BadRequestException('Teacher ID already exists');
      }
    }

    await this.prisma.user.update({
      where: { id: staffUserId },
      data: {
        ...(data.firstName !== undefined
          ? { firstName: data.firstName.trim() }
          : {}),
        ...(data.lastName !== undefined
          ? { lastName: data.lastName.trim() }
          : {}),
        ...(data.email !== undefined
          ? { email: data.email.toLowerCase().trim() }
          : {}),
      },
    });

    return this.prisma.staffProfile.update({
      where: { userId: staffUserId },
      data: {
        ...(data.employeeId !== undefined
          ? { employeeId: data.employeeId.trim() }
          : {}),
        ...(data.assignedClassId !== undefined
          ? { assignedClassId: data.assignedClassId || null }
          : {}),
        ...(data.department !== undefined
          ? { department: data.department?.trim() || null }
          : {}),
        ...(data.subject !== undefined
          ? { subject: data.subject?.trim() || null }
          : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone?.trim() || null }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
        assignedClass: true,
      },
    });
  }

  async updateAdmin(
    adminUserId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });
    if (!user || user.role !== UserRole.ADMIN) {
      throw new NotFoundException('Admin not found');
    }

    if (data.email) {
      const email = data.email.toLowerCase().trim();
      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists && exists.id !== adminUserId) {
        throw new BadRequestException('Email already registered');
      }
    }

    return this.prisma.user.update({
      where: { id: adminUserId },
      data: {
        ...(data.firstName !== undefined
          ? { firstName: data.firstName.trim() }
          : {}),
        ...(data.lastName !== undefined
          ? { lastName: data.lastName.trim() }
          : {}),
        ...(data.email !== undefined
          ? { email: data.email.toLowerCase().trim() }
          : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
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
