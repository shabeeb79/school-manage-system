import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';

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

    const grades = await this.prisma.grade.findMany({
      where: { studentId },
      orderBy: [{ term: 'asc' }, { subject: 'asc' }],
    });

    const bySubject = grades.reduce<
      Record<string, { scores: number[]; max: number; letter?: string }>
    >((acc, g) => {
      const key = g.subject;
      if (!acc[key]) acc[key] = { scores: [], max: Number(g.maxScore) };
      acc[key].scores.push(Number(g.score));
      if (g.gradeLetter) acc[key].letter = g.gradeLetter;
      return acc;
    }, {});

    const summary = Object.entries(bySubject).map(([subject, data]) => {
      const avg =
        data.scores.reduce((a, b) => a + b, 0) / (data.scores.length || 1);
      return {
        subject,
        average: Number(avg.toFixed(2)),
        maxScore: data.max,
        gradeLetter: data.letter,
        exams: data.scores.length,
      };
    });

    return { student, grades, summary };
  }

  async remove(id: string) {
    const grade = await this.prisma.grade.findUnique({ where: { id } });
    if (!grade) throw new NotFoundException('Grade not found');
    return this.prisma.grade.delete({ where: { id } });
  }
}
