import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AssignmentsService } from './assignments.service';
import {
  CreateAssignmentDto,
  GradeSubmissionDto,
  ReviewSubmissionDto,
  SubmitAssignmentDto,
} from './dto/assignment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'assignments');

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private assignments: AssignmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignments.create(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser()
    user: {
      id: string;
      role: UserRole;
      studentProfile?: { schoolClassId?: string | null } | null;
      staffProfile?: { assignedClassId?: string | null } | null;
    },
  ) {
    return this.assignments.list(user);
  }

  @Post(':id/submit')
  @Roles(UserRole.STUDENT)
  submit(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitAssignmentDto,
  ) {
    return this.assignments.submit(id, user.id, dto);
  }

  @Post(':id/submit-file')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      limits: { fileSize: MAX_MEDIA_BYTES },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('video/')
        ) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException('Only photo or video uploads are allowed') as any,
          false,
        );
      },
    }),
  )
  submitFile(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
    @Body('content') content?: string,
  ) {
    return this.assignments.submitWithFile(id, user.id, file, content);
  }

  @Patch('submissions/:submissionId/grade')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  grade(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assignments.gradeSubmission(submissionId, user, dto);
  }

  @Patch('submissions/:submissionId/review')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  review(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: { id: string; role: UserRole },
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.assignments.reviewSubmission(submissionId, user, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.assignments.remove(id, user.id, user.role);
  }
}
