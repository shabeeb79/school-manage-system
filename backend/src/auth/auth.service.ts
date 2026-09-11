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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { studentProfile: true, staffProfile: true },
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
              schoolClassId: dto.schoolClassId,
              parentName: dto.parentName,
              parentPhone: dto.parentPhone,
            },
          },
        }),
        ...(dto.role === UserRole.STAFF && {
          staffProfile: {
            create: {
              employeeId: dto.employeeId!,
              assignedClassId: dto.assignedClassId,
              department: dto.department,
              subject: dto.subject,
            },
          },
        }),
      },
      include: { studentProfile: true, staffProfile: true },
    });

    const { password: _, ...safe } = user;
    return { accessToken: this.signToken(user.id, user.email, user.role), user: safe };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: { include: { schoolClass: true } },
        staffProfile: { include: { assignedClass: true } },
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
