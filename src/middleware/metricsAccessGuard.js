// `/metrics` endpoint'i için erişim koruması.
//
// Neden gerekli? `/metrics` iç işleyişini (istek hacmi, hata oranları, bağlantı
// sayıları) dışarı döker. Bu bilgi bir saldırgan için keşif (reconnaissance)
// değeri taşır ve halka açık olmamalıdır — sadece izleme altyapısı (Prometheus
// scraper / Grafana Agent) erişebilmeli. TODO Week 8: "IP whitelist veya ayrı port".
//
// İki katmanlı savunma sunuyoruz (defense in depth):
//   1) METRICS_TOKEN tanımlıysa: bir bearer token ZORUNLU (en güçlü, PaaS-dostu).
//   2) Token yoksa: IP allowlist (loopback + özel ağlar + METRICS_ALLOWED_IPS).
const logger = require('../utils/logger');

// IPv6-mapped IPv4 önekini (::ffff:127.0.0.1 -> 127.0.0.1) temizle.
function normalizeIp(ip) {
  return (ip || '').replace(/^::ffff:/, '');
}

// Loopback ve RFC1918 özel ağ aralıkları — bir scraper tipik olarak aynı host'tan
// veya özel ağdan gelir, internetten değil.
function isPrivateOrLoopback(ip) {
  const addr = normalizeIp(ip);
  if (addr === '127.0.0.1' || addr === '::1') return true;
  if (addr.startsWith('10.') || addr.startsWith('192.168.')) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = addr.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

const metricsAccessGuard = (req, res, next) => {
  const token = process.env.METRICS_TOKEN;

  // 1) Token modu: METRICS_TOKEN tanımlıysa doğru token OLMADAN geçiş yok.
  // Bu, Render gibi PaaS'lerde IP filtrelemesinin güvenilmez olduğu durumlar için
  // (aşağıdaki nota bak) daha sağlam bir seçenektir.
  if (token) {
    const header = req.headers.authorization || '';
    const provided = header.replace(/^Bearer\s+/i, '') || req.query.token;
    if (provided !== token) {
      (req.log || logger).warn('metrics erişimi reddedildi (geçersiz token)');
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  }

  // 2) IP allowlist modu.
  // ⚠️ Güvenlik notu: `req.ip`'in doğru olması Express'in `trust proxy` ayarına
  // bağlıdır. Render gibi bir reverse-proxy ARKASINDA, trust proxy açık değilse
  // uygulama daima proxy'nin (özel) IP'sini görür — yani IP filtresi orada
  // aldatıcı biçimde "hep izin ver"e döner. Bu yüzden production/Render için
  // gerçek koruma METRICS_TOKEN'dır; IP allowlist esas olarak yerel/özel-ağ
  // senaryoları içindir.
  const allowList = (process.env.METRICS_ALLOWED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const clientIp = normalizeIp(req.ip || req.socket?.remoteAddress);
  const allowed = isPrivateOrLoopback(clientIp) || allowList.includes(clientIp);

  if (!allowed) {
    (req.log || logger).warn({ clientIp }, 'metrics erişimi reddedildi (IP izinli değil)');
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

module.exports = metricsAccessGuard;
