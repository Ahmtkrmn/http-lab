// Uygulama genelinde TEK paylaşılan structured logger (pino).
//
// Neden `console.log` değil de pino?
// `console.log` düz metin (string) üretir. Bir string log satırı, insan gözüyle
// okumak için uygundur ama bir izleme aracının (Grafana Loki, Datadog, CloudWatch)
// bunu ayrıştırıp "status_code=500 olan istekleri getir" gibi sorgular çalıştırması
// çok zordur. pino ise her log satırını tek satırlık bir JSON nesnesi olarak yazar
// (structured logging) — makineler bunu doğrudan alanlara (field) ayırıp
// filtreleyebilir/aggregate edebilir. Week 8'in özü tam olarak budur:
// "çalışıyor gibi görünüyor" ile "ölçebiliyorum" arasındaki fark.
//
// Neden tek bir paylaşılan örnek (singleton)?
// Aynı `src/db/prisma.js`'teki mantık: logger'ın seviyesi, formatı ve hedefi
// TEK yerde kararlaştırılsın; her modül `require('../utils/logger')` ile aynı
// yapılandırılmış örneği alsın. Bir modül kendi logger'ını kurarsa formatlar
// birbirinden sapar.
const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Log seviyesi (öncelik sırası):
//   1) LOG_LEVEL env (elle geçersiz kılma imkânı)
//   2) test  -> 'silent' : testlerin çıktısını log gürültüsüyle kirletme
//   3) prod  -> 'info'   : DEBUG gürültüsü production'a gitmesin
//   4) dev   -> 'debug'  : yerelde ayrıntılı akışı gör
const level =
  process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug');

// Mimari karar: production'da SAF JSON, development'ta insan-okur (pretty) format.
//
// `pino-pretty` renklendirilmiş, hizalanmış, okunması kolay satırlar üretir ama
// bunu bir "transport" (ayrı worker thread) üzerinden yapar ve JSON'u bozar —
// yani makine tarafından ayrıştırılamaz. Bu yüzden pretty format SADECE
// development'ta açılır. Production'da ve test'te transport tanımlanmaz; pino
// varsayılan olarak stdout'a tek satırlık JSON yazar. Bir container ortamında
// (Docker/Render) doğru davranış budur: uygulama sadece stdout'a yazar, log'ları
// toplama/saklama işini platform (veya Grafana Agent) üstlenir — "12-factor app"
// prensibi (logs as event streams).
const logger = pino({
  level,
  // Development dışında transport yok -> düz JSON stdout.
  transport:
    isProduction || isTest
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
  // Production JSON'unda zaman damgası okunabilir ISO-8601 olsun (pino'nun
  // varsayılanı epoch milisaniyedir; log toplayıcılar ISO'yu daha rahat parse eder).
  ...(isProduction ? { timestamp: pino.stdTimeFunctions.isoTime } : {}),
});

module.exports = logger;
