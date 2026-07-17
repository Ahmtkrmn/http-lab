const { verifyAccessToken } = require('../utils/tokenService');

// 1. Kapı: Token geçerli mi? (Authentication)
const authenticateToken = (req, res, next) => {
  // Token genellikle "Bearer " formatında gelir
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Erişim reddedildi. Token bulunamadı.' });
  }

  try {
    // Token doğrulama mantığı artık tokenService içinde (SRP).
    // Görev: Expired token kontrolü verifyAccessToken içindeki
    // jwt.verify tarafından otomatik yapılır ve hata fırlatılır.
    const user = verifyAccessToken(token);
    req.user = user; // Kullanıcı bilgilerini diğer fonksiyonlar okuyabilsin diye req içine koyuyoruz
    next();
  } catch (err) {
    // Week 9 düzeltmesi: Burası eskiden 403 dönüyordu — HTTP semantiği
    // açısından yanlıştı ve frontend'i bozuyordu:
    //   401 Unauthorized -> "KİMLİĞİNİ doğrulayamadım" (token yok/bozuk/
    //       süresi dolmuş). Doğru tepki: yeniden kimlik kanıtla (frontend
    //       bunu görünce sessizce /api/auth/refresh dener, olmazsa login'e
    //       yönlendirir).
    //   403 Forbidden -> "Kimliğin TAMAM ama bu işleme İZNİN yok" (rol/
    //       sahiplik). Doğru tepki: 'Yetkiniz yok' mesajı — tekrar login
    //       olmak durumu DEĞİŞTİRMEZ.
    // Süresi dolmuş token bir kimlik sorunudur; 403 dönseydi frontend
    // kullanıcıya yanlışlıkla 'yetkin yok' der ve token yenilemeyi hiç
    // denemezdi. 403'ü artık yalnızca requireRole (ve sahiplik kontrolleri)
    // döndürür.
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token.' });
  }
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
