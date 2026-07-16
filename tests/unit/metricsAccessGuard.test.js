const metricsAccessGuard = require('../../src/middleware/metricsAccessGuard');

// Mock bir Express req/res/next üçlüsü kur — gerçek HTTP/DB gerektirmeden
// guard'ın karar mantığını (IP/token) izole test ediyoruz (authMiddleware.test
// ile aynı desen).
function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeReq({ ip, headers = {}, query = {} } = {}) {
  return {
    ip,
    headers,
    query,
    socket: { remoteAddress: ip },
  };
}

describe('metricsAccessGuard', () => {
  const originalToken = process.env.METRICS_TOKEN;
  const originalAllowed = process.env.METRICS_ALLOWED_IPS;

  afterEach(() => {
    // Env'i test öncesi haline döndür ki testler birbirini etkilemesin.
    if (originalToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = originalToken;
    if (originalAllowed === undefined) delete process.env.METRICS_ALLOWED_IPS;
    else process.env.METRICS_ALLOWED_IPS = originalAllowed;
  });

  describe('IP allowlist modu (token yokken)', () => {
    beforeEach(() => {
      delete process.env.METRICS_TOKEN;
      delete process.env.METRICS_ALLOWED_IPS;
    });

    it('loopback (127.0.0.1) izin verir', () => {
      const req = makeReq({ ip: '127.0.0.1' });
      const res = makeRes();
      const next = jest.fn();
      metricsAccessGuard(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBeNull();
    });

    it('IPv6-mapped loopback (::ffff:127.0.0.1) izin verir', () => {
      const req = makeReq({ ip: '::ffff:127.0.0.1' });
      const res = makeRes();
      const next = jest.fn();
      metricsAccessGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('özel ağ IP\'si (10.x / 172.16-31.x / 192.168.x) izin verir', () => {
      for (const ip of ['10.0.0.5', '172.20.1.1', '192.168.1.42']) {
        const req = makeReq({ ip });
        const res = makeRes();
        const next = jest.fn();
        metricsAccessGuard(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('halka açık IP\'yi (8.8.8.8) 403 ile reddeder', () => {
      const req = makeReq({ ip: '8.8.8.8' });
      const res = makeRes();
      const next = jest.fn();
      metricsAccessGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('METRICS_ALLOWED_IPS ile whitelist\'e eklenen halka açık IP\'ye izin verir', () => {
      process.env.METRICS_ALLOWED_IPS = '8.8.8.8, 1.1.1.1';
      const req = makeReq({ ip: '1.1.1.1' });
      const res = makeRes();
      const next = jest.fn();
      metricsAccessGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('token modu (METRICS_TOKEN tanımlıyken)', () => {
    beforeEach(() => {
      process.env.METRICS_TOKEN = 'gizli';
    });

    it('doğru bearer token ile izin verir (IP halka açık olsa bile)', () => {
      const req = makeReq({ ip: '8.8.8.8', headers: { authorization: 'Bearer gizli' } });
      const res = makeRes();
      const next = jest.fn();
      metricsAccessGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('query string ile token da kabul edilir (?token=)', () => {
      const req = makeReq({ ip: '8.8.8.8', query: { token: 'gizli' } });
      const res = makeRes();
      const next = jest.fn();
      metricsAccessGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('yanlış token 403 döner (loopback\'ten bile)', () => {
      const req = makeReq({ ip: '127.0.0.1', headers: { authorization: 'Bearer yanlis' } });
      const res = makeRes();
      const next = jest.fn();
      metricsAccessGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });
  });
});
