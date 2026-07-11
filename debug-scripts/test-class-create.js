const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found');
      return;
    }
    const classroom = await prisma.classroom.create({
      data: {
        userId: user.id,
        name: 'Test Class',
        subject: 'Math',
        grade: 'Grade 10',
        curriculum: 'CAPS',
        studentCount: 30,
        averagePercentile: 65,
        teachingNotes: '',
        students: [],
        assessmentColumns: []
      }
    });
    console.log('Success:', classroom.id);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
