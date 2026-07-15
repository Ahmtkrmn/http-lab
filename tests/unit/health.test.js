// DB'nin gerçekten çökmüş olduğu durumu, gerçek bir Postgres'i kapatmadan
// simüle etmek için src/db/prisma.js'i mock'luyoruz (bkz. o dosyadaki DIP
// notu: paylaşılan singleton olduğu için tek bir yerden mock'lamak yeterli).
jest.mock('../../src/db/prisma', () => ({
  getPrismaClient: () => ({
    $queryRaw: jest.fn().mockRejectedValue(new Error('Connection terminated')),
  }),
}));

const request = require('supertest');
const app = require('../../src/app');

describe('GET /health (DB erişilemez durumda - mock)', () => {
  it('DB sorgusu başarısız olursa 503 ve "disconnected" döner', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.db).toBe('disconnected');
  });
});
