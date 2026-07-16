// Load environment variables from the .env file into process.env
require('dotenv').config({ quiet: true });

// Import Express framework
const express = require('express');

// Import our custom middlewares
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const metricsAccessGuard = require('./middleware/metricsAccessGuard');

// Import our route definitions
const itemsRouter = require('./routes/items');
const authRouter = require('./routes/auth');

// Health check bağımlılıkları: DB canlılığını ölçmek için paylaşılan Prisma
// client'ı, response'a versiyon bilgisini eklemek için package.json'u kullanıyoruz.
const { getPrismaClient } = require('./db/prisma');
const { version } = require('../package.json');

// Week 8: Prometheus metrik kayıt defteri (registry) ve ölçüm middleware'i.
const { register, metricsMiddleware } = require('./metrics/metrics');

// SOLID / SRP notu:
// Refactor öncesinde bu dosya hem "Express uygulamasını inşa et" hem de
// "sunucuyu belirli bir portta dinlemeye başlat" sorumluluklarını aynı anda
// taşıyordu (dosyanın en altında app.listen(...) çağrısı vardı). Bu, dosyanın
// import edilmesinin OTOMATİK olarak gerçek bir ağ portu açması anlamına
// geliyordu — bu da Supertest gibi araçlarla in-process (portsuz) HTTP
// testi yazmayı imkansız hale getiriyordu. Artık bu dosya SADECE app'i
// inşa edip dışa aktarıyor; sunucuyu başlatma sorumluluğu server.js'e ait.

// Initialize the Express application
const app = express();

// 1. Built-in Middleware: Parse incoming JSON payloads
// This MUST come before our routes so that req.body is populated
app.use(express.json());

// 2. Custom Middleware: Log every incoming request
// Placed after express.json() so we could theoretically log body size accurately.
// requestLogger'ı metrics'ten ÖNCE koyuyoruz ki bu noktadan sonraki her log
// satırında (metrics guard'ının reddi dahil) requestId hazır olsun.
app.use(requestLogger);

// 2b. Metrics Middleware: Her isteğin süresini/sayısını ölç. Route'lardan ÖNCE
// takılır ki hiçbir isteği kaçırmasın (bkz. src/metrics/metrics.js).
app.use(metricsMiddleware);

// 3. Route Handlers: Mount the items router to the '/api/items' path
app.use('/api/items', itemsRouter);
app.use('/api/auth', authRouter);

// 4. Health Check Endpoint: CI/CD smoke test'i ve UptimeRobot gibi
// izleme araçları bu uç noktayı periyodik olarak yoklayacak (bkz. TODO.md
// Week 7/8). Sadece "process ayakta mı?" değil, "process DB'ye erişebiliyor
// mu?" sorusunu da yanıtlaması gerekir — aksi halde DB'siz de "ok" dönen bir
// health check, gerçek bir kesinti sırasında yanlış güven verir.
app.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  let statusCode = 200;

  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'disconnected';
    statusCode = 503;
  }

  res.status(statusCode).json({
    status: statusCode === 200 ? 'ok' : 'error',
    version,
    db: dbStatus,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// 4b. Metrics Endpoint: Prometheus bu uç noktayı periyodik olarak yoklar (pull).
// `metricsAccessGuard` ile korunur — içeriği (istek hacmi, hata oranı, bağlantı
// sayıları) halka açık olmamalı (bkz. middleware'deki güvenlik notu).
app.get('/metrics', metricsAccessGuard, async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// 5. 404 Handler: Catch-all for requests that didn't match any route above
// Since Express reads top-to-bottom, if a request reaches here, it means no route matched it.
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
  });
});

// 6. Global Error Handler: Must be the absolute LAST middleware
// Catches any errors passed via next(err) from previous handlers
app.use(errorHandler);

module.exports = app;
