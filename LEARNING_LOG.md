# Learning Log

Bu dosya, `TODO.md` yol haritasında ilerlerken yapılan her önemli değişikliği
**ne yapıldı → neden bu şekilde yapıldı → buradan çıkarılacak ders** formatında
kayıt altına alır. Amaç sadece "ne değişti"yi değil, "neden böyle karar
verildiği"ni de görünür kılmak.

---

## Adım 1 — `TODO.md` "Devam Etmeden Önce Düzeltilmesi Gereken Sorunlar"

**Tarih:** 2026-07-15

### 1. `docker-compose.yml` — `DATABASE_URL` çakışması

**Yapılan Değişiklik:**
`docker-compose.yml`'de `app` servisinin altında hem `env_file: .env` hem de
`environment: - DATABASE_URL=...` bloğu vardı. `environment` bloğu tamamen
kaldırıldı; artık `app` servisi `DATABASE_URL`'i sadece `.env`'den okuyor.

**Mimari Karar:**
Docker Compose'ta bir servise değişken sağlamanın iki yolu varsa (`env_file`
ve `environment`) ve ikisi de aynı adı tanımlıyorsa, **`environment` her
zaman kazanır** — `env_file`'daki değeri sessizce ezer. Burada asıl sorun şu:
ezilen değer, `.env`'deki gerçek değerle *aynı* görünüyordu ama pratikte iki
ayrı yerde tutulan bir bağlantı bilgisi, biri güncellenip diğeri unutulduğunda
(örn. şifre değişirse) sessizce birbirinden sapar ve hata "neden çalışmıyor"
diye saatlerce debug edilir. Tek kaynak (`.env`) = tek gerçek.

**Mentör Notu:**
Konfigürasyonda **aynı bilgiyi iki yerde tutma** (DRY, ama config için).
Docker Compose'ta bir env değişkenini nereden aldığını her zaman şu öncelik
sırasıyla düşün: `docker run -e` / compose `environment:` (en yüksek öncelik)
→ `env_file:` → image'ın kendi `ENV`'i (Dockerfile) → hiçbiri yoksa boş.
Bir servis "yanlış" bir değer kullanıyor gibi görünüyorsa önce bu zinciri
kontrol et.

**Ayrıca fark edilen ek bir bug (bonus):** Kaldırılan satırdaki değer
`DATABASE_URL=postgresql://...@localhost:5432/...` idi. Bu, `app`
container'ının İÇİNDEN bakıldığında yanlıştır — bir container içinde
`localhost`, o container'ın kendisini işaret eder, aynı Docker ağındaki
`db` container'ını değil. `docker compose up` ile tüm stack birlikte
ayağa kalkarsa, `app`'in `db`'ye ulaşabilmesi için host adının `localhost`
değil `db` (servis adı) olması gerekir. Bunu otomatik düzeltmedim çünkü
`.env` kişisel/gitignore'lı bir dosya ve senin hangi workflow'u kullandığına
bağlı (aşağıdaki "Dikkat" notuna bak).

### 2. `docker-compose.yml` — veritabanı portunun host'a açık olması

**Yapılan Değişiklik:**
`db` servisindeki `ports: - "5432:5432"` satırı tamamen kaldırıldı.

**Mimari Karar:**
Bir Docker Compose dosyasındaki tüm servisler, aynı **iç ağda (internal
network)** otomatik olarak birbirine erişebilir — `ports:` mapping'i sadece
**host makineden (senin bilgisayarından)** container'a erişim açar, servisler
arası erişim için gerekli değildir. `app` zaten `db`'ye Docker'ın iç DNS'i
üzerinden (`db` hostname'i ile) erişebiliyor; `adminer` de aynı şekilde.
Portu host'a açmanın tek faydası "senin makinenden `psql` veya bir GUI ile
doğrudan bağlanabilmen" — bu geliştirme sırasında rahatlık sağlar ama
production'da veritabanını internete/host ağına gereksiz yere maruz bırakır.

**Mentör Notu:**
"Çalışması için mi açık, yoksa alışkanlıktan mı açık?" sorusunu her
`ports:` satırında sor. Bir servisin dışarıdan (host'tan/internetten)
erişilmesi GEREKMİYORSA, port mapping'i olmamalı — bu "en az yetki
(least privilege)" prensibinin network versiyonu. `adminer` hâlâ
`8080:8080` ile açık kalabilir çünkü onun amacı zaten senin tarayıcından
erişilebilir bir DB yönetim arayüzü sağlamak.

**⚠️ Dikkat — senin aksiyonun gerekiyor:** Bu değişiklikten sonra
`docker compose up` ile TÜM stack'i (app+db+adminer) birlikte
çalıştıracaksan, kendi `.env` dosyandaki `DATABASE_URL`'in host kısmını
`localhost` yerine `db` yapman gerekir (örn.
`postgresql://postgres:<sifre>@db:5432/http_lab_db`), yoksa `app`
container'ı veritabanına bağlanamaz. Eğer hâlâ `npm run dev` ile
uygulamayı doğrudan kendi makinende çalıştırıp sadece Postgres'i
container'da tutuyorsan, o zaman `.env`'de `localhost` kalmalı AMA bu
durumda geçici olarak `db` servisine port mapping eklemen gerekir (yalnızca
local geliştirme için, commit etmeden). `.env` gitignore'lı ve kişisel
olduğu için bu dosyaya dokunmadım.

### 3. `.env` dosyasının commit durumu

**Yapılan Değişiklik:** Kod değişikliği yok — doğrulama yapıldı.

**Mimari Karar:** `git ls-files | grep env` çalıştırıldı; sonuç sadece
`.env.example` ve `.env.test.example` döndü. `.gitignore` içinde `.env` ve
`.env.test` zaten listeli. Yani gerçek sırlar hiçbir zaman repoya
commit edilmemiş — TODO'daki uyarı muhtemelen "zip içinde geldi" durumuna
(dosya sisteminde var olma) işaret ediyordu, git geçmişine değil.

**Mentör Notu:** `.gitignore`'a bir dosyayı eklemek, o dosya DAHA ÖNCE
commit edilmişse hiçbir şey yapmaz — git o dosyayı zaten takip ediyordur.
Şüphen varsa her zaman `git ls-files | grep <pattern>` ile "gerçekten takip
ediliyor mu?" diye doğrula, sadece `.gitignore` içeriğine bakma.

### 4. `items.integration.test.js` test izolasyonu

**Yapılan Değişiklik:** Kod değişikliği yok — doğrulama yapıldı.

**Mimari Karar:** Dosyada `beforeEach(async () => { await resetDb(); ... })`
zaten mevcut — her `it(...)` bloğundan önce tablolar temizleniyor, bu yüzden
testler birbirinin verisine bağımlı değil. `afterAll` içinde de son bir
`resetDb()` + `prisma.$disconnect()` var (temiz kapanış).

**Mentör Notu:** Test izolasyonunu doğrularken `beforeEach` (her testten
önce) ile `beforeAll` (sadece bir kere, suite başında) farkına dikkat et.
`beforeAll` kullanılsaydı, bir testte oluşturulan veri bir sonraki testte
hâlâ dursaydı ve testler sırayla çalıştırıldığında (`--runInBand`) tesadüfen
geçebilir ama paralel çalıştırıldığında veya sıra değiştiğinde kırılırdı.
`beforeEach` + gerçek DB temizliği, bu projenin "flaky/sıraya bağımlı test"
riskine karşı doğru savunması.

---

## Adım 2 — Port kaldırıldıktan sonra ortaya çıkan çelişki: hangi host adı?

**Tarih:** 2026-07-15

**Sorun:** Adım 1'de `db` servisinin host port'unu kaldırınca, `.env`'deki
`DATABASE_URL`'in `localhost` değeri artık `app` container'ı içinden çalışmaz
hale geldi (bir container'ın içinde `localhost` kendi kendisidir, `db`
container'ını işaret etmez). İki seçenek vardı:
1. Portu geri aç, `.env`'de `localhost` kalsın (native `npm run dev` +
   dockerized Postgres kolay çalışsın).
2. Portu kapalı tut, `.env`'de host'u `db` yap; `docker compose up` ile TÜM
   stack'i (app dahil) container'da çalıştırmayı asıl yöntem yap.

**Yapılan Değişiklik:**
2. seçenek uygulandı. `.env`'deki `DATABASE_URL` host'u `db` yapıldı;
`.env.example` ve `README.md`'deki "Kurulum" bölümü, `docker compose up
--build`'i "Yöntem A / önerilen" olarak, `npm run dev` + geçici port açmayı
"Yöntem B / hızlı iterasyon" olarak yeniden yazıldı.

**Mimari Karar:**
Bu proje zaten Week 6'da Docker'ı bitirdi ve Week 7'de CI/CD + cloud deploy'a
(Railway/Render, yine Docker image'ından) giriyor — yani uygulamanın
production'daki gerçek çalışma şekli "bir container içinde, DATABASE_URL'i
managed bir Postgres'e işaret eden" bir şekil. Yerelde de aynı şekilde
`docker compose up` ile çalıştırmak, "yerelde çalışıyor ama container'da
çalışmıyor" tipi sürprizleri (env değişkeni yanlış, network yanlış vs.)
üretime çıkmadan yerelde yakalamanı sağlar. Bu, DevOps'ta "dev/prod parity"
(geliştirme ile production'ın birbirine benzemesi) prensibinin küçük ölçekli
bir uygulamasıdır. Güvenlik düzeltmesini (kapalı DB portu) de bu kararla
koruyoruz — sadece `npm run dev` tercih edilirse, geçici ve commit
edilmeyen bir port mapping'i gerekiyor.

**Mentör Notu:**
Bir altyapı kararı verirken sadece "şu an hangisi daha az iş" diye değil,
"bu proje 2 hafta sonra nereye gidiyor" diye sor. Burada Week 7 (CI/CD,
cloud deploy) ve Week 6 (Docker) zaten tamamlanmışken, "container-first"
yaklaşımı gelecekteki işini azaltıyor: production'a deploy ederken zaten
alışmış olacaksın, sürpriz env/network hatalarıyla ilk defa production'da
karşılaşmayacaksın. `docker compose up --build`'in kod değişikliğinde
rebuild gerektirmesi gerçek bir DX (developer experience) maliyeti, ama
`Dockerfile`'daki layer sıralaması (`COPY package*.json` → `npm ci` →
`COPY . .`) sayesinde `npm ci` her seferinde tekrar çalışmıyor, sadece
kaynak kod kopyalanıyor — bu yüzden rebuild pahalı değil.

---

## Adım 3 — Week 7: Health Check, ESLint, CI Pipeline

**Tarih:** 2026-07-15

### 1. `GET /health` endpoint'ini güçlendirme

**Yapılan Değişiklik:**
`src/app.js`'teki `/health` route'u artık sadece "process ayakta mı" değil,
"process DB'ye erişebiliyor mu" sorusunu da yanıtlıyor. `getPrismaClient()`
ile `prisma.$queryRaw\`SELECT 1\`` çalıştırılıyor; başarılıysa `200` + `db:
"connected"`, hata fırlatırsa `503` + `db: "disconnected"` dönüyor. Response'a
`version` (package.json'dan) alanı eklendi. İki test eklendi:
- `tests/integration/health.integration.test.js` — gerçek DB'ye karşı,
  "bağlıyken 200" senaryosu.
- `tests/unit/health.test.js` — `jest.mock('../../src/db/prisma')` ile
  `$queryRaw`'ı hataya zorlayarak "DB çökükken 503" senaryosu.

**Mimari Karar:**
"DB kopukken 503" senaryosunu gerçek bir integration testte nasıl test
edeceğimi düşünürken ilk denemem `prisma.$disconnect()` çağırıp hemen
ardından `/health`'e istek atmaktı — ama bu BAŞARISIZ oldu, çünkü Prisma
`$disconnect()`'ten sonraki bir sorguda **otomatik olarak yeniden bağlanıyor**
(lazy reconnect). Yani "gerçek DB'yi gerçekten kapatmadan kopukluğu simüle
etmek" mümkün değildi elimdeki araçlarla. Çözüm: bu senaryoyu bir **unit
test**'e taşıyıp `src/db/prisma.js` modülünü `jest.mock` ile sahte bir
client'a değiştirdim — tam olarak `src/db/prisma.js` içindeki DIP yorumunun
öngördüğü kullanım şekli ("testlerde jest.mock('../db/prisma') ile sahte
client enjekte edilebilir").

**Mentör Notu:**
Bir senaryoyu test ederken "gerçek DB'ye karşı mı, yoksa mock'lanmış bir
bağımlılığa karşı mı test etmeliyim?" sorusunun cevabı bazen denedikten
sonra ortaya çıkar. "Happy path" (DB bağlı) gerçek DB ile test edilmeye
değer çünkü gerçek bir Postgres bağlantısının çalıştığını doğrular; ama
"DB çökük" gibi *arızi* durumları gerçek altyapıda güvenilir şekilde
tetiklemek çoğu zaman ya imkansız ya da kırılgandır (flaky testin tam
tanımı) — bu durumlarda bağımlılığı mock'lamak daha doğru araçtır. İki
yaklaşımı da AYNI davranış (aynı route) için, farklı test dosyalarında,
farklı katmanlarda (integration/unit) kullanmak "test piramidi" dediğimiz
şeyin ta kendisi.

### 2. ESLint kurulumu

**Yapılan Değişiklik:**
`eslint` ve `@eslint/js` devDependency olarak eklendi. `eslint.config.js`
(ESLint 9+ "flat config" formatı) oluşturuldu: `js.configs.recommended` baz
alınıyor, Node/CommonJS globals (`require`, `module`, `process`, `console`
vb.) ve test dosyaları için Jest globals (`describe`, `it`, `expect` vb.)
tanımlandı. `package.json`'a `"lint": "eslint ."` script'i eklendi.

**Mimari Karar:**
`no-unused-vars` kuralını `{ args: 'none', caughtErrors: 'none' }` ile
gevşettim. Nedeni: projede `catch (err) { return res.status(500).json(...) }`
deseni bilinçli bir tercih — hatayı loglamadan/kullanmadan genel bir yanıt
dönmek — ve bunu "hata" (lint error) olarak işaretlemek, var olan ve
kasıtlı bir kod stiline karşı gürültü üretirdi. `npm run lint` çalıştırınca
projede sadece bu ikisi (app.js:56, authMiddleware.js:20) uyarı olarak
çıktı; kuralı koddan önce değiştirmek, koddan önce lint konfigürasyonunun
mevcut, kasıtlı kod stiliyle uyumlu olmasını sağlamanın doğru sırasıydı.

**Mentör Notu:**
Bir lint aracını mevcut bir projeye sonradan eklerken iki yol var: (1) tüm
kuralları varsayılanda bırakıp koda göre lint'i "kazan" ya da (2) mevcut,
bilinçli kod stilini gözden geçirip lint kuralını ona göre ayarla. Kör kör
"recommended" kuralları uygulayıp var olan, çalışan, test edilmiş kodu
lint'i geçsin diye değiştirmek (özellikle catch bloklarında) çoğu zaman
yanlış yöndür — lint kuralları kod kalitesine HİZMET eder, kendi başına
amaç değildir.

### 3. `.github/workflows/ci.yml` — CI Pipeline

**Yapılan Değişiklik:**
Üç paralel job içeren bir GitHub Actions workflow'u eklendi:
- `lint`: `npm ci` + `npm run lint`
- `test`: bir `postgres:15-alpine` **service container**'ı ayağa kaldırıyor
  (job'un adımlarıyla paralel başlar, `localhost:5432`'de erişilebilir olur),
  sonra `.env.test` dosyasını `${{ secrets.TEST_DATABASE_URL }}` kullanarak
  CI'da dinamik olarak oluşturuyor, sonra `npm test` çalıştırıyor.
- `build`: `docker build -t http-lab:ci .` — sadece image'ın sorunsuz build
  olduğunu doğruluyor, hiçbir yere push etmiyor.

Tetikleyici: `push` (main) ve `pull_request` (main hedefli). Job'lar
arasında `needs:` YOK, yani üçü de paralel/bağımsız çalışıyor.

**Mimari Karar:**
En can alıcı problem şuydu: `tests/jest.setup.js`, gerçek bir `.env.test`
**dosyasının var olmasını** şart koşuyor (sadece `process.env.DATABASE_URL`
set etmek yetmiyor, `fs.existsSync` ile dosyayı arıyor). Bu dosya
`.gitignore`'da olduğu için CI runner'ında hiç yok. Çözüm: `npm test`'ten
ÖNCE bir workflow adımıyla `.env.test`'i CI içinde, secrets'tan gelen
değerlerle programatik olarak oluşturmak — yani yereldeki "`.env.test.example`'ı
kopyala, değerleri doldur" adımını CI'da otomatikleştirmek. Bu sayede
`npm test`'in kendisi (dolayısıyla `pretest` → `db:migrate:test` →
`dotenv-cli` zinciri) YEREL ile CI'da BİREBİR AYNI şekilde çalışıyor — CI'a
özel bir "test modu" veya farklı bir komut eklemedim.

`DATABASE_URL`'i workflow dosyasına doğrudan yazmak yerine bir repository
secret'ından (`TEST_DATABASE_URL`) almamın nedeni TODO'nun bunu açıkça
istemesi; teknik olarak burada gerçek bir "sır" yok (CI'daki Postgres
şifresi zaten aynı dosyada `POSTGRES_PASSWORD: postgres` olarak açık
yazıyor, ephemeral/tek seferlik bir container) — ama secrets mekanizmasını
öğrenmek, ileride gerçek sırların (üretim DB şifresi, API anahtarları) asla
workflow dosyasına gömülmemesi gerektiğini alışkanlık haline getirmek için
değerli.

**Mentör Notu:**
"Service container" ile "başka bir job" karıştırılmamalı: bir service
container SADECE onu tanımlayan job'un ömrü boyunca yaşar, o job'un diğer
adımlarına `localhost` üzerinden görünür ve job bitince otomatik yok olur.
Bu, `docker-compose.yml`'deki `db` servisinden farklı bir mekanizma ama
AMAÇ olarak aynı şey: "testler gerçek bir DB istiyor, o DB'yi testten önce
otomatik ayağa kaldır" sorununu iki farklı ortamda (yerel/CI) iki farklı
araçla (`docker compose`/`services:`) çözüyoruz.

**⚠️ Senin yapman gereken adımlar (dosya düzenlemesiyle yapılamaz):**
1. GitHub repo → Settings → Secrets and variables → Actions → "New
   repository secret" → adı `TEST_DATABASE_URL`, değeri
   `postgresql://postgres:postgres@localhost:5432/http_lab_test`.
2. GitHub repo → Settings → Branches → Add branch protection rule →
   `main` → "Require status checks to pass before merging" seçip
   `lint`, `test`, `build` job'larını zorunlu kıl, "Require a pull request
   before merging" işaretle. Bu bir repo ayarı, benim yapabileceğim bir
   dosya değişikliği değil.

Bu iki adım tamamlanmadan `ci.yml` GitHub'a push'lanıp bir PR açılana kadar
gerçekten çalışıp çalışmadığını göremeyiz — bir sonraki adım bunu push edip
gözlemlemek olabilir.

### 4. Doğrulama — ilk gerçek CI çalıştırması

**Yapılan Değişiklik:** Kod değişikliği yok — `main`'e commit push edilip
GitHub Actions API'sinden sonuç gözlemlendi.

**Sonuç:** Üç job da (`lint`, `test`, `build`) **ilk denemede** başarılı oldu
(bkz. [run #1](https://github.com/Ahmtkrmn/http-lab/actions/runs/29411237150)).
`test` job'unun geçmesi, `TEST_DATABASE_URL` secret'ının repo'da zaten doğru
tanımlı olduğunu kanıtladı (secret eksik/boş olsaydı `.env.test`'e boş bir
`DATABASE_URL` yazılır, `pretest` adımındaki `prisma migrate deploy` bağlantı
hatasıyla çökerdi — yani bu adım "sessizce doğru" değil, "test edilerek
doğrulanmış" bir sonuç).

**Beklenmedik bulgu:** `git push` sırasında GitHub şu uyarıyı verdi:
`Bypassed rule violations for refs/heads/main: Changes must be made through
a pull request.` Yani `main` için PR-zorunluluğu içeren bir branch protection
kuralı ZATEN varmış, ama repo admini (bu hesap) bu kuralı bypass edebiliyor
ve kural "status checks zorunlu olsun" ayarını içermiyor gibi görünüyor
(aksi halde CI tamamlanmadan push reddedilirdi).

**Mentör Notu:** Bir güvenlik/süreç kontrolünün "var olması" ile "gerçekten
uygulanması" aynı şey değildir. Branch protection kuralı GitHub'da
tanımlıyken bile, repo sahibinin varsayılan olarak onu bypass edebilmesi
(admin bypass) kuralı fiilen gönüllü hale getirir. Gerçekten "main'e
doğrudan push imkansız" istiyorsan, kuralda ayrıca "Do not allow bypassing
the above settings" seçeneğini de işaretlemen gerekir — bu, GitHub'ın kendi
UI'ında kolayca gözden kaçan, ama davranışı tamamen değiştiren bir detaydır.

---

## Adım 4 — CD Pipeline (Render) test edildi ve sertleştirildi

**Tarih:** 2026-07-15

**Yapılan Değişiklik:** Sen `.github/workflows/deploy.yml`'i hazırladın
(Render Deploy Hook'u tetikleyip 60 saniye bekleyen, sonra `/health`'i
15 saniye aralıklarla 12 kez yoklayan bir job), `feature/cd-pipeline`
branch'inden bir PR açıp `main`'e merge ettin. Ben bunu bağımsız olarak
doğruladım:
- GitHub Actions API'sinden hem `CI` hem `CD Pipeline - Deploy to Render`
  workflow'larının merge sonrası otomatik tetiklendiğini ve ikisinin de
  `success` ile tamamlandığını gördüm.
- Canlı URL'e (`https://http-lab.onrender.com`) kendim `curl` attım:
  `/health` → `200` + `db: "connected"`, `/api/items` (token'sız) → `401`
  (auth middleware production'da da doğru çalışıyor), `/` → `404` (beklenen).

Sonrasında `deploy.yml`'de iki dayanıklılık (resilience) düzeltmesi yaptım:
1. `curl -X POST` → `curl -sf -X POST`: `-f` olmadan, Render deploy hook'u
   4xx/5xx dönse bile (örn. hook URL'i geçersizleşmiş, Render tarafı
   düşükse) `curl`'ün kendisi exit code 0 ile döner — adım "başarılı"
   görünür ama deploy aslında hiç tetiklenmemiştir. `-f` bu durumu gerçek
   bir job hatasına çevirir.
2. Hardcoded `RENDER_URL="https://http-lab.onrender.com/health"` →
   `${{ vars.RENDER_SERVICE_URL || 'https://http-lab.onrender.com' }}`:
   URL artık bir repository variable'dan (Settings → Secrets and variables
   → Actions → Variables) okunuyor, tanımlı değilse aynı adrese düşüyor.
   Servis adı/URL'i değiştirirse workflow dosyasına dokunmadan
   güncelleyebilecek.
   İkisini de `env:` bloğuna taşıdım (`run:` gövdesinde `${{ }}` doğrudan
   metne gömülü değil) — bu, secrets/vars'ı shell komutunun İÇİNE
   literal olarak enjekte etmemenin standart pratiği.

**Mimari Karar:** "Çalışıyor" ile "doğru" aynı şey değil. Workflow zaten
`success` dönmüştü ama bu, `curl`'ün her zaman doğru şekilde başarısız
olacağını GARANTİ ETMİYORDU — sadece BU SEFER hook URL'i doğru olduğu için
gerçekten tetiklendi. Bir CI/CD pipeline'ını "bir kere yeşil geçti" diye
güvenilir saymak yanlış bir güven duygusudur; asıl soru "yanlış giden bir
şey olduğunda pipeline bunu YAKALAR mı?" sorusudur. `curl -f` eklemeden
önce, hook URL'i kazayla silinmiş/yanlış yazılmış olsaydı bu workflow YİNE
"başarılı" görünüp deploy'un hiç olmadığını gizlerdi.

**Mentör Notu:** Bir shell script'te dış bir komutun (`curl`, `git`, `npm`)
"başarısız" sayılıp sayılmayacağı, komutun KENDİ exit code'una bağlıdır —
`curl` varsayılan olarak HTTP durum kodundan (404, 500 vb.) BAĞIMSIZ olarak
0 döner, çünkü "isteği gönderebildim" ile "sunucu iyi bir yanıt verdi" onun
için farklı şeylerdir. CI/CD script'lerinde bu ayrımı hep sorgula: "bu satır
gerçekten başarısız olursa job kırmızı olur mu, yoksa sessizce mi geçer?"
`set -e` (bash'in "herhangi bir komut başarısız olursa dur" modu) GitHub
Actions'ın `run:` bloklarında varsayılan olarak zaten açıktır, ama `curl`
gibi araçların "başarı" tanımını senin niyetinle eşleştirmek (`-f` bayrağı
gibi) ayrı bir sorumluluktur — `set -e` bunu senin yerine yapmaz.

---

## Adım 5 — Week 8: Monitoring, Logging & Observability

**Tarih:** 2026-07-16

Bu hafta "çalışıyor gibi görünüyor" ile "ölçebiliyorum" arasındaki farkı kuran
katmanı ekledik: structured logging (pino), request correlation (requestId) ve
Prometheus metrikleri (prom-client). Grafana Cloud ve UptimeRobot kurulumu bir
panel/hesap işi olduğu için senin aksiyonuna bırakıldı (README'de adım-adım
rehber var); uygulama tarafı (JSON log, `/metrics`, `/health` 200/503) hazır.

### 1. `console.log` → structured logging (pino)

**Yapılan Değişiklik:**
`src/utils/logger.js` oluşturuldu (tek paylaşılan pino örneği). `server.js`,
`middleware/requestLogger.js` ve `middleware/errorHandler.js` içindeki tüm
`console.log`/`console.error` çağrıları bununla değiştirildi. Format:
`NODE_ENV=production`'da tek satırlık JSON (ISO-8601 zaman damgalı),
development'ta `pino-pretty` ile renkli/insan-okur çıktı, test'te `silent`.

**Mimari Karar:**
Neden `console.log` yeterli değil? `console.log` düz metin (string) üretir; bir
string'i bir izleme aracının (Grafana Loki, Datadog) alanlara ayırıp
"status_code=500 olanları getir" diye sorgulaması çok zordur. pino ise her satırı
tek satırlık bir JSON nesnesi olarak yazar (structured logging) — makine bunu
doğrudan filtreleyip aggregate edebilir. Production'da transport (pino-pretty)
KULLANMIYORUZ: pretty format JSON'u bozar ve bir worker thread açar; container
ortamında doğru davranış, uygulamanın sadece stdout'a saf JSON yazması, toplama
işini platforma bırakmasıdır (12-factor "logs as event streams").

**Mentör Notu:**
Log seviyesini bir "olayın önemi"ne göre seç, gürültüye göre değil. Bu projede
kuralı status koduna bağladık: 5xx→error, 4xx→warn, gerisi→info. Böylece
production'da `level>=warn` filtreleyerek "sorunlu" istekleri saniyeler içinde
ayıklarsın. Ayrıca hata loglarken hata NESNESİNİ (`{ err }`) ver, `err.message`
string'ini değil — pino'nun serializer'ı stack trace'i JSON'a yazar; ama o
stack'i İSTEMCİYE gönderme (iç dosya yollarını sızdırmak güvenlik zaafıdır).

### 2. requestId (correlation ID) — `X-Request-ID`

**Yapılan Değişiklik:**
`requestLogger` artık her isteğe `crypto.randomUUID()` ile bir `requestId`
üretiyor (gelen `X-Request-ID` header'ı varsa onu koruyor), bunu yanıt header'ına
koyuyor ve `req.log = logger.child({ requestId })` ile isteğe özel bir child
logger yaratıyor. Bu isteğin ürettiği her log satırı (errorHandler dahil) aynı
ID'yi taşıyor.

**Mimari Karar:**
UUID için ayrı bir paket (`uuid`) kurmadım — Node'un yerleşik
`crypto.randomUUID()`'si yeterli (bağımlılık minimalizmi). Gelen header'ı
KORUMAK bilinçli: ileride önünde bir proxy/gateway veya çağıran başka bir servis
kendi ID'sini üretmişse, onu sürdürmek isteğin servis sınırlarını AŞAN takibini
(distributed tracing'in ilk adımı) mümkün kılar. Child logger deseni sayesinde
`requestId`'yi her log çağrısına elle eklemeyi unutma riski ortadan kalkar.

**Mentör Notu:**
Correlation ID, "gece 3'teki arıza"nın en pratik aracıdır: bir kullanıcı hata
alıp sana `X-Request-ID`'sini iletince, log'larda `requestId="..."` ile o tek
isteğin bütün hikâyesini (giriş→DB→hata) izole edersin. Bunu daha ilk günden
koymak, sonradan "hangi log hangi isteğe ait?" kâbusundan kurtarır.

### 3. Prometheus metrikleri + cardinality tuzağı

**Yapılan Değişiklik:**
`src/metrics/metrics.js`: kendi `Registry`'si, `metricsMiddleware` (tüm
route'lardan önce), ve üç custom metrik — `http_requests_total` (Counter),
`http_request_duration_seconds` (Histogram), `active_db_connections` (Gauge).
Gauge, pg Pool'un anlık durumunu okumak için `src/db/prisma.js`'e eklenen
`getPool()` üzerinden `collect()` (pull) ile besleniyor.

**Mimari Karar:**
En kritik karar `route` label'ında GERÇEK path'i (`/api/items/123`) değil, route
KALIBINI (`/api/items/:id`) kullanmaktı. Aksi halde her farklı id yeni bir zaman
serisi (time series) yaratır; bir bot rastgele URL tararsa seri sayısı sınırsız
büyür ve Prometheus'un belleği şişip çöker — buna "yüksek cardinality" denir ve
izleme sistemlerinin en yaygın çöküş sebebidir. `req.route` yönlendirme
tamamlandıktan sonra kalıbı taşır; eşleşmeyen (404) path'leri tek bir `unmatched`
serisinde topladım. Ayrıca RPS/error-rate gibi türev değerleri metriğin İÇİNE
gömmedim: bir Counter (sadece artan) tutup, "saniyedeki istek" veya "5xx oranı"nı
Prometheus tarafında `rate()`/bölme ile SORGU üretiyor — ham veri saklanır,
yorum sorguya bırakılır.

**Mentör Notu:**
Metrik tasarımında label seçerken hep sor: "bu label'ın kaç FARKLI değeri
olabilir?" Sınırlı ve öngörülebilir olmalı (method: ~7, status_code: ~40, route:
route sayısı kadar). Sınırsız olabilecek şeyleri (id, email, tam URL, timestamp)
ASLA label yapma. Counter vs Gauge ayrımı da öz: Counter yalnızca artar
(toplam istek), Gauge anlık artıp azalır (açık bağlantı). Yanlışını seçersen
`rate()` gibi fonksiyonlar anlamsız sonuç verir.

### 4. `/metrics` erişim koruması + PaaS'te IP filtresinin yanılgısı

**Yapılan Değişiklik:**
`src/middleware/metricsAccessGuard.js`: iki modlu koruma. `METRICS_TOKEN`
tanımlıysa bearer token ZORUNLU; yoksa IP allowlist (loopback + özel ağlar +
`METRICS_ALLOWED_IPS`). Guard'ın karar mantığı için 9 unit test yazıldı;
`/metrics`'in prom formatı ve token davranışı için integration testler eklendi
(toplam 43→59 test, coverage %94→%95.96).

**Mimari Karar:**
TODO "IP whitelist veya ayrı port" diyordu; ben iki katmanlı (defense in depth)
gittim ve token'ı önerilen yol yaptım. Nedeni önemli bir gerçek: Render gibi bir
PaaS'te uygulama, reverse-proxy ARKASINDA çalışır ve `trust proxy` ayarlanmadıkça
daima proxy'nin (özel) IP'sini görür — yani saf IP allowlist orada aldatıcı
biçimde "hep izin ver"e döner ve `/metrics` fiilen halka açık kalır. Token bu
tuzağa düşmez. IP filtresini yine de bıraktım çünkü yerel/özel-ağ senaryolarında
(ör. aynı Docker ağındaki bir scraper) pratiktir.

**Mentör Notu:**
"Güvenlik kontrolü var" ile "güvenlik kontrolü çalışıyor" farkı (Week 7'deki
branch-protection dersinin bir kuzeni): bir IP allowlist yazmak kolaydır, ama
onu doğru çalıştıran şey `req.ip`'in gerçekten istemciyi göstermesidir — bu da
altyapıya (proxy/trust proxy) bağlıdır. Bir güvenlik mekanizmasını eklerken hep
"bu, benim gerçek çalışma ortamımda hangi girdiyi görüyor?" diye sor; laboratuvar
(localhost) ile production (proxy arkası) farklı davranabilir.

### 5. Test edilebilirlik: prisma mock'u bozmadan getPool eklemek

**Yapılan Değişiklik:**
`active_db_connections` gauge'u pg Pool'a erişmek zorundaydı ama Pool, adapter
deseni yüzünden `prisma.js` içinde gizliydi. `getPool()` export'u ekledim ve
gauge'un `collect()`'i prisma modülünü DOSYA TEPESİNDE değil, çağrı anında
`require('../db/prisma').getPool?.()` ile okuyor.

**Mimari Karar:**
`collect()` içinde late-require + optional-chaining (`?.`) bilinçli: mevcut
`tests/unit/health.test.js`, `jest.mock('../../src/db/prisma')` ile prisma'yı
sahteliyor ve o mock'ta `getPool` yok. Tepede require etsem ve gauge o testte
tetiklense TypeError alırdım. Gauge yalnızca `/metrics` yoklandığında çalıştığı
ve o test `/metrics`'e gitmediği için pratikte sorun çıkmazdı — ama savunmacı
yazmak (kod bir gün başka bir yerden çağrılırsa) doğru refleks.

**Mentör Notu:**
Yeni bir özellik (metrics), var olan bir test kurgusunu (prisma singleton mock'u)
sessizce bozabilir. Bir modüle export eklerken "bu modülü kim mock'luyor ve
mock'unda bu yeni şey var mı?" diye sor. Late-require + `?.` gibi küçük savunmalar,
DIP/singleton seam'ini koruyarak yeni bağımlılıkları güvenle eklemenin yoludur.

### 6. Grafana Cloud'a uçtan uca bağlantı: Alloy, remote_write ve iki farklı API key yetkisi

**Yapılan Değişiklik:**
`/metrics`'i dışarıya (Grafana Cloud'a) taşımak için `monitoring/` klasöründeki
hazır `config.alloy` + `docker-compose.monitoring.yml` kullanıldı. Render'da
`METRICS_TOKEN` zaten ayarlıydı (token'sız `403`, token'lı `200` doğrulandı);
`monitoring/.env.monitoring` (gitignore'lı) Grafana Cloud'un verdiği 3 değerle
(remote_write URL, instance ID, `metrics:write` API key) dolduruldu. Alloy'u
Docker'da ayağa kaldırıp (`docker compose -f docker-compose.monitoring.yml up
-d`) hem kendi component health API'sinden (`/api/v0/web/components`, ikisi de
`healthy`) hem de Grafana Cloud **Explore**'dan (`http_requests_total` sorgusu
veri döndü) uçtan uca doğrulandı. `generate-traffic.sh` ile canlıya karışık
trafik (200/401/404 + ara sıra register/login) üretilip 4 panelli hazır
dashboard (`grafana-dashboard.json`) import edildi; ekran görüntüsü
`docs/grafana_dashboard.png` olarak ana `README.md`'ye bağlandı.

**Mimari Karar:**
Grafana Cloud internetteki rastgele bir `/metrics` endpoint'ini kendisi
yoklamaz (pull yönü ters çevrilemez) — bu yüzden mimaride bir "collector" (Alloy)
zorunlu: o `/metrics`'i **çeker** (pull), Grafana Cloud'a **push** eder
(`remote_write`). Alloy'u prod'a (Render'a) değil, kendi makinene (Docker'da)
kurmak bilinçli bir tercih: hem ücretsiz hem de öğrenme amaçlı setup için Render'ı
ekstra bir process ile kirletmiyor — Alloy sadece dışarıdan `https://http-lab
.onrender.com/metrics`'i HTTPS üzerinden çekiyor, konumu önemsiz.

**Mentör Notu:**
Grafana Cloud'da API key üretirken doğrulama amacıyla o key'le `/api/prom/api/
v1/query` sorgusu atmayı denedim ve `"authentication error: invalid scope
requested"` aldım — bu bir HATA değil, DOĞRU davranış: `metrics:write` yetkili
bir token'ın sorgu (`read`) yapamaması "en az yetki" (least privilege) ilkesinin
kanıtı. Bir entegrasyonu doğrularken "beklenmedik bir hata aldım" ile "sistem
tam da izin vermemesi gerektiği gibi izin vermedi" arasındaki farkı ayırt etmek
önemli — panik yapıp token'ı yeniden üretmek yerine, hatanın kaynağını (scope)
okumak yeterliydi. Bu yüzden uçtan uca doğrulamayı asıl amacına uygun kanaldan
(Grafana Explore, kendi oturumunla) yapmak gerekti.

### 7. UptimeRobot ile dış-dünya alarmı

**Yapılan Değişiklik:**
UptimeRobot'ta ücretsiz bir hesapla `https://http-lab.onrender.com/health`
için 5 dakikalık aralıkla bir HTTP(s) monitör kuruldu, e-posta alert contact
eklendi. `/health`'in `curl` ile `200` + `db:"connected"` döndüğü ayrıca
doğrulandı.

**Mimari Karar:**
Grafana dashboard'ı "bakarsan görürsün" (pull, insan tetikli); UptimeRobot ise
"bakmasan da sana söyler" (push, alarm tetikli) — ikisi birbirinin yerine
geçmiyor, tamamlayıcı. `/health`'in zaten `SELECT 1` ile DB'yi de kontrol
etmesi sayesinde (bkz. Adım 3 öncesi health check sertleştirmesi) UptimeRobot
sadece process canlılığını değil, DB bağlantısını da fiilen izliyor — ayrı bir
DB-health monitörü kurmaya gerek kalmadı.

**Mentör Notu:**
Bir "izlenebilirlik" hikâyesinin iki ayrı bacağı var: **gözlem** (dashboard —
"şu an sistem nasıl?") ve **alarm** (UptimeRobot — "sistem kötüyken bana
söyle"). Sadece dashboard kurup "monitoring bitti" demek yaygın bir eksik
kalma biçimidir; kimse dashboard'a 7/24 bakmaz. Bu haftanın gerçek dersi:
ölçüm (metrics) + gözlem (dashboard) + alarm (UptimeRobot) üçü birlikte
"gece 3'te arıza olursa haberim olur" garantisini verir, tek başına hiçbiri
vermez.

---

## Adım 6 — Week 9: Frontend Basics & Full-Stack Entegrasyonu

**Tarih:** 2026-07-17

Bu hafta API'yi ilk kez bir TARAYICI tüketti ve bu, backend'de görünmeyen üç
sorunu su yüzüne çıkardı: CORS, token'ın nerede saklanacağı ve 401/403
ayrımının aslında ne anlama geldiği. `client/` altında Vite + React + Tailwind
v4 uygulaması kuruldu (login, korumalı route, items tablosu, rol bazlı form);
backend'de refresh token httpOnly cookie'ye taşındı, `/refresh` (rotation'lı)
ve `/logout` (sunucu tarafı invalidation) eklendi. Test sayısı 59 → 72.

### 1. Refresh token: response body'den httpOnly cookie'ye

**Yapılan Değişiklik:**
`routes/auth.js`: login artık refresh token'ı JSON body'de DEĞİL,
`httpOnly; Path=/api/auth; SameSite=Lax(dev)/None(prod); Secure(prod)` bir
cookie'de dönüyor; body'de yalnızca `accessToken` + `user` (id, email, name,
role — asla şifre hash'i) var. `app.js`'e `cookie-parser` eklendi. Yeni uçlar:
`POST /refresh` ve `POST /logout`.

**Mimari Karar:**
Saklama stratejisi tehdit modelinden türedi: XSS olan bir sayfada JS,
localStorage'ın ve değişkenlerin TAMAMINI okuyabilir ama httpOnly cookie'yi
OKUYAMAZ. Bu yüzden uzun ömürlü token (7g) cookie'ye, kısa ömürlü token (15dk)
frontend'in belleğine kondu — çalınabilecek en değerli şeyin ömrü 15 dakikaya
indirildi. `Path=/api/auth` ile cookie'nin `/api/items` gibi uçlara HİÇ
gitmemesi sağlandı (gereksiz maruziyet azaltma). `SameSite` seçimi ortama
bağlı: dev'de 5173→3000 "same-site, cross-origin" olduğundan `Lax` yeterli;
prod'da Vercel→Render cross-site olduğundan `None; Secure` şart (tarayıcı
`None`'ı Secure'suz reddeder).

**Mentör Notu:**
"Token'ı nereye koyayım?" sorusunun tek doğru cevabı yok; doğru SORU şu:
"XSS olduğunda saldırgan neyi, ne kadar süreyle ele geçirir?" localStorage =
her şeyi süresiz; memory + httpOnly cookie = en fazla 15 dakikalık bir access
token. Güvenlik kararlarını özellik listesinden değil, tehdit senaryosundan
başlayarak ver.

### 2. Token rotation ve `jti` — saniye hassasiyeti tuzağı

**Yapılan Değişiklik:**
`/refresh` her çağrıda YENİ bir refresh token üretip DB'dekini eziyor
(rotation); eski token'la ikinci bir `/refresh` denemesi 401 alıyor (testle
kanıtlandı). `tokenService.generateRefreshToken`'a `jti: crypto.randomUUID()`
claim'i eklendi.

**Mimari Karar:**
`jti` süs değil, rotation'ın ÖN KOŞULU: JWT'nin `iat`/`exp` claim'leri saniye
hassasiyetindedir; aynı saniyede aynı payload'la üretilen iki token bayt-bayt
AYNI string olur. `jti`'siz "rotation", login'in hemen ardından gelen
refresh'te muhtemelen aynı token'ı üretecek ve hiçbir şey döndürmemiş
olacaktı. Rotation'ın değeri şu: çalınan bir refresh token en fazla BİR kez
işe yarar — ikinci kullanımda (meşru kullanıcı da yenilemiş olacağından) DB
eşleşmesi tutmaz. DB karşılaştırması da JWT imza doğrulamasının yerini tutmaz,
onu TAMAMLAR: imza "bu token'ı ben ürettim" der, DB "bu token hâlâ aktif
oturum" der. Logout'un gerçek işi de burada — cookie silmek istemci tarafı
bir jesttir, oturumu öldüren şey DB'deki `refreshToken`'ın NULL'lanmasıdır.

**Mentör Notu:**
Kriptografik doğrulama (stateless) + sunucu durumu (stateful) birlikteliği
bilinçli bir takas: access token'ı 15 dk boyunca DB'siz doğruluyoruz (hız),
refresh'i her seferinde DB'ye soruyoruz (kontrol). "JWT stateless'tır, logout
yapılamaz" cümlesini duyarsan bil ki eksik: access token için doğru, oturumun
kendisi için değil.

### 3. 401 vs 403 — süresi dolmuş token bir "yetki" sorunu değildir

**Yapılan Değişiklik:**
`authMiddleware`: geçersiz/süresi dolmuş access token artık **403 değil 401**
dönüyor. İlgili unit + integration testler güncellendi. (403, `requireRole` ve
sahiplik kontrollerinde yaşamaya devam ediyor — orası gerçekten "yetki".)

**Mimari Karar:**
Eski davranış frontend yazılırken FİİLEN bozuldu: TODO'nun hata sözleşmesi
"401 → login'e yönlendir / sessiz yenile, 403 → 'yetkiniz yok' mesajı" diyor.
Süresi dolan token 403 dönseydi, frontend 15 dakikada bir kullanıcıya
"yetkiniz yok" diyecek ve token yenilemeyi hiç DENEMEYECEKTİ. Anlam ayrımı
net: 401 "kim olduğunu doğrulayamadım, kimliğini yeniden kanıtla" (çözüm:
refresh/login), 403 "kimliğin tamam ama iznin yok" (çözüm: rol — tekrar login
işe yaramaz). (Not: TODO'daki eski bir madde 403 bekliyordu; bu bilinçli bir
sözleşme değişikliğidir ve README'de duyuruldu.)

**Mentör Notu:**
Status kodları makine-okur bir SÖZLEŞMEDİR, log süsü değil. Frontend'in retry
mantığı, monitoring'in error-rate panelleri, hepsi bu ayrıma dayanır. Bir API
tasarlarken her hata kodu için "istemci bunu görünce NE YAPMALI?" sorusuna tek
ve net bir cevap verebiliyor olmalısın; 401'e "yenile", 403'e "vazgeç" gibi.

### 4. CORS: engelleyen sunucu değil, tarayıcıdır

**Yapılan Değişiklik:**
`app.js`'e koşullu CORS eklendi: `FRONTEND_URL` env'i varsa
`cors({ origin: FRONTEND_URL, credentials: true })` takılıyor, yoksa hiçbir
CORS header'ı dönmüyor (TODO'daki "kasıtlı kır → gözle → çöz" alıştırması bir
env toggle'ı oldu). `tests/integration/cors.integration.test.js` preflight
davranışını tarayıcısız doğruluyor.

**Mimari Karar:**
Middleware sırası bilinçli: `requestLogger` → **cors** → `metricsMiddleware`.
Preflight OPTIONS istekleri loglansın ama cors onları erkenden yanıtlayıp
bitirdiği için metriklere `unmatched` gürültüsü olarak yansımasın. `origin`
olarak `*` değil TEK bir origin: kimlikli (credentials) isteklerde tarayıcı
joker origin'i zaten reddeder. Test yazarken bir yanılgım da düzeldi: `cors`
paketi izinsiz origin'e "izin yok" DEMEZ — her yanıtta izinli origin'i söyler;
karşılaştırmayı ve engellemeyi TARAYICI yapar. curl/Postman'in CORS'a
takılmamasının sebebi budur: CORS bir sunucu güvenlik duvarı değil, tarayıcının
"bu yanıtı sayfadaki JS'e verecek miyim?" politikasıdır.

**Mentör Notu:**
CORS hatası gördüğünde refleksin "backend'e izin ekle" olmadan önce "kim, kime,
hangi origin'den istek atıyor?" sorusu olsun. Ve `credentials` çiftini ezberle:
frontend `credentials: 'include'` + backend `credentials: true` — ikisi
birlikte yoksa cookie sessizce yolda kaybolur ve hata mesajı bile göremezsin
(istek "anonim" gider). Sessiz başarısızlıklar, yanlış yapılandırılmış CORS'un
en sinsi yüzüdür.

### 5. Frontend mimarisi: api/ katmanı, in-memory token, silent refresh

**Yapılan Değişiklik:**
`client/src/api/http.js` tüm isteklerin tek kapısı: base URL (`VITE_API_URL`),
Bearer header, `credentials: 'include'`, hata normalizasyonu (`ApiError`:
`status` + `kind: 'network'|'http'`) ve 401 görünce "refresh dene → isteği BİR
kez tekrarla" mantığı. `tokenStore.js` (modül değişkeni) access token'ın tek
evi. `AuthContext` açılışta `restoreSession()` ile cookie'den oturumu sessizce
geri kuruyor; `ProtectedRoute` üç durumla (`loading/authenticated/anonymous`)
çalışıyor. `LoginPage`, `ItemsPage`, rol bazlı `NewItemForm` (kategori
dropdown'ı için backend'e küçük bir `GET /api/categories` eklendi).

**Mimari Karar:**
İki incelik: (1) `status`'un üç durumlu olması şart — sadece `user == null`'a
bakılsaydı, F5 sonrası refresh yanıtı gelene kadarki birkaç yüz milisaniyede
kullanıcı login'e fırlatılırdı; `loading` bu belirsizlik penceresini temsil
eder. (2) Eşzamanlı 401'ler tek refresh'i paylaşır (`refreshPromise` dedup):
rotation yüzünden iki paralel refresh, ikincisini "eski token" diye 401'letirdi
— React StrictMode'un effect'leri iki kez çalıştırması bu bug'ı dev'de anında
yakalatırdı. Ayrıca oturum düşünce yönlendirme kararı http.js'te DEĞİL:
http.js sadece `onSessionExpired` callback'ini çağırır, callback'i
AuthContext kaydeder — alt katman üst katmanı import etmez (DIP'in frontend
karşılığı; backend'deki `getPrismaClient()` seam'inin kuzeni).

**Mentör Notu:**
"Component'ta fetch yok" kuralı estetik değil, mimari: 401-refresh-retry gibi
kesişen dertler (cross-cutting concerns) tek yerde çözülür; component'lar
yalnızca "veri geldi / gelmedi / hata" ile ilgilenir. Backend'de route'lara
`jwt.sign` gömmemekle (Week 4 refactor'ü) aynı ilke — katman sorumluluğunu
koru, aynı derdi iki yerde çözme.

### 6. Vite env'leri build anında gömülür + Nginx SPA fallback

**Yapılan Değişiklik:**
`client/Dockerfile` (multi-stage: node build → nginx:alpine serve) ve
`client/nginx.conf` (SPA fallback: `try_files $uri $uri/ /index.html`) yazıldı;
compose'a `client` servisi eklendi (`5173:80`). Kök `.dockerignore`'a `client`
eklendi (backend imajının build context'ine `client/node_modules` girmesin).
Compose ile tam yığın doğrulandı: `/health` 200, login→refresh→rotation→
logout akışı curl ile uçtan uca, SPA fallback (`/items` → 200) ve CORS'un
"kırık" başlangıç durumu dahil.

**Mimari Karar:**
İki kritik fark backend alışkanlıklarını kırar: (1) `VITE_API_URL` compose'da
`http://app:3000` DEĞİL `http://localhost:3000` — çünkü isteği atan client
container'ı değil, Docker ağının DIŞINDA yaşayan tarayıcıdır; `app` host adı
tarayıcıda çözülmez. (2) Vite env'leri RUNTIME'da okunmaz, build sırasında
bundle'a string olarak GÖMÜLÜR — statik dosyada `process.env` yoktur. Bu
yüzden değer Dockerfile'a build ARG olarak girer ve API adresi değişirse
imaj yeniden build edilir (Vercel'de de env değişince redeploy gerekir).
Nginx'teki `try_files` satırı ise React Router'ın hayat sigortası: `/items`
sunucuda bir dosya değil, JS'te yaşayan bir route'tur; fallback olmasa F5
Nginx 404'üyle biterdi.

**Mentör Notu:**
Full-stack'te "environment variable" kelimesi iki FARKLI şeyi adlandırır:
backend'de çalışma anında okunan gerçek process env'i, frontend'de ise build
anında koda gömülen bir sabit. Bu yüzden frontend env'ine ASLA secret koyma —
`VITE_` önekli her değer, tarayıcıya inen JS'in içinde düz metin olarak
gezer. "Frontend'de gizli bilgi yoktur" cümlesini duvara as.

---

## Adım 7 — Proje anlayışını güçlendiren dokümantasyon: `software.md` genişletmesi + yeni `frontend.md`

**Tarih:** 2026-07-17

**Yapılan Değişiklik:**
`software.md` (o zamana kadar sadece backend'i anlatan bir "sıfırdan anlatım"
belgesiydi) Week 9 frontend'ini kapsayacak şekilde 6 yeni bölümle (14-19)
genişletildi: Vite/React'in nasıl derlenip çalıştığı, frontend'in backend'le
aynı SRP katmanlaşmasını (route↔page, itemsDb↔api/items.js, prisma.js↔http.js)
nasıl taşıdığı, tarayıcıda login'den item listesine kadar TAM istek yolculuğu
(dosya:satır referanslarıyla), CORS + token saklama tehdit modeli, ve
docker-compose'daki dördüncü (client/Nginx) container. 1. bölümdeki artık
yanlış olan "bu proje arayüz içermiyor" cümlesi de güncellendi. Bağımsız yeni
bir dosya olarak `frontend.md` oluşturuldu: React/JSX/component/state/hook/
routing/Tailwind kavramlarını sıfırdan, bu projenin gerçek `client/src/`
dosyaları üzerinden öğreten bir belge — `nodejs.md`'nin frontend karşılığı.

**Mimari Karar:**
İçerik ikiye bölündü, tek bir dev koca dosyaya gömülmedi: `frontend.md`
"React NEDİR" sorusunu (kavramsal, projeden bağımsız öğrenme), `software.md`
"bu React kodu backend'e NASIL bağlanıyor" sorusunu (bu projeye özgü
entegrasyon/güvenlik akışı) cevaplıyor. Bu ayrım, zaten var olan `nodejs.md`
(Node NEDİR) / `software.md` (bu proje NASIL çalışıyor) desenini tekrar
kullanıyor — üçüncü bir dosya eklemek, var olan iki dosyayı da büyütüp
okunamaz hale getirmek yerine aynı deseni bir katman daha genişletti.

**Mentör Notu:**
Dokümantasyonu "nerede yaşaması gerektiği" sorusuyla organize et: "bu bir
KAVRAM mı (proje bağımsız, başka projede de geçerli) yoksa bu projeye ÖZGÜ
bir MİMARİ KARAR mı?" Kavramlar (Node.js nedir, React nedir) ayrı, tekrar
kullanılabilir dosyalarda yaşamalı; o kavramların BU projede nasıl bir araya
geldiği (istek yolculuğu, CORS, auth, Docker) ayrı bir dosyada yaşamalı. Aksi
halde tek dosya hem "kavramsal öğretici" hem "projeye özgü referans" olmaya
çalışır ve ikisini de kötü yapar — okuyan kişi ne aradığını bilse bile doğru
yeri bulamaz.
