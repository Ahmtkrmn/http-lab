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
