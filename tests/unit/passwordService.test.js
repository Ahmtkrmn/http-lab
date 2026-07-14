const { hashPassword, comparePassword, SALT_ROUNDS } = require('../../src/utils/passwordService');

describe('passwordService', () => {
  describe('hashPassword', () => {
    it('düz metin şifreyi hash\'ler ve orijinal metinden farklı bir sonuç üretir', async () => {
      const hashed = await hashPassword('mySecret123');
      expect(hashed).not.toBe('mySecret123');
      expect(typeof hashed).toBe('string');
    });

    it('bcrypt formatında bir hash üretir ($2b$ ile başlar)', async () => {
      const hashed = await hashPassword('anotherSecret');
      expect(hashed.startsWith('$2b$') || hashed.startsWith('$2a$')).toBe(true);
    });

    it('SALT_ROUNDS = 12 olarak sabitlenmiştir', () => {
      expect(SALT_ROUNDS).toBe(12);
    });

    it('aynı şifre için her seferinde farklı hash üretir (salt sayesinde)', async () => {
      const hash1 = await hashPassword('sameSecret');
      const hash2 = await hashPassword('sameSecret');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('doğru şifre için true döner', async () => {
      const hashed = await hashPassword('correctPassword');
      const result = await comparePassword('correctPassword', hashed);
      expect(result).toBe(true);
    });

    it('yanlış şifre için false döner', async () => {
      const hashed = await hashPassword('correctPassword');
      const result = await comparePassword('wrongPassword', hashed);
      expect(result).toBe(false);
    });
  });
});
