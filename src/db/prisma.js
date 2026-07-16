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
// Week 8: `pg` Pool örneğine ayrı bir referans tutuyoruz. Neden?
// `active_db_connections` metriği (bkz. src/metrics/metrics.js) bağlantı
// havuzunun ANLIK durumunu (kaç bağlantı açık/boşta) okumak zorunda; bu bilgi
// Prisma client'ında değil, alttaki pg Pool'unda (totalCount/idleCount) yaşıyor.
// Adapter deseni Pool'u içeride sakladığı için dışarıdan erişemiyorduk — bu yüzden
// oluşturduğumuz anda referansını yakalayıp getPool() ile dışa açıyoruz.
let poolInstance = null;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  poolInstance = new Pool({ connectionString });
  const adapter = new PrismaPg(poolInstance);
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }
  return prismaInstance;
}

// pg Pool'una erişim (yalnızca metrics içindir). `null` dönebilir: henüz hiç
// DB bağlantısı kurulmadıysa (getPrismaClient hiç çağrılmadıysa) Pool da yoktur —
// çağıran taraf bu durumu tolere etmeli (gauge'da 0 raporlamak gibi).
function getPool() {
  return poolInstance;
}

module.exports = { getPrismaClient, getPool };
