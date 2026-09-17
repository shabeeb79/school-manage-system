-- CreateEnum
CREATE TYPE "TeachingSubject" AS ENUM (
  'ARABIC',
  'ENGLISH',
  'MALAYALAM',
  'MATHEMATICS',
  'SOCIAL_SCIENCE',
  'HINDI',
  'CHEMISTRY',
  'BIOLOGY',
  'PHYSICS',
  'IT'
);

-- AlterTable: convert staff subject TEXT -> TeachingSubject
ALTER TABLE "staff_profiles"
  ALTER COLUMN "subject" TYPE "TeachingSubject"
  USING (
    CASE
      WHEN "subject" IS NULL THEN NULL
      WHEN upper(replace("subject", ' ', '_'))::text = ANY (ARRAY[
        'ARABIC','ENGLISH','MALAYALAM','MATHEMATICS','SOCIAL_SCIENCE',
        'HINDI','CHEMISTRY','BIOLOGY','PHYSICS','IT'
      ]) THEN upper(replace("subject", ' ', '_'))::"TeachingSubject"
      ELSE NULL
    END
  );
