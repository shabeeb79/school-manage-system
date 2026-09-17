import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeachingSubject, UserRole } from '@prisma/client';
import { listTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpsertStaffMarkDto } from './dto/upsert-staff-mark.dto';
import { assignedClassIdsFromStaff } from '../users/staff-classes';

export const TERM_ASSESSMENT = 'Term Assessment';
export const DEFAULT_MAX_SCORE = 100;

function letterFromScore(score: number, maxScore: number) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function formatClassLabel(name: string, section?: string | null) {
  const sec = section?.trim();
  return sec ? `${name} - ${sec}` : name;
}

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  create(recordedById: string, dto: CreateGradeDto) {
    return this.prisma.grade.create({
      data: { ...dto, recordedById },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async list(user: { id: string; role: UserRole }, studentId?: string) {
    const where: { studentId?: string } = {};
    if (user.role === UserRole.STUDENT) {
      where.studentId = user.id;
    } else if (studentId) {
      where.studentId = studentId;
    }

    return this.prisma.grade.findMany({
      where,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        recordedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: listTake(undefined, 100, 200),
    });
  }

  async gradeCard(studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        studentProfile: { include: { schoolClass: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const schoolClassId = student.studentProfile?.schoolClassId ?? null;
    const expectedSubjects = schoolClassId
      ? await this.expectedSubjectsForClass(schoolClassId)
      : [];

    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        examName: TERM_ASSESSMENT,
        ...(expectedSubjects.length
          ? { subject: { in: expectedSubjects } }
          : {}),
      },
      orderBy: { subject: 'asc' },
    });

    const bySubject = new Map(grades.map((g) => [g.subject, g] as const));
    const subjectsMarked = expectedSubjects.filter((subject) =>
      bySubject.has(subject),
    ).length;
    const complete =
      expectedSubjects.length > 0 &&
      subjectsMarked === expectedSubjects.length;

    const subjects = expectedSubjects.map((subject) => {
      const grade = bySubject.get(subject);
      if (!complete || !grade) {
        return {
          subject,
          status: 'pending' as const,
          score: null,
          maxScore: DEFAULT_MAX_SCORE,
          gradeLetter: null,
        };
      }
      return {
        subject,
        status: 'ready' as const,
        score: Number(grade.score),
        maxScore: Number(grade.maxScore),
        gradeLetter: grade.gradeLetter,
      };
    });

    const totalScore = complete
      ? subjects.reduce((sum, row) => sum + (row.score ?? 0), 0)
      : null;
    const totalMax = complete
      ? subjects.reduce((sum, row) => sum + row.maxScore, 0)
      : null;
    const percentage =
      complete && totalMax && totalMax > 0
        ? Number((((totalScore ?? 0) / totalMax) * 100).toFixed(2))
        : null;
    const overallLetter =
      complete && totalScore != null && totalMax
        ? letterFromScore(totalScore, totalMax)
        : null;

    return {
      student,
      examName: TERM_ASSESSMENT,
      complete,
      pending: !complete,
      expectedSubjects,
      subjectsMarked,
      subjectsExpected: expectedSubjects.length,
      subjects,
      totalScore,
      totalMax,
      percentage,
      overallLetter,
      // Keep older shape for any legacy callers, but hide scores while pending
      grades: complete ? grades : [],
      summary: complete
        ? subjects.map((row) => ({
            subject: row.subject,
            average: row.score,
            maxScore: row.maxScore,
            gradeLetter: row.gradeLetter,
            exams: 1,
          }))
        : [],
    };
  }

  private expectedSubjects() {
    return (Object.values(TeachingSubject) as TeachingSubject[]).sort();
  }

  private async expectedSubjectsForClass(_schoolClassId: string) {
    return this.expectedSubjects();
  }

  async staffClassMarks(staffUserId: string, schoolClassId?: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
      include: {
        assignedClass: true,
        classAssignments: {
          include: { schoolClass: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const classIds = staff ? assignedClassIdsFromStaff(staff) : [];
    if (!classIds.length || !staff?.subject) {
      throw new BadRequestException(
        'Assign at least one class and a subject to this teacher before entering grades',
      );
    }

    const targetClassId = schoolClassId ?? classIds[0];
    if (!classIds.includes(targetClassId)) {
      throw new ForbiddenException('You are not assigned to this class');
    }

    const schoolClass =
      staff.classAssignments.find((a) => a.schoolClassId === targetClassId)
        ?.schoolClass ??
      (staff.assignedClassId === targetClassId ? staff.assignedClass : null) ??
      (await this.prisma.schoolClass.findUnique({ where: { id: targetClassId } }));

    const expectedSubjects = await this.expectedSubjectsForClass(targetClassId);
    const students = await this.prisma.studentProfile.findMany({
      where: { schoolClassId: targetClassId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isActive: true,
          },
        },
      },
      orderBy: { studentId: 'asc' },
    });

    const studentIds = students.map((s) => s.userId);
    const subjectFilter = expectedSubjects.length
      ? expectedSubjects
      : staff.subject
        ? [staff.subject]
        : [];
    const grades = studentIds.length
      ? await this.prisma.grade.findMany({
          where: {
            studentId: { in: studentIds },
            examName: TERM_ASSESSMENT,
            ...(subjectFilter.length
              ? { subject: { in: subjectFilter } }
              : {}),
          },
          select: {
            id: true,
            studentId: true,
            subject: true,
            score: true,
            maxScore: true,
            gradeLetter: true,
          },
        })
      : [];

    const gradesByStudent = new Map<string, typeof grades>();
    for (const grade of grades) {
      const list = gradesByStudent.get(grade.studentId) ?? [];
      list.push(grade);
      gradesByStudent.set(grade.studentId, list);
    }

    return {
      subject: staff.subject,
      examName: TERM_ASSESSMENT,
      maxScore: DEFAULT_MAX_SCORE,
      expectedSubjects,
      assignedClasses: classIds.map((id) => {
        const cls =
          staff.classAssignments.find((a) => a.schoolClassId === id)
            ?.schoolClass ??
          (staff.assignedClassId === id ? staff.assignedClass : null);
        return cls
          ? {
              id: cls.id,
              name: cls.name,
              section: cls.section,
              label: formatClassLabel(cls.name, cls.section),
            }
          : { id, name: id, section: null, label: id };
      }),
      schoolClass: schoolClass
        ? {
            id: schoolClass.id,
            name: schoolClass.name,
            section: schoolClass.section,
            label: formatClassLabel(schoolClass.name, schoolClass.section),
          }
        : null,
      students: students.map((profile) => {
        const studentGrades = gradesByStudent.get(profile.userId) ?? [];
        const bySubject = new Map(
          studentGrades.map((g) => [g.subject, g] as const),
        );
        const myGrade = bySubject.get(staff.subject!);
        const subjectMarks = expectedSubjects.map((subject) => {
          const grade = bySubject.get(subject);
          return {
            subject,
            score: grade ? Number(grade.score) : null,
            maxScore: grade ? Number(grade.maxScore) : DEFAULT_MAX_SCORE,
            gradeId: grade?.id ?? null,
          };
        });
        const complete =
          expectedSubjects.length > 0 &&
          expectedSubjects.every((subject) => bySubject.has(subject));
        const totalScore = complete
          ? subjectMarks.reduce((sum, m) => sum + (m.score ?? 0), 0)
          : null;
        const totalMax = complete
          ? subjectMarks.reduce((sum, m) => sum + m.maxScore, 0)
          : null;

        return {
          userId: profile.userId,
          studentId: profile.studentId,
          firstName: profile.user.firstName,
          lastName: profile.user.lastName,
          email: profile.user.email,
          isActive: profile.user.isActive,
          myMark: myGrade
            ? {
                id: myGrade.id,
                score: Number(myGrade.score),
                maxScore: Number(myGrade.maxScore),
                gradeLetter: myGrade.gradeLetter,
              }
            : null,
          subjectMarks,
          complete,
          totalScore,
          totalMax,
        };
      }),
    };
  }

  async upsertStaffMark(staffUserId: string, dto: UpsertStaffMarkDto) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
      include: {
        assignedClass: true,
        classAssignments: { select: { schoolClassId: true } },
      },
    });
    const classIds = staff ? assignedClassIdsFromStaff(staff) : [];
    if (!classIds.length || !staff?.subject) {
      throw new BadRequestException(
        'Assign at least one class and a subject to this teacher before entering grades',
      );
    }

    const student = await this.prisma.user.findUnique({
      where: { id: dto.studentId },
      include: { studentProfile: true },
    });
    if (!student?.studentProfile) {
      throw new NotFoundException('Student not found');
    }
    if (
      !student.studentProfile.schoolClassId ||
      !classIds.includes(student.studentProfile.schoolClassId)
    ) {
      throw new ForbiddenException(
        'You can only enter marks for students in your assigned classes',
      );
    }

    const maxScore = dto.maxScore ?? DEFAULT_MAX_SCORE;
    if (dto.score > maxScore) {
      throw new BadRequestException(`Score cannot exceed ${maxScore}`);
    }
    const gradeLetter = letterFromScore(dto.score, maxScore);

    const existing = await this.prisma.grade.findFirst({
      where: {
        studentId: dto.studentId,
        subject: staff.subject,
        examName: TERM_ASSESSMENT,
      },
    });

    if (existing) {
      return this.prisma.grade.update({
        where: { id: existing.id },
        data: {
          score: dto.score,
          maxScore,
          gradeLetter,
          recordedById: staffUserId,
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    }

    return this.prisma.grade.create({
      data: {
        studentId: dto.studentId,
        subject: staff.subject,
        examName: TERM_ASSESSMENT,
        score: dto.score,
        maxScore,
        gradeLetter,
        recordedById: staffUserId,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async toppers() {
    const expectedSubjects = this.expectedSubjects();

    const [classes, grades] = await Promise.all([
      this.prisma.schoolClass.findMany({
        orderBy: [{ name: 'asc' }, { section: 'asc' }],
        select: {
          id: true,
          name: true,
          section: true,
          students: {
            select: {
              userId: true,
              studentId: true,
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
      this.prisma.grade.findMany({
        where: {
          examName: TERM_ASSESSMENT,
          ...(expectedSubjects.length
            ? { subject: { in: expectedSubjects } }
            : {}),
        },
        select: {
          studentId: true,
          subject: true,
          score: true,
          maxScore: true,
        },
      }),
    ]);

    const gradesByStudent = new Map<
      string,
      Map<string, { score: number; maxScore: number }>
    >();
    for (const grade of grades) {
      let bySubject = gradesByStudent.get(grade.studentId);
      if (!bySubject) {
        bySubject = new Map();
        gradesByStudent.set(grade.studentId, bySubject);
      }
      bySubject.set(grade.subject, {
        score: Number(grade.score),
        maxScore: Number(grade.maxScore),
      });
    }

    type RankedStudent = {
      studentUserId: string;
      studentName: string;
      rollNo: string;
      classId: string;
      classLabel: string;
      totalScore: number;
      totalMax: number;
      percentage: number;
      subjectsMarked: number;
      subjectsExpected: number;
      studentsComplete: number;
      studentsTotal: number;
      pending: boolean;
    };

    const classToppers: RankedStudent[] = [];
    const schoolCandidates: RankedStudent[] = [];

    for (const schoolClass of classes) {
      const classLabel = formatClassLabel(
        schoolClass.name,
        schoolClass.section,
      );
      const studentsTotal = schoolClass.students.length;
      const completeStudents: RankedStudent[] = [];

      for (const profile of schoolClass.students) {
        const bySubject = gradesByStudent.get(profile.userId) ?? new Map();
        const subjectsMarked = expectedSubjects.filter((subject) =>
          bySubject.has(subject),
        ).length;
        const studentComplete =
          expectedSubjects.length > 0 &&
          subjectsMarked === expectedSubjects.length;
        if (!studentComplete) continue;

        const totalScore = expectedSubjects.reduce(
          (sum, subject) => sum + (bySubject.get(subject)?.score ?? 0),
          0,
        );
        const totalMax = expectedSubjects.reduce(
          (sum, subject) => sum + (bySubject.get(subject)?.maxScore ?? 0),
          0,
        );
        const percentage =
          totalMax > 0
            ? Number(((totalScore / totalMax) * 100).toFixed(2))
            : 0;

        completeStudents.push({
          studentUserId: profile.userId,
          studentName: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
          rollNo: profile.studentId,
          classId: schoolClass.id,
          classLabel,
          totalScore,
          totalMax,
          percentage,
          subjectsMarked,
          subjectsExpected: expectedSubjects.length,
          studentsComplete: 0,
          studentsTotal,
          pending: false,
        });
      }

      const studentsComplete = completeStudents.length;
      const classFullyMarked =
        studentsTotal > 0 &&
        expectedSubjects.length > 0 &&
        studentsComplete === studentsTotal;

      completeStudents.sort(
        (a, b) => b.totalScore - a.totalScore || b.percentage - a.percentage,
      );

      if (classFullyMarked && completeStudents[0]) {
        const topper = {
          ...completeStudents[0],
          studentsComplete,
          studentsTotal,
          pending: false,
        };
        classToppers.push(topper);
        schoolCandidates.push(
          ...completeStudents.map((row) => ({
            ...row,
            studentsComplete,
            studentsTotal,
            pending: false,
          })),
        );
      } else {
        classToppers.push({
          studentUserId: '',
          studentName: '',
          rollNo: '',
          classId: schoolClass.id,
          classLabel,
          totalScore: 0,
          totalMax: 0,
          percentage: 0,
          subjectsMarked: 0,
          subjectsExpected: expectedSubjects.length,
          studentsComplete,
          studentsTotal,
          pending: true,
        });
      }
    }

    schoolCandidates.sort(
      (a, b) => b.totalScore - a.totalScore || b.percentage - a.percentage,
    );

    const relevantClasses = classToppers.filter((row) => row.studentsTotal > 0);
    const allClassesReady =
      relevantClasses.length > 0 &&
      relevantClasses.every((row) => !row.pending && Boolean(row.studentUserId));

    return {
      examName: TERM_ASSESSMENT,
      schoolTopper: allClassesReady ? schoolCandidates[0] ?? null : null,
      schoolPending: !allClassesReady,
      classToppers,
    };
  }

  async remove(id: string) {
    const grade = await this.prisma.grade.findUnique({ where: { id } });
    if (!grade) throw new NotFoundException('Grade not found');
    return this.prisma.grade.delete({ where: { id } });
  }
}
