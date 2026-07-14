require('dotenv').config({ quiet: true });
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// 1. Veritabanı bağlantı adresimizi alıyoruz
const connectionString = process.env.DATABASE_URL;

// 2. Standart bir PostgreSQL bağlantı havuzu (Pool) oluşturuyoruz
const pool = new Pool({ connectionString });

// 3. Bu havuzu Prisma'nın anlayacağı bir adaptöre çeviriyoruz
const adapter = new PrismaPg(pool);

// 4. Ve nihayet PrismaClient'ı bu adaptör ile başlatıyoruz (İşte Prisma 7'nin istediği şey!)
const prisma = new PrismaClient({ adapter });

async function main() {
  // 'upsert' means "Update or Insert". 
  // It checks if a record exists. If yes, it does nothing (update: {}). If no, it creates it.
  // This is crucial for idempotency — we can run this seed script 100 times without duplicating categories.
  const electronics = await prisma.category.upsert({
    where: { name: 'electronics' },
    update: {},
    create: { name: 'electronics' },
  });

  // Upsert the 'furniture' category
  const furniture = await prisma.category.upsert({
    where: { name: 'furniture' },
    update: {},
    create: { name: 'furniture' },
  });

  // Create initial items and link them to the newly created category IDs
  // createMany is used for batch inserting multiple rows efficiently
  await prisma.item.createMany({
    data: [
      { name: 'Laptop', price: 1500, categoryId: electronics.id },
      { name: 'Desk', price: 350, categoryId: furniture.id },
    ],
    // skipDuplicates ensures we don't throw an error if items with these IDs already exist
    skipDuplicates: true,
  });

  console.log('[SYSTEM] Database seeding completed successfully ✅');
}

// Execute the main function
main()
  // Catch and log any errors
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  // Finally, disconnect the Prisma client to avoid leaving open database connections
  .finally(async () => {
    await prisma.$disconnect();
  });