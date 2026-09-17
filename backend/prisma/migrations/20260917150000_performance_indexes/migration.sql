-- Performance indexes for common filters, joins, and sorts

CREATE INDEX IF NOT EXISTS "users_role_lastName_idx" ON "users"("role", "lastName");
CREATE INDEX IF NOT EXISTS "users_isActive_idx" ON "users"("isActive");

CREATE INDEX IF NOT EXISTS "student_profiles_schoolClassId_idx" ON "student_profiles"("schoolClassId");

CREATE INDEX IF NOT EXISTS "staff_profiles_assignedClassId_idx" ON "staff_profiles"("assignedClassId");

CREATE INDEX IF NOT EXISTS "staff_class_assignments_schoolClassId_idx" ON "staff_class_assignments"("schoolClassId");

CREATE INDEX IF NOT EXISTS "posts_isPublished_createdAt_idx" ON "posts"("isPublished", "createdAt");
CREATE INDEX IF NOT EXISTS "posts_authorId_idx" ON "posts"("authorId");
CREATE INDEX IF NOT EXISTS "posts_targetClassId_idx" ON "posts"("targetClassId");
CREATE INDEX IF NOT EXISTS "posts_audience_idx" ON "posts"("audience");

CREATE INDEX IF NOT EXISTS "post_targets_userId_idx" ON "post_targets"("userId");

CREATE INDEX IF NOT EXISTS "attendance_schoolClassId_date_idx" ON "attendance"("schoolClassId", "date");
CREATE INDEX IF NOT EXISTS "attendance_date_idx" ON "attendance"("date");

CREATE INDEX IF NOT EXISTS "grades_studentId_examName_idx" ON "grades"("studentId", "examName");
CREATE INDEX IF NOT EXISTS "grades_studentId_subject_idx" ON "grades"("studentId", "subject");
CREATE INDEX IF NOT EXISTS "grades_term_idx" ON "grades"("term");

CREATE INDEX IF NOT EXISTS "fees_studentId_createdAt_idx" ON "fees"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "fees_status_dueDate_idx" ON "fees"("status", "dueDate");

CREATE INDEX IF NOT EXISTS "assignments_schoolClassId_dueDate_idx" ON "assignments"("schoolClassId", "dueDate");
CREATE INDEX IF NOT EXISTS "assignments_createdById_idx" ON "assignments"("createdById");

CREATE INDEX IF NOT EXISTS "assignment_submissions_studentId_idx" ON "assignment_submissions"("studentId");

CREATE INDEX IF NOT EXISTS "leave_requests_requesterId_createdAt_idx" ON "leave_requests"("requesterId", "createdAt");
CREATE INDEX IF NOT EXISTS "leave_requests_status_createdAt_idx" ON "leave_requests"("status", "createdAt");
