const { getPrismaClient } = require('../../src/db/prisma');

async function resetDb() {
  const prisma = getPrismaClient();
  // Foreign key sırasına dikkat ederek temizle: önce Item, sonra User/Category.
  await prisma.item.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.category.deleteMany({});
}

module.exports = { resetDb };
