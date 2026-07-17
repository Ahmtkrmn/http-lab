// CORS davranışı testi — tarayıcı olmadan: tarayıcının cross-origin istekten
// önce otomatik gönderdiği OPTIONS "preflight" isteğini Supertest ile taklit
// edip dönen Access-Control-* header'larını doğruluyoruz.
//
// Dikkat: app.js, FRONTEND_URL'i REQUIRE ANINDA okur (middleware koşullu
// takılıyor). Bu yüzden her describe bloğunda env'i ayarlayıp app'i
// jest.isolateModules ile TAZE bir modül kaydında yeniden yüklüyoruz —
// diğer test dosyalarındaki app örneği bundan etkilenmez (Jest her test
// dosyasına izole modül kaydı verir).

function loadAppWithEnv(frontendUrl) {
  let app;
  jest.isolateModules(() => {
    if (frontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = frontendUrl;
    }
    app = require('../../src/app');
  });
  return app;
}

const request = require('supertest');

const ORIGIN = 'http://localhost:5173';

afterEach(() => {
  delete process.env.FRONTEND_URL;
});

describe('CORS (Week 9)', () => {
  it('FRONTEND_URL set edilmemişse CORS header\'ları DÖNMEZ (kasıtlı "kırık" durum)', async () => {
    const app = loadAppWithEnv(undefined);

    const res = await request(app)
      .options('/api/items')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    // Header yok -> tarayıcı yanıtı frontend'e vermez, konsola CORS hatası basar.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('FRONTEND_URL set edilince preflight, izinli origin ve credentials header\'larıyla döner', async () => {
    const app = loadAppWithEnv(ORIGIN);

    const res = await request(app)
      .options('/api/items')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
    // Joker (*) DEĞİL, origin'in kendisi: credentials modunda tarayıcı '*' kabul etmez.
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    // Cookie'li (kimlikli) isteklere izin — frontend'deki credentials: 'include' ile çifttir.
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('farklı bir origin istek atsa da header İZİNLİ origin\'i söyler (engelleme tarayıcının işi)', async () => {
    const app = loadAppWithEnv(ORIGIN);

    const res = await request(app)
      .options('/api/items')
      .set('Origin', 'https://kotu-site.example.com')
      .set('Access-Control-Request-Method', 'GET');

    // Önemli kavrayış: CORS'ta sunucu isteği REDDETMEZ; sadece "ben şu
    // origin'e izin veriyorum" der. cors paketi (string origin config'iyle)
    // bu header'ı her istekte aynı döner. Asıl engelleme TARAYICIDA olur:
    // kotu-site.example.com'daki sayfa, header'daki izinli origin kendi
    // origin'iyle eşleşmediği için yanıtı OKUYAMAZ. (curl/Postman'in CORS'a
    // takılmamasının sebebi de bu — CORS bir tarayıcı mekanizmasıdır,
    // sunucu güvenlik duvarı değildir.)
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-origin']).not.toBe('https://kotu-site.example.com');
  });
});
