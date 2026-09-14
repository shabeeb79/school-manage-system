-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'VOICE', 'PHOTO');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "kind" "MessageKind" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "mediaMime" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

-- Keep existing subject/body nullable-safe defaults
ALTER TABLE "messages" ALTER COLUMN "subject" SET DEFAULT '';
ALTER TABLE "messages" ALTER COLUMN "body" SET DEFAULT '';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_senderId_receiverId_createdAt_idx" ON "messages"("senderId", "receiverId", "createdAt");
CREATE INDEX IF NOT EXISTS "messages_receiverId_isRead_idx" ON "messages"("receiverId", "isRead");
