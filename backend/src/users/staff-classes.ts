import { BadRequestException } from '@nestjs/common';
import { TeachingSubject } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const staffProfileInclude = {
  assignedClass: true,
  classAssignments: {
    include: {
      schoolClass: {
        select: { id: true, name: true, section: true },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

/** Teaching classes (subject teacher scope). */
export function assignedClassIdsFromStaff(staff: {
  assignedClassId?: string | null;
  classAssignments?: { schoolClassId: string }[];
}): string[] {
  const fromJoin = (staff.classAssignments ?? []).map((a) => a.schoolClassId);
  if (fromJoin.length) return [...new Set(fromJoin)];
  return staff.assignedClassId ? [staff.assignedClassId] : [];
}

/** Homeroom / class-teacher class only (attendance + student leave). */
export function classTeacherClassIdFromStaff(staff: {
  assignedClassId?: string | null;
}): string | null {
  return staff.assignedClassId ?? null;
}

export async function resolveAssignedClassIds(
  prisma: PrismaService,
  staffUserId: string,
): Promise<string[]> {
  const staff = await prisma.staffProfile.findUnique({
    where: { userId: staffUserId },
    include: { classAssignments: { select: { schoolClassId: true } } },
  });
  if (!staff) return [];
  return assignedClassIdsFromStaff(staff);
}

export async function resolveClassTeacherClassId(
  prisma: PrismaService,
  staffUserId: string,
): Promise<string | null> {
  const staff = await prisma.staffProfile.findUnique({
    where: { userId: staffUserId },
    select: { assignedClassId: true },
  });
  return staff?.assignedClassId ?? null;
}

export async function assertSubjectAvailableForClasses(
  prisma: PrismaService,
  params: {
    classIds: string[];
    subject: TeachingSubject;
    excludeUserId?: string;
  },
) {
  if (!params.classIds.length) return;

  const conflict = await prisma.staffClassAssignment.findFirst({
    where: {
      schoolClassId: { in: params.classIds },
      staffProfile: {
        subject: params.subject,
        ...(params.excludeUserId
          ? { NOT: { userId: params.excludeUserId } }
          : {}),
      },
    },
    include: {
      staffProfile: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      schoolClass: { select: { name: true, section: true } },
    },
  });

  if (!conflict) return;

  const name =
    `${conflict.staffProfile.user.firstName} ${conflict.staffProfile.user.lastName}`.trim() ||
    'Another teacher';
  const classLabel = conflict.schoolClass.section
    ? `${conflict.schoolClass.name}-${conflict.schoolClass.section}`
    : conflict.schoolClass.name;
  throw new BadRequestException(
    `Class ${classLabel} already has a ${params.subject} teacher (${name}).`,
  );
}

/**
 * Sync teaching class assignments and optional class-teacher (homeroom) class.
 * classTeacherClassId must be one of the teaching classes (or null).
 */
export async function syncStaffClassAssignments(
  prisma: PrismaService,
  staffProfileId: string,
  classIds: string[],
  classTeacherClassId?: string | null,
) {
  const uniqueIds = [...new Set(classIds.filter(Boolean))];

  if (uniqueIds.length) {
    const found = await prisma.schoolClass.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new BadRequestException('One or more assigned classes were not found');
    }
  }

  let homeroomUpdate: string | null | undefined = undefined;
  if (classTeacherClassId !== undefined) {
    const homeroom = classTeacherClassId || null;
    if (homeroom && !uniqueIds.includes(homeroom)) {
      throw new BadRequestException(
        'Class teacher class must be one of the assigned teaching classes',
      );
    }
    homeroomUpdate = homeroom;
  } else {
    // Keep existing homeroom only if still in teaching set; otherwise clear.
    const current = await prisma.staffProfile.findUnique({
      where: { id: staffProfileId },
      select: { assignedClassId: true },
    });
    if (
      current?.assignedClassId &&
      !uniqueIds.includes(current.assignedClassId)
    ) {
      homeroomUpdate = null;
    }
  }

  await prisma.staffClassAssignment.deleteMany({
    where: { staffProfileId },
  });

  if (uniqueIds.length) {
    await prisma.staffClassAssignment.createMany({
      data: uniqueIds.map((schoolClassId) => ({
        staffProfileId,
        schoolClassId,
      })),
    });
  }

  if (homeroomUpdate !== undefined) {
    await prisma.staffProfile.update({
      where: { id: staffProfileId },
      data: { assignedClassId: homeroomUpdate },
    });
  }

  return uniqueIds;
}

/** Normalize API input: prefer assignedClassIds, fall back to singular assignedClassId only if no array. */
export function normalizeAssignedClassIds(input: {
  assignedClassIds?: string[] | null;
  assignedClassId?: string | null;
}): string[] | undefined {
  if (input.assignedClassIds !== undefined && input.assignedClassIds !== null) {
    return [...new Set(input.assignedClassIds.filter(Boolean))];
  }
  return undefined;
}
