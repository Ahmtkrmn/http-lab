const crypto = require('crypto');
const logger = require('../utils/logger');

// İstek loglama middleware'i — Week 8'de `console.log`'tan structured logging'e
// (pino) taşındı ve her isteğe bir "requestId" (correlation ID) eklendi.
//
// requestId neden önemli?
// Production'da aynı anda onlarca istek işlenir; log'lar birbirine karışır.
// "Gece 3'teki arıza" anında tek bir kullanıcının isteğinin İZİNİ sürmek
// istersen (login -> DB sorgusu -> hata), o isteğe ait TÜM log satırlarını
// birbirine bağlayacak ortak bir kimliğe ihtiyacın var. `requestId` tam olarak
// budur: aynı isteğin ürettiği her log satırı aynı ID'yi taşır, böylece
// izleme aracında `requestId="..."` ile filtreleyip o isteğin tüm hikâyesini
// görürsün.
const requestLogger = (req, res, next) => {
  // İsteğin sunucuya ulaştığı anı kaydet (süre ölçümü için).
  const startTime = Date.now();

  // Gelen istekte zaten bir X-Request-ID header'ı varsa onu KORU, yoksa yeni bir
  // UUID üret. Neden mevcut olanı koruyoruz? İleride önünde bir reverse proxy /
  // API gateway veya çağıran başka bir servis kendi ID'sini üretmiş olabilir;
  // onu sürdürmek, isteğin sınırları AŞAN (distributed tracing'in ilk adımı)
  // takibini mümkün kılar. `crypto.randomUUID()` Node'un yerleşik API'sidir —
  // sırf UUID için ayrı bir paket kurmaya gerek yok.
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;

  // ID'yi yanıt header'ına da koy: istemci (veya frontend) bir hata gördüğünde
  // bu ID'yi bize iletebilir, biz de log'larda doğrudan o isteği buluruz.
  res.setHeader('X-Request-ID', requestId);

  // Bu isteğe özel bir "child logger". pino'nun child logger'ı, verdiğin alanları
  // (burada requestId) O logger'la yazılan HER satıra otomatik ekler — yani
  // handler'larda `req.log.info(...)` dediğimizde requestId'yi elle eklemeyi
  // unutma riski ortadan kalkar.
  req.log = logger.child({ requestId });

  // Yanıt tamamen istemciye gönderildiğinde ('finish') tek bir özet satırı yaz.
  // Neden 'finish'? Çünkü status kodu ve gövde boyutu ancak yanıt bittikten sonra
  // kesindir.
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const bodySize = Number(res.getHeader('content-length')) || 0;

    // Log seviyesi kuralını status koduna GÖRE seçiyoruz (bkz. README "Log
    // Seviyeleri"): 5xx sunucu hatasıdır -> error; 4xx istemci hatasıdır
    // (ör. 401/404) ama sunucu için "kurtarılabilir/beklenen" bir durumdur -> warn;
    // gerisi normal akıştır -> info. Böylece izleme aracında sadece `level>=warn`
    // filtreleyerek "sorunlu" istekleri gürültüden ayırabilirsin.
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    req.log[level](
      {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        bodySize,
      },
      'request completed'
    );
  });

  next();
};

module.exports = requestLogger;
