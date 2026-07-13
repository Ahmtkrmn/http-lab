const express = require('express');
const router = express.Router();
// inMemoryStore yerine yeni veritabanı katmanımızı içeri aktarıyoruz [cite: 46, 47]
const itemsDb = require('../store/itemsDb'); 

//güvenlik middleware'lerini içeri aktarıyoruz
const{authenticateToken, requireRole} = require('../middleware/authMiddleware');

// GET /api/items
//sadece giriş yapmış kullanıcılar görebilsin diye authenticateToken middleware'ini ekliyoruz
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    // Veritabanından verilerin gelmesini bekle
    const items = await itemsDb.findAll();
    res.status(200).json({ data: items, total: items.length });
  } catch (err) {
    // Hata olursa global errorHandler'a ilet [cite: 47, 50]
    next(err); 
  }
});

// GET /api/items/:id
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const item = await itemsDb.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(200).json({ data: item });
  } catch (err) {
    next(err);
  }
});

// POST /api/items
router.post('/', authenticateToken,requireRole('EDITOR'), async (req, res, next) => {
  try {
    // DİKKAT: Artık 'category' string'i değil, 'categoryId' (Sayı) alıyoruz!
    const { name, price, categoryId, description } = req.body;
    
    if (!name || price === undefined || !categoryId) {
      return res.status(400).json({ error: 'name, price, and categoryId are required' });
    }
    
// Ürünü oluşturan kişinin ID'sini tokendan (req.user.userId) alıp veritabanına işliyoruz!
    const newItem = await itemsDb.create({ 
      name, 
      price, 
      categoryId, 
      description,
      userId: req.user.userId 
    });
res.status(201).json({ data: newItem });
  } catch (err) {
    next(err);
  }
});

// PUT /api/items/:id (Tam Güncelleme)
router.put('/:id', authenticateToken, requireRole('EDITOR'), async (req, res, next) => {
  try {
    const { name, price, categoryId, description } = req.body;
    
    if (!name || price === undefined || !categoryId) {
      return res.status(400).json({ error: 'name, price, and categoryId are required for PUT' });
    }
    
    const updatedItem = await itemsDb.replace(req.params.id, { name, price, categoryId, description });
    res.status(200).json({ data: updatedItem });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/items/:id (Kısmi Güncelleme)
router.patch('/:id', authenticateToken, requireRole('EDITOR'), async (req, res, next) => {
  try {
    const updatedItem = await itemsDb.update(req.params.id, req.body);
    res.status(200).json({ data: updatedItem });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/items/:id -> Sadece EDITOR ve ADMIN silebilir
router.delete('/:id', authenticateToken, requireRole(['EDITOR']), async (req, res, next) => {
  try {
    const item = await itemsDb.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // KASITLI GÜVENLİK KONTROLÜ (Sahiplik - Ownership)
    // Admin değilse ve bu ürünü kendisi oluşturmadıysa ENGELLE
    if (req.user.role !== 'ADMIN' && item.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Sadece kendi ürünlerinizi silebilirsiniz (403 Forbidden).' });
    }

    await itemsDb.remove(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;