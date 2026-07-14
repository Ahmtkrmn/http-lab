require('dotenv').config({ quiet: true });
// SOLID / DIP notu: Bu dosya artık kendi Pool/PrismaClient'ını üretmiyor.
// Uygulama genelinde tek bir bağlantı için src/db/prisma.js'teki paylaşılan
// singleton'ı kullanıyor (bkz. o dosyadaki DIP açıklaması).
const { getPrismaClient } = require('../db/prisma');

const prisma = getPrismaClient();

const itemsDb = {
  // Tüm ürünleri kategorileriyle birlikte getir (Eager Loading)
  findAll: async () => {
    return prisma.item.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' }, // En yeni eklenen en üstte çıksın
    });
  },

  // Tek bir ürünü ID'sine göre bul
  findById: async (id) => {
    return prisma.item.findUnique({
      where: { id: parseInt(id) },
      include: { category: true },
    });
  },

  // Yeni ürün oluştur
  create: async (data) => {
    // BUG FIX: `user: { connect: ... }` daha önce yanlışlıkla `category`
    // objesinin İÇİNE yazılmıştı. Prisma "category" ilişkisi için "user"
    // adında bir alanı tanımadığından bu, her POST isteğinde
    // "Unknown argument `user`" hatasıyla 500 dönmesine sebep oluyordu.
    // Bu regresyon, entegrasyon testleri (POST /api/items) yazılırken
    // ortaya çıkarıldı. `user` ilişkisi artık `data`'nın kendi seviyesinde,
    // `category` ile kardeş bir alan olarak doğru şekilde kuruluyor.
    return prisma.item.create({
      data: {
        name: data.name,
        price: data.price,
        description: data.description || null,
        // Dikkat: categoryId'yi doğrudan yazmak yerine 'connect' kullanıyoruz
        category: {
          connect: { id: parseInt(data.categoryId) },
        },
        // Ürünü oluşturan kişinin ID'sini tokendan (req.user.userId) alıp veritabanına işliyoruz!
        ...(data.userId && { user: { connect: { id: parseInt(data.userId) } } }),
      },
      include: { category: true },
    });
  },

  // Kısmi güncelleme (PATCH)
  update: async (id, data) => {
    return prisma.item.update({
      where: { id: parseInt(id) },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.categoryId && { category: { connect: { id: parseInt(data.categoryId) } } }),
      },
      include: { category: true },
    });
  },

  // Tam güncelleme (PUT)
  replace: async (id, data) => {
    return prisma.item.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        price: data.price,
        description: data.description || null,
        category: { connect: { id: parseInt(data.categoryId) } },
      },
      include: { category: true },
    });
  },

  // Ürünü sil
  remove: async (id) => {
    return prisma.item.delete({
      where: { id: parseInt(id) },
    });
  },
};

module.exports = itemsDb;