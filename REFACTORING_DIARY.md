# Refactoring Diary — Week 4

Bu dosya, `http-lab` projesinde yapılan SOLID odaklı refactor sürecini
BEFORE → AFTER → NEDEN formatında belgeler. SOLID analizinin tam metni
`README.md` içindeki "SOLID Analizi" bölümündedir.

---

## Örnek 1 — Dependency Injection: Çift Prisma Bağlantısı

### BEFORE

```js
// src/routes/auth.js (eski)
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// src/store/itemsDb.js (eski) — TAMAMEN AYRI bir bağlantı daha
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['query'] });
```

### AFTER

```js
// src/db/prisma.js — tek bir yerde üretilen singleton
function getPrismaClient() {
  if (!prismaInstance) prismaInstance = createPrismaClient();
  return prismaInstance;
}
module.exports = { getPrismaClient };

// src/routes/auth.js ve src/store/itemsDb.js
const { getPrismaClient } = require('../db/prisma');
const prisma = getPrismaClient();
```

### NEDEN Daha İyi?

- **DIP ihlali giderildi**: İki modül artık kendi somut `PrismaClient`
  örneğini üretmiyor; ortak bir soyutlamadan (module export) alıyor.
- **Kaynak israfı önlendi**: Uygulama başına iki ayrı PostgreSQL connection
  pool açılması, bağlantı limiti ve tutarsız yaşam döngüsü riskiydi.
- **Test edilebilirlik arttı**: Testlerde `jest.mock('../db/prisma')` ile
  tek bir noktadan sahte (fake) client enjekte etmek mümkün; eskiden her
  dosyanın kendi `require('@prisma/client')` çağrısını ayrı ayrı mock'lamak
  gerekirdi.

---

## Örnek 2 — SRP: Route Handler'da İş Mantığının Dağılması

### BEFORE

```js
// src/routes/auth.js (eski) — login handler'ının içinde:
const hashedPassword = await bcrypt.hash(password, 12);
...
const accessToken = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: '15m' }
);
const refreshToken = jwt.sign(
  { userId: user.id },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);
```

Tek bir route handler; HTTP isteğini yönetme, şifre hashleme kararı
(salt rounds = 12), token üretim stratejisi (süre, payload şekli) ve
veritabanı erişimini AYNI ANDA taşıyordu.

### AFTER

```js
// src/utils/passwordService.js
async function hashPassword(p) { return bcrypt.hash(p, SALT_ROUNDS); }

// src/utils/tokenService.js
function generateAccessToken(payload, secret = process.env.JWT_ACCESS_SECRET) {
  return jwt.sign({ userId: payload.userId, role: payload.role }, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

// src/routes/auth.js (yeni) — sadece orkestrasyon yapar
const hashedPassword = await hashPassword(password);
const accessToken = generateAccessToken({ userId: user.id, role: user.role });
const refreshToken = generateRefreshToken({ userId: user.id });
```

### NEDEN Daha İyi?

- **SRP sağlandı**: Route artık sadece "isteği al, doğru servisleri sırayla
  çağır, yanıt dön" sorumluluğunu taşıyor; "şifre nasıl güvenli hale
  getirilir" ve "token nasıl üretilir" soruları kendi modüllerine taşındı.
- **OCP kolaylaştı**: Token süresini, algoritmasını veya salt round sayısını
  değiştirmek artık tek bir dosyada (tokenService.js / passwordService.js)
  yapılabiliyor; route dosyasına dokunmak gerekmiyor.
- **Unit test edilebilirlik**: `tokenService` ve `passwordService`, Express
  `req`/`res` nesnelerine hiç ihtiyaç duymadan, saf fonksiyonlar olarak
  doğrudan test edilebiliyor (bkz. `tests/unit/tokenService.test.js`,
  `tests/unit/passwordService.test.js`).

---

## Örnek 3 — Testability: `app.js` İçinde Gizli `app.listen()`

### BEFORE

```js
// src/app.js (eski) — dosyanın en altında
app.listen(PORT, () => {
  console.log(`[SYSTEM] Server is running successfully on http://localhost:${PORT}`);
});
```

`app.js`'i `require` etmek (örneğin bir test dosyasından) OTOMATİK olarak
gerçek bir ağ portu açıyordu. Bu da Supertest gibi in-process HTTP test
araçlarıyla test yazmayı imkansız kılıyordu — her test çalıştırmasında
port çakışması veya gereksiz gerçek bir sunucu ayağa kalkması riski vardı.

### AFTER

```js
// src/app.js (yeni) — sadece inşa eder, dışa aktarır
const app = express();
// ...middleware, route tanımları...
module.exports = app;

// src/server.js (yeni dosya) — sadece başlatır
const app = require('./app');
app.listen(PORT, () => { ... });
```

### NEDEN Daha İyi?

- **SRP sağlandı**: "Uygulamayı inşa etmek" ile "sunucuyu ağda dinletmek"
  iki ayrı sorumluluk olarak ayrıldı.
- **Test edilebilirlik**: `tests/integration/*.test.js` dosyaları artık
  `require('../../src/app')` ile gerçek bir port açmadan, doğrudan
  Supertest üzerinden in-process HTTP isteği gönderebiliyor.
- **Yan etki yok**: Modülü sadece `import`/`require` etmek artık hiçbir
  gözlemlenebilir yan etki (port açma) yaratmıyor — bu, iyi modül
  tasarımının temel prensiplerinden biridir.

---

## Bonus — Refactor Sürecinde Ortaya Çıkan Gerçek Bug

Entegrasyon testleri yazılırken (`POST /api/items`), `itemsDb.js` içindeki
`create` fonksiyonunda `user: { connect: ... }` alanının yanlışlıkla
`category` objesinin İÇİNE iç içe yazıldığı ortaya çıktı:

```js
// BEFORE (hatalı)
category: {
  connect: { id: parseInt(data.categoryId) },
  ...(data.userId && { user: { connect: { id: parseInt(data.userId) } } })
},
```

Bu, Prisma'nın `Unknown argument 'user'` hatasıyla her ürün oluşturma
isteğinde **500 Internal Server Error** dönmesine sebep oluyordu —
yani üretim kodunda hiç fark edilmemiş, testler olmadan gizli kalmış
kritik bir regresyon. `user` alanı `category` ile kardeş seviyeye
taşınarak düzeltildi. Bu, testlerin sadece "regresyonu önleme" değil,
**mevcut, fark edilmemiş buglar bulma** değerini de gösteriyor.
