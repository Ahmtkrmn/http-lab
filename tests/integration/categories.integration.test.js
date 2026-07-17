const request = require('supertest');
const app = require('../../src/app');
const { getPrismaClient } = require('../../src/db/prisma');
const { resetDb } = require('../testUtils/resetDb');
const { hashPassword } = require('../../src/utils/passwordService');

const prisma = getPrismaClient();

describe('Categories Integration (gerçek DB)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  async function loginAsViewer() {
    const hashed = await hashPassword('Sifre123');
    await prisma.user.create({
      data: { email: 'viewer@example.com', name: 'Viewer', password: hashed, role: 'VIEWER' },
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'viewer@example.com', password: 'Sifre123' });
    return res.body.accessToken;
  }

  it('token olmadan 401 döner', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(401);
  });

  it('giriş yapmış kullanıcıya (VIEWER dahil) kategorileri isme göre sıralı döner', async () => {
    await prisma.category.createMany({
      data: [{ name: 'furniture' }, { name: 'electronics' }],
    });
    const accessToken = await loginAsViewer();

    const res = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    // orderBy name asc: 'electronics' < 'furniture'
    expect(res.body.data.map((c) => c.name)).toEqual(['electronics', 'furniture']);
  });
});
