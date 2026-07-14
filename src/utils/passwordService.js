// SOLID / SRP notu:
// Refactor öncesinde bcrypt.hash(...) çağrısı ve "salt rounds = 12" kararı
// doğrudan routes/auth.js içindeki /register handler'ının gövdesindeydi.
// Şifreleme stratejisini (örn. salt round sayısını, ileride başka bir
// hashing algoritmasına geçişi) değiştirmek route dosyasını düzenlemeyi
// gerektiriyordu (OCP ihlali). Ayrıca route, hem "HTTP isteğini yönet"
// hem de "şifreyi nasıl güvenli hale getiririm" sorumluluklarını
// aynı anda taşıyordu (SRP ihlali).
//
// Bu modül şifreyle ilgili tüm sorumluluğu tek bir yere taşır.

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function hashPassword(plainTextPassword) {
  return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
}

async function comparePassword(plainTextPassword, hashedPassword) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
}

module.exports = { SALT_ROUNDS, hashPassword, comparePassword };
