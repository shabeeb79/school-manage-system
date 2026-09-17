import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionStatus, UserRole } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { listTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAssignmentDto,
  GradeSubmissionDto,
  ReviewSubmissionDto,
  SubmitAssignmentDto,
} from './dto/assignment.dto';
import {
  assignedClassIdsFromStaff,
  resolveAssignedClassIds,
} from '../users/staff-classes';

const MAX_ATTEMPTS = 3;

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  create(createdById: string, dto: CreateAssignmentDto) {
    return this.prisma.assignment.create({
      data: {
        title: dto.title,
        description: dto.description,
        subject: dto.subject,
        dueDate: new Date(dto.dueDate),
        schoolClassId: dto.schoolClassId,
        maxScore: dto.maxScore ?? 100,
        createdById,
      },
      include: { schoolClass: true },
    });
  }

  async createForStaff(createdById: string, dto: CreateAssignmentDto) {
    const classIds = await resolveAssignedClassIds(this.prisma, createdById);
    if (!classIds.includes(dto.schoolClassId)) {
      throw new ForbiddenException(
        'You can only create assignments for your assigned classes',
      );
    }
    const schoolClass = await this.prisma.schoolClass.findUnique({
      where: { id: dto.schoolClassId },
    });
    if (!schoolClass) {
      throw new BadRequestException('Class not found');
    }
    return this.create(createdById, dto);
  }

  async list(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
    staffProfile?: {
      assignedClassId?: string | null;
      classAssignments?: { schoolClassId: string }[];
    } | null;
  }) {
    // Students only see teacher-published assignments for their own class.
    // Staff see assignments for their assigned classes.
    const where: {
      schoolClassId?: string | { in: string[] };
      createdBy?: { role: { in: UserRole[] } };
    } = {};
    if (user.role === UserRole.STUDENT) {
      if (!user.studentProfile?.schoolClassId) {
        return [];
      }
      where.schoolClassId = user.studentProfile.schoolClassId;
      where.createdBy = {
        role: { in: [UserRole.STAFF, UserRole.ADMIN] },
      };
    } else if (user.role === UserRole.STAFF) {
      const classIds = assignedClassIdsFromStaff({
        assignedClassId: user.staffProfile?.assignedClassId,
        classAssignments: user.staffProfile?.classAssignments,
      });
      if (!classIds.length) return [];
      where.schoolClassId = { in: classIds };
    }

    const assignments = await this.prisma.assignment.findMany({
      where,
      include: {
        schoolClass: {
          select: { id: true, name: true, section: true, academicYear: true },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        // Students only need their own submission; staff loads submissions on detail.
        submissions:
          user.role === UserRole.STUDENT
            ? { where: { studentId: user.id } }
            : false,
        _count: { select: { submissions: true } },
        reads:
          user.role === UserRole.STUDENT
            ? { where: { userId: user.id }, select: { id: true } }
            : false,
      },
      orderBy: { dueDate: 'asc' },
      take: listTake(undefined, 50, 100),
    });

    if (user.role !== UserRole.STUDENT) {
      return assignments.map((assignment) => ({
        ...assignment,
        submissions: [] as [],
      }));
    }

    return assignments.map(({ reads, ...assignment }) => ({
      ...assignment,
      isUnread:
        assignment.createdById !== user.id &&
        Array.isArray(reads) &&
        reads.length === 0,
    }));
  }

  async getOne(
    id: string,
    user: {
      id: string;
      role: UserRole;
      studentProfile?: { schoolClassId?: string | null } | null;
      staffProfile?: {
        assignedClassId?: string | null;
        classAssignments?: { schoolClassId: string }[];
      } | null;
    },
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        schoolClass: {
          select: { id: true, name: true, section: true, academicYear: true },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        submissions:
          user.role === UserRole.STUDENT
            ? { where: { studentId: user.id } }
            : {
                include: {
                  student: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
                orderBy: { submittedAt: 'desc' },
                take: listTake(undefined, 100, 200),
              },
        _count: { select: { submissions: true } },
        reads:
          user.role === UserRole.STUDENT
            ? { where: { userId: user.id }, select: { id: true } }
            : false,
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    if (user.role === UserRole.STAFF) {
      const classIds = assignedClassIdsFromStaff({
        assignedClassId: user.staffProfile?.assignedClassId,
        classAssignments: user.staffProfile?.classAssignments,
      });
      if (!classIds.includes(assignment.schoolClassId)) {
        throw new ForbiddenException('Not allowed to view this assignment');
      }
    } else if (user.role === UserRole.STUDENT) {
      if (user.studentProfile?.schoolClassId !== assignment.schoolClassId) {
        throw new ForbiddenException('Not allowed to view this assignment');
      }
    }

    if (user.role === UserRole.STUDENT) {
      const { reads, ...rest } = assignment;
      return {
        ...rest,
        isUnread:
          rest.createdById !== user.id &&
          Array.isArray(reads) &&
          reads.length === 0,
      };
    }

    return assignment;
  }

  async unreadCount(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
    staffProfile?: { assignedClassId?: string | null } | null;
  }) {
    if (user.role !== UserRole.STUDENT) {
      return { count: 0 };
    }
    if (!user.studentProfile?.schoolClassId) {
      return { count: 0 };
    }

    const count = await this.prisma.assignment.count({
      where: {
        schoolClassId: user.studentProfile.schoolClassId,
        createdBy: { role: { in: [UserRole.STAFF, UserRole.ADMIN] } },
        createdById: { not: user.id },
        reads: { none: { userId: user.id } },
      },
    });
    return { count };
  }

  async markRead(assignmentId: string, userId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    await this.prisma.assignmentRead.upsert({
      where: {
        assignmentId_userId: { assignmentId, userId },
      },
      create: { assignmentId, userId },
      update: { readAt: new Date() },
    });

    return { ok: true };
  }

  async markAllRead(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
    staffProfile?: { assignedClassId?: string | null } | null;
  }) {
    if (user.role !== UserRole.STUDENT) {
      return { marked: 0 };
    }
    if (!user.studentProfile?.schoolClassId) {
      return { marked: 0 };
    }

    const unread = await this.prisma.assignment.findMany({
      where: {
        schoolClassId: user.studentProfile.schoolClassId,
        createdBy: { role: { in: [UserRole.STAFF, UserRole.ADMIN] } },
        createdById: { not: user.id },
        reads: { none: { userId: user.id } },
      },
      select: { id: true },
      take: 200,
    });
    if (!unread.length) return { marked: 0 };

    await this.prisma.assignmentRead.createMany({
      data: unread.map((assignment) => ({
        assignmentId: assignment.id,
        userId: user.id,
      })),
      skipDuplicates: true,
    });

    return { marked: unread.length };
  }

  private async deleteMediaFile(fileUrl?: string | null) {
    if (!fileUrl) return;
    const relative = fileUrl.replace(/^\/uploads\//, '');
    const fullPath = join(process.cwd(), 'uploads', relative);
    try {
      await unlink(fullPath);
    } catch {
      // ignore missing/locked files
    }
  }

  async submit(
    assignmentId: string,
    studentId: string,
    dto: SubmitAssignmentDto,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { schoolClassId: true },
    });
    if (!student?.schoolClassId || student.schoolClassId !== assignment.schoolClassId) {
      throw new ForbiddenException(
        'This assignment is only for students in the selected class',
      );
    }

    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: { assignmentId, studentId },
      },
    });

    if (existing?.status === SubmissionStatus.APPROVED) {
      throw new BadRequestException('This assignment is already approved');
    }

    if (existing && existing.attemptCount >= MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Submission blocked: you have reached the maximum of 3 attempts for this assignment',
      );
    }

    if (existing?.fileUrl) {
      await this.deleteMediaFile(existing.fileUrl);
    }

    const nextAttempt = (existing?.attemptCount ?? 0) + 1;

    return this.prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: { assignmentId, studentId },
      },
      create: {
        assignmentId,
        studentId,
        content: dto.content,
        fileUrl: dto.fileUrl,
        mediaType: dto.mediaType,
        status: SubmissionStatus.SUBMITTED,
        attemptCount: 1,
        isGraded: false,
        score: null,
        feedback: null,
      },
      update: {
        content: dto.content,
        fileUrl: dto.fileUrl,
        mediaType: dto.mediaType,
        status: SubmissionStatus.SUBMITTED,
        attemptCount: nextAttempt,
        isGraded: false,
        score: null,
        feedback: null,
        submittedAt: new Date(),
      },
    });
  }

  async submitWithFile(
    assignmentId: string,
    studentId: string,
    file: Express.Multer.File,
    note?: string,
  ) {
    if (!file) throw new BadRequestException('Photo or video file is required');
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File must be less than 2MB');
    }

    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
      throw new BadRequestException('Only photo or video uploads are allowed');
    }

    const existing = await this.prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: { assignmentId, studentId },
      },
    });

    if (existing && existing.attemptCount >= MAX_ATTEMPTS) {
      await this.deleteMediaFile(`/uploads/assignments/${file.filename}`);
      throw new BadRequestException(
        'Submission blocked: you have reached the maximum of 3 attempts for this assignment',
      );
    }

    if (existing?.status === SubmissionStatus.APPROVED) {
      await this.deleteMediaFile(`/uploads/assignments/${file.filename}`);
      throw new BadRequestException('This assignment is already approved');
    }

    const fileUrl = `/uploads/assignments/${file.filename}`;
    const mediaType = isImage ? 'PHOTO' : 'VIDEO';

    return this.submit(assignmentId, studentId, {
      content:
        note?.trim() ||
        `${mediaType === 'PHOTO' ? 'Photo' : 'Video'} submission`,
      fileUrl,
      mediaType,
    });
  }

  async gradeSubmission(
    submissionId: string,
    grader: { id: string; role: UserRole },
    dto: GradeSubmissionDto,
  ) {
    await this.assertCanReview(submissionId, grader);

    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback,
        isGraded: true,
        status: SubmissionStatus.APPROVED,
      },
    });
  }

  async reviewSubmission(
    submissionId: string,
    grader: { id: string; role: UserRole },
    dto: ReviewSubmissionDto,
  ) {
    if (
      dto.status !== SubmissionStatus.APPROVED &&
      dto.status !== SubmissionStatus.REJECTED
    ) {
      throw new BadRequestException('Status must be APPROVED or REJECTED');
    }

    if (dto.status === SubmissionStatus.REJECTED && !dto.feedback?.trim()) {
      throw new BadRequestException('A remark is required when rejecting');
    }

    const submission = await this.assertCanReview(submissionId, grader);

    if (dto.status === SubmissionStatus.REJECTED) {
      await this.deleteMediaFile(submission.fileUrl);
      return this.prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.REJECTED,
          feedback: dto.feedback!.trim(),
          score: null,
          isGraded: false,
          fileUrl: null,
          mediaType: null,
          content: 'Submission rejected — upload a new photo or video',
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          assignment: true,
        },
      });
    }

    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        feedback: null,
        score: dto.score,
        isGraded: true,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignment: true,
      },
    });
  }

  private async assertCanReview(
    submissionId: string,
    grader: { id: string; role: UserRole },
  ) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    if (grader.role === UserRole.ADMIN) return submission;

    if (grader.role === UserRole.STAFF) {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: grader.id },
        include: { classAssignments: { select: { schoolClassId: true } } },
      });
      const classIds = staff ? assignedClassIdsFromStaff(staff) : [];
      if (
        submission.assignment.createdById === grader.id ||
        classIds.includes(submission.assignment.schoolClassId)
      ) {
        return submission;
      }
    }

    throw new ForbiddenException('You cannot review this submission');
  }

  async remove(id: string, userId: string, role: UserRole) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (role !== UserRole.ADMIN && assignment.createdById !== userId) {
      throw new ForbiddenException();
    }
    return this.prisma.assignment.delete({ where: { id } });
  }
}
