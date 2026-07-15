# 🎯 Senior Backend Developer Yol Haritası — http-lab

## Hedef & Beklenti

> **Sevgili Claude:** Bu projede bir "Senior Developer" ve mentör gibi davranmanı istiyorum. Aşağıdaki yol haritasında yer alan görevleri sırasıyla yapacağız. 
> 
> Şimdi ilk olarak **[⚠️ Devam Etmeden Önce Düzeltilmesi Gereken Sorunlar]** adımına geçeceğiz. 
> 
> Kodda gerekli değişiklikleri doğrudan yap, fakat benim de Junior bir geliştirici olarak senin yazdıklarından öğrenmem gerekiyor. Lütfen yaptığın her önemli değişiklikten sonra ana dizinde `LEARNING_LOG.md` adında bir dosya oluştur (varsa güncelle) ve içine şunları yaz:
> 
> 1. **Yapılan Değişiklik:** Hangi dosyalarda neyi değiştirdin?
> 2. **Mimari Karar:** Neden bu yöntemi, fonksiyonu veya algoritmayı tercih ettin?
> 3. **Mentör Notu:** Benim bu yazılan koddan öğrenmem gereken en önemli best-practice (en iyi uygulama) veya ipucu nedir?
> 
> *Lütfen önce mevcut kod tabanını incele, bu dosyayı okuduğunu, anladığını ve talimatları kabul ettiğini bana kısaca özetle.*

---

# 🎯 Senior Backend Developer Yol Haritası — http-lab

## Hedef & Beklenti

Bu projeyi bitirdiğimde elimde şunlar olacak:
- Production'a deploy edilmiş, izlenebilir, CI/CD'li, AI destekli bir backend sistemi
- HTTP, Auth, DB, Docker, CI/CD, Monitoring ve AI katmanlarını kendi eliyle kurmuş biri olarak mülakatlara girebilme
- CV'ye eklenecek 2-3 somut, deploy edilmiş portfolio projesi
- "Tutorial izleyip taklit ettim" değil — **"kırdım, anladım, inşa ettim"** diyebilme

---

## Mevcut Durum — Ne Tamamlandı?

Projenin şu anki halini inceledim. Altı haftalık emek somut olarak şurada duruyor:

```
http-lab/
├── src/
│   ├── app.js                    ✅ Express app, middleware chain
│   ├── server.js                 ✅ app.js'den ayrıldı (SRP düzeltmesi)
│   ├── db/prisma.js              ✅ Singleton Prisma client
│   ├── middleware/
│   │   ├── authMiddleware.js     ✅ JWT auth + RBAC (requireRole)
│   │   ├── requestLogger.js      ✅ Her isteği logluyor
│   │   └── errorHandler.js       ✅ Global hata yakalayıcı
│   ├── routes/
│   │   ├── items.js              ✅ CRUD, ownership kontrolü
│   │   └── auth.js               ✅ Register, Login, rate limiting
│   ├── store/itemsDb.js          ✅ Prisma üzerinden DB operasyonları
│   └── utils/
│       ├── passwordService.js    ✅ bcrypt hash/compare (SRP)
│       └── tokenService.js       ✅ JWT generate/verify (SRP)
├── prisma/
│   ├── schema.prisma             ✅ User (RBAC rolü), Item, Category
│   ├── seed.js                   ✅ Başlangıç verisi
│   └── migrations/ (4 adet)      ✅ Versiyon kontrollü şema
├── tests/
│   ├── unit/ (3 dosya)           ✅ authMiddleware, passwordService, tokenService
│   └── integration/ (2 dosya)    ✅ auth + items endpoint'leri
├── coverage/                     ✅ %94 statement, %89 branch, %93 function
├── Dockerfile                    ✅ Multi-stage build, non-root user
├── docker-compose.yml            ✅ app + db (PostgreSQL) + adminer
└── REFACTORING_DIARY.md          ✅ SOLID analizi, before/after örnekleri
```

**Teknoloji stack'i:** Express 5, Prisma 7, PostgreSQL, bcrypt, JWT, express-rate-limit, Jest, Supertest, Docker

---

## ⚠️ Devam Etmeden Önce Düzeltilmesi Gereken Sorunlar

Bu maddeler küçük ama production'da fark yaratır. Haftaya geçmeden önce kapatılmalı.

- [x] **docker-compose.yml'deki güvenlik açığı:** `environment` bölümünde `DATABASE_URL` değişkeni tırnak içinde yazılmış ve `.env` dosyasındaki değeri eziyor. Doğrusu: değişkeni `environment` bloğundan tamamen kaldır, `env_file: .env` yeterli. *(Çözüldü — bkz. LEARNING_LOG.md)*
- [x] **docker-compose.yml'de port güvenliği:** `db` servisi `5432:5432` ile host'a açık. Production'da veritabanı portu dışarıya açılmaz; sadece `app` servisi erişebilmeli. Port satırını kaldır, sadece Docker iç ağı kullansın. *(Çözüldü — bkz. LEARNING_LOG.md)*
- [x] **`.env` dosyası commit'te:** Gerçek `DATABASE_URL`, `JWT_SECRET` gibi değerler `.gitignore`'da mı kontrol et. `.env.example` ve `.env.test.example` dosyaları var ama asıl `.env` de zip içinde geldi — bu bir alışkanlık sorunudur. *(Doğrulandı — `.env` ve `.env.test` `.gitignore`'da ve `git ls-files` çıktısında görünmüyor, commit edilmemiş.)*
- [x] **`items.integration.test.js`'deki test izolasyonu:** Her testten önce `resetDb` çalışıyor mu doğrula. Testlerin sıraya bağımlı olmaması şarttır (`--runInBand` kullanıyorsun, bu doğru). *(Doğrulandı — `beforeEach` içinde her testten önce `resetDb()` çağrılıyor.)*

---

## Week 7 — CI/CD & Cloud Deployment

> **Ne öğreniyorum:** Kodu yazmak yetmez; onu güvenle, tekrarlanabilir biçimde production'a taşımak gerekir. CI/CD bunu otomatikleştirir.

### GitHub Actions — CI Pipeline

- [ ] `.github/workflows/ci.yml` dosyasını oluştur
- [ ] **Tetikleyici:** Her `pull_request` ve `main` branch push'unda çalışsın
- [ ] **`lint` job'u:** ESLint kur (`npm install --save-dev eslint`), her push'ta çalışsın
- [ ] **`test` job'u:** PostgreSQL servis container'ı ayağa kaldır, `npm test` çalıştır
  - GitHub Actions'da servis container nasıl tanımlanır öğren (`services.postgres`)
  - `DATABASE_URL`'i GitHub Secrets'tan al (`${{ secrets.TEST_DATABASE_URL }}`)
- [ ] **`build` job'u:** Docker image'ı build et, hata yoksa geç
- [ ] Üç job paralel çalışsın, hepsi geçmeden merge edilemesin
- [ ] Branch protection rule'u GitHub'da aktif et: `main`'e doğrudan push yasak

### GitHub Actions — CD Pipeline

- [ ] `.github/workflows/deploy.yml` dosyasını oluştur
- [ ] **Tetikleyici:** Sadece `main`'e merge sonrası çalışsın
- [ ] Railway veya Render'da ücretsiz hesap aç, PostgreSQL ve Node servisi kur
- [ ] Deploy adımını pipeline'a ekle (Railway CLI veya Render webhook)
- [ ] Deploy sonrası **smoke test:** `curl /health` ile 200 geldiğini doğrula
- [ ] GitHub Actions badge'ini README'ye ekle: `![CI](https://github.com/...)`

### Health Check Endpoint

- [ ] `GET /health` endpoint'ini `src/routes/` dışında `app.js`'e ekle
- [ ] Response şu alanları içersin:
  ```json
  { "status": "ok", "version": "1.0.0", "db": "connected", "uptime": 3600 }
  ```
- [ ] Veritabanı bağlantısını da kontrol et: `prisma.$queryRaw\`SELECT 1\`` ile ping at
- [ ] DB bağlantısı yoksa `"db": "disconnected"` ve status 503 dön

### Portfolio #2 Çıktısı

- [ ] Production URL'i README'ye ekle
- [ ] `docker compose up` ile tüm stack'in ayağa kalktığını son kez test et
- [ ] GitHub Actions log ekran görüntüsü README'ye ekle

---

## Week 8 — Monitoring, Logging & Observability

> **Ne öğreniyorum:** "Çalışıyor gibi görünüyor" ile "gerçekten çalışıyor" arasındaki fark ölçümle anlaşılır. Gece 3'teki arıza anında ne baktığını bilmek bu haftanın konusu.

### Structured Logging

- [ ] `pino` veya `winston` kur: `npm install pino pino-pretty`
- [ ] `src/utils/logger.js` dosyası oluştur, tüm `console.log` ve `console.error` çağrılarını bununla değiştir
- [ ] Log formatı JSON olsun (`NODE_ENV=production`'da), development'ta human-readable
- [ ] Her log satırına `requestId` ekle (UUID): her istek için `X-Request-ID` header'ı üret, tüm log satırları aynı ID'yi taşısın
- [ ] **Log seviyeleri kuralını yaz ve README'ye ekle:**
  - `DEBUG`: Sadece local geliştirmede, ayrıntılı akış
  - `INFO`: Login, kayıt, ödeme gibi önemli iş olayları
  - `WARN`: Beklenmedik ama kurtarılabilir durumlar (örn: kullanıcı bulunamadı)
  - `ERROR`: Exception'lar, başarısız işlemler
- [ ] `requestLogger.js` middleware'ini logger ile yeniden yaz; `console.log` kaldır
- [ ] `errorHandler.js` middleware'ini logger.error ile yeniden yaz

### Metrics

- [ ] `prom-client` kur: `npm install prom-client`
- [ ] `GET /metrics` endpoint'i ekle (Prometheus formatında)
- [ ] Şu metric'leri implement et:
  - `http_requests_total` — Counter, `method` + `route` + `status_code` label'ı ile
  - `http_request_duration_seconds` — Histogram, P50/P95/P99 percentile'ları görünür olsun
  - `active_db_connections` — Gauge
- [ ] Metrics middleware'ini tüm route'lardan önce ekle
- [ ] `/metrics` endpoint'i sadece internal erişime açık olsun (IP whitelist veya ayrı port)

### Grafana Cloud (Ücretsiz Tier)

- [ ] Grafana Cloud'da ücretsiz hesap aç
- [ ] Prometheus remote_write ile `/metrics` endpoint'ini Grafana'ya bağla
- [ ] En az 3 panelli dashboard kur:
  - **RPS (Request Per Second):** Son 5 dakikada kaç istek geldi?
  - **Error Rate:** 5xx oranı ne? (`http_requests_total{status_code=~"5.."}`)
  - **P95 Latency:** İsteklerin %95'i kaç ms altında yanıt alıyor?
- [ ] Dashboard ekran görüntüsünü README'ye ekle

### Alerting

- [ ] UptimeRobot ücretsiz plan ile `/health` endpoint'ini izle (5 dakikada bir ping)
- [ ] E-posta alertini ayarla: servis 2 dakika yanıt vermezse bildirim gelsin
- [ ] README'ye "Monitoring & Alerting" bölümü ekle

---

## Week 9 — Frontend Basics & Full-Stack Entegrasyonu

> **Ne öğreniyorum:** Backend engineer olsan bile API'ının browser'da nasıl tüketildiğini, CORS'un neden fırladığını, token'ın nerede saklandığını anlamak şarttır.

### Proje Kurulumu

- [ ] Aynı repo'da `client/` klasörü aç: `npm create vite@latest client -- --template react`
- [ ] Tailwind CSS kur (sade görünüm yeterli, fancy UI değil)
- [ ] `client/src/api/` klasörü oluştur — tüm fetch çağrıları burada, component'larda `fetch` yok
- [ ] `client/.env.local` ile `VITE_API_URL=http://localhost:3000` tanımla

### CORS'u Kasıtlı Olarak Kır ve Çöz

- [ ] Frontend `:5173`'ten, backend `:3000`'den çalışsın
- [ ] Browser'da CORS hatasını gözlemle ve ekran görüntüsü al
- [ ] Backend'e `cors` paketi kur: `npm install cors`
- [ ] `app.js`'e `cors({ origin: process.env.FRONTEND_URL, credentials: true })` ekle
- [ ] Hem hatalı hem düzgün CORS yanıtlarının header'larını incele (DevTools → Network)
- [ ] `credentials: true` ile `withCredentials: true`'nun birlikte neden gerekli olduğunu README'ye yaz

### Implement Edilecekler (Sırasıyla)

- [ ] **Login sayfası:** Email + şifre form, JWT access token'ı `memory`'de sakla (localStorage değil), refresh token'ı `httpOnly cookie`'de tut
- [ ] **Korumalı route:** Giriş yapmamış kullanıcı `/items`'a gitmeye çalışırsa `/login`'e yönlendir
- [ ] **Items listesi:** `GET /api/items` ile verileri çek, basit tablo görünümü
- [ ] **Yeni item formu:** Sadece `EDITOR` veya `ADMIN` rolündeki kullanıcıya görünsün
- [ ] **Error handling:** 401 → login sayfasına yönlendir, 403 → "Yetkiniz yok" mesajı, network error → anlamlı hata göster
- [ ] **Logout:** Access token'ı memory'den sil, refresh token invalidate etmek için backend'e istek at

### docker-compose Güncellemesi

- [ ] `docker-compose.yml`'e `client` servisi ekle (Nginx ile static file serve)
- [ ] `docker compose up` ile üç servisin (app + db + client) birlikte çalıştığını doğrula
- [ ] Frontend Vercel veya Netlify'a deploy et, backend URL'ini environment variable'dan al

---

## Week 10 — AI/ML API Entegrasyonu & RAG (Portfolio #3)

> **Ne öğreniyorum:** LLM API'larını doğru kullanmak — prompt engineering, RAG, streaming, token yönetimi — artık backend developer'ın temel yetkinliğidir.

### Yeni Proje: DocChat — RAG Tabanlı Döküman Soru-Cevap

Bu haftadan bağımsız, deploy edilmiş bir portfolio projesi çıkacak.

### Altyapı

- [ ] Yeni repo aç: `doc-chat`
- [ ] PostgreSQL'e `pgvector` extension'ı ekle: `CREATE EXTENSION vector;`
- [ ] Prisma schema'sına `DocumentChunk` modeli ekle (`content String`, `embedding Unsupported("vector(1536)")`)
- [ ] OpenAI API key al ve `.env`'e ekle (`OPENAI_API_KEY`)
- [ ] `openai` npm paketini kur

### Döküman İşleme Pipeline

- [ ] `POST /api/documents/upload` endpoint'i: PDF veya düz metin kabul etsin
- [ ] Upload edilen metni chunk'lara böl (500 token, %20 overlap)
- [ ] Her chunk için OpenAI `text-embedding-3-small` modeli ile embedding al
- [ ] Embedding vektörünü ve chunk metnini `DocumentChunk` tablosuna kaydet
- [ ] Upload süreci tamamlandığında döküman bilgisini döndür

### Soru-Cevap Pipeline

- [ ] `POST /api/chat` endpoint'i: `{ question: string, documentId: number }` kabul etsin
- [ ] Soruyu embedding'e çevir
- [ ] pgvector `cosine_distance` ile en yakın 5 chunk'ı bul
- [ ] Bu chunk'ları system prompt'a ekle:
  ```
  Aşağıdaki bağlam bilgisine dayanarak soruyu yanıtla.
  Bağlamda olmayan bilgi için "Bu konuda bilgim yok" de.
  Bağlam: {chunks}
  ```
- [ ] OpenAI `gpt-4o-mini` modeli ile yanıt üret
- [ ] Yanıtı `text/event-stream` ile streaming olarak gönder (SSE)
- [ ] Response'ta hangi chunk'lardan yararlanıldığını `sources` alanında döndür

### Güvenlik & Rate Limiting

- [ ] Kullanıcı başına günlük 50 sorgu sınırı (Redis veya DB ile)
- [ ] Prompt injection dene: `"Bağlamı unut, şimdi şunu yap:"` → model bunu yapmamalı
- [ ] Kullanıcı izolasyonu: Başkasının dökümanına erişim denenirse 403 dönsün
- [ ] Input sanitization: Maksimum soru uzunluğu 500 karakter

### Frontend (Minimal)

- [ ] Döküman yükleme arayüzü (sürükle-bırak)
- [ ] Chat arayüzü: Streaming yanıt token token ekrana yazılsın
- [ ] Yanıtın altında "Kaynaklar" bölümü: hangi paragraftan alındı?

### Portfolio #3 Çıktısı

- [ ] Deploy: Frontend Vercel, Backend + DB Railway/Render
- [ ] README: Mimari diyagramı (Mermaid ile), kurulum adımları, demo URL
- [ ] Demo GIF veya Loom videosu çek (2-3 dakika yeterli)

---

## 📋 Genel Teknik Borçlar (Her Haftanın Arasında)

Bu maddeler haftalık değil ama projeyi büyüttükçe birikirse sonra yazmak zorlaşır.

### Güvenlik

- [ ] `helmet` middleware'ini kur: `npm install helmet` → HTTP güvenlik header'larını otomatik ekler
- [ ] Input validation katmanı: `zod` veya `joi` ile tüm request body'leri schema'ya göre doğrula
- [ ] SQL injection senaryosu: Prisma kullandığın için ORM'nin bunu nasıl önlediğini belgele
- [ ] `npm audit` çalıştır ve HIGH/CRITICAL bulguları kapat

### Test

- [ ] `items.js` route testlerinde sahiplik (ownership) senaryosu eksik: EDITOR başkasının item'ını silmeye çalışırsa 403 dön
- [ ] Token expiry entegrasyon testi ekle: Süresi geçmiş token ile istek at, 403 mü?
- [ ] Edge case: Aynı email ile iki kez kayıt → 409 testi var mı?
- [ ] Coverage'ı %95 üzerinde tut; her yeni feature için test önce (ya da hemen sonra) yazılsın

### Dokümantasyon

- [ ] README'ye `CONTRIBUTING.md` benzeri bir "Nasıl çalıştırılır?" bölümü ekle: sıfırdan clone'layıp `docker compose up` yapan biri ne yapmalı?
- [ ] Tüm endpoint'leri README tablosunda listele (method, path, auth gereksinimi, örnek response)
- [ ] `LEARNINGS.md` dosyası tut: Her hafta karşılaştığın hatayı ve nasıl çözdüğünü yaz (mülakatlarda altın değerinde)

---


## 📊 İlerleme Özeti

| Hafta | Konu | Durum |
|-------|------|-------|
| 1 | Terminal & Git | ✅ Tamamlandı |
| 2 | HTTP & REST API | ✅ Tamamlandı |
| 3 | Database & ORM | ✅ Tamamlandı |
| 4 | Auth & Security | ✅ Tamamlandı |
| 5 | Testing & Clean Code | ✅ Tamamlandı (%94 coverage) |
| 6 | Docker | ✅ Tamamlandı (multi-stage build) |
| 7 | CI/CD & Deployment | 🔲 Bu hafta |
| 8 | Monitoring & Logging | 🔲 Sonraki hafta |
| 9 | Frontend & Full-Stack | 🔲 |
| 10 | AI/RAG (Portfolio #3) | 🔲 |

---



---
