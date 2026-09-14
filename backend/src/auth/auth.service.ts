import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  assertSubjectAvailableForClasses,
  normalizeAssignedClassIds,
  staffProfileInclude,
  syncStaffClassAssignments,
} from '../users/staff-classes';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        studentProfile: { include: { schoolClass: true } },
        staffProfile: { include: staffProfileInclude },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { password: _, ...safe } = user;
    return { accessToken: this.signToken(user.id, user.email, user.role), user: safe };
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new BadRequestException('Email already registered');

    if (dto.role === UserRole.STUDENT && !dto.studentId) {
      throw new BadRequestException('studentId is required for students');
    }
    if (dto.role === UserRole.STAFF && !dto.employeeId) {
      throw new BadRequestException('employeeId is required for staff');
    }
    if (dto.role === UserRole.STAFF && !dto.subject) {
      throw new BadRequestException('subject is required for staff');
    }

    const assignedClassIds =
      dto.role === UserRole.STAFF
        ? (normalizeAssignedClassIds({
            assignedClassIds: dto.assignedClassIds,
          }) ??
          (dto.assignedClassId ? [dto.assignedClassId] : []))
        : [];

    // assignedClassId on the DTO is the class-teacher (homeroom) class when
    // assignedClassIds is also provided; otherwise treat singular as teaching+homeroom.
    const classTeacherClassId =
      dto.role === UserRole.STAFF
        ? dto.assignedClassIds?.length
          ? dto.assignedClassId || null
          : assignedClassIds[0] ?? null
        : null;

    if (dto.role === UserRole.STAFF && dto.subject && assignedClassIds.length) {
      await assertSubjectAvailableForClasses(this.prisma, {
        classIds: assignedClassIds,
        subject: dto.subject,
      });
    }

    if (
      classTeacherClassId &&
      assignedClassIds.length &&
      !assignedClassIds.includes(classTeacherClassId)
    ) {
      throw new BadRequestException(
        'Class teacher class must be one of the assigned teaching classes',
      );
    }

    const schoolClassId = dto.schoolClassId;
    const hashed = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashed,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        ...(dto.role === UserRole.STUDENT && {
          studentProfile: {
            create: {
              studentId: dto.studentId!,
              schoolClassId,
              parentName: dto.parentName,
              parentPhone: dto.parentPhone,
              enrollmentDate: dto.enrollmentDate
                ? new Date(dto.enrollmentDate)
                : new Date(),
            },
          },
        }),
        ...(dto.role === UserRole.STAFF && {
          staffProfile: {
            create: {
              employeeId: dto.employeeId!,
              assignedClassId: classTeacherClassId,
              department: dto.department,
              subject: dto.subject,
              phone: dto.phone?.trim() || undefined,
            },
          },
        }),
      },
      include: {
        studentProfile: { include: { schoolClass: true } },
        staffProfile: { include: staffProfileInclude },
      },
    });

    if (dto.role === UserRole.STAFF && user.staffProfile) {
      await syncStaffClassAssignments(
        this.prisma,
        user.staffProfile.id,
        assignedClassIds,
        classTeacherClassId,
      );
      const refreshed = await this.me(user.id);
      return {
        accessToken: this.signToken(user.id, user.email, user.role),
        user: refreshed,
      };
    }

    const { password: _, ...safe } = user;
    return { accessToken: this.signToken(user.id, user.email, user.role), user: safe };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: { include: { schoolClass: true } },
        staffProfile: { include: staffProfileInclude },
      },
    });
    if (!user) throw new UnauthorizedException();
    const { password: _, ...safe } = user;
    return safe;
  }

  private signToken(sub: string, email: string, role: UserRole) {
    return this.jwt.sign({ sub, email, role });
  }
}
