-- CreateTable
CREATE TABLE "staff_class_assignments" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_class_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_class_assignments_staffProfileId_schoolClassId_key" ON "staff_class_assignments"("staffProfileId", "schoolClassId");

-- AddForeignKey
ALTER TABLE "staff_class_assignments" ADD CONSTRAINT "staff_class_assignments_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_class_assignments" ADD CONSTRAINT "staff_class_assignments_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing single assignedClassId
INSERT INTO "staff_class_assignments" ("id", "staffProfileId", "schoolClassId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", "assignedClassId", CURRENT_TIMESTAMP
FROM "staff_profiles"
WHERE "assignedClassId" IS NOT NULL;
