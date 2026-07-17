const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { getPrismaClient } = require('../db/prisma');
const { hashPassword, comparePassword } = require('../utils/passwordService');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/tokenService');

const prisma = getPrismaClient();

// ---------------------------------------------------------------------------
// Week 9 — Refresh token artık response BODY'de değil, httpOnly COOKIE'de.
//
// Neden? XSS (sayfaya sızan kötü niyetli JS) localStorage'daki ve JS
// değişkenlerindeki her şeyi okuyabilir. httpOnly cookie'yi ise JavaScript
// HİÇBİR ŞEKİLDE okuyamaz — onu sadece tarayıcının kendisi, istekle birlikte
// otomatik gönderir. Bu yüzden strateji:
//   - Access token (15 dk, kısa ömürlü)  -> frontend'de SADECE bellekte (RAM)
//   - Refresh token (7 gün, uzun ömürlü) -> httpOnly cookie'de
// Böylece XSS olsa bile çalınabilecek tek şey 15 dakikalık access token olur.
// ---------------------------------------------------------------------------
const REFRESH_COOKIE_NAME = 'refreshToken';

// path: '/api/auth' — tarayıcı bu cookie'yi SADECE /api/auth/* isteklerinde
// gönderir. /api/items gibi uç noktalara uzun ömürlü token'ın hiç gitmemesi,
// gereksiz maruziyeti (exposure) azaltır: cookie'ye ihtiyacı olan tek yer
// /refresh ve /logout'tur.
function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true, // JS'in document.cookie ile okumasını engeller (XSS savunması)
    // secure: cookie sadece HTTPS üzerinden gönderilsin. Localhost'ta HTTP
    // kullandığımız için sadece production'da açıyoruz.
    secure: isProd,
    // sameSite: dev'de frontend (localhost:5173) ve backend (localhost:3000)
    // aynı "site" sayılır (port SameSite hesabına girmez) -> 'lax' yeterli.
    // Production'da ise Vercel (frontend) ve Render (backend) FARKLI sitelerdir;
    // cross-site istekte cookie gönderilebilmesi için 'none' + secure ŞARTTIR
    // (tarayıcılar SameSite=None'ı Secure olmadan reddeder).
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün — refresh token ömrüyle senkron
  };
}

// clearCookie çağırırken path AYNI olmak zorunda (yanlış path'li silme,
// tarayıcıda hiçbir şey silmez). maxAge'i çıkarıyoruz çünkü silme işleminin
// kendisi tarihi geçmişe kurar.
function clearRefreshCookie(res) {
  const clearOpts = { ...refreshCookieOptions() };
  delete clearOpts.maxAge;
  res.clearCookie(REFRESH_COOKIE_NAME, clearOpts);
}

// Login ve refresh response'larında aynı user şekli dönsün diye tek yerde.
// Şifre hash'i gibi hassas alanların response'a SIZMAMASI için explicit
// (alan alan) seçiyoruz — asla `...user` spread'i yapma.
function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // IP başına maksimum 5 istek
  message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
  // Testler aynı Express app örneğini paylaştığı ve tek bir "IP"den (127.0.0.1)
  // onlarca login isteği attığı için, test ortamında rate limiting'i pas geçiyoruz.
  // Üretimde bu davranış değişmez.
  skip: () => process.env.NODE_ENV === 'test',
});

// POST /api/auth/register - Yeni Kullanıcı Kaydı
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password ve name zorunludur.' });
    }

    // Şifreleme sorumluluğu artık passwordService'te (SRP).
    const hashedPassword = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role || 'VIEWER', // Gönderilmezse varsayılan olarak VIEWER olur
      },
    });

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      userId: newUser.id,
    });
  } catch (err) {
    // Benzersiz (unique) email kısıtlaması hatası
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Bu email zaten kullanılıyor.' });
    }
    next(err);
  }
});

// POST /api/auth/login - Giriş Yapma
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Kullanıcıyı bul
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre.' });
    }

    // 2. Şifreyi doğrula (passwordService)
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre.' });
    }

    // 3. Token'ları üret (tokenService) — expiresIn / secret kararları artık
    // burada değil, tokenService içinde tek bir yerde yönetiliyor.
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // 4. Refresh Token'ı veritabanına kaydet — bu bize token'ı sunucu
    // tarafında GEÇERSİZ KILMA (revocation) yeteneği verir. Salt JWT doğrulama
    // "imza geçerli mi + süresi dolmuş mu"ya bakar; DB karşılaştırması ise
    // "bu token hâlâ bu kullanıcının AKTİF oturumu mu" sorusunu yanıtlar
    // (logout sonrası veya rotation sonrası eski token'lar imzası geçerli
    // olsa bile reddedilir).
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // 5. Refresh token'ı httpOnly cookie olarak yaz; body'de SADECE access
    // token + kullanıcı bilgisi dön (frontend'in role'e göre UI çizebilmesi
    // için — yetkinin gerçek denetimi her zaman backend'de kalır).
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

    res.status(200).json({
      accessToken,
      user: publicUser(user),
      message: 'Giris başarili.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh - Access token yenileme (silent refresh)
// Frontend bunu iki durumda çağırır:
//   1. Sayfa yenilenince (F5): bellekteki access token uçmuştur; cookie
//      hâlâ durduğu için kullanıcıya şifre sormadan oturumu geri kurarız.
//   2. Access token 15 dk sonra dolunca: 401 alan frontend, isteği
//      tekrarlamadan önce buradan taze bir access token alır.
router.post('/refresh', async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!tokenFromCookie) {
      return res.status(401).json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' });
    }

    // 1. Kriptografik doğrulama: imza bizim mi, süresi geçmiş mi?
    let decoded;
    try {
      decoded = verifyRefreshToken(tokenFromCookie);
    } catch (err) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.' });
    }

    // 2. Revocation kontrolü: token DB'deki AKTİF oturumla birebir aynı mı?
    // Eşleşmiyorsa ya logout edilmiş ya da rotation ile eskitilmiş bir
    // token'dır — ikisi de "bu oturum artık yok" demektir.
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.refreshToken !== tokenFromCookie) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Oturum geçersiz kılınmış. Lütfen tekrar giriş yapın.' });
    }

    // 3. Token ROTATION: her refresh'te yeni bir refresh token üretip
    // eskisini DB'de ezerek geçersiz kılıyoruz. Böylece çalınan bir refresh
    // token en fazla BİR kez kullanılabilir; ikinci kullanım (gerçek
    // kullanıcı da yenilemiş olacağı için) DB eşleşmesinden döner.
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, refreshCookieOptions());
    res.status(200).json({ accessToken, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout - Oturumu sunucu tarafında geçersiz kıl
// Sadece cookie silmek YETMEZ: cookie istemcidedir, kopyalanmış bir refresh
// token hâlâ çalışırdı. Asıl invalidation, DB'deki refreshToken alanını
// NULL'lamaktır — ondan sonra o token'la /refresh çağrısı 401 döner.
router.post('/logout', async (req, res, next) => {
  try {
    const tokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];

    if (tokenFromCookie) {
      try {
        const decoded = verifyRefreshToken(tokenFromCookie);
        // updateMany + çift koşul: yalnızca DB'de duran token, cookie'deki
        // token'ın KENDİSİYSE sıfırla. (update yerine updateMany: koşul
        // tutmazsa hata fırlatmak yerine sessizce 0 satır günceller —
        // logout idempotent kalır.)
        await prisma.user.updateMany({
          where: { id: decoded.userId, refreshToken: tokenFromCookie },
          data: { refreshToken: null },
        });
      } catch (err) {
        // Token bozuk/süresi dolmuş olabilir — logout yine de başarılıdır;
        // amacımız oturumu kapatmak, hata döndürmek değil.
      }
    }

    clearRefreshCookie(res);
    // 204: "yapıldı, dönecek içerik yok". Cookie'siz tekrar çağrılsa bile
    // aynı sonucu verir (idempotent) — çifte tıklama vb. hata üretmez.
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
