const request = require('supertest');
const app = require('../../src/app');
const { getPrismaClient } = require('../../src/db/prisma');

const prisma = getPrismaClient();

describe('Observability: /metrics & requestId (gerçek DB)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('X-Request-ID (correlation ID)', () => {
    it('her yanıta bir X-Request-ID header ekler', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(/[0-9a-f-]{36}/i);
    });

    it('gelen X-Request-ID header varsa onu korur (zinciri sürdürür)', async () => {
      const incoming = 'test-correlation-id-123';
      const res = await request(app).get('/health').set('X-Request-ID', incoming);
      expect(res.headers['x-request-id']).toBe(incoming);
    });
  });

  describe('GET /metrics', () => {
    it('Prometheus text formatında custom metrikleri döner', async () => {
      // Önce en az bir istek üretelim ki http_requests_total'da veri olsun.
      await request(app).get('/health');

      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      // Üç custom metriğin de kayıt defterinde bulunduğunu doğrula.
      expect(res.text).toContain('http_requests_total');
      expect(res.text).toContain('http_request_duration_seconds');
      expect(res.text).toContain('active_db_connections');
    });

    it('metrics middleware /metrics endpoint\'ini kendi sayacına EKLEMEZ (self-noise yok)', async () => {
      await request(app).get('/metrics');
      const res = await request(app).get('/metrics');
      // route="/metrics" içeren bir http_requests_total serisi olmamalı.
      expect(res.text).not.toMatch(/http_requests_total\{[^}]*route="\/metrics"/);
    });
  });

  describe('GET /metrics erişim koruması (METRICS_TOKEN)', () => {
    afterEach(() => {
      delete process.env.METRICS_TOKEN;
    });

    it('token tanımlıyken yanlış/eksik token 403 döner', async () => {
      process.env.METRICS_TOKEN = 'gizli-token';
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(403);
    });

    it('token tanımlıyken doğru bearer token 200 döner', async () => {
      process.env.METRICS_TOKEN = 'gizli-token';
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', 'Bearer gizli-token');
      expect(res.status).toBe(200);
    });
  });
});
