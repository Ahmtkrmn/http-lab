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


## Week 8 — Monitoring, Logging & Observability

> **Ne öğreniyorum:** "Çalışıyor gibi görünüyor" ile "gerçekten çalışıyor" arasındaki fark ölçümle anlaşılır. Gece 3'teki arıza anında ne baktığını bilmek bu haftanın konusu.

---

### ▶️ KALDIĞIMIZ YER (2026-07-17 — projeye dönünce buradan devam et)

**Week 8 tamamen kapandı** (Grafana Cloud dashboard + UptimeRobot + `monitoring/`
commit'i dahil). **Week 9'un KOD tarafı bitti**: `client/` (Vite + React +
Tailwind v4) yazıldı, backend'e cookie tabanlı refresh akışı (`/refresh`,
`/logout`, rotation) + CORS + `GET /api/categories` eklendi, 72 test yeşil,
compose'a Nginx'li `client` servisi eklendi (detay: `LEARNING_LOG.md` Adım 6).

**Dokümantasyon güncellendi**: `software.md`'ye frontend'i kapsayan 6 yeni
bölüm (14-19 — Vite/React nasıl çalışıyor, tarayıcıdan backend'e TAM istek
yolculuğu, CORS + token güvenliği, Docker/Nginx) eklendi; ayrıca React/JSX/
component/state/hook/routing kavramlarını sıfırdan anlatan yeni bir
`frontend.md` oluşturuldu (`nodejs.md`'nin frontend karşılığı — detay:
`LEARNING_LOG.md` Adım 7). "Front-end nasıl back-end ile bağlı, uygulamam
nasıl çalışıyor?" sorusunun cevabı artık bu iki dosyada.

**🔜 SIRADAKİ ADIM — Week 9'un tarayıcı/panel gerektiren kısımları (senin aksiyonun):**

1. [ ] **CORS'u canlı gözlemle**: `.env`'de `FRONTEND_URL` satırı KAPALIYKEN
       `docker compose up --build` → http://localhost:5173 aç → login dene →
       Console'daki CORS hatasının ekran görüntüsünü al.
2. [ ] `.env`'de `FRONTEND_URL=http://localhost:5173` satırını aç → `docker
       compose up -d app` (yeniden başlat) → login'in çalıştığını gör; DevTools
       → Network'te `Access-Control-Allow-*` header'larını incele (hatalı ve
       düzgün hallerini karşılaştır). Demo kullanıcı: `demo@http-lab.dev` /
       `Demo1234!` (EDITOR — form görünür).
3. [ ] **Vercel/Netlify deploy**: Root Directory `client`, env
       `VITE_API_URL=https://http-lab.onrender.com`; Render tarafına
       `FRONTEND_URL=https://<proje>.vercel.app` ekle (adımlar: README →
       "Frontend & Full-Stack" → Deploy).
4. [ ] Week 9 değişikliklerini commit/push et (branch: `feature/week8-observability`
       yerine yeni bir `feature/week9-frontend` branch'i önerilir).

**Eski Week 8 kurulum adımları (hepsi tamam):**

1. [x] Grafana Cloud hesabı + remote_write değerleri
2. [x] `monitoring/.env.monitoring` dolduruldu
3. [x] Alloy başlatıldı (target UP)
4. [x] Explore'da `http_requests_total` doğrulandı
5. [x] `generate-traffic.sh` ile trafik üretildi
6. [x] Dashboard import edildi (4 panel)
7. [x] Ekran görüntüsü `docs/grafana_dashboard.png` → README
8. [x] UptimeRobot `/health` monitörü + e-posta alert
9. [x] `monitoring/` dosyaları commit edildi (`.env.monitoring` hariç — gitignore'lı)

(1-7 detayı: bkz. `LEARNING_LOG.md` → Adım 5, madde 6 "Grafana Cloud'a uçtan uca bağlantı")

**⚠️ Hatırlatma:** `METRICS_TOKEN`'ı hiçbir committed dosyaya yazma. Kaynağı Render Environment sekmesi;
Alloy da onu `monitoring/.env.monitoring` (gitignore'lı) üzerinden okuyacak.

---

### Structured Logging

- [x] `pino` veya `winston` kur: `npm install pino pino-pretty` — pino + pino-pretty (dev) kuruldu (bkz. `LEARNING_LOG.md` Adım 5)
- [x] `src/utils/logger.js` dosyası oluştur, tüm `console.log` ve `console.error` çağrılarını bununla değiştir — `server.js`, `requestLogger.js`, `errorHandler.js` taşındı
- [x] Log formatı JSON olsun (`NODE_ENV=production`'da), development'ta human-readable — smoke test ile ikisi de doğrulandı
- [x] Her log satırına `requestId` ekle (UUID): her istek için `X-Request-ID` header'ı üret, tüm log satırları aynı ID'yi taşısın — `crypto.randomUUID()` + pino child logger; gelen header korunuyor
- [x] **Log seviyeleri kuralını yaz ve README'ye ekle** — README "Monitoring, Logging & Observability" bölümünde tablo olarak
- [x] `requestLogger.js` middleware'ini logger ile yeniden yaz; `console.log` kaldır — status koduna göre seviye (5xx→error, 4xx→warn)
- [x] `errorHandler.js` middleware'ini logger.error ile yeniden yaz — stack trace log'a gider, istemciye gitmez

### Metrics

- [x] `prom-client` kur: `npm install prom-client`
- [x] `GET /metrics` endpoint'i ekle (Prometheus formatında) — `src/metrics/metrics.js` + `app.js`
- [x] Şu metric'leri implement et:
  - `http_requests_total` — Counter, `method` + `route` + `status_code` label'ı ile
  - `http_request_duration_seconds` — Histogram, P50/P95/P99 percentile'ları görünür olsun
  - `active_db_connections` — Gauge (pg Pool'dan pull anında okunur)
- [x] Metrics middleware'ini tüm route'lardan önce ekle
- [x] `/metrics` endpoint'i sadece internal erişime açık olsun (IP whitelist veya ayrı port) — `metricsAccessGuard`: METRICS_TOKEN (önerilen) + IP allowlist

### Grafana Cloud (Ücretsiz Tier) — ⚠️ SENİN AKSİYONUN (kod hazır, panel kurulumu gerekli)

Uygulama tarafı hazır: `/metrics` Prometheus formatında yayında ve PromQL sorguları
README'ye yazıldı. Kalan adımlar bir panel/hesap kurulumudur (dosyayla yapılamaz):

- [x] Grafana Cloud'da ücretsiz hesap aç
- [x] Grafana Alloy/Agent ile `/metrics`'i scrape edip Grafana'ya `remote_write` et (README'de adımlar)
- [x] En az 3 panelli dashboard kur (RPS / Error Rate / P95 Latency — PromQL'ler README'de hazır; 4 panel import edildi, DB connections dahil)
- [x] Dashboard ekran görüntüsünü README'ye ekle

### Alerting — ⚠️ SENİN AKSİYONUN (kod hazır: /health 200/503 döner)

- [x] README'ye "Monitoring & Alerting" bölümü ekle — Grafana + UptimeRobot adım-adım rehberi eklendi
- [x] UptimeRobot ücretsiz plan ile `/health` endpoint'ini izle (5 dakikada bir ping)
- [x] E-posta alertini ayarla: servis 2 dakika yanıt vermezse bildirim gelsin — UptimeRobot alert contact ile kuruldu (bkz. `LEARNING_LOG.md` Adım 5/7)

---

## Week 9 — Frontend Basics & Full-Stack Entegrasyonu

> **Ne öğreniyorum:** Backend engineer olsan bile API'ının browser'da nasıl tüketildiğini, CORS'un neden fırladığını, token'ın nerede saklandığını anlamak şarttır.

### Proje Kurulumu

- [x] Aynı repo'da `client/` klasörü aç: `npm create vite@latest client -- --template react` — React 19 + Vite 8 (bkz. `LEARNING_LOG.md` Adım 6)
- [x] Tailwind CSS kur (sade görünüm yeterli, fancy UI değil) — Tailwind v4, `@theme` token'ları `client/src/index.css`'te
- [x] `client/src/api/` klasörü oluştur — tüm fetch çağrıları burada, component'larda `fetch` yok — `http.js` (tek kapı) + `auth/items/categories.js`
- [x] `client/.env.local` ile `VITE_API_URL=http://localhost:3000` tanımla — `.env.example` da eklendi (gitignore: `*.local`)

### CORS'u Kasıtlı Olarak Kır ve Çöz

- [x] Frontend `:5173`'ten, backend `:3000`'den çalışsın — dev'de `npm run dev`, compose'da Nginx `5173:80`
- [ ] Browser'da CORS hatasını gözlemle ve ekran görüntüsü al — ⚠️ SENİN AKSİYONUN (`.env`'de `FRONTEND_URL` kapalıyken dene; bkz. "KALDIĞIMIZ YER")
- [x] Backend'e `cors` paketi kur: `npm install cors`
- [x] `app.js`'e `cors({ origin: process.env.FRONTEND_URL, credentials: true })` ekle — `FRONTEND_URL` set değilse bilinçli olarak takılmıyor ("kır ve çöz" alıştırması env toggle'ı oldu); preflight davranışı `cors.integration.test.js` ile test altında
- [ ] Hem hatalı hem düzgün CORS yanıtlarının header'larını incele (DevTools → Network) — ⚠️ SENİN AKSİYONUN
- [x] `credentials: true` ile `withCredentials: true`'nun birlikte neden gerekli olduğunu README'ye yaz — README → "Frontend & Full-Stack" → credentials bölümü

### Implement Edilecekler (Sırasıyla)

- [x] **Login sayfası:** Email + şifre form, JWT access token'ı `memory`'de sakla (localStorage değil), refresh token'ı `httpOnly cookie`'de tut — backend'e `/refresh` (rotation'lı) + `/logout` eklendi; access token `tokenStore.js`'te (RAM)
- [x] **Korumalı route:** Giriş yapmamış kullanıcı `/items`'a gitmeye çalışırsa `/login`'e yönlendir — `ProtectedRoute.jsx`, üç durumlu (`loading/authenticated/anonymous`)
- [x] **Items listesi:** `GET /api/items` ile verileri çek, basit tablo görünümü — skeleton loading + boş durum dahil
- [x] **Yeni item formu:** Sadece `EDITOR` veya `ADMIN` rolündeki kullanıcıya görünsün — kategori dropdown'ı için backend'e `GET /api/categories` eklendi
- [x] **Error handling:** 401 → login sayfasına yönlendir, 403 → "Yetkiniz yok" mesajı, network error → anlamlı hata göster — 401 merkezi (silent refresh + retry, `http.js`); NOT: bunun için `authMiddleware` süresi dolmuş token'a artık 403 değil **401** dönüyor (bkz. `LEARNING_LOG.md` Adım 6/3)
- [x] **Logout:** Access token'ı memory'den sil, refresh token invalidate etmek için backend'e istek at — invalidation DB'de (`refreshToken=NULL`), cookie temizleniyor

### docker-compose Güncellemesi

- [x] `docker-compose.yml`'e `client` servisi ekle (Nginx ile static file serve) — multi-stage `client/Dockerfile` + SPA fallback'li `nginx.conf`
- [x] `docker compose up` ile üç servisin (app + db + client) birlikte çalıştığını doğrula — curl ile uçtan uca doğrulandı: `/health` 200, login→refresh→logout cookie akışı, SPA fallback (`/items` → 200)
- [ ] Frontend Vercel veya Netlify'a deploy et, backend URL'ini environment variable'dan al — ⚠️ SENİN AKSİYONUN (adımlar README'de; Render'a `FRONTEND_URL` eklemeyi unutma)

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
| 7 | CI/CD & Deployment | ✅ Tamamlandı |
| 8 | Monitoring & Logging | ✅ Tamamlandı (logging + metrics + testler + Grafana Cloud dashboard + UptimeRobot + `monitoring/` commit'i) |
| 9 | Frontend & Full-Stack | 🟡 Kod tamam (client + cookie auth + CORS + compose; 72 test). Kalan senin aksiyonların: CORS gözlemi/screenshot, Vercel deploy, commit |
| 10 | AI/RAG (Portfolio #3) | 🔲 |

---



---
