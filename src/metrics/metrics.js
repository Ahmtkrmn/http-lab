// Week 8 — Prometheus metrikleri (prom-client).
//
// Logging "ne oldu?" sorusunu (olay bazında) yanıtlar; metrics ise "genel olarak
// nasıl gidiyor?" sorusunu (sayısal, zaman serisi bazında) yanıtlar. Örn: "son 5
// dakikada saniyede kaç istek geldi", "5xx oranı ne", "isteklerin %95'i kaç ms
// altında yanıtlandı". Prometheus bu sayıları periyodik olarak `/metrics`
// endpoint'inden "çeker" (pull model) ve zaman serisi olarak saklar.
const client = require('prom-client');

// Kendi Registry'mizi oluşturuyoruz (global default register yerine).
// Neden? Testlerde ve modüler kurulumlarda global durum sızıntısını önler;
// hangi metriklerin export edildiğini TEK bir yerden kontrol ederiz.
const register = new client.Registry();

// Node.js/process seviyesi hazır metrikler (CPU, RAM, event loop lag, GC...).
// Test ortamında ATLIYORUZ: collectDefaultMetrics event loop'u izlemek için
// canlı bir libuv handle açar; bu, Jest sürecini açık tutup "did not exit"
// uyarısı ürettiği için (proje zaten --forceExit kullanıyor ama gürültüyü
// azaltıyoruz) test dışında etkinleştiriyoruz.
if (process.env.NODE_ENV !== 'test') {
  client.collectDefaultMetrics({ register });
}

// 1) Counter: toplam HTTP istek sayısı.
// Counter yalnızca ARTAR (sıfırlanmaz). RPS (request-per-second) ve error-rate
// gibi türev metrikler bu counter'ın Prometheus tarafında `rate()` ile türevi
// alınarak hesaplanır — yani "saniyedeki istek" bilgisini biz değil, sorgu üretir.
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Toplam işlenen HTTP istek sayısı',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// 2) Histogram: istek süresi (saniye cinsinden).
// Histogram, süreleri önceden tanımlı "kova"lara (bucket) dağıtır; Prometheus
// bu kovalardan P50/P95/P99 gibi persentilleri `histogram_quantile()` ile
// hesaplar. Bucket sınırlarını tipik bir web API'nin gecikme aralığına göre
// seçtik (5ms'ten 5sn'e). Birim olarak SANİYE kullanmak Prometheus konvansiyonudur
// (metrik adı da `_seconds` ile biter).
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP istek süresi (saniye)',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// 3) Gauge: aktif DB bağlantısı sayısı.
// Gauge, Counter'ın aksine hem artan hem AZALAN anlık bir değeri temsil eder.
// `collect()` callback'i sayesinde bunu "pull" anında (yani /metrics her
// yoklandığında) canlı olarak pg Pool'undan okuyoruz — periyodik bir setInterval
// tutmaya gerek yok, değeri sadece sorulduğunda hesaplıyoruz.
// Not: Gauge'u bir değişkene atamıyoruz; `registers: [register]` seçeneği onu
// zaten kayıt defterine ekler ve değeri `collect()` içinde `this.set(...)` ile
// güncellenir — dolayısıyla dışarıdan referansa ihtiyaç yok.
new client.Gauge({
  name: 'active_db_connections',
  help: 'pg bağlantı havuzundaki toplam açık bağlantı sayısı',
  registers: [register],
  collect() {
    // prisma modülünü BURADA (collect anında) require ediyoruz, dosyanın
    // tepesinde değil. Neden? (a) döngüsel bağımlılık riskini önler, (b) prisma
    // modülü bazı unit testlerde jest.mock ile değiştiriliyor; getPool orada
    // tanımlı olmayabilir, bu yüzden optional-chaining (?.) ile savunmacı okuyoruz.
    const pool = require('../db/prisma').getPool?.();
    this.set(pool ? pool.totalCount : 0);
  },
});

// Metrics middleware'i: her isteğin süresini ölçüp counter/histogram'a işler.
// Tüm route'lardan ÖNCE takılır ki hiçbir isteği kaçırmasın.
function metricsMiddleware(req, res, next) {
  // /metrics endpoint'inin kendisini ölçmüyoruz: Prometheus onu 15 saniyede bir
  // yokladığı için kendi kendini sayması metrikleri gereksiz şişirir (self-noise).
  if (req.path === '/metrics') {
    return next();
  }

  // startTimer, çağrıldığı andan itibaren geçen süreyi ölçen bir fonksiyon döner;
  // 'finish'te label'larla çağırınca süreyi saniye cinsinden histogram'a yazar.
  const endTimer = httpRequestDuration.startTimer();

  res.on('finish', () => {
    // KRİTİK — cardinality (etiket patlaması): route label'ında GERÇEK path'i
    // (`/api/items/123`) değil, route KALIBINI (`/api/items/:id`) kullanıyoruz.
    // Aksi halde her farklı id yeni bir zaman serisi yaratır ve Prometheus'un
    // belleği şişer (yüksek-cardinality, izleme sistemlerini çökerten en yaygın
    // hatadır). `req.route` yönlendirme tamamlandıktan sonra kalıbı taşır;
    // `req.baseUrl` ise router'ın mount edildiği ön eki (`/api/items`) verir.
    // Hiçbir route eşleşmediyse (404) tüm bu path'leri tek bir 'unmatched'
    // serisinde topluyoruz — yoksa rastgele URL tarayan botlar cardinality'yi
    // patlatırdı.
    const route = req.route ? req.baseUrl + req.route.path : 'unmatched';

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
}

module.exports = { register, metricsMiddleware };
