# HTTP Lab

Express 5 + Prisma 7 (PostgreSQL) ile yazılmış, JWT tabanlı kimlik doğrulama
ve rol bazlı yetkilendirme (RBAC) içeren bir REST API projesi. Proje,
kategori bazlı ürünler (`Item`) üzerinde CRUD işlemleri sunar.

> **Week 4 güncellemesi**: Bu sürümde proje SOLID prensipleri ışığında
> refactor edildi ve kapsamlı bir test paketi (unit + integration) eklendi.
> Refactor sürecinin BEFORE/AFTER örnekleri için `REFACTORING_DIARY.md`
> dosyasına bakın.

## Özellikler

- **Kimlik doğrulama**: Kayıt ol / giriş yap, `bcrypt` ile şifre hashleme, `jsonwebtoken` ile access & refresh token üretimi
- **Rol bazlı yetkilendirme (RBAC)**: `ADMIN`, `EDITOR`, `VIEWER` rolleri
- **Sahiplik kontrolü**: Kullanıcılar (ADMIN hariç) yalnızca kendi oluşturdukları ürünleri silebilir
- **Prisma 7 + `@prisma/adapter-pg`**: PostgreSQL ile driver adapter üzerinden, uygulama genelinde **tek bir paylaşılan** bağlantı
- **Merkezi hata yönetimi** ve **request logging** middleware'leri
- **Login rate limiting**: `express-rate-limit` ile 15 dakikada IP başına 5 deneme sınırı (test ortamında devre dışı)
- **%94 test coverage** — 43 test (23 unit + 12 integration + diğer), gerçek bir PostgreSQL test veritabanına karşı çalışır
- Postman koleksiyonu (`http-lab.postman_collection.json`) ile hazır istek örnekleri

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Runtime | Node.js |
| Web Framework | Express ^5.2.1 |
| ORM | Prisma ^7.8.0 (`@prisma/client`, `@prisma/adapter-pg`) |
| Veritabanı | PostgreSQL (`pg`) |
| Kimlik Doğrulama | `jsonwebtoken`, `bcrypt` |
| Test | `jest`, `supertest` |
| Ortam Değişkenleri | `dotenv` |
| Geliştirme | `nodemon` |

---

## SOLID Analizi (Refactor Öncesi Bulgular)

Refactor'a başlamadan önce mevcut koddaki SOLID ihlalleri şu üç soru
üzerinden incelendi. Ayrıntılı BEFORE/AFTER örnekleri için
`REFACTORING_DIARY.md` dosyasına bakın.

### 1. SRP — Tek bir fonksiyonun birden fazla işi var mıydı?

- **`src/routes/auth.js`** (`/login`, `/register` handler'ları): HTTP
  isteğini yönetme, girdi doğrulama, **şifre hashleme kararı** (bcrypt,
  salt rounds = 12), **JWT üretim stratejisi** (payload şekli, `expiresIn`
  süreleri) ve veritabanı erişimini aynı anda taşıyordu.
- **`src/middleware/authMiddleware.js`**: `jwt.verify` çağrısı doğrudan
  middleware gövdesine gömülmüştü; "token nasıl doğrulanır" kuralı
  "Express isteğini nasıl işlerim" sorumluluğuyla iç içeydi.
- **`src/app.js`**: Hem Express uygulamasını inşa ediyor hem de
  `app.listen(...)` ile sunucuyu gerçekten başlatıyordu — "ne" ile "nasıl
  çalıştırılır" sorumlulukları aynı dosyadaydı ve bu, dosyanın test
  amacıyla import edilmesini bile imkansız kılıyordu (import etmek otomatik
  olarak bir port açıyordu).

### 2. OCP — Yeni özellik eklemek için mevcut kodu değiştirmek gerekiyor muydu?

- Token üretim mantığı (`jwt.sign` çağrıları) `auth.js` içine gömülü
  olduğundan, token süresini, algoritmasını veya payload yapısını
  değiştirmek doğrudan route dosyasının düzenlenmesini gerektiriyordu.
- Şifre hashleme stratejisi (salt rounds sabiti) route içinde satır
  içiydi; ileride farklı bir hashing yaklaşımına geçmek yine route
  dosyasına dokunmayı gerektirirdi.
- Login rate limiting kuralı (`max: 5`) hiçbir ortam farkı gözetmeden
  sabitti — bu, testlerde IP başına 5 istekten sonra tüm login
  isteklerinin 429 ile engellenmesine (dolayısıyla testlerin "sessizce"
  403/undefined token almasına) yol açan gerçek bir sorun olarak ortaya
  çıktı.

### 3. DI — Bağımlılıklar sınıf/modül içinde mi oluşturuluyordu?

- **En kritik bulgu**: `src/routes/auth.js` ve `src/store/itemsDb.js`,
  birbirinden tamamen bağımsız İKİ AYRI `Pool` + `PrismaPg` adapter +
  `PrismaClient` üçlüsü oluşturuyordu. Aynı uygulama için iki ayrı
  veritabanı bağlantı havuzu açılıyordu; bu hem kaynak israfıydı hem de
  test sırasında bu bağımlılığı sahte (mock) bir client ile değiştirmeyi
  pratik olarak imkansız kılıyordu.
- `itemsDb.js`, somut `PrismaClient` sınıfına doğrudan bağımlıydı; routes
  katmanı bu modülü import ederken bir soyutlama üzerinden değil,
  doğrudan somut implementasyon üzerinden çalışıyordu.

**Refactor sonrası çözüm özeti**: `src/db/prisma.js` içinde tek bir
paylaşılan Prisma client singleton'ı; `src/utils/tokenService.js` ve
`src/utils/passwordService.js` içinde izole edilmiş, saf ve bağımsız test
edilebilir servisler; `src/app.js` / `src/server.js` ayrımı ile test
edilebilir bir Express uygulaması.

---

## Proje Yapısı (Refactor Sonrası)

```
http-lab/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── app.js                    # Express app'i İNŞA EDER, dinlemeye başlamaz (test edilebilir)
│   ├── server.js                 # app.js'i import edip gerçekten dinlemeye başlatan tek yer
│   ├── db/
│   │   └── prisma.js             # Uygulama genelinde TEK paylaşılan Prisma client (DIP)
│   ├── utils/
│   │   ├── tokenService.js       # JWT üretme/doğrulama — saf, bağımsız test edilebilir
│   │   └── passwordService.js    # bcrypt hash/compare — saf, bağımsız test edilebilir
│   ├── middleware/
│   │   ├── authMiddleware.js     # authenticateToken & requireRole (artık tokenService kullanır)
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   ├── routes/
│   │   ├── auth.js               # Artık sadece orkestrasyon yapar (SRP)
│   │   └── items.js
│   └── store/
│       └── itemsDb.js            # Paylaşılan prisma client'ı kullanır, create() bug'ı düzeltildi
├── tests/
│   ├── jest.setup.js             # .env.test'i yükler
│   ├── testUtils/resetDb.js      # Her testten önce DB'yi temizler
│   ├── unit/
│   │   ├── tokenService.test.js
│   │   ├── passwordService.test.js
│   │   └── authMiddleware.test.js
│   └── integration/
│       ├── auth.integration.test.js
│       └── items.integration.test.js
├── REFACTORING_DIARY.md
├── http-lab.postman_collection.json
├── prisma.config.ts
├── .env.example
└── package.json
```

## Veri Modeli

- **User**: `email`, `name`, `password` (bcrypt hash), `role` (`ADMIN` / `EDITOR` / `VIEWER`, varsayılan `VIEWER`), `refreshToken`
- **Category**: `name` (unique), birden çok `Item` ile ilişkili
- **Item**: `name`, `price`, `description` (opsiyonel), bir `Category`'e ve opsiyonel olarak onu oluşturan `User`'a bağlı

## Kurulum

### Gereksinimler
- Node.js
- Çalışan bir PostgreSQL sunucusu

### Adımlar

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. `.env.example` dosyasını `.env` olarak kopyalayıp kendi değerlerinizle doldurun:
   ```
   PORT=3000
   NODE_ENV=development
   DATABASE_URL="postgresql://<kullanici>:<sifre>@localhost:5432/<veritabani_adi>"
   JWT_ACCESS_SECRET=<guclu-bir-gizli-anahtar>
   JWT_REFRESH_SECRET=<guclu-bir-gizli-anahtar>
   ```

3. Migration'ları uygulayın:
   ```bash
   npx prisma migrate deploy
   # geliştirme ortamında: npx prisma migrate dev
   ```

4. (Opsiyonel) Örnek verilerle veritabanını doldurun:
   ```bash
   npx prisma db seed
   ```

5. Sunucuyu başlatın:
   ```bash
   npm run dev     # nodemon ile (geliştirme), src/server.js'i çalıştırır
   npm start       # üretim modu
   ```

Sunucu varsayılan olarak `http://localhost:3000` adresinde çalışır.

## API Uç Noktaları

### Health Check
| Metod | Yol | Açıklama |
|---|---|---|
| GET | `/health` | Servisin ayakta olup olmadığını kontrol eder |

### Auth (`/api/auth`)
| Metod | Yol | Açıklama | Not |
|---|---|---|---|
| POST | `/register` | Yeni kullanıcı oluşturur | `email`, `password`, `name` zorunlu; `role` gönderilmezse `VIEWER` |
| POST | `/login` | Giriş yapar, access & refresh token döner | 15 dk'da IP başına 5 istekle sınırlı (test ortamında pas geçilir) |

### Items (`/api/items`) — tümü `authenticateToken` gerektirir
| Metod | Yol | Açıklama | Gerekli Rol |
|---|---|---|---|
| GET | `/` | Tüm ürünleri listeler | Giriş yapmış herkes |
| GET | `/:id` | Tek bir ürünü getirir | Giriş yapmış herkes |
| POST | `/` | Yeni ürün oluşturur | `EDITOR` (veya `ADMIN`) |
| PUT | `/:id` | Ürünü tamamen günceller | `EDITOR` (veya `ADMIN`) |
| PATCH | `/:id` | Ürünü kısmen günceller | `EDITOR` (veya `ADMIN`) |
| DELETE | `/:id` | Ürünü siler | `EDITOR`/`ADMIN`, yalnızca kendi oluşturduğu ürün (ADMIN istisna) |

İstekler `Authorization: Bearer <accessToken>` header'ı ile gönderilmelidir.

---

## Testler

### Test Piramidi

**Unit Tests** (`tests/unit/`, DB veya ağ bağlantısı gerektirmez):
- `tokenService.test.js` — access/refresh token üretimi, geçerli/geçersiz/süresi dolmuş token doğrulama
- `passwordService.test.js` — bcrypt hash üretimi, salt farkı, doğru/yanlış şifre karşılaştırma
- `authMiddleware.test.js` — `authenticateToken` (token yok / geçerli / geçersiz) ve `requireRole` (izinli rol, ADMIN bypass, izinsiz rol, string/array rol girdisi) — mock `req`/`res`/`next` ile

**Integration Tests** (`tests/integration/`, **gerçek PostgreSQL test veritabanına** karşı, Supertest ile in-process HTTP):
- `auth.integration.test.js` — kayıt, e-posta çakışması (409), `POST /api/auth/login` başarılı giriş ve token'ların DB'ye yazılması, yanlış şifre (401), olmayan kullanıcı (401), token olmadan erişim (401), yetersiz rolle erişim (403), **süresi dolmuş token senaryosu** (403)
- `items.integration.test.js` — CRUD uç noktaları, sahiplik kontrolü (kendi ürünü olmayanı silememe → 403), ADMIN bypass, validasyon hataları (400), bulunamayan kayıt (404)

Testler ayrı bir `http_lab_test` veritabanı kullanır (`.env.test`); her test
öncesi `tests/testUtils/resetDb.js` ile tablolar temizlenir, böylece testler
birbirinden bağımsız ve tekrarlanabilir çalışır.

### Çalıştırma

```bash
npm test               # tüm testler
npm run test:unit      # sadece unit testler
npm run test:integration  # sadece integration testler (DB gerektirir)
npm run test:coverage  # coverage raporuyla birlikte
```

### `npm run test:coverage` Çıktısı

```
File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------------|---------|----------|---------|---------|-------------------
All files            |   94.04 |    89.55 |   93.54 |   94.04 |
 src                 |   88.23 |      100 |       0 |   88.23 |
  app.js             |   88.23 |      100 |       0 |   88.23 | 41,51
 src/db              |     100 |      100 |     100 |     100 |
  prisma.js          |     100 |      100 |     100 |     100 |
 src/middleware      |     100 |    93.75 |     100 |     100 |
  authMiddleware.js  |     100 |      100 |     100 |     100 |
  errorHandler.js    |     100 |       75 |     100 |     100 | 13
  requestLogger.js   |     100 |      100 |     100 |     100 |
 src/routes          |   90.36 |    93.54 |     100 |   90.36 |
  auth.js            |   91.42 |    84.61 |     100 |   91.42 | 27,51,89
  items.js           |   89.58 |      100 |     100 |   89.58 | 18,31,71,81,102
 src/store           |     100 |    71.42 |     100 |     100 |
  itemsDb.js         |     100 |    71.42 |     100 |     100 | 56,58-72
 src/utils           |     100 |      100 |     100 |     100 |
  passwordService.js |     100 |      100 |     100 |     100 |
  tokenService.js    |     100 |      100 |     100 |     100 |
---------------------|---------|----------|---------|---------|-------------------

Test Suites: 5 passed, 5 total
Tests:       43 passed, 43 total
Time:        15.8 s
```

**Hedef %80'in üzerinde**: Statements %94.04, Branches %89.55, Functions
%93.54, Lines %94.04. `package.json` içindeki `jest.coverageThreshold`
ayarı (80/70/80/80) `npm run test:coverage` komutunu, eşiklerin altına
düşülmesi durumunda başarısız (exit code ≠ 0) yapacak şekilde
yapılandırılmıştır. `src/app.js`'in kalan kapsanmamış satırları
(`module.exports` civarı) ve `errorHandler.js`'in tek eksik dalı,
davranışsal olarak önemsiz satırlardır.

---

## Bilinen Sorunlar / Dikkat Edilmesi Gerekenler

- Yüklenen arşivde `.env` dosyası, içinde gerçek görünen bir veritabanı
  şifresi ve JWT gizli anahtarlarıyla birlikte mevcuttu. Bu dosyanın
  repoya/paylaşıma dahil edilmemesi ve `.gitignore` ile hariç tutulması
  (zaten hariç tutuluyor), ayrıca bu anahtarların üretimde değiştirilmesi
  önerilir.
- `PUT` ve `PATCH` uç noktalarında da `requireRole('EDITOR')` kontrolü
  var; sahiplik (ownership) kontrolü yalnızca `DELETE` işleminde
  uygulanmış — istenirse güncelleme işlemlerine de eklenebilir.
- Refactor sırasında, testler yazılırken `itemsDb.js`'te gerçek bir bug
  bulundu ve düzeltildi: `user.connect` yanlışlıkla `category` objesinin
  içine gömülmüştü ve her `POST /api/items` isteğinde 500 hatasına yol
  açıyordu (ayrıntı için `REFACTORING_DIARY.md`).

## Postman Koleksiyonu

`http-lab.postman_collection.json` dosyasını Postman'a import ederek hazır isteklerle API'yi test edebilirsiniz.
