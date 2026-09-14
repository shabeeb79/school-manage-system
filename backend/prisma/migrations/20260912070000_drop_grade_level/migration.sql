-- AlterTable
ALTER TABLE "classes" DROP COLUMN "gradeLevel";

-- Make section required: backfill any nulls first, then set NOT NULL
UPDATE "classes" SET "section" = '' WHERE "section" IS NULL;
ALTER TABLE "classes" ALTER COLUMN "section" SET NOT NULL;
