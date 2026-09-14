import { PrismaClient, UserRole, TeachingSubject } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SUBJECTS: TeachingSubject[] = [
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
];

const STAFF = [
  { firstName: 'Amina', lastName: 'Hassan', email: 'arabic@school.com' },
  { firstName: 'Emma', lastName: 'Wright', email: 'english@school.com' },
  { firstName: 'Ravi', lastName: 'Nair', email: 'malayalam@school.com' },
  { firstName: 'Maya', lastName: 'Patel', email: 'math@school.com' },
  { firstName: 'Sam', lastName: 'Cohen', email: 'social@school.com' },
  { firstName: 'Priya', lastName: 'Sharma', email: 'hindi@school.com' },
  { firstName: 'Chen', lastName: 'Wei', email: 'chemistry@school.com' },
  { firstName: 'Nora', lastName: 'Ali', email: 'biology@school.com' },
  { firstName: 'James', lastName: 'Brooks', email: 'physics@school.com' },
  { firstName: 'Lina', lastName: 'Okada', email: 'it@school.com' },
];

const STUDENTS = [
  { firstName: 'Alex', lastName: 'Student', email: 'student@school.com' },
  { firstName: 'Jordan', lastName: 'Lee', email: 'jordan@school.com' },
  { firstName: 'Casey', lastName: 'Nguyen', email: 'casey@school.com' },
  { firstName: 'Riley', lastName: 'Garcia', email: 'riley@school.com' },
  { firstName: 'Morgan', lastName: 'Kim', email: 'morgan@school.com' },
  { firstName: 'Taylor', lastName: 'Singh', email: 'taylor@school.com' },
  { firstName: 'Avery', lastName: 'Brown', email: 'avery@school.com' },
  { firstName: 'Quinn', lastName: 'Martinez', email: 'quinn@school.com' },
  { firstName: 'Reese', lastName: 'Patel', email: 'reese@school.com' },
  { firstName: 'Skyler', lastName: 'Chen', email: 'skyler@school.com' },
  { firstName: 'Jamie', lastName: 'Wilson', email: 'jamie@school.com' },
  { firstName: 'Cameron', lastName: 'Davis', email: 'cameron@school.com' },
  { firstName: 'Drew', lastName: 'Lopez', email: 'drew@school.com' },
  { firstName: 'Blake', lastName: 'Ahmed', email: 'blake@school.com' },
  { firstName: 'Finley', lastName: 'Ross', email: 'finley@school.com' },
];

async function main() {
  console.log('Clearing database...');

  await prisma.message.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignmentRead.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.postRead.deleteMany();
  await prisma.postTarget.deleteMany();
  await prisma.post.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.schoolClass.deleteMany();

  console.log('Seeding database...');

  const password = await bcrypt.hash('password123', 10);

  const classA = await prisma.schoolClass.create({
    data: { name: '10', section: 'A', academicYear: '2025-26' },
  });
  const classB = await prisma.schoolClass.create({
    data: { name: '10', section: 'B', academicYear: '2025-26' },
  });
  const classC = await prisma.schoolClass.create({
    data: { name: '10', section: 'C', academicYear: '2025-26' },
  });
  const classes = [classA, classB, classC];

  await prisma.user.create({
    data: {
      email: 'admin@school.com',
      password,
      firstName: 'Ada',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    },
  });

  // First 3 staff are class teachers for 10-A, 10-B, 10-C
  const classTeacherIds = [classA.id, classB.id, classC.id];

  for (let i = 0; i < STAFF.length; i++) {
    const person = STAFF[i];
    const subject = SUBJECTS[i];
    await prisma.user.create({
      data: {
        email: person.email,
        password,
        firstName: person.firstName,
        lastName: person.lastName,
        role: UserRole.STAFF,
        staffProfile: {
          create: {
            employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
            department: subject.replaceAll('_', ' '),
            subject,
            assignedClassId: i < 3 ? classTeacherIds[i] : null,
            phone: `555-01${String(i).padStart(2, '0')}`,
            ...(i < 3
              ? {
                  classAssignments: {
                    create: { schoolClassId: classTeacherIds[i] },
                  },
                }
              : {}),
          },
        },
      },
    });
  }

  for (let i = 0; i < STUDENTS.length; i++) {
    const person = STUDENTS[i];
    const schoolClass = classes[i % 3];
    await prisma.user.create({
      data: {
        email: person.email,
        password,
        firstName: person.firstName,
        lastName: person.lastName,
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            studentId: `STU${String(i + 1).padStart(3, '0')}`,
            schoolClassId: schoolClass.id,
            parentName: `${person.lastName} Parent`,
            parentPhone: `555-02${String(i).padStart(2, '0')}`,
          },
        },
      },
    });
  }

  console.log('Seed complete.');
  console.log('');
  console.log('Demo logins (password: password123):');
  console.log('  Admin:  admin@school.com');
  console.log('  Classes: 10-A, 10-B, 10-C');
  console.log('  Class teachers:');
  console.log('    arabic@school.com  → 10-A (ARABIC)');
  console.log('    english@school.com → 10-B (ENGLISH)');
  console.log('    malayalam@school.com → 10-C (MALAYALAM)');
  console.log('  Other staff (subject only, no class):');
  for (let i = 3; i < STAFF.length; i++) {
    console.log(`    ${STAFF[i].email} (${SUBJECTS[i]})`);
  }
  console.log('  Students: 15 (5 per class) — student@school.com … finley@school.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
