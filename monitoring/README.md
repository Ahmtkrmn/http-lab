# Monitoring — Grafana Cloud kurulumu (Week 8)

Bu klasör, canlı http-lab servisinin (`/metrics`) metriklerini **Grafana Cloud**'a
taşıyıp bir dashboard'da izlemek için gereken her şeyi içerir.

## Mimari

```
[http-lab @ Render]  --scrape (pull)-->  [Grafana Alloy]  --remote_write (push)-->  [Grafana Cloud / Prometheus]  -->  [Dashboard]
     /metrics                             (bu klasördeki                              (hosted, ücretsiz tier)
   (METRICS_TOKEN                          Docker container'ı)
    ile korumalı)
```

Neden bir "collector" (Alloy)? Grafana Cloud internetteki rastgele bir endpoint'i
kendisi yoklamaz; sen bir ajan çalıştırırsın, o `/metrics`'i çeker ve Grafana
Cloud'a iletir. Alloy'u yerelde (kendi makinende, Docker'da) çalıştırmak ücretsiz
ve öğrenmek için idealdir — ajan çalıştığı sürece metrikler akar.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `config.alloy` | Alloy yapılandırması: `/metrics`'i scrape et → Grafana Cloud'a remote_write |
| `docker-compose.monitoring.yml` | Alloy'u Docker'da çalıştırır |
| `.env.monitoring.example` | Sırların şablonu (kopyala → `.env.monitoring`) |
| `grafana-dashboard.json` | Import edilecek hazır dashboard (RPS / Error Rate / Latency / DB) |
| `generate-traffic.sh` | Dashboard'da veri görmek için canlıya trafik üretir |

---

## Adım adım

### 1. Render'da `/metrics`'i koru (token)

`METRICS_TOKEN` env'ini Render'da ayarla (güçlü rastgele bir değer):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Render Dashboard → **http-lab** → **Environment** → Add: `METRICS_TOKEN` = üretilen
değer → **Save** (otomatik redeploy). Doğrula:

```bash
# token'sız -> 403, doğru token -> 200
curl -s -o /dev/null -w "%{http_code}\n" https://http-lab.onrender.com/metrics
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <TOKEN>" https://http-lab.onrender.com/metrics
```

### 2. Grafana Cloud hesabı

1. <https://grafana.com/auth/sign-up/create-user> → ücretsiz hesap aç (GitHub ile giriş yapabilirsin).
2. Sana bir **stack** verilir (ör. `adiniz.grafana.net`).
3. Prometheus **remote_write** bilgilerini al: stack'te
   **Connections → Add new connection → "Hosted Prometheus metrics"** (veya
   "Prometheus" → *Send metrics*). Şu 3 değeri kaydet:
   - **Remote Write Endpoint** URL'i (`…/api/prom/push` ile biter)
   - **Username / Instance ID** (bir sayı)
   - **Password / API Token** — "Generate now / Create token" ile üret
     (`metrics:write` yetkili).

### 3. Sırları doldur

```bash
cd monitoring
cp .env.monitoring.example .env.monitoring   # (Windows: copy)
```

`.env.monitoring` içine yaz:
- `SCRAPE_TARGET=http-lab.onrender.com:443`
- `METRICS_TOKEN=` → Render'a koyduğun token'ın AYNISI
- `GRAFANA_CLOUD_PROM_URL=` → adım 2'deki endpoint
- `GRAFANA_CLOUD_USER=` → instance ID
- `GRAFANA_CLOUD_API_KEY=` → API token

> `.env.monitoring` `.gitignore`'da — sırlar commit edilmez.

### 4. Alloy'u çalıştır

```bash
# monitoring/ klasörünün içinden:
docker compose -f docker-compose.monitoring.yml up
```

Alloy arayüzü: <http://localhost:12345> — scrape hedefinin **UP** olduğunu buradan
görebilirsin. 15 saniyede bir `/metrics` çekilip Grafana Cloud'a yazılır.

### 5. Metrik aktığını doğrula (Grafana Explore)

Grafana Cloud → **Explore** → Prometheus data source → sorgu:
`http_requests_total`. Sonuç dönüyorsa boru hattı çalışıyor. 🎉

### 6. Trafik üret (dashboard boş kalmasın)

```bash
# Canlıya birkaç dakika istek at (login/CRUD karışımı):
bash monitoring/generate-traffic.sh
```

### 7. Dashboard'ı import et

Grafana Cloud → **Dashboards → New → Import** → `grafana-dashboard.json` dosyasını
yükle → Prometheus data source'unu seç → **Import**. Dört panel gelir:
**RPS**, **Error Rate (5xx)**, **Latency P50/P95/P99**, **Active DB Connections**.

### 8. Ekran görüntüsü → README

Dashboard'ın ekran görüntüsünü al, `docs/grafana.png` olarak kaydet ve ana
`README.md`'deki "Grafana Cloud" bölümüne `![Grafana](docs/grafana.png)` ile ekle.
Bu, portfolyonun "izlenebilir sistem" kanıtıdır.

---

## Sorun giderme

- **Alloy'da target DOWN / 403:** `.env.monitoring`'teki `METRICS_TOKEN`, Render'daki
  ile birebir aynı mı? Token'da baş/son boşluk olmasın.
- **Grafana'da veri yok:** `GRAFANA_CLOUD_PROM_URL` `…/api/prom/push` ile bitiyor mu?
  `GRAFANA_CLOUD_USER` sayı mı (e-posta değil)? Token `metrics:write` yetkili mi?
- **Paneller "No data":** Henüz trafik yok — `generate-traffic.sh` çalıştır, panel
  zaman aralığını "Last 15 minutes" yap.
