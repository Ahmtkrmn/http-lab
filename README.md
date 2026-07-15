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

### Yöntem A — Docker Compose (önerilen, asıl yöntem)

Bu proje, production'da da (Railway/Render) container olarak çalışacağı için,
yerelde de aynı şekilde `docker compose up` ile çalıştırılması **canonical**
(asıl) yöntem kabul edilir — "kendi bilgisayarımda çalışıyor ama container'da
çalışmıyor" sürprizlerini önler. Neden bu karar verildi, bkz. `LEARNING_LOG.md`.

1. `.env.example` dosyasını `.env` olarak kopyalayın; `DATABASE_URL`'deki host
   kısmını **`db`** olarak bırakın (bu, `docker-compose.yml`'deki servis adıdır,
   `localhost` DEĞİL — container'lar birbirine Docker'ın iç DNS'i üzerinden bu
   isimle ulaşır).
2. ```bash
   docker compose up --build
   ```
   Bu komut `app` (API), `db` (PostgreSQL) ve `adminer` (DB yönetim arayüzü,
   `http://localhost:8080`) servislerini ayağa kaldırır. `app` container'ı
   açılırken `Dockerfile`'daki `CMD` sayesinde migration'ları otomatik uygular.
3. Sunucu `http://localhost:3000` adresinde çalışır.

Kod değiştirdikçe image'ı yeniden build etmeniz gerekir (`docker compose up
--build`); `package*.json` değişmediyse Docker'ın layer cache'i sayesinde
`npm ci` adımı tekrar çalışmaz, sadece kaynak kod kopyalanır — bu yüzden
rebuild beklenenden hızlıdır.

### Yöntem B — Native (`npm run dev`, hızlı iterasyon için)

Sık kod değişikliği yapıp anında yeniden yükleme (hot reload) istiyorsanız,
uygulamayı container dışında, `nodemon` ile native çalıştırabilirsiniz. Bu
durumda Postgres'e host makineden erişmeniz gerektiği için:

1. `.env`'de `DATABASE_URL` host kısmını `localhost` yapın.
2. `docker-compose.yml`'deki `db` servisine **geçici olarak** (commit
   etmeden) şunu ekleyin:
   ```yaml
   ports:
     - "5432:5432"
   ```
3. ```bash
   npm install               # postinstall -> prisma generate
   docker compose up db adminer   # sadece veritabanını container'da çalıştır
   npx prisma migrate deploy      # veya geliştirmede: npx prisma migrate dev
   npx prisma db seed             # (opsiyonel) örnek veri
   npm run dev                    # nodemon ile src/server.js
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

### Testleri Çalıştırmadan Önce (Kurulum)

1. `npm install` çalıştırın — bu, `postinstall` script'i sayesinde
   `npx prisma generate`'i otomatik tetikler. Eğer ağ/proxy kısıtlaması
   yüzünden bu adım başarısız olursa, elle çalıştırın:
   ```bash
   npx prisma generate
   ```
2. `.env.test.example` dosyasını `.env.test` olarak kopyalayın ve
   `DATABASE_URL`'i gerçek, boş bir test veritabanına işaret edecek şekilde
   düzenleyin (varsayılan: `http_lab_test`).
3. O veritabanını (henüz yoksa) oluşturun:
   ```bash
   createdb http_lab_test   # ya da: psql -c "CREATE DATABASE http_lab_test;"
   ```
4. `npm test` çalıştırın.

**Migration'ları elle uygulamanıza gerek yok**: `package.json`'daki
`pretest` script'i (`npm run db:migrate:test`), `npm test` / `npm run
test:coverage` her çalıştığında `.env.test`'teki `DATABASE_URL`'e
`prisma migrate deploy`'u otomatik uygular. Bunu elle tetiklemek isterseniz:
```bash
npm run db:migrate:test
```

> ⚠️ **Sık yapılan hata**: `npx prisma migrate deploy`'u DOĞRUDAN (dotenv-cli
> olmadan) çalıştırırsanız, Prisma CLI varsayılan olarak `.env` dosyasını
> okur — `.env.test`'i DEĞİL. Bu durumda migration'lar yanlışlıkla
> geliştirme veritabanınıza (`http_lab_db`) uygulanır ve test veritabanınız
> (`http_lab_test`) boş kalır; testler
> `"The table 'public.Item' does not exist in the current database"`
> hatasıyla çöker. Bu yüzden proje artık `dotenv-cli` kullanarak doğru
> ortam dosyasını açıkça belirtiyor (`db:migrate:test` script'ine bakın) ve
> bu adımı `pretest` ile otomatikleştiriyor — elle bu hatayı yapmanız
> artık mümkün değil.

`.env.test` bulunamazsa `tests/jest.setup.js`, "secretOrPrivateKey must have
a value" gibi anlaşılması güç hatalar yerine yukarıdaki adımları özetleyen
açık bir hata mesajı fırlatır.

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
- **Sonradan düzeltilen paketleme hatası**: Teslim edilen ilk zip'te
  `.env`/`.env.test` (içlerinde sır olduğu için) hariç tutulmuştu, ama
  yerlerine `.env.test.example` konmamıştı ve `package.json`'da
  `postinstall: prisma generate` script'i yoktu. Sonuç: `npm install`
  sonrası `@prisma/client` üretilmemiş oluyor (integration test suite'leri
  hiç yüklenemiyordu) ve `.env.test` yokluğunda `JWT_ACCESS_SECRET`
  `undefined` kalarak unit testlerin yarısı da "secretOrPrivateKey must
  have a value" hatasıyla çöküyordu — kullanıcının bildirdiği "testlerin
  yarısı geçmiyor" şikayetinin sebebi buydu. Artık `.env.test.example`
  eklendi, `postinstall` script'i eklendi ve `.env.test` eksikse
  `tests/jest.setup.js` açıklayıcı bir hata fırlatıyor.
- **İkinci tur düzeltme — test DB'sine migration uygulanmamış olması**:
  Kullanıcı ortamında `.env.test` doğru oluşturulmuştu ama testler
  `"The table 'public.Item' does not exist in the current database"`
  hatasıyla çöktü. Kök neden: `npx prisma migrate deploy`'un varsayılan
  olarak `.env` dosyasını okuması, `.env.test`'i değil — yani migration'lar
  yanlış (geliştirme) veritabanına uygulanmış, test veritabanı boş
  kalmıştı. Çözüm: `dotenv-cli` devDependency olarak eklendi,
  `db:migrate:test` script'i `.env.test`'i açıkça hedefleyecek şekilde
  yazıldı ve `pretest`/`pretest:coverage` ile `npm test` her çalıştığında
  bu migration otomatik uygulanacak şekilde bağlandı.

## Postman Koleksiyonu

`http-lab.postman_collection.json` dosyasını Postman'a import ederek hazır isteklerle API'yi test edebilirsiniz.
