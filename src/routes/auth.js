require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 5, // IP başına maksimum 5 istek
  message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
});

// Prisma Bağlantısı (itemsDb'deki mantığın aynısı)
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// POST /api/auth/register - Yeni Kullanıcı Kaydı
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password ve name zorunludur.' });
    }

    // 1. Şifreyi Hashle (Görev: Salt rounds 12)
    const hashedPassword = await bcrypt.hash(password, 12);

    // 2. Kullanıcıyı DB'ye kaydet (Plain text şifre ASLA yazılmaz)
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: role || 'VIEWER' // Gönderilmezse varsayılan olarak VIEWER olur
      }
    });

    res.status(201).json({ 
      message: 'Kullanıcı başarıyla oluşturuldu.', 
      userId: newUser.id 
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

    // 2. Şifreyi doğrula
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre.' });
    }

    // 3. Token'ları üret (Görev: Access 15m, Refresh 7d)
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // 4. Refresh Token'ı veritabanına kaydet (Görev: DB'de sakla)
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    });

    res.status(200).json({
      accessToken,
      refreshToken,
      message: 'Giris başarili.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;