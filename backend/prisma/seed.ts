import { PrismaClient, UserRole, FeeStatus, AttendanceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  await prisma.message.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.fee.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.postTarget.deleteMany();
  await prisma.post.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.schoolClass.deleteMany();

  const password = await bcrypt.hash('password123', 10);

  const classA = await prisma.schoolClass.create({
    data: {
      name: '10',
      section: 'A',
      academicYear: '2025-26',
    },
  });

  const classB = await prisma.schoolClass.create({
    data: {
      name: '9',
      section: 'B',
      academicYear: '2025-26',
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@school.com',
      password,
      firstName: 'Ada',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: 'staff@school.com',
      password,
      firstName: 'Sam',
      lastName: 'Teacher',
      role: UserRole.STAFF,
      staffProfile: {
        create: {
          employeeId: 'EMP001',
          department: 'Science',
          subject: 'PHYSICS',
          assignedClassId: classA.id,
          phone: '555-0100',
        },
      },
    },
  });

  const mathStaff = await prisma.user.create({
    data: {
      email: 'math@school.com',
      password,
      firstName: 'Maya',
      lastName: 'Math',
      role: UserRole.STAFF,
      staffProfile: {
        create: {
          employeeId: 'EMP002',
          department: 'Mathematics',
          subject: 'MATHEMATICS',
          assignedClassId: classB.id,
          phone: '555-0101',
        },
      },
    },
  });

  const student1 = await prisma.user.create({
    data: {
      email: 'student@school.com',
      password,
      firstName: 'Alex',
      lastName: 'Student',
      role: UserRole.STUDENT,
      studentProfile: {
        create: {
          studentId: 'STU001',
          schoolClassId: classA.id,
          parentName: 'Pat Parent',
          parentPhone: '555-0200',
          address: '12 Maple Street',
        },
      },
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: 'jordan@school.com',
      password,
      firstName: 'Jordan',
      lastName: 'Lee',
      role: UserRole.STUDENT,
      studentProfile: {
        create: {
          studentId: 'STU002',
          schoolClassId: classA.id,
          parentName: 'Kim Lee',
          parentPhone: '555-0300',
        },
      },
    },
  });

  const student3 = await prisma.user.create({
    data: {
      email: 'casey@school.com',
      password,
      firstName: 'Casey',
      lastName: 'Nguyen',
      role: UserRole.STUDENT,
      studentProfile: {
        create: {
          studentId: 'STU003',
          schoolClassId: classB.id,
          parentName: 'Taylor Nguyen',
        },
      },
    },
  });

  await prisma.post.create({
    data: {
      title: 'Welcome to the new term',
      content:
        'Welcome everyone! Please check your schedules and fee dues this week.',
      audience: 'ALL',
      authorId: admin.id,
    },
  });

  await prisma.post.create({
    data: {
      title: 'Grade 10 Science Fair',
      content: 'Science fair submissions are due next Friday for Grade 10-A.',
      audience: 'CLASS',
      targetClassId: classA.id,
      authorId: admin.id,
    },
  });

  await prisma.post.create({
    data: {
      title: 'Staff meeting Friday',
      content: 'All staff: curriculum planning meeting at 3 PM in the library.',
      audience: 'STAFF',
      authorId: admin.id,
    },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.attendance.createMany({
    data: [
      {
        studentId: student1.id,
        schoolClassId: classA.id,
        date: today,
        status: AttendanceStatus.PRESENT,
        markedById: staff.id,
      },
      {
        studentId: student2.id,
        schoolClassId: classA.id,
        date: today,
        status: AttendanceStatus.LATE,
        markedById: staff.id,
        remarks: 'Arrived 10 minutes late',
      },
    ],
  });

  await prisma.grade.createMany({
    data: [
      {
        studentId: student1.id,
        subject: 'PHYSICS',
        examName: 'Term Assessment',
        score: 88,
        maxScore: 100,
        gradeLetter: 'A',
        recordedById: staff.id,
      },
      {
        studentId: student2.id,
        subject: 'PHYSICS',
        examName: 'Term Assessment',
        score: 76,
        maxScore: 100,
        gradeLetter: 'C',
        recordedById: staff.id,
      },
      {
        studentId: student3.id,
        subject: 'MATHEMATICS',
        examName: 'Term Assessment',
        score: 81,
        maxScore: 100,
        gradeLetter: 'B',
        recordedById: mathStaff.id,
      },
    ],
  });

  await prisma.fee.createMany({
    data: [
      {
        studentId: student1.id,
        title: 'Tuition - Term 1',
        description: 'Term 1 tuition fee',
        amount: 1500,
        amountPaid: 500,
        status: FeeStatus.PARTIAL,
        dueDate: new Date('2026-04-01'),
        createdById: admin.id,
      },
      {
        studentId: student1.id,
        title: 'Lab Fee',
        amount: 120,
        amountPaid: 120,
        status: FeeStatus.PAID,
        paidAt: new Date(),
        createdById: admin.id,
      },
      {
        studentId: student2.id,
        title: 'Tuition - Term 1',
        amount: 1500,
        amountPaid: 0,
        status: FeeStatus.PENDING,
        dueDate: new Date('2026-04-01'),
        createdById: admin.id,
      },
    ],
  });

  const assignment = await prisma.assignment.create({
    data: {
      title: 'Newton Laws Worksheet',
      description: 'Complete questions 1-10 from chapter 3.',
      subject: 'Physics',
      dueDate: new Date('2026-04-15'),
      schoolClassId: classA.id,
      createdById: staff.id,
      maxScore: 50,
    },
  });

  await prisma.assignmentSubmission.create({
    data: {
      assignmentId: assignment.id,
      studentId: student1.id,
      content: 'Attached answers for questions 1-10.',
      score: 45,
      isGraded: true,
      status: 'APPROVED',
      attemptCount: 1,
    },
  });

  await prisma.leaveRequest.create({
    data: {
      requesterId: student2.id,
      reason: 'Family event',
      startDate: new Date('2026-04-10'),
      endDate: new Date('2026-04-11'),
      status: 'PENDING',
    },
  });

  await prisma.message.create({
    data: {
      senderId: staff.id,
      receiverId: student1.id,
      subject: 'Lab report reminder',
      body: 'Please submit your lab report by Thursday.',
    },
  });

  console.log('Seed complete.');
  console.log('Demo logins (password: password123):');
  console.log('  admin@school.com');
  console.log('  staff@school.com (Physics · 10-A)');
  console.log('  math@school.com (Mathematics · 9-B)');
  console.log('  Tip: assign one teacher per subject to a class; toppers need all 10 subjects.');
  console.log('  student@school.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
