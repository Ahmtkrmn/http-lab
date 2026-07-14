// SOLID / SRP notu:
// Refactor öncesinde JWT üretim/doğrulama mantığı iki farklı yerde,
// route ve middleware kodunun İÇİNE gömülüydü:
//   - routes/auth.js  -> login sırasında jwt.sign(...) iki kez satır içinde çağrılıyordu
//   - middleware/authMiddleware.js -> jwt.verify(...) doğrudan middleware gövdesinde
// Bu, "token nasıl üretilir/doğrulanır" kuralını Express'in "isteği nasıl
// işlerim" sorumluluğuyla karıştırıyordu (SRP ihlali) ve token stratejisini
// (örn. algoritma, expiresIn süresi, secret seçimi) değiştirmek route/middleware
// kodunun düzenlenmesini gerektiriyordu (OCP ihlali).
//
// Bu modül token'la ilgili TÜM sorumluluğu tek bir yerde toplar; saf
// fonksiyonlar (Express req/res'e bağımlı değil) olduğu için dependency
// olmadan doğrudan unit test edilebilir.

const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateAccessToken(payload, secret = process.env.JWT_ACCESS_SECRET) {
  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(payload, secret = process.env.JWT_REFRESH_SECRET) {
  return jwt.sign(
    { userId: payload.userId },
    secret,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function verifyAccessToken(token, secret = process.env.JWT_ACCESS_SECRET) {
  // jwt.verify hata fırlatır (TokenExpiredError, JsonWebTokenError vb.)
  // Çağıran taraf bunu try/catch ile yakalamalı.
  return jwt.verify(token, secret);
}

function verifyRefreshToken(token, secret = process.env.JWT_REFRESH_SECRET) {
  return jwt.verify(token, secret);
}

module.exports = {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
