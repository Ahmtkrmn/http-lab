# HTTP Lab

Express 5 + Prisma 7 (PostgreSQL) ile yazılmış, JWT tabanlı kimlik doğrulama ve rol bazlı yetkilendirme (RBAC) içeren bir REST API projesi. Proje, kategori bazlı ürünler (`Item`) üzerinde CRUD işlemleri sunar.

## Özellikler

- **Kimlik doğrulama**: Kayıt ol / giriş yap, `bcrypt` ile şifre hashleme, `jsonwebtoken` ile access & refresh token üretimi
- **Rol bazlı yetkilendirme (RBAC)**: `ADMIN`, `EDITOR`, `VIEWER` rolleri
- **Sahiplik kontrolü**: Kullanıcılar (ADMIN hariç) yalnızca kendi oluşturdukları ürünleri silebilir
- **Prisma 7 + `@prisma/adapter-pg`**: PostgreSQL ile driver adapter üzerinden bağlantı
- **Merkezi hata yönetimi** ve **request logging** middleware'leri
- **Login rate limiting**: `express-rate-limit` ile 15 dakikada IP başına 5 deneme sınırı
- Postman koleksiyonu (`http-lab.postman_collection.json`) ile hazır istek örnekleri

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Runtime | Node.js |
| Web Framework | Express ^5.2.1 |
| ORM | Prisma ^7.8.0 (`@prisma/client`, `@prisma/adapter-pg`) |
| Veritabanı | PostgreSQL (`pg`) |
| Kimlik Doğrulama | `jsonwebtoken`, `bcrypt` |
| Ortam Değişkenleri | `dotenv` |
| Geliştirme | `nodemon` |

## Proje Yapısı

```
http-lab/
├── prisma/
│   ├── migrations/          # Veritabanı migration geçmişi
│   ├── schema.prisma        # Veri modelleri (User, Category, Item, Role enum)
│   └── seed.js              # Örnek kategori/ürün verisiyle DB'yi doldurur
├── src/
│   ├── app.js                    # Uygulama giriş noktası, middleware & route kurulumu
│   ├── middleware/
│   │   ├── authMiddleware.js     # authenticateToken & requireRole (JWT doğrulama, RBAC)
│   │   ├── errorHandler.js       # Merkezi hata yakalayıcı
│   │   └── requestLogger.js      # İstek/yanıt loglama
│   ├── routes/
│   │   ├── auth.js               # /api/auth/register, /api/auth/login
│   │   └── items.js              # /api/items altındaki CRUD uç noktaları
│   └── store/
│       └── itemsDb.js            # Prisma üzerinden Item veri erişim katmanı
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
   npm run dev     # nodemon ile (geliştirme)
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
| POST | `/login` | Giriş yapar, access & refresh token döner | 15 dk'da IP başına 5 istekle sınırlı |

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

## Bilinen Sorunlar / Dikkat Edilmesi Gerekenler

- `src/routes/auth.js` içinde `express-rate-limit` paketi kullanılıyor ancak `package.json`'da bağımlılık olarak tanımlı değil ve `node_modules` içinde bulunmuyor. Çalıştırmadan önce eklenmesi gerekir:
  ```bash
  npm install express-rate-limit
  ```
- Yüklenen arşivde `.env` dosyası, içinde gerçek görünen bir veritabanı şifresi ve JWT gizli anahtarlarıyla birlikte mevcuttu. Bu dosyanın repoya/paylaşıma dahil edilmemesi ve `.gitignore` ile hariç tutulması, ayrıca bu anahtarların üretimde değiştirilmesi önerilir.
- `PUT` ve `PATCH` uç noktalarında da `requireRole('EDITOR')` kontrolü var; sahiplik (ownership) kontrolü yalnızca `DELETE` işleminde uygulanmış — istenirse güncelleme işlemlerine de eklenebilir.

## Postman Koleksiyonu

`http-lab.postman_collection.json` dosyasını Postman'a import ederek hazır isteklerle API'yi test edebilirsiniz.