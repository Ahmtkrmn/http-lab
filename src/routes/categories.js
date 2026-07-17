const express = require('express');
const router = express.Router();

const categoriesDb = require('../store/categoriesDb');
const { authenticateToken } = require('../middleware/authMiddleware');

// GET /api/categories — Week 9'da frontend'in item formu için eklendi.
// items ile aynı erişim kuralı: giriş yapmış herkes (VIEWER dahil) listeler;
// kategori OLUŞTURMA ucu bilinçli olarak yok — kategoriler şimdilik seed ile
// yönetiliyor (bkz. prisma/seed.js), gereksiz yüzey açmıyoruz.
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const categories = await categoriesDb.findAll();
    res.status(200).json({ data: categories });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
