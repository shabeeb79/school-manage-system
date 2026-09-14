-- CreateTable
CREATE TABLE "post_reads" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_reads" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_reads_userId_idx" ON "post_reads"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "post_reads_postId_userId_key" ON "post_reads"("postId", "userId");

-- CreateIndex
CREATE INDEX "assignment_reads_userId_idx" ON "assignment_reads"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_reads_assignmentId_userId_key" ON "assignment_reads"("assignmentId", "userId");

-- AddForeignKey
ALTER TABLE "post_reads" ADD CONSTRAINT "post_reads_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reads" ADD CONSTRAINT "post_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_reads" ADD CONSTRAINT "assignment_reads_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_reads" ADD CONSTRAINT "assignment_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
