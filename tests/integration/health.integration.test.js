const request = require('supertest');
const app = require('../../src/app');
const { getPrismaClient } = require('../../src/db/prisma');
const { version } = require('../../package.json');

const prisma = getPrismaClient();

describe('Health Check Integration (gerçek DB)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('DB bağlıyken 200 ve "connected" döner', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      version,
      db: 'connected',
    });
    expect(typeof res.body.uptime).toBe('number');
  });
});
