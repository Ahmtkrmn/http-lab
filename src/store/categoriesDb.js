require('dotenv').config({ quiet: true });
// DIP: itemsDb ile aynı desen — kendi Pool/PrismaClient'ını üretmez,
// src/db/prisma.js'teki paylaşılan singleton'ı kullanır.
const { getPrismaClient } = require('../db/prisma');

const prisma = getPrismaClient();

const categoriesDb = {
  // Week 9: Frontend'deki "Yeni Item" formunun kategori dropdown'ını
  // doldurmak için eklendi. Kullanıcıya ham categoryId sayısı yazdırmak
  // yerine isimden seçtirmek hem UX hem veri bütünlüğü açısından doğrusu.
  findAll: async () => {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  },
};

module.exports = categoriesDb;
