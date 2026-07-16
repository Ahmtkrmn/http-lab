const logger = require('../utils/logger');

// Global hata yönetimi middleware'i.
// Express'te bir hata handler'ı TAM OLARAK bu 4 parametreye (err, req, res, next)
// sahip olmalıdır — 'next'i yazmazsan Express bunu sıradan bir middleware sanar
// ve next(err) ile gelen hatalar buraya hiç ulaşmaz.
const errorHandler = (err, req, res, next) => {
  // Week 8: `console.error` yerine structured logger.
  // İsteğe özel child logger (req.log) varsa onu kullan — böylece bu hata satırı
  // da isteğin diğer log satırlarıyla AYNI requestId'yi taşır ve izini sürebilirsin.
  // requestLogger'dan önce (çok nadir) bir hata oluşursa req.log olmayabilir;
  // o durumda temel logger'a düş.
  const log = req.log || logger;

  const statusCode = err.statusCode || 500;

  // Hata nesnesini `err` anahtarıyla veriyoruz: pino'nun yerleşik hata
  // serileştiricisi bu anahtarı tanır ve mesajı + STACK TRACE'i JSON'a düzgünce
  // yazar. Düz `err.message` string'i loglamak stack'i kaybettirir; production'da
  // bir 500'ün NEREDE patladığını stack olmadan bulmak çok zorlaşır.
  log.error(
    {
      err,
      method: req.method,
      path: req.path,
      statusCode,
    },
    'request failed'
  );

  // İstemciye dönen yanıt DEĞİŞMEDİ: hâlâ yapılandırılmış, güvenli bir JSON.
  // Dikkat: stack trace'i log'a yazıyoruz ama İSTEMCİYE göndermiyoruz — iç
  // detayları (dosya yolları, satır numaraları) dışarı sızdırmak bir güvenlik
  // zaafıdır.
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({
    error: message,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
};

module.exports = errorHandler;
