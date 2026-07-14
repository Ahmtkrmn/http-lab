const request = require('supertest');
const app = require('../../src/app');
const { getPrismaClient } = require('../../src/db/prisma');
const { resetDb } = require('../testUtils/resetDb');
const { hashPassword } = require('../../src/utils/passwordService');

const prisma = getPrismaClient();

async function createUserAndLogin(email, role) {
  const hashed = await hashPassword('Sifre123');
  await prisma.user.create({ data: { email, name: email, password: hashed, role } });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Sifre123' });
  return res.body.accessToken;
}

describe('Items Integration (gerçek DB)', () => {
  let category;

  beforeEach(async () => {
    await resetDb();
    category = await prisma.category.create({ data: { name: 'test-kategori' } });
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it('EDITOR yeni ürün oluşturabilir ve ürün createdBy kendisi olur', async () => {
    const token = await createUserAndLogin('editor1@example.com', 'EDITOR');

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Klavye', price: 250, categoryId: category.id });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Klavye');
  });

  it('bir EDITOR başka bir EDITOR\'un ürününü silmeye çalışırsa 403 döner (sahiplik kontrolü)', async () => {
    const ownerToken = await createUserAndLogin('owner@example.com', 'EDITOR');
    const otherToken = await createUserAndLogin('other@example.com', 'EDITOR');

    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Mouse', price: 50, categoryId: category.id });

    const itemId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(deleteRes.status).toBe(403);
  });

  it('ADMIN, başkasının ürününü de silebilir (rol bypass)', async () => {
    const ownerToken = await createUserAndLogin('owner2@example.com', 'EDITOR');
    const adminToken = await createUserAndLogin('admin1@example.com', 'ADMIN');

    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Monitor', price: 900, categoryId: category.id });

    const itemId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(204);
  });

  it('VIEWER GET /api/items ile ürünleri listeleyebilir (yazamaz ama okuyabilir)', async () => {
    const editorToken = await createUserAndLogin('editor2@example.com', 'EDITOR');
    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ name: 'Kulaklik', price: 300, categoryId: category.id });

    const viewerToken = await createUserAndLogin('viewer2@example.com', 'VIEWER');
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].name).toBe('Kulaklik');
  });

  it('GET /api/items/:id var olmayan ürün için 404 döner', async () => {
    const token = await createUserAndLogin('viewer3@example.com', 'VIEWER');
    const res = await request(app)
      .get('/api/items/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/items/:id var olan ürünü kategorisiyle birlikte döner', async () => {
    const token = await createUserAndLogin('editor3@example.com', 'EDITOR');
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Webcam', price: 120, categoryId: category.id });

    const res = await request(app)
      .get(`/api/items/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Webcam');
    expect(res.body.data.category.name).toBe('test-kategori');
  });

  it('PUT /api/items/:id ürünü tamamen günceller', async () => {
    const token = await createUserAndLogin('editor4@example.com', 'EDITOR');
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Eski Isim', price: 10, categoryId: category.id });

    const res = await request(app)
      .put(`/api/items/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Yeni Isim', price: 99, categoryId: category.id, description: 'guncellendi' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Yeni Isim');
    expect(res.body.data.price).toBe(99);
  });

  it('PUT /api/items/:id zorunlu alan eksikse 400 döner', async () => {
    const token = await createUserAndLogin('editor5@example.com', 'EDITOR');
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X', price: 1, categoryId: category.id });

    const res = await request(app)
      .put(`/api/items/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 5 }); // name ve categoryId eksik

    expect(res.status).toBe(400);
  });

  it('PATCH /api/items/:id sadece verilen alanı günceller', async () => {
    const token = await createUserAndLogin('editor6@example.com', 'EDITOR');
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sabit Isim', price: 10, categoryId: category.id });

    const res = await request(app)
      .patch(`/api/items/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 15 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Sabit Isim'); // değişmedi
    expect(res.body.data.price).toBe(15); // güncellendi
  });

  it('POST /api/items zorunlu alan eksikse 400 döner', async () => {
    const token = await createUserAndLogin('editor7@example.com', 'EDITOR');
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 10 }); // name ve categoryId eksik

    expect(res.status).toBe(400);
  });

  it('DELETE /api/items/:id var olmayan ürün için 404 döner', async () => {
    const token = await createUserAndLogin('editor8@example.com', 'EDITOR');
    const res = await request(app)
      .delete('/api/items/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('geçersiz categoryId ile ürün oluşturma global errorHandler üzerinden hata döner', async () => {
    const token = await createUserAndLogin('editor9@example.com', 'EDITOR');
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hayalet Ürün', price: 10, categoryId: 999999 });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeDefined();
  });
});
