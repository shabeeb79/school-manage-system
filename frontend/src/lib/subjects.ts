export enum TeachingSubject {
  ARABIC = 'ARABIC',
  ENGLISH = 'ENGLISH',
  MALAYALAM = 'MALAYALAM',
  MATHEMATICS = 'MATHEMATICS',
  SOCIAL_SCIENCE = 'SOCIAL_SCIENCE',
  HINDI = 'HINDI',
  CHEMISTRY = 'CHEMISTRY',
  BIOLOGY = 'BIOLOGY',
  PHYSICS = 'PHYSICS',
  IT = 'IT',
}

export const TEACHING_SUBJECTS = [
  TeachingSubject.ARABIC,
  TeachingSubject.ENGLISH,
  TeachingSubject.MALAYALAM,
  TeachingSubject.MATHEMATICS,
  TeachingSubject.SOCIAL_SCIENCE,
  TeachingSubject.HINDI,
  TeachingSubject.CHEMISTRY,
  TeachingSubject.BIOLOGY,
  TeachingSubject.PHYSICS,
  TeachingSubject.IT,
] as const;

export const TEACHING_SUBJECT_LABELS: Record<TeachingSubject, string> = {
  ARABIC: 'Arabic',
  ENGLISH: 'English',
  MALAYALAM: 'Malayalam',
  MATHEMATICS: 'Mathematics',
  SOCIAL_SCIENCE: 'Social Science',
  HINDI: 'Hindi',
  CHEMISTRY: 'Chemistry',
  BIOLOGY: 'Biology',
  PHYSICS: 'Physics',
  IT: 'IT',
};

export function teachingSubjectLabel(value?: string | null) {
  if (!value) return '—';
  return TEACHING_SUBJECT_LABELS[value as TeachingSubject] ?? value;
}
