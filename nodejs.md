# Node.js Öğreniyorum (http-lab Üzerinden)


---

## 1. Node.js nedir, Next.js'ten farkı ne?

- **Node.js**: JavaScript kodunu bir tarayıcı OLMADAN, doğrudan
  bilgisayarında/sunucunda çalıştırmanı sağlayan bir **çalışma ortamı**
  (runtime). Normalde JavaScript sadece tarayıcıda çalışırdı; Node.js
  sayesinde JavaScript ile sunucu, dosya sistemi, veritabanı bağlantısı
  gibi şeyler de yazılabiliyor. **Bu proje tam olarak budur**: Node.js
  üzerinde çalışan bir arka uç (backend) programı.
- **Express**: Node.js'in üzerine kurulan, "gelen HTTP isteklerini
  yönetmeyi kolaylaştıran" bir **kütüphane/framework**. Node.js'in
  kendi başına da bir `http` modülü var ama çok düşük seviyeli; Express
  route tanımlama, middleware zinciri gibi kolaylıklar ekliyor. Bu proje
  Express kullanıyor (`src/app.js`'in en tepesinde `require('express')`).
- **Next.js**: Node.js üzerinde çalışan, ama **React tabanlı frontend
  (ve isteğe bağlı backend) framework'ü**. Sayfa yönlendirme, server-side
  rendering, React bileşenleri gibi tamamen farklı bir problemi çözer —
  "kullanıcının GÖRDÜĞÜ arayüzü" oluşturmakla ilgilenir. Bu proje HİÇBİR
  ekran üretmiyor, sadece JSON döndüren bir API — yani Next.js'in çözdüğü
  problem burada yok.

Kısaca: **Node.js bir motor, Express o motorun üstüne kurulu bir arka uç
kütüphanesi, Next.js ise o motorun üstüne kurulu tamamen ayrı, arayüz
odaklı bir framework.** Aynı motoru (Node.js) kullanırlar ama farklı
işler için tasarlanmışlardır — biri arabaysa diğeri kamyon gibi düşün,
ikisi de motor kullanır ama farklı amaçla üretilmiştir.

---

## 2. Node.js'in modül sistemi: `require` / `module.exports`

Bu projedeki HER `.js` dosyasının başında/sonunda göreceğin en temel
Node.js kalıbı budur. Örnek — `src/utils/passwordService.js`:

```js
const bcrypt = require('bcrypt');   // (A) Dışarıdan bir modül/paket getir

const SALT_ROUNDS = 12;

async function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

module.exports = { SALT_ROUNDS, hashPassword, comparePassword };  // (B) Dışarı aç
```

- **(A) `require(...)`**: "bu dosyanın/paketin dışarı açtığı şeyi bana
  ver" demektir. `require('bcrypt')` → `node_modules/bcrypt` klasöründeki
  paketi getirir. `require('../db/prisma')` (göreli yol, başında `./`
  veya `../`) → projenin kendi başka bir dosyasını getirir.
- **(B) `module.exports = {...}`**: "bu dosyayı başka biri `require`
  ettiğinde eline bunlar geçsin" demektir. `passwordService.js`'i başka
  bir dosya `require('../utils/passwordService')` ile çağırırsa, eline
  `{ SALT_ROUNDS, hashPassword, comparePassword }` nesnesi geçer.

Bu sisteme **CommonJS** denir (Node.js'in klasik modül sistemi;
`package.json`'da `"type": "commonjs"` satırı bunu doğruluyor). Projede
zincirleme örneği:

```
routes/auth.js  --require-->  utils/passwordService.js  --require-->  bcrypt (npm paketi)
routes/auth.js  --require-->  db/prisma.js               --require-->  @prisma/client (npm paketi)
```

Her dosya, ihtiyacı olan parçayı başka dosyalardan "ödünç alarak" büyük
bir yapıyı oluşturuyor — hiçbir dosya her şeyi tek başına yapmıyor.

---

## 3. `npm` ve `package.json`: paket yönetimi

`npm` (Node Package Manager), Node.js ile birlikte gelen paket yöneticisi.
`package.json` (proje kökünde) şunları tanımlar:

- **`dependencies`**: uygulamanın ÇALIŞMASI için gereken paketler (örn.
  `express`, `@prisma/client`, `bcrypt`, `jsonwebtoken`, `pino`).
  `npm install` çalıştığında bunlar `node_modules/` klasörüne iner.
- **`devDependencies`**: sadece GELİŞTİRME sırasında gereken paketler
  (örn. `jest` test için, `eslint` kod taraması için, `nodemon` otomatik
  yeniden başlatma için) — production'a taşınmaz.
- **`scripts`**: `npm run <isim>` ile çalıştırabileceğin kısayol komutlar.
  Bu projedeki en önemlileri:

```json
"scripts": {
  "postinstall": "prisma generate",
  "dev": "nodemon src/server.js",
  "start": "node src/server.js",
  "test": "jest --runInBand --forceExit",
  "pretest": "npm run db:migrate:test"
}
```

npm'in bilmen gereken bir kuralı var: **`pre` ve `post` önekleri
otomatik zincirlenir.** Yani `npm run install` denince önce
`preinstall` (varsa), sonra `install`, sonra `postinstall` OTOMATİK
çalışır — kimse elle çağırmaz. Aynı şekilde `npm test` dendiğinde önce
`pretest` (test veritabanını güncelleyen script) otomatik tetiklenir.
Bu proje bu konvansiyonu bilinçli kullanıyor: `postinstall` sayesinde
`npm install` sonrası Prisma'nın kod üretimini unutmak imkânsız hale
geliyor.

---

## 4. Asenkron (async) çalışma: Node.js'in en önemli özelliği

Node.js **tek iş parçacıklıdır (single-threaded)** ama aynı anda binlerce
isteği yönetebilir — çünkü veritabanı sorgusu, dosya okuma, ağ isteği gibi
"bekleme gerektiren" işleri **asenkron (async)** yapar: işi başlatır,
sonucunu BEKLEMEDEN başka işlere geçer, sonuç hazır olunca geri döner.

Bu projede her yerde göreceğin `async`/`await` kalıbı tam olarak bunu
okunaklı hale getirir. Örnek — `src/store/itemsDb.js`:

```js
findAll: async () => {                      // (1) Bu fonksiyon asenkron
  return prisma.item.findMany({              // (2) await burada YOK ama
    include: { category: true },             //     return + async, Promise
    orderBy: { createdAt: 'desc' },           //     otomatik sarar
  });
},
```

Ve `src/routes/items.js`'de kullanımı:

```js
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const items = await itemsDb.findAll();   // (3) SONUÇ gelene kadar burada "beklenir"
    res.status(200).json({ data: items, total: items.length });
  } catch (err) {
    next(err);                                 // (4) Hata olursa errorHandler'a
  }
});
```

- `async` bir fonksiyonun başına yazıldığında, o fonksiyon her zaman bir
  **Promise** (gelecekte tamamlanacak bir söz) döner.
- `await`, "bu Promise sonuçlanana kadar SADECE BU FONKSİYONUN İÇİNDE
  bekle, ama Node.js'in geri kalanı bu sırada başka istekleri işlemeye
  devam etsin" demektir. Yani `await itemsDb.findAll()` çalışırken, aynı
  sunucu başka bir kullanıcının `POST /api/items` isteğini de paralel
  işleyebilir — çünkü bekleme CPU'yu bloklamıyor, sadece o fonksiyonun
  devamını erteliyor.
- **`try/catch` neden her yerde var?** Bir `await` edilen işlem
  (örn. veritabanı hatası, geçersiz veri) hata fırlatırsa, `catch`
  bloğu bunu yakalar ve `next(err)` ile Express'in `errorHandler`'ına
  yönlendirir — bu projenin standart hata yönetim kalıbı (bkz.
  `software.md` bölüm 8).

Karşılaştırma için "senkron (sync)" ne demek: eğer `await` olmasaydı ve
Node.js veritabanı cevabını beklerken HİÇBİR ŞEY yapamasaydı, aynı anda
sadece TEK bir kullanıcıya hizmet verebilirdi — her istek bir öncekinin
bitmesini beklerdi. Async yapı, Node.js'i düşük kaynakla yüksek
eşzamanlılık (concurrency) sağlayabilen bir sunucu yapan şeydir.

---

## 5. Express: Node.js üzerine kurulu web framework'ü

`src/app.js`'de gördüğün `app.use(...)`, `app.get(...)`, `app.post(...)`
gibi çağrıların hepsi Express'e ait. Üç temel kavram:

### a) Middleware

Bir middleware, `(req, res, next)` parametreleri alan bir fonksiyondur.
Ya isteği durdurur (cevap döner) ya da `next()` çağırarak sıradaki
middleware'e devreder. Bu projede `requestLogger`, `authenticateToken`,
`metricsMiddleware` hepsi birer middleware — ve **yazıldıkları sıra**
çalışma sırasını belirler (`software.md` bölüm 7-8'de tam akış var).

### b) Router / Route

```js
router.post('/', authenticateToken, requireRole('EDITOR'), async (req, res, next) => {...});
```

Bu satır Express'e "`POST` isteği, bu router'ın kök yoluna (`/`, yani
`/api/items`'e mount edildiği için tam adres `/api/items`) geldiğinde,
SIRAYLA `authenticateToken` → `requireRole('EDITOR')` → bu son fonksiyonu
çalıştır" der. Aynı satırda birden fazla middleware zincirlenebilir —
Express bunları soldan sağa, sırayla dener.

### c) `req` ve `res` nesneleri

- `req` (request): gelen isteğin HER BİLGİSİNİ taşır — `req.body` (POST
  verisi), `req.params` (`/:id` gibi URL parçaları), `req.headers`,
  ve bu projede middleware'lerin sonradan eklediği özel alanlar:
  `req.user` (authenticateToken tarafından), `req.log` (requestLogger
  tarafından), `req.id` (requestId).
- `res` (response): cevabı oluşturmak için kullanılır — `res.status(200)`,
  `res.json({...})`, `res.send()`.

---

## 6. Bu projede kullanılan npm paketlerinin ne işe yaradığı

| Paket | Ne için kullanılıyor (bu projede) |
|---|---|
| `express` | HTTP sunucusu + routing + middleware sistemi |
| `@prisma/client`, `prisma`, `@prisma/adapter-pg` | ORM — veritabanı tablolarını JS nesneleri gibi sorgulamayı sağlar (SQL elle yazmak yerine `prisma.item.findMany()`) |
| `pg` | PostgreSQL'e ham bağlantı açan alt-seviye kütüphane; Prisma'nın adaptörü bunun üzerine oturuyor |
| `jsonwebtoken` | JWT (JSON Web Token) üretme/doğrulama — kullanıcı girişi sonrası "kimlik kartı" gibi çalışan token |
| `bcrypt` | Şifreleri geri döndürülemez şekilde "hash"leme (düz metin asla saklanmaz) |
| `dotenv` | `.env` dosyasındaki (DATABASE_URL, JWT_SECRET gibi gizli/ortama-özel değerleri) `process.env`'e yükler |
| `pino`, `pino-pretty` | Yapılandırılmış (JSON) log yazıcı; `pino-pretty` sadece geliştirmede okunaklı renkli çıktı için |
| `prom-client` | Prometheus formatında metrik (istek sayısı, süresi, DB bağlantı sayısı) üretir |
| `express-rate-limit` | Belirli bir IP'den kısa sürede çok fazla istek gelirse (örn. brute-force login denemesi) engeller |
| `jest`, `supertest` | Test çalıştırıcı (jest) + gerçek ağ portu açmadan HTTP isteği simüle eden araç (supertest) |
| `nodemon` | Sadece geliştirmede: dosya kaydettiğinde sunucuyu otomatik yeniden başlatır |
| `eslint` | Kod stilini/olası hataları otomatik tarayan araç |

---

## 7. `process.env`: ortam değişkenleri

Bu proje, gizli/ortama-özel bilgileri (veritabanı adresi, JWT secret'ı,
port numarası) KODUN İÇİNE yazmak yerine `process.env` üzerinden okur:

```js
const PORT = process.env.PORT || 3000;
```

`process.env`, Node.js'in işletim sisteminden/ortamdan okuduğu
değişkenler nesnesidir. `dotenv` paketi, bir `.env` dosyasındaki
satırları (`DATABASE_URL=postgres://...`) okuyup bu nesneye yükler
(`require('dotenv').config()`). Bu sayede:

- Aynı kod, farklı ortamlarda (lokal, test, Docker, production/Render)
  farklı veritabanına/ayarlara bağlanabilir — kod DEĞİŞMEZ, sadece
  hangi `.env` dosyasının okunduğu değişir (`.env` vs `.env.test`).
  `CLAUDE.md`'de anlatılan `.env` (host: `db`, Docker için) ile `.env.test`
  (host: `localhost`, native Jest için) ayrımı tam olarak bu yüzden var.
- Şifreler/secret'lar git'e (versiyon kontrolüne) COMMIT EDİLMEZ —
  `.env` dosyası `.gitignore`'dadır, sadece `.env.example` (gerçek
  değer olmadan, hangi anahtarların gerektiğini gösteren şablon) commit'lenir.

---

## 8. Node.js'in "tek dosyadan başlama" mantığı: giriş noktası

Her Node.js programının bir **giriş noktası (entry point)** vardır —
`node <dosya>` komutuyla ilk çalıştırılan dosya. Bu projede o dosya
`src/server.js`'dir (`npm start` → `node src/server.js`). Node.js bu
dosyayı satır satır çalıştırır; dosya içindeki her `require(...)`
karşılaştığı modülü de (henüz çalıştırılmadıysa) baştan sona çalıştırıp
sonucunu döner. Bu yüzden `server.js`'in en üstündeki
`const app = require('./app')` satırı, aslında TÜM `app.js`'in
(middleware kurulumu, route tanımları) o an baştan sona çalışmasını
tetikler — bkz. `software.md` bölüm 6-7'deki tam anlatım.

---

## 9. Sırada ne var?

- Bu dosyadaki `require`/`module.exports`, `async`/`await`, middleware
  kavramlarını projenin gerçek dosyalarında ara — her biri en az bir kez
  `src/` altında geçiyor.
- `software.md`, bu kavramların GERÇEK bir isteği nasıl uçtan uca
  işlediğini adım adım gösteriyor — ikisini birlikte oku.
- Next.js'i gerçekten öğrenmek istersen (Week 9 roadmap'inde planlanan
  frontend Next.js değil ama sen yine de istersen): önce burada
  öğrendiğin `async/await`, modül sistemi ve "sunucu bir isteği nasıl
  karşılar" mantığı doğrudan işine yarayacak, çünkü Next.js de altta
  Node.js çalıştırıyor — üstüne React ve dosya-tabanlı routing (`app/`
  klasöründeki her dosya otomatik bir sayfa/uç nokta olur) ekliyor.
