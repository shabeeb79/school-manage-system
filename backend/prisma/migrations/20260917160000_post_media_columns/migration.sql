-- Post media columns used by admin post uploads (were in Prisma schema but never migrated)
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
