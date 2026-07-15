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
