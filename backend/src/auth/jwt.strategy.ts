import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
import { AuthUserCache } from './auth-user.cache';

function jwtFromQuery(req: Request): string | null {
  const token = req?.query?.token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/** Lean profile payload for request auth (enough for feed/attendance/role checks). */
const authUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  studentProfile: {
    select: {
      id: true,
      studentId: true,
      schoolClassId: true,
      schoolClass: {
        select: { id: true, name: true, section: true },
      },
    },
  },
  staffProfile: {
    select: {
      id: true,
      employeeId: true,
      subject: true,
      assignedClassId: true,
      assignedClass: {
        select: { id: true, name: true, section: true },
      },
      classAssignments: {
        select: {
          schoolClassId: true,
          schoolClass: {
            select: { id: true, name: true, section: true },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private userCache: AuthUserCache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        jwtFromQuery,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'school-manage-secret',
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const cached = this.userCache.get<Record<string, unknown>>(payload.sub);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: authUserSelect,
    });
    if (!user || !user.isActive) return null;

    this.userCache.set(user.id, user);
    return user;
  }
}
