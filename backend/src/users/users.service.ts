import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeachingSubject, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { listTake } from '../common/pagination';
import {
  assertSubjectAvailableForClasses,
  assignedClassIdsFromStaff,
  normalizeAssignedClassIds,
  staffProfileInclude,
  syncStaffClassAssignments,
} from './staff-classes';

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
        staffProfile: { include: staffProfileInclude },
      },
      orderBy: { lastName: 'asc' },
      take: listTake(undefined, 200, 500),
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
        staffProfile: { include: staffProfileInclude },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getAssignedStudents(staffUserId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
      include: { classAssignments: { select: { schoolClassId: true } } },
    });
    if (!staff) return [];

    const classIds = assignedClassIdsFromStaff(staff);
    if (!classIds.length) return [];

    return this.prisma.studentProfile.findMany({
      where: { schoolClassId: { in: classIds } },
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
      orderBy: [{ schoolClassId: 'asc' }, { studentId: 'asc' }],
    });
  }

  /** Class-teacher roster only (attendance). Empty if not a class teacher. */
  async getClassStudents(staffUserId: string, schoolClassId?: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
      select: { assignedClassId: true },
    });
    const homeroomId = staff?.assignedClassId;
    if (!homeroomId) return [];

    if (schoolClassId && schoolClassId !== homeroomId) {
      throw new ForbiddenException(
        'You can only mark attendance for your class-teacher class',
      );
    }

    return this.prisma.studentProfile.findMany({
      where: { schoolClassId: homeroomId },
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

    let schoolClassId = data.schoolClassId?.trim() || undefined;

    if (actor.role === UserRole.STAFF) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: actor.id },
        include: { classAssignments: { select: { schoolClassId: true } } },
      });
      if (!staff) {
        throw new ForbiddenException('Staff profile not found');
      }
      const allowed = assignedClassIdsFromStaff(staff);
      if (!allowed.length) {
        throw new ForbiddenException(
          'Assign at least one class to this teacher before adding students',
        );
      }
      if (!schoolClassId) {
        schoolClassId = allowed[0];
      } else if (!allowed.includes(schoolClassId)) {
        throw new ForbiddenException(
          'You can only add students to your assigned classes',
        );
      }
    } else if (!schoolClassId) {
      throw new BadRequestException('schoolClassId is required');
    }

    const schoolClass = await this.prisma.schoolClass.findUnique({
      where: { id: schoolClassId },
    });
    if (!schoolClass) {
      throw new BadRequestException('Class not found');
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

    const schoolClassId = data.schoolClassId;

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
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
      include: { classAssignments: { select: { schoolClassId: true } } },
    });
    const allowed = staff ? assignedClassIdsFromStaff(staff) : [];
    if (
      !student.schoolClassId ||
      !allowed.includes(student.schoolClassId)
    ) {
      throw new ForbiddenException(
        'You can only update students in your assigned classes',
      );
    }

    return this.applyStudentUpdate(studentUserId, {
      ...data,
      schoolClassId: undefined,
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
      assignedClassIds?: string[] | null;
      department?: string;
      subject?: string | null;
      phone?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: {
        staffProfile: {
          include: { classAssignments: { select: { schoolClassId: true } } },
        },
      },
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

    let subjectValue: TeachingSubject | null | undefined = undefined;
    if (data.subject !== undefined) {
      if (!data.subject) {
        subjectValue = null;
      } else if (
        (Object.values(TeachingSubject) as string[]).includes(data.subject)
      ) {
        subjectValue = data.subject as TeachingSubject;
      } else {
        throw new BadRequestException('Invalid teaching subject');
      }
    }

    const nextClassIds = normalizeAssignedClassIds({
      assignedClassIds: data.assignedClassIds,
    });
    // When teaching classes are updated, assignedClassId is the class-teacher class.
    // When only assignedClassId is sent without assignedClassIds, update homeroom only.
    const classTeacherUpdate =
      data.assignedClassId !== undefined || data.assignedClassIds !== undefined
        ? data.assignedClassId !== undefined
          ? data.assignedClassId
          : null
        : undefined;

    const subjectForCheck =
      subjectValue !== undefined
        ? subjectValue
        : user.staffProfile.subject;
    const classIdsForCheck =
      nextClassIds ?? assignedClassIdsFromStaff(user.staffProfile);

    if (subjectForCheck && classIdsForCheck.length) {
      await assertSubjectAvailableForClasses(this.prisma, {
        classIds: classIdsForCheck,
        subject: subjectForCheck,
        excludeUserId: staffUserId,
      });
    }

    if (
      classTeacherUpdate &&
      classIdsForCheck.length &&
      !classIdsForCheck.includes(classTeacherUpdate)
    ) {
      throw new BadRequestException(
        'Class teacher class must be one of the assigned teaching classes',
      );
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

    await this.prisma.staffProfile.update({
      where: { userId: staffUserId },
      data: {
        ...(data.employeeId !== undefined
          ? { employeeId: data.employeeId.trim() }
          : {}),
        ...(data.department !== undefined
          ? { department: data.department?.trim() || null }
          : {}),
        ...(subjectValue !== undefined ? { subject: subjectValue } : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone?.trim() || null }
          : {}),
      },
    });

    if (nextClassIds !== undefined) {
      await syncStaffClassAssignments(
        this.prisma,
        user.staffProfile.id,
        nextClassIds,
        classTeacherUpdate ?? null,
      );
    } else if (classTeacherUpdate !== undefined) {
      const teachingIds = assignedClassIdsFromStaff(user.staffProfile);
      if (classTeacherUpdate && !teachingIds.includes(classTeacherUpdate)) {
        throw new BadRequestException(
          'Class teacher class must be one of the assigned teaching classes',
        );
      }
      await this.prisma.staffProfile.update({
        where: { userId: staffUserId },
        data: { assignedClassId: classTeacherUpdate },
      });
    }

    return this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
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
        ...staffProfileInclude,
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

  async remove(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
