const request = require('supertest');
const app = require('../../src/app');
const { getPrismaClient } = require('../../src/db/prisma');
const { resetDb } = require('../testUtils/resetDb');
const { hashPassword } = require('../../src/utils/passwordService');

const prisma = getPrismaClient();

// Supertest yanıtındaki Set-Cookie header'ından refresh token cookie'sini
// ayıklar. Tarayıcının otomatik yaptığı işi testte elle yapıyoruz:
// raw  -> header satırının tamamı (HttpOnly, Path gibi flag'leri doğrulamak için)
// value-> cookie'nin değeri (sonraki isteğe Cookie header'ı olarak geri vermek için)
function extractRefreshCookie(res) {
  const setCookies = res.headers['set-cookie'] || [];
  const raw = setCookies.find((c) => c.startsWith('refreshToken='));
  if (!raw) return null;
  const value = raw.split(';')[0].split('=').slice(1).join('=');
  return { raw, value };
}

// Testlerde tekrar tekrar kullanılan "kullanıcı yarat + login ol" akışı.
async function registerAndLogin(email, password, role = 'VIEWER') {
  const hashed = await hashPassword(password);
  await prisma.user.create({
    data: { email, name: 'Test User', password: hashed, role },
  });
  return request(app).post('/api/auth/login').send({ email, password });
}

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
    it('doğru email/şifre ile access token (body) ve refresh token (httpOnly cookie) döner', async () => {
      const res = await registerAndLogin('login@example.com', 'DogruSifre123', 'EDITOR');

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();

      // Week 9: refresh token artık body'de DEĞİL — httpOnly cookie'de.
      expect(res.body.refreshToken).toBeUndefined();

      // Frontend'in UI çizmesi için user bilgisi body'de dönmeli (şifre hariç!)
      expect(res.body.user).toMatchObject({ email: 'login@example.com', role: 'EDITOR' });
      expect(res.body.user.password).toBeUndefined();

      // Cookie doğru flag'lerle set edilmiş mi?
      const cookie = extractRefreshCookie(res);
      expect(cookie).not.toBeNull();
      expect(cookie.raw).toMatch(/HttpOnly/i); // JS okuyamasın (XSS savunması)
      expect(cookie.raw).toMatch(/Path=\/api\/auth/i); // sadece auth uçlarına gitsin

      // Refresh token DB'ye yazılmış olmalı (revocation için)
      const dbUser = await prisma.user.findUnique({ where: { email: 'login@example.com' } });
      expect(dbUser.refreshToken).toBe(cookie.value);
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

  describe('POST /api/auth/refresh', () => {
    it('geçerli cookie ile yeni access token döner ve refresh token ROTATE edilir', async () => {
      const loginRes = await registerAndLogin('refresh@example.com', 'Sifre123', 'EDITOR');
      const loginCookie = extractRefreshCookie(loginRes);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${loginCookie.value}`);

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toMatchObject({ email: 'refresh@example.com', role: 'EDITOR' });

      // Rotation: yanıt YENİ bir cookie set etmeli ve DB artık yenisini tutmalı
      const rotatedCookie = extractRefreshCookie(res);
      expect(rotatedCookie).not.toBeNull();
      expect(rotatedCookie.value).not.toBe(loginCookie.value);

      const dbUser = await prisma.user.findUnique({ where: { email: 'refresh@example.com' } });
      expect(dbUser.refreshToken).toBe(rotatedCookie.value);
    });

    it('rotation sonrası ESKİ refresh token artık çalışmaz (tek kullanımlık)', async () => {
      const loginRes = await registerAndLogin('rotation@example.com', 'Sifre123');
      const loginCookie = extractRefreshCookie(loginRes);

      // İlk kullanım: başarılı (ve token'ı eskitir)
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${loginCookie.value}`);

      // İkinci kullanım (çalınmış token senaryosu): DB'deki aktif token
      // artık farklı olduğu için reddedilmeli
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${loginCookie.value}`);

      expect(res.status).toBe(401);
    });

    it('cookie yoksa 401 döner', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('bozuk/sahte cookie ile 401 döner', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=sahte.bir.token');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('DB\'deki refresh token\'ı NULL\'lar ve cookie\'yi temizler', async () => {
      const loginRes = await registerAndLogin('logout@example.com', 'Sifre123');
      const loginCookie = extractRefreshCookie(loginRes);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refreshToken=${loginCookie.value}`);

      expect(res.status).toBe(204);

      // Sunucu tarafı invalidation: DB'de oturum kalmamalı
      const dbUser = await prisma.user.findUnique({ where: { email: 'logout@example.com' } });
      expect(dbUser.refreshToken).toBeNull();

      // Cookie silme talimatı: aynı isimle, geçmiş tarihli/boş bir Set-Cookie döner
      const clearedCookie = extractRefreshCookie(res);
      expect(clearedCookie).not.toBeNull();
      expect(clearedCookie.value).toBe('');
    });

    it('logout sonrası eski refresh token ile /refresh 401 döner', async () => {
      const loginRes = await registerAndLogin('logout2@example.com', 'Sifre123');
      const loginCookie = extractRefreshCookie(loginRes);

      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', `refreshToken=${loginCookie.value}`);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${loginCookie.value}`);

      expect(res.status).toBe(401);
    });

    it('cookie olmadan bile 204 döner (idempotent)', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(204);
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
    it('süresi dolmuş access token ile korumalı bir uç noktaya erişim 401 döner', async () => {
      // Week 9'da 403 -> 401 düzeltildi: süresi dolmuş token "kimliğini
      // doğrulayamadım" (401) demektir; frontend bunu görünce sessizce
      // /refresh dener. 403 "yetkin yok" demek olurdu — yanıltıcı.
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 1, role: 'ADMIN' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: -60 } // 60 saniye önce sona ermiş
      );

      const res = await request(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/süresi dolmuş|geçersiz/i);
    });
  });
});
