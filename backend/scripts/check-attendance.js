const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const att = await p.attendance.findMany({
    include: { student: { select: { email: true, firstName: true, id: true } } },
    orderBy: { date: 'desc' },
    take: 20,
  });
  console.log(
    'ATTENDANCE',
    JSON.stringify(
      att.map((a) => ({
        date: a.date,
        status: a.status,
        studentId: a.studentId,
        email: a.student.email,
        name: a.student.firstName,
        classId: a.schoolClassId,
      })),
      null,
      2,
    ),
  );

  const students = await p.user.findMany({
    where: { role: 'STUDENT' },
    include: { studentProfile: true },
  });
  console.log(
    'STUDENTS',
    JSON.stringify(
      students.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.firstName,
        roll: u.studentProfile?.studentId,
        classId: u.studentProfile?.schoolClassId,
      })),
      null,
      2,
    ),
  );

  const staff = await p.staffProfile.findMany({
    include: { user: { select: { email: true, firstName: true } }, assignedClass: true },
  });
  console.log(
    'STAFF',
    JSON.stringify(
      staff.map((s) => ({
        email: s.user.email,
        name: s.user.firstName,
        subject: s.subject,
        class: s.assignedClass
          ? `${s.assignedClass.name}-${s.assignedClass.section}`
          : null,
        classId: s.assignedClassId,
      })),
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await p.$disconnect();
  });
