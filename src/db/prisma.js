// Uygulama genelinde TEK bir Prisma Client örneği.
//
// SOLID / DIP notu:
// Refactor öncesinde hem src/routes/auth.js hem de src/store/itemsDb.js
// kendi Pool + PrismaPg adapter + PrismaClient üçlüsünü ayrı ayrı
// oluşturuyordu. Bu; (a) iki ayrı bağlantı havuzu açarak kaynak israfına
// yol açıyor, (b) her modülü somut bir bağımlılığa (concrete PrismaClient)
// sıkı sıkıya bağlıyor ve (c) test sırasında bu bağımlılığı sahte (fake/mock)
// bir client ile değiştirmeyi neredeyse imkansız kılıyordu.
//
// Bu modül, bağımlılığı tek bir yerden üretip dışa aktararak (module-level
// singleton) Dependency Injection'a uygun bir yapı sağlar: tüketen
// modüller (routes/auth.js, store/itemsDb.js) somut PrismaClient'ı DEĞİL,
// bu modülün export ettiği örneği kullanır. Testlerde de aynı yöntemle
// jest.mock('../db/prisma') çağrılarak kolayca sahte bir client enjekte
// edilebilir.
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

let prismaInstance = null;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }
  return prismaInstance;
}

module.exports = { getPrismaClient };
