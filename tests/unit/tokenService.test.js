const jwt = require('jsonwebtoken');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../../src/utils/tokenService');

describe('tokenService', () => {
  const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
  const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

  describe('generateAccessToken', () => {
    it('geçerli bir JWT string üretir', () => {
      const token = generateAccessToken({ userId: 1, role: 'ADMIN' });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('payload içine userId ve role gömer', () => {
      const token = generateAccessToken({ userId: 42, role: 'EDITOR' });
      const decoded = jwt.verify(token, ACCESS_SECRET);
      expect(decoded.userId).toBe(42);
      expect(decoded.role).toBe('EDITOR');
    });

    it('15 dakikalık bir expiresIn ayarlar', () => {
      const token = generateAccessToken({ userId: 1, role: 'VIEWER' });
      const decoded = jwt.decode(token);
      const diffSeconds = decoded.exp - decoded.iat;
      expect(diffSeconds).toBe(15 * 60);
    });
  });

  describe('generateRefreshToken', () => {
    it('payload içine sadece userId gömer, role gömmez', () => {
      const token = generateRefreshToken({ userId: 7 });
      const decoded = jwt.verify(token, REFRESH_SECRET);
      expect(decoded.userId).toBe(7);
      expect(decoded.role).toBeUndefined();
    });

    it('7 günlük bir expiresIn ayarlar', () => {
      const token = generateRefreshToken({ userId: 1 });
      const decoded = jwt.decode(token);
      const diffSeconds = decoded.exp - decoded.iat;
      expect(diffSeconds).toBe(7 * 24 * 60 * 60);
    });

    it('aynı saniyede üretilen iki token bile FARKLIDIR (jti sayesinde)', () => {
      // Week 9 token rotation bu garantiye dayanır: iat/exp saniye
      // hassasiyetinde olduğu için jti olmadan art arda üretilen iki token
      // birebir aynı string olurdu (bkz. tokenService.js'teki açıklama).
      const token1 = generateRefreshToken({ userId: 1 });
      const token2 = generateRefreshToken({ userId: 1 });
      expect(token1).not.toBe(token2);
      expect(jwt.decode(token1).jti).toBeDefined();
    });
  });

  describe('verifyAccessToken', () => {
    it('geçerli bir token için decoded payload döner', () => {
      const token = generateAccessToken({ userId: 5, role: 'ADMIN' });
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(5);
      expect(decoded.role).toBe('ADMIN');
    });

    it('geçersiz (bozuk) token için hata fırlatır', () => {
      expect(() => verifyAccessToken('gecersiz.bir.token')).toThrow();
    });

    it('süresi dolmuş token için TokenExpiredError fırlatır', () => {
      const expiredToken = jwt.sign(
        { userId: 1, role: 'VIEWER' },
        ACCESS_SECRET,
        { expiresIn: -10 } // -10 saniye: geçmişte sona ermiş
      );
      expect(() => verifyAccessToken(expiredToken)).toThrow(jwt.TokenExpiredError);
    });

    it('yanlış secret ile imzalanmış token için hata fırlatır', () => {
      const tokenWithWrongSecret = jwt.sign({ userId: 1 }, 'yanlis-secret', { expiresIn: '15m' });
      expect(() => verifyAccessToken(tokenWithWrongSecret)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('geçerli bir refresh token için decoded payload döner', () => {
      const token = generateRefreshToken({ userId: 9 });
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(9);
    });
  });
});
