import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionStatus, UserRole } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAssignmentDto,
  GradeSubmissionDto,
  ReviewSubmissionDto,
  SubmitAssignmentDto,
} from './dto/assignment.dto';

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

  async list(user: {
    id: string;
    role: UserRole;
    studentProfile?: { schoolClassId?: string | null } | null;
    staffProfile?: { assignedClassId?: string | null } | null;
  }) {
    const where: { schoolClassId?: string } = {};
    if (user.role === UserRole.STUDENT && user.studentProfile?.schoolClassId) {
      where.schoolClassId = user.studentProfile.schoolClassId;
    } else if (
      user.role === UserRole.STAFF &&
      user.staffProfile?.assignedClassId
    ) {
      where.schoolClassId = user.staffProfile.assignedClassId;
    }

    return this.prisma.assignment.findMany({
      where,
      include: {
        schoolClass: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
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
              },
        _count: { select: { submissions: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  private deleteMediaFile(fileUrl?: string | null) {
    if (!fileUrl) return;
    const relative = fileUrl.replace(/^\/uploads\//, '');
    const fullPath = join(process.cwd(), 'uploads', relative);
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath);
      } catch {
        // ignore missing/locked files
      }
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
      this.deleteMediaFile(existing.fileUrl);
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
      this.deleteMediaFile(`/uploads/assignments/${file.filename}`);
      throw new BadRequestException(
        'Submission blocked: you have reached the maximum of 3 attempts for this assignment',
      );
    }

    if (existing?.status === SubmissionStatus.APPROVED) {
      this.deleteMediaFile(`/uploads/assignments/${file.filename}`);
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
      this.deleteMediaFile(submission.fileUrl);
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
      });
      if (
        submission.assignment.createdById === grader.id ||
        (staff?.assignedClassId &&
          staff.assignedClassId === submission.assignment.schoolClassId)
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
