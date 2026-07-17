const { authenticateToken, requireRole } = require('../../src/middleware/authMiddleware');
const { generateAccessToken } = require('../../src/utils/tokenService');

// Express req/res nesnelerini gerçek bir sunucu açmadan taklit ediyoruz.
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authMiddleware.authenticateToken', () => {
  it('Authorization header yoksa 401 döner', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('geçerli bir Bearer token ile req.user set edilir ve next() çağrılır', () => {
    const token = generateAccessToken({ userId: 1, role: 'ADMIN' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.userId).toBe(1);
    expect(req.user.role).toBe('ADMIN');
  });

  it('geçersiz token için 401 döner (kimlik sorunu, yetki sorunu değil)', () => {
    // Week 9'da 403 -> 401 olarak düzeltildi: geçersiz/süresi dolmuş token
    // bir KİMLİK DOĞRULAMA hatasıdır (401); 403 yalnızca rol/sahiplik
    // reddi içindir (bkz. authMiddleware.js'teki açıklama).
    const req = { headers: { authorization: 'Bearer gecersiz.token.deger' } };
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authMiddleware.requireRole', () => {
  it('kullanıcının rolü izin verilenler listesindeyse next() çağrılır', () => {
    const middleware = requireRole(['EDITOR']);
    const req = { user: { role: 'EDITOR' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ADMIN rolü her zaman izinlidir (bypass)', () => {
    const middleware = requireRole(['EDITOR']);
    const req = { user: { role: 'ADMIN' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rolü izin verilenler listesinde olmayan kullanıcı için 403 döner', () => {
    const middleware = requireRole(['EDITOR']);
    const req = { user: { role: 'VIEWER' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('tek bir string rol verildiğinde de doğru çalışır (dizi olmasa da)', () => {
    const middleware = requireRole('EDITOR');
    const req = { user: { role: 'EDITOR' } };
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
