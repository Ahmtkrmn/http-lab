// Tüm testlerden önce çalışır: test ortamı için .env.test dosyasını yükler.
const fs = require('fs');
const path = require('path');

const envTestPath = path.resolve(__dirname, '..', '.env.test');

if (!fs.existsSync(envTestPath)) {
  // .env.test yoksa testler "secretOrPrivateKey must have a value" gibi
  // anlaşılması zor hatalarla sessizce başarısız olur. Bunun yerine net
  // bir yönlendirme veriyoruz.
  throw new Error(
    '\n\n[TEST SETUP HATASI] ".env.test" dosyası bulunamadı.\n' +
    '  1) ".env.test.example" dosyasını ".env.test" olarak kopyalayın.\n' +
    '  2) İçindeki DATABASE_URL\'in gerçek, ÇALIŞAN ve BOŞ bir PostgreSQL\n' +
    '     test veritabanını gösterdiğinden emin olun (örn. http_lab_test).\n' +
    '  3) Migration\'ları o veritabanına uygulayın: \n' +
    '     npx dotenv -e .env.test -- npx prisma migrate deploy\n' +
    '  Ayrıntı için README.md > "Testler" bölümüne bakın.\n'
  );
}

require('dotenv').config({ path: envTestPath, quiet: true });
