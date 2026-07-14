const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { getPrismaClient } = require('../db/prisma');
const { hashPassword, comparePassword } = require('../utils/passwordService');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenService');

const prisma = getPrismaClient();

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

    // 4. Refresh Token'ı veritabanına kaydet
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.status(200).json({
      accessToken,
      refreshToken,
      message: 'Giris başarili.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
