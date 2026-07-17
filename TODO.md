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

### ▶️ KALDIĞIMIZ YER (2026-07-16 — projeye dönünce buradan devam et)

**Şu ana kadar TAMAM olan:**
- ✅ Structured logging (pino) + requestId + metrics (prom-client) kodu yazıldı, test edildi (59 test), `main`'e push edildi.
- ✅ Render redeploy oldu; canlı `/metrics` **200 dönüyor** (`https://http-lab.onrender.com/metrics`).
- ✅ `/metrics` güvenliği: Render'da `METRICS_TOKEN` env'i ayarlandı. Doğrulandı → token'sız **403**, doğru token'la **200**.
- ✅ `monitoring/` klasörü hazır: `config.alloy`, `docker-compose.monitoring.yml`, `.env.monitoring.example`, `grafana-dashboard.json` (4 panel), `generate-traffic.sh`, `README.md` (adım-adım rehber).

**🔜 SIRADAKİ ADIM — Grafana Cloud'a bağlan (detaylı rehber: `monitoring/README.md`):**

1. [x] **Grafana Cloud hesabı aç** (grafana.com, ücretsiz). Prometheus remote_write için 3 değeri al:
       Remote Write Endpoint URL'i (`…/api/prom/push`), Username/Instance ID (sayı), API Token (`metrics:write`).
2. [x] `cd monitoring && cp .env.monitoring.example .env.monitoring` → içini doldur:
       - `SCRAPE_TARGET=http-lab.onrender.com:443`
       - `METRICS_TOKEN=` → **Render'daki env'in AYNISI** (Render Dashboard → http-lab → Environment'tan kopyala; buraya/commit'e yazma!)
       - `GRAFANA_CLOUD_PROM_URL`, `GRAFANA_CLOUD_USER`, `GRAFANA_CLOUD_API_KEY` → adım 1'deki 3 değer.
3. [x] Alloy'u başlat: `docker compose -f monitoring/docker-compose.monitoring.yml up` → arayüz: http://localhost:12345 (target UP mı?).
4. [x] Grafana Cloud → **Explore** → `http_requests_total` sorgusu veri dönüyor mu? (boru hattı doğrulaması)
5. [x] `bash monitoring/generate-traffic.sh` ile canlıya trafik üret (paneller dolsun).
6. [x] Grafana → **Dashboards → Import** → `monitoring/grafana-dashboard.json` yükle, Prometheus data source'u seç.
7. [x] Dashboard ekran görüntüsü → `docs/grafana_dashboard.png` → ana `README.md`'ye eklendi.
8. [x] **UptimeRobot**: `/health` için 5 dk'lık HTTP monitörü + e-posta alert kur (2 dk yanıt yoksa bildirim).
9. [ ] `monitoring/` dosyalarını commit et (`.env.monitoring` hariç — gitignore'lı).

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
- [ ] E-posta alertini ayarla: servis 2 dakika yanıt vermezse bildirim gelsin

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
| 7 | CI/CD & Deployment | ✅ Tamamlandı |
| 8 | Monitoring & Logging | ✅ Tamamlandı (logging + metrics + testler + Grafana Cloud dashboard + UptimeRobot; sadece `monitoring/` klasörünün commit'i kaldı) |
| 9 | Frontend & Full-Stack | 🔲 |
| 10 | AI/RAG (Portfolio #3) | 🔲 |

---



---
