const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const date = new Date(Date.UTC(y, Number(m) - 1, Number(d)));

  const classA = await p.schoolClass.findFirst({
    where: { name: '10', section: 'A' },
  });
  if (!classA) throw new Error('Class 10-A not found');

  const staff = await p.user.findFirst({
    where: { email: 'staff@school.com' },
  });
  if (!staff) throw new Error('staff not found');

  const students = await p.studentProfile.findMany({
    where: { schoolClassId: classA.id },
    include: { user: true },
  });

  for (const student of students) {
    await p.attendance.upsert({
      where: {
        studentId_date: { studentId: student.userId, date },
      },
      create: {
        studentId: student.userId,
        date,
        status: 'PRESENT',
        schoolClassId: classA.id,
        markedById: staff.id,
      },
      update: {
        status: 'PRESENT',
        schoolClassId: classA.id,
        markedById: staff.id,
      },
    });
  }

  const forTest = await p.attendance.findMany({
    where: { student: { email: 'user@gmail.com' } },
  });
  console.log(
    'Marked',
    students.length,
    'students for',
    `${y}-${m}-${d}`,
    'test records:',
    forTest,
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await p.$disconnect();
  });
