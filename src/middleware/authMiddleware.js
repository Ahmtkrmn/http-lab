const jwt = require('jsonwebtoken');

// 1. Kapı: Token geçerli mi? (Authentication)
const authenticateToken = (req, res, next) => {
  // Token genellikle "Bearer " formatında gelir
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Erişim reddedildi. Token bulunamadı.' });
  }

  // Token'ı gizli anahtarımızla açıp içindeki bilgileri (userId, role) okuyoruz
  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
    if (err) {
      // Görev 4: Expired token kontrolü burada otomatik yapılır (jwt.verify hata fırlatır)
      return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
    }
    
    req.user = user; // Kullanıcı bilgilerini diğer fonksiyonlar okuyabilsin diye req içine koyuyoruz
    next();
  });
};

// 2. Kapı: Yetkisi yetiyor mu? (RBAC - Authorization)
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // String verildiyse diziye çevir (örn: 'EDITOR' -> ['EDITOR'])
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // ADMIN süper yetkilidir, her kapıdan geçer. Diğerleri listede varsa geçer.
    if (req.user.role === 'ADMIN' || rolesArray.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok (403 Forbidden).' });
    }
  };
};

module.exports = { authenticateToken, requireRole };