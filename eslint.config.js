const js = require('@eslint/js');

// ESLint 9+ "flat config" formatı: her obje bir konfigürasyon katmanı,
// dizideki sıraya göre birleştirilir (sonraki öncekini ezer/genişletir).
module.exports = [
  js.configs.recommended,
  {
    // Proje genelinde geçerli ortam: Node.js + CommonJS (require/module.exports).
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      // Kullanılmayan değişkenleri hata değil uyarı yap; Express handler'larında
      // (err, req, res, next) imzanın tamamını yazmak zorunlu olduğu için
      // kullanılmayan `req`/`next` gibi parametreleri es geçiyoruz. Projede
      // `catch (err) { return res.status(...).json(...) }` deseni sıkça
      // kullanılıyor (err'i loglamadan genel bir hata dönmek) — bu yüzden
      // yakalanan hatanın kullanılmaması da hata değil.
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // Test dosyalarına özel: Jest'in global fonksiyonları (describe/it/expect vb.)
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        beforeAll: 'readonly',
        afterEach: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
  },
  {
    // ESLint'in taramaması gereken dizinler.
    ignores: ['node_modules/**', 'coverage/**', 'prisma/migrations/**'],
  },
];
