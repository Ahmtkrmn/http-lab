# Frontend Nedir? (http-lab'in `client/` Klasörü Üzerinden, Sıfırdan Anlatım)

> Bu dosya, "frontend" kelimesinin ne anlama geldiğini hiç bilmeyen biri
> için hazırlandı. Amaç: tarayıcıda gördüğün ekranın ARKASINDA hangi
> kavramların olduğunu (DOM, component, state, JSX, routing, build aracı...)
> bu projenin (`http-lab`) GERÇEK `client/` dosyaları üzerinden öğretmek.
>
> Bu dosya `nodejs.md` ve `software.md`'nin TAMAMLAYICISI, tekrarı değil:
> - `nodejs.md` → Node.js'in kendisini (backend runtime) anlatır.
> - `software.md` (bölüm 13-19) → frontend ile backend'in birbirine NASIL
>   bağlandığını (istek yolculuğu, CORS, token, Docker/Nginx) anlatır.
> - **Bu dosya (`frontend.md`)** → frontend'in KENDİSİNİ (React, JSX,
>   component, state, routing, stil) sıfırdan anlatır — yani "tarayıcıda
>   çalışan program" dediğimiz şey aslında nedir, hangi parçalardan oluşur.

---

## 1. "Frontend" tam olarak ne demek?

**Backend** (`src/`), bir isteğe JSON döndüren bir programdır — ekranı,
rengi, butonu yoktur; `curl` veya Postman ile de konuşabilirsin.
**Frontend** (`client/`) ise tam tersi: **tarayıcıda çalışan**, kullanıcının
GÖRDÜĞÜ ve TIKLADIĞI her şeyi (buton, form, tablo, renk) üreten programdır.

En önemli kavrayış: frontend, backend'in bir "uzantısı" değil, **bambaşka
bir ortamda (tarayıcı) çalışan bambaşka bir programdır**. İkisi sadece
ağ üzerinden (`fetch` ile) konuşurlar — tıpkı iki ayrı bilgisayarın
konuşması gibi (bkz. `software.md` bölüm 16). Bu projede:

| | Backend (`src/`) | Frontend (`client/`) |
|---|---|---|
| Nerede çalışır? | Sunucuda (senin bilgisayarında ya da Render'da) | Kullanıcının TARAYICISINDA |
| Girdi | HTTP isteği (`GET /api/items`) | Kullanıcı etkileşimi (tıklama, yazma) |
| Çıktı | JSON (`{ data: [...] }`) | Ekranda görünen HTML/CSS (buton, tablo, form) |
| Dili/aracı | Node.js + Express | React + Vite (ama ikisi de JavaScript) |
| Test aracı | `curl`, Postman, Supertest | Tarayıcının kendisi (DevTools) |

---

## 2. Tarayıcı aslında ne yapıyor? (HTML / CSS / JS'in rolleri)

React'e geçmeden önce, tarayıcının temelde ne inşa ettiğini bilmek gerekir.
Bir web sayfası üç ayrı "malzeme"den oluşur — üçü de birbirinden BAĞIMSIZ
görevler üstlenir:

| Malzeme | Görevi | Günlük hayat benzetmesi |
|---|---|---|
| **HTML** | Sayfanın **yapısı/iskeleti**: "burada bir başlık var, burada bir buton var" | Bir evin duvarları, odaları — neyin nerede olduğu |
| **CSS** | Sayfanın **görünümü**: renkler, boşluklar, yazı tipi | Evin boyası, mobilyaların dizilişi |
| **JavaScript** | Sayfanın **davranışı**: "butona tıklanınca ne olsun?" | Evin elektriği — anahtara basınca ışığın yanması |

Tarayıcı, aldığı HTML'i belleğinde bir **ağaç yapısına** çevirir — buna
**DOM** (Document Object Model) denir. JavaScript'in yaptığı asıl iş,
zaman içinde bu DOM ağacını DEĞİŞTİRMEKTİR: bir `<li>` eklemek, bir
butonun rengini değiştirmek, bir metni güncellemek. Kullanıcının
gördüğü "sayfa güncellendi" hissi, aslında JS'in DOM'u elle düzenlemesidir.

**Sorun**: Bir uygulama büyüdükçe (bu projedeki `ItemsPage` gibi onlarca
satır, düzinelerce durum içeren bir ekran düşün), "hangi DOM elemanını,
ne zaman, nasıl güncelleyeceğim" işini elle yönetmek hem yorucu hem
hataya çok açık hale gelir — bir yeri günceller, başka bir yeri
güncellemeyi unutursun, ekran gerçek veriyle senkron kalmaz. **React'in
var olma sebebi tam olarak bu problemi çözmektir.**

---

## 3. React'in çözümü: "State'i söyle, DOM'u BEN güncellerim"

React'in temel fikri **deklaratif**tir (imperative'in tersi): sen
DOM'a "şunu şöyle değiştir" demezsin; bunun yerine "şu anki veriye göre
ekran BÖYLE görünmeli" dersin, DOM'u gerçekte nasıl güncelleyeceğine
React karar verir.

Somut örnek — `client/src/pages/ItemsPage.jsx:25-27`:

```jsx
const [items, setItems] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
```

Sen asla "tabloya bir satır ekle" demezsin. Sadece `setItems(yeniListe)`
çağırırsın (bölüm 6'da detay) — React geri kalanını (hangi DOM
elemanının değiştiğini bulup SADECE onu güncellemeyi) kendisi halleder.
Bu "verilen state'e göre ekranı yeniden hesapla" modeline **render**
denir, ve React'in bunu YAVAŞ yapmadan (her state değişiminde TÜM
sayfayı yeniden inşa etmeden) başarmasını sağlayan iç mekanizmaya
**Virtual DOM** denir: React önce hafızada ucuz bir "taslak" DOM hesaplar,
eskisiyle KARŞILAŞTIRIR (diffing), ve gerçek tarayıcı DOM'una sadece
FARK olan minik değişikliği uygular. Bunun detayına inmen gerekmez —
bilmen gereken tek şey: **state değişince React otomatik olarak ilgili
ekranı yeniden çizer, sen DOM'a elle dokunmazsın.**

---

## 4. JSX: `<div>` yazan ama aslında JavaScript olan sözdizimi

Bu projedeki her `.jsx` dosyasında (`LoginPage.jsx`, `ItemsPage.jsx`...)
HTML'e benzeyen bir sözdizimi göreceksin:

```jsx
return (
  <button type="submit" disabled={pending} className={primaryBtnCls}>
    {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
  </button>
)
```

Bu **JSX**'tir — tarayıcının ASLA anlamadığı bir sözdizimi. Vite (bölüm 9),
bu kodu derlerken arka planda düz JavaScript'e çevirir; yukarıdaki satır
kavramsal olarak şuna dönüşür:

```js
return React.createElement(
  'button',
  { type: 'submit', disabled: pending, className: primaryBtnCls },
  pending ? 'Giriş yapılıyor…' : 'Giriş yap',
)
```

Yani JSX, `React.createElement(...)` çağırmanın **kısayoludur** — "HTML
yazıyormuş gibi hissettiren JavaScript" diye düşünebilirsin. Bu yüzden
JSX içinde süslü parantez (`{}`) ile HER YERDE gerçek JavaScript
çalıştırabilirsin — `{pending ? '...' : '...'}` gibi bir koşul, ya da
`ItemsPage.jsx:140`'taki gibi bir liste döngüsü:

```jsx
{items.map((item) => (
  <tr key={item.id}>...</tr>
))}
```

`items` dizisindeki HER eleman için bir `<tr>` üretir — bu, düz HTML'de
elle yazman gereken tekrarlayan kodu, JavaScript'in `.map()` fonksiyonuyla
otomatikleştirmenin yoludur. (`key={item.id}` neden şart: React, listedeki
hangi elemanın DEĞİŞTİĞİNİ/eklendiğini/silindiğini `key` sayesinde ucuza
anlar — key olmadan her değişiklikte listenin tamamını yeniden çizmek
zorunda kalırdı.)

---

## 5. Component: Kendi kendine yeten bir ekran parçası

Bir **component**, girdisine göre bir JSX çıktısı üreten bir JavaScript
fonksiyonudur. Backend'deki bir route handler'a benzetebilirsin: "girdi
alır, çıktı üretir" — sadece çıktı JSON değil, ekranda görünecek
JSX'tir. Bu projedeki EN küçük component örneği:

```jsx
// client/src/components/Feedback.jsx:6-8
export function Spinner({ size = 20, className = '' }) {
  return <CircleNotch size={size} className={`animate-spin ${className}`} aria-hidden="true" />
}
```

- `{ size = 20, className = '' }` → bunlara **props** (properties) denir:
  component'i ÇAĞIRAN tarafın ona geçtiği girdiler. `<Spinner size={18} />`
  yazan biri, `Spinner`'ın içindeki `size` değişkenini 18 yapmış olur.
  Props, tıpkı bir fonksiyonun parametreleri gibi çalışır — ve backend'deki
  bir fonksiyonun parametreleri gibi, component KENDİ props'unu asla
  değiştirmez (sadece okur).
- Component'lar iç içe geçebilir (composition): `ItemsPage`, içinde
  `NewItemForm`'u, o da içinde `ErrorNotice`/`Spinner`'ı kullanır. Büyük
  bir ekran, küçük component'ların birleşiminden oluşur — tıpkı backend'de
  büyük bir akışın küçük middleware'lerin zincirinden oluşması gibi
  (bkz. `software.md` bölüm 7).

**Neden bu kadar küçük component'lara bölünüyor?** Aynı SRP mantığı
(bkz. `software.md` bölüm 4 ve 15): `Spinner`'ın TEK işi "dönen bir ikon
çizmek"tir; bunu `FullPageSpinner`, `ErrorNotice`, `NewItemForm` gibi
birçok yerde tekrar tekrar YAZMAK yerine, bir kere yazıp import ederiz.

---

## 6. Hook'lar: Bir component'in "hafızası" ve "refleksleri"

React'te bir component fonksiyonu her render'da BAŞTAN çalışır — normal
bir JavaScript fonksiyonu gibi düşünürsen, "hafızası olmaması" (her
çağrıda değişkenlerin sıfırlanması) gerekirdi. **Hook'lar**, bir
component'e bu "hafıza" ve "yan etki" yeteneklerini kazandıran özel
fonksiyonlardır (hepsi `use` ile başlar). Bu projede dört tanesi
yoğun kullanılıyor:

### `useState` — component'in hafızası

```jsx
// client/src/pages/ItemsPage.jsx:25-27
const [items, setItems] = useState([])
const [loading, setLoading] = useState(true)
```

`useState(başlangıçDeğeri)`, bir `[değer, değeriDeğiştirenFonksiyon]`
çifti döner. Kritik kural: state'i ASLA doğrudan değiştirmezsin
(`items = [...]` YANLIŞ) — mutlaka `setItems(...)` çağırırsın. Neden?
Çünkü React'in "bir şey değişti, yeniden render et" tetiklemesi TAM
OLARAK bu `set...` fonksiyonunun çağrılmasına bağlıdır; doğrudan
değişiklik React'in haberi olmadan olur, ekran GÜNCELLENMEZ.

### `useEffect` — "ekrana ilk çizildiğinde / bir şey değiştiğinde şunu yap"

```jsx
// client/src/pages/ItemsPage.jsx:49-51
useEffect(() => {
  loadItems()
}, [loadItems])
```

`useEffect(fonksiyon, bağımlılıklar)`: component ekrana ilk çizildiğinde
VE `bağımlılıklar` dizisindeki değerlerden biri değiştiğinde `fonksiyon`u
çalıştırır. Boş dizi (`[]`) verirsen "sadece BİR KEZ, component ilk
göründüğünde çalış" demiş olursun — `AuthContext.jsx:19-44`'teki
`restoreSession()` çağrısı tam olarak bunun için `[]` kullanır: "uygulama
açılır açılmaz, bir kere, oturumu sessizce geri kurmayı dene." Bu,
backend'deki "sunucu ayağa kalkarken çalışan kurulum kodu"na (bölüm 6)
en yakın frontend karşılığıdır — farkı, HER component kendi "açılış
anını" ayrı ayrı tanımlayabilir.

### `useContext` — ağacın herhangi bir yerinden global veri okumak

```jsx
// client/src/auth/AuthContext.jsx:72-76
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}
```

Normalde bir veriyi (örn. "giriş yapmış kullanıcı kim?") derin bir
component'e ulaştırmak için onu HER ara component'ten props olarak
elden ele geçirmen gerekirdi ("prop drilling" — yorucu ve kırılgan).
`useContext`, bunun yerine "bu veriyi ağacın HERHANGİ bir yerinden
doğrudan oku" imkânı verir. Bu projede `useAuth()` çağıran her component
(`LoginPage`, `ItemsPage`, `ProtectedRoute`...) `user`/`status`/`login`/
`logout`'a, aralarındaki hiçbir component bunu bilmeden ulaşır.

### `useCallback` — bir fonksiyonu gereksiz yere yeniden yaratmamak

```jsx
// client/src/pages/ItemsPage.jsx:30-47
const loadItems = useCallback(async () => { ... }, [])
```

Normal bir JS fonksiyonu, component her render olduğunda YENİDEN
tanımlanır (yeni bir bellek adresinde). `useCallback`, "bağımlılıklar
değişmediği sürece AYNI fonksiyon referansını koru" der. Burada önemli
çünkü `loadItems`, `useEffect`'in bağımlılık listesinde (`[loadItems]`)
kullanılıyor — eğer her render'da yeni bir fonksiyon olsaydı, `useEffect`
"bağımlılık değişti" sanıp `loadItems()`'ı SONSUZ döngüde tekrar
çağırırdı.

**Özet tablo:**

| Hook | Sorduğu soru | Bu projede kullanıldığı yer |
|---|---|---|
| `useState` | "Bu component neyi hatırlamalı?" | `items`, `loading`, `error` (ItemsPage) |
| `useEffect` | "Component göründüğünde/bir şey değiştiğinde ne çalışsın?" | oturumu sessizce geri kurma (AuthContext) |
| `useContext` | "Bu veriyi ağacın her yerinden nasıl okurum?" | `useAuth()` — oturum bilgisi |
| `useCallback`/`useMemo` | "Bunu her render'da yeniden hesaplamama gerek var mı?" | `loadItems`, `AuthContext`'teki `value` (`useMemo`) |

---

## 7. SPA (Single Page Application) ve React Router: "sayfa değişimi" illüzyonu

Geleneksel bir web sitesinde her linke tıkladığında tarayıcı YENİ bir
`GET` isteği atar, sunucudan TAMAMEN yeni bir HTML sayfası indirir ve
sıfırdan çizer (beyaz an — flicker). Bu projede öyle değil: `client/src/App.jsx`

```jsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
  <Route path="*" element={<Navigate to="/items" replace />} />
</Routes>
```

**React Router**, tarayıcının adres çubuğundaki URL'i İZLER, ama URL
değiştiğinde sunucuya YENİ bir istek ATMAZ — sadece JS içinde "şu an
hangi component gösterilecek" kararını değiştirir ve React ilgili
component'i render eder. Bu yüzden buna **SPA (Single Page Application)**
denir: aslında tarayıcıya TEK bir HTML sayfası (`index.html`) yüklenir,
"sayfalar arası geçiş" dediğin şey o tek sayfanın İÇERİĞİNİN JS ile
değiştirilmesidir.

Bunun bir bedeli var: kullanıcı `/items` adresine DOĞRUDAN girerse (veya
F5 basarsa), bu GERÇEK bir HTTP isteğidir ve sunucuda (Nginx/Vite) fiziksel
olarak `/items` diye bir dosya YOKTUR — bu durumun nasıl çözüldüğü
(`try_files ... /index.html` kuralı) `software.md` bölüm 18'de anlatılıyor.

`ProtectedRoute` (`client/src/auth/ProtectedRoute.jsx`), bu route
haritasının İÇİNE oturan bir "kapı" component'idir — kendisi hiçbir şey
render etmez, sadece `useAuth()`'tan okuduğu `status`'e göre ya asıl
içeriği (`children`) ya da `/login`'e bir yönlendirme (`<Navigate>`)
gösterir. Backend'deki `authMiddleware`'in (route'u koruyan) frontend
karşılığı tam olarak budur (bkz. `software.md` bölüm 15'teki tablo).

---

## 8. Component ağacı: Kim kimi sarmalıyor, ve neden sıra önemli

`client/src/main.jsx`'te gördüğün sarmalama (nesting), rastgele değil —
her katmanın bir işlevi var:

```jsx
<BrowserRouter>      {/* 1. URL'i okur, en dışta olmalı ki içindeki HERKES route bilgisine erişsin */}
  <AuthProvider>      {/* 2. Oturum durumunu yayınlar; Router'ın İÇİNDE olmalı çünkü */}
    <App />           {/*    oturum düşünce yönlendirme yapması gerekir (useNavigate kullanır) */}
  </AuthProvider>
</BrowserRouter>
```

Bu, backend'deki middleware SIRASININ kritik olmasıyla (bölüm 7, `app.js`)
aynı ilke: bir üst katman, alt katmanın ihtiyaç duyduğu şeyi ondan ÖNCE
kurmuş olmalı. `AuthProvider` `BrowserRouter`'ın dışında olsaydı, içindeki
kod routing fonksiyonlarını (`useNavigate`, `<Navigate>`) kullanamazdı —
tıpkı `express.json()` route'lardan önce gelmezse `req.body`'nin boş
kalması gibi (bkz. `software.md` bölüm 7, madde 3).

---

## 9. Stil: Neden ayrı `.css` dosyaları yerine "utility class"lar?

Bu projede className'lerin içinde onlarca küçük kelime görürsün:

```jsx
className="flex min-h-dvh items-center justify-center bg-background px-4"
```

Bu **Tailwind CSS**'tir — her kelime (`flex`, `items-center`, `bg-background`)
ÖNCEDEN TANIMLANMIŞ, tek bir CSS kuralına karşılık gelen bir "utility"
class'ıdır (`flex` → `display: flex`, `px-4` → `padding-left/right: 1rem`).
Geleneksel yöntemde (ayrı `.css` dosyasına `.login-button { ... }` gibi
kurallar yazmak) her yeni component için yeni class isimleri uydurman ve
dosyalar arasında gidip gelmen gerekirdi; Tailwind'de stil, component'in
YANINDA, JSX'in içinde kalır — okurken "bu buton nasıl görünüyor" sorusunun
cevabı için başka dosyaya gitmezsin.

**Design token'lar** (`client/src/index.css`'teki `@theme` bloğu):
renkler kod içine ham hex (`#22c55e`) olarak GÖMÜLMEZ, `--color-accent`
gibi semantik isimlerle bir kere tanımlanır; `className="bg-accent"`
yazan her yer bu tanıma işaret eder. Paleti değiştirmek istediğinde
TEK dosyayı (`index.css`) değiştirirsin, projedeki yüzlerce `className`'e
dokunmazsın — backend'deki "tek doğruluk kaynağı" prensibinin
(`db/prisma.js` singleton'ı, bölüm 15'teki tablo) stil karşılığı.

Tekrarlanan class kombinasyonları (`inputCls`, `primaryBtnCls` —
`client/src/components/styles.js`) sabit string'ler olarak paylaşılır:
aynı görünümü `LoginPage` ve `NewItemForm`'a ayrı ayrı yazıp zamanla
birbirinden UZAKLAŞMALARINDANSA (drift), tek kaynaktan import edilir.

**Erişilebilirlik (a11y) notu**: Kodda sık göreceğin `aria-label`,
`aria-live`, `role="alert"`, `role="status"` gibi öznitelikler, ekran
okuyucu kullanan kullanıcılar için var — örn. `Feedback.jsx:26`'daki
`role="alert"`, bir hata belirdiği an ekran okuyucunun bunu SESLİ ve
KESİNTİLİ duyurmasını sağlar; `focus-visible:outline-*` kuralları da
(`styles.js`) klavye ile gezinen kullanıcı için görünür bir odak halkası
garanti eder. Bunlar "güzel görünsün" değil, "herkes kullanabilsin"
kaygısıyla eklenmiş — bu projenin bilinçli bir konvansiyonu.

---

## 10. Vite: JSX'i tarayıcının anlayacağı hale nasıl getiriyor?

Tarayıcı JSX'i (bölüm 4) ANLAMAZ, ayrıca `import` ile bölünmüş onlarca
küçük dosyayı (bölüm 5'teki gibi) tek tek indirmesi de verimsiz olurdu.
**Vite**, bu ikisini çözen **build aracı**dır:

1. **Transpile**: `.jsx` dosyalarındaki JSX sözdizimini düz
   `React.createElement(...)` çağrılarına çevirir (bölüm 4).
2. **Bundling**: Onlarca ayrı dosyayı (`api/http.js`, `pages/ItemsPage.jsx`,
   `node_modules/react`...) TEK (veya birkaç) optimize edilmiş dosyaya
   birleştirir — tarayıcı yüzlerce ayrı istek yerine bir avuç dosya indirir.
3. **Dev sunucusu (HMR)**: `npm run dev` sırasında değişikliği ANINDA
   tarayıcıya yansıtır (sayfayı komple yenilemeden) — bu yüzden kod
   kaydettiğin an ekranda görürsün.

Bu araç ve `client/`'ın derlenip Nginx üzerinden nasıl servis edildiği,
build-time/runtime env ayrımı dahil, zaten `software.md` bölüm 14'te
detaylı işlendi — burada tekrar etmiyoruz, sadece "JSX'i kim, nasıl düz
JS'e çeviriyor" sorusunun cevabını veriyoruz.

---

## 11. Bu projede kullanılan frontend paketlerinin ne işe yaradığı

| Paket | Ne için kullanılıyor (bu projede) |
|---|---|
| `react`, `react-dom` | Component/state/hook sistemi + bunları GERÇEK tarayıcı DOM'una çizen katman |
| `react-router-dom` | URL'i izleyip doğru component'i gösteren SPA routing kütüphanesi (bölüm 7) |
| `@tailwindcss/vite`, `tailwindcss` | Utility-first CSS sistemi (bölüm 9) |
| `@phosphor-icons/react` | SVG ikon seti — emoji yerine tema-uyumlu, tutarlı ikonlar (`Feedback.jsx` yorumu) |
| `vite`, `@vitejs/plugin-react` | Build aracı + JSX'i derleyen Vite eklentisi (bölüm 10) |
| `oxlint` | Kod stilini/olası hataları tarayan, ESLint'e benzer ama daha hızlı bir araç (root ESLint `client/` klasörünü görmezden gelir, kendi lint aracı var) |

---

## 12. Sırada ne var? (bu dosyayı nasıl kullanmalısın)

- Bu dosya "React ve frontend NEDİR" sorusunu cevaplıyor. "Bu frontend
  backend'e NASIL bağlanıyor, hangi istek ne zaman atılıyor" sorusu için
  `software.md` bölüm 13-19'a (özellikle bölüm 16'daki uçtan uca yolculuk)
  bak — ikisi birlikte tam resmi oluşturuyor.
- `client/src/` altındaki gerçek dosyalarda burada öğrendiğin kavramları
  ara: her `.jsx` dosyasında en az bir `useState`/`useEffect`, her sayfada
  bir component ağacı, her className'de Tailwind utility'leri geçiyor.
- Component/state/hook mantığını iyi oturttuktan sonra, `client/src/api/`
  klasörüne (frontend'in "backend'e giden kapısı") bakman en doğal
  sıradaki adım — o da zaten `software.md` bölüm 15'teki katman
  tablosunda ele alınmış durumda.
