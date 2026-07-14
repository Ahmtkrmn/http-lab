const request = require('supertest');
const app = require('../../src/app');
const { getPrismaClient } = require('../../src/db/prisma');
const { resetDb } = require('../testUtils/resetDb');
const { hashPassword } = require('../../src/utils/passwordService');

const prisma = getPrismaClient();

describe('Auth Integration (gerçek DB)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('geçerli bilgilerle yeni kullanıcı oluşturur ve DB\'ye kaydeder', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'yeni@example.com',
        password: 'GucluSifre123',
        name: 'Yeni Kullanici',
      });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBeDefined();

      const dbUser = await prisma.user.findUnique({ where: { email: 'yeni@example.com' } });
      expect(dbUser).not.toBeNull();
      expect(dbUser.password).not.toBe('GucluSifre123'); // plaintext DB'de tutulmamalı
      expect(dbUser.role).toBe('VIEWER'); // varsayılan rol
    });

    it('aynı email ile ikinci kayıt denemesinde 409 döner', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'tekrar@example.com',
        password: 'Sifre123',
        name: 'Birinci',
      });

      const res = await request(app).post('/api/auth/register').send({
        email: 'tekrar@example.com',
        password: 'BaskaSifre456',
        name: 'Ikinci',
      });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('doğru email/şifre ile access ve refresh token döner (gerçek DB üzerinden)', async () => {
      const hashed = await hashPassword('DogruSifre123');
      await prisma.user.create({
        data: { email: 'login@example.com', name: 'Login User', password: hashed, role: 'EDITOR' },
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'DogruSifre123',
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // Refresh token DB'ye yazılmış olmalı
      const dbUser = await prisma.user.findUnique({ where: { email: 'login@example.com' } });
      expect(dbUser.refreshToken).toBe(res.body.refreshToken);
    });

    it('yanlış şifre ile 401 döner', async () => {
      const hashed = await hashPassword('DogruSifre123');
      await prisma.user.create({
        data: { email: 'yanlissifre@example.com', name: 'X', password: hashed, role: 'VIEWER' },
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'yanlissifre@example.com',
        password: 'YanlisSifre',
      });

      expect(res.status).toBe(401);
    });

    it('olmayan email ile 401 döner', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'olmayan@example.com',
        password: 'herhangi',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Yetkisiz erişim senaryoları', () => {
    it('token olmadan /api/items isteği 401 döner', async () => {
      const res = await request(app).get('/api/items');
      expect(res.status).toBe(401);
    });

    it('VIEWER rolündeki kullanıcı ürün oluşturmaya çalışırsa 403 döner', async () => {
      const hashed = await hashPassword('Sifre123');
      await prisma.user.create({
        data: { email: 'viewer@example.com', name: 'Viewer', password: hashed, role: 'VIEWER' },
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'viewer@example.com',
        password: 'Sifre123',
      });

      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ name: 'Test Ürün', price: 10, categoryId: 1 });

      expect(res.status).toBe(403);
    });
  });

  describe('Token expiry senaryosu', () => {
    it('süresi dolmuş access token ile korumalı bir uç noktaya erişim 403 döner', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 1, role: 'ADMIN' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: -60 } // 60 saniye önce sona ermiş
      );

      const res = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/süresi dolmuş|geçersiz/i);
    });
  });
});
