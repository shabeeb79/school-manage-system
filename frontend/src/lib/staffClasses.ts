export type AssignedClass = {
  id: string;
  name: string;
  section?: string | null;
};

type StaffProfileLike = {
  assignedClassId?: string | null;
  assignedClass?: AssignedClass | null;
  classAssignments?: Array<{
    schoolClassId?: string;
    schoolClass?: AssignedClass | null;
  } | null> | null;
} | null | undefined;

/** Teaching classes (subject teacher scope). */
export function staffAssignedClasses(staffProfile?: StaffProfileLike): AssignedClass[] {
  if (!staffProfile) return [];

  const fromJoin = (staffProfile.classAssignments ?? [])
    .map((row) => {
      if (row?.schoolClass?.id) return row.schoolClass;
      if (row?.schoolClassId) {
        return { id: row.schoolClassId, name: row.schoolClassId, section: null };
      }
      return null;
    })
    .filter((c): c is AssignedClass => Boolean(c?.id));

  if (fromJoin.length) {
    const seen = new Set<string>();
    return fromJoin.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }

  if (staffProfile.assignedClass?.id) return [staffProfile.assignedClass];
  if (staffProfile.assignedClassId) {
    return [
      {
        id: staffProfile.assignedClassId,
        name: staffProfile.assignedClassId,
        section: null,
      },
    ];
  }
  return [];
}

export function staffAssignedClassIds(staffProfile?: StaffProfileLike): string[] {
  return staffAssignedClasses(staffProfile).map((c) => c.id);
}

/** Homeroom / class-teacher class (attendance + student leave). */
export function staffClassTeacherClass(staffProfile?: StaffProfileLike): AssignedClass | null {
  if (!staffProfile?.assignedClassId) return null;
  if (staffProfile.assignedClass?.id === staffProfile.assignedClassId) {
    return staffProfile.assignedClass;
  }
  const fromTeaching = staffAssignedClasses(staffProfile).find(
    (c) => c.id === staffProfile.assignedClassId,
  );
  return (
    fromTeaching ?? {
      id: staffProfile.assignedClassId,
      name: staffProfile.assignedClassId,
      section: null,
    }
  );
}

export function isStaffClassTeacher(staffProfile?: StaffProfileLike): boolean {
  return Boolean(staffProfile?.assignedClassId);
}
