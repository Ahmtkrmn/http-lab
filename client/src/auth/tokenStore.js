// ---------------------------------------------------------------------------
// Access token'ın YAŞADIĞI TEK YER: bir JavaScript modül değişkeni (RAM).
//
// Neden localStorage DEĞİL? localStorage'a yazılan her şey, sayfada çalışan
// HERHANGİ bir JS tarafından okunabilir (window.localStorage.getItem). Bir
// XSS açığında (ör. sızmış bir üçüncü parti script) saldırgan token'ı çalıp
// dışarı postalayabilir. Modül değişkeni de teknik olarak XSS'e karşı %100
// korumalı değildir, ama sekme kapanınca/yenilenince buharlaşır ve global
// olarak keşfedilebilir bir API'si yoktur — saldırı yüzeyi çok daha küçüktür.
//
// "Sayfa yenilenince token uçuyorsa kullanıcı her F5'te login mi olacak?"
// Hayır — kalıcılığı httpOnly cookie'deki refresh token sağlar. Uygulama
// açılışında AuthContext sessizce /api/auth/refresh çağırır ve buraya taze
// bir access token koyar (bkz. AuthContext.jsx "bootstrap").
// ---------------------------------------------------------------------------
let accessToken = null

export const tokenStore = {
  get: () => accessToken,
  set: (token) => {
    accessToken = token
  },
  clear: () => {
    accessToken = null
  },
}
