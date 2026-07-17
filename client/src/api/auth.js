// Auth uç noktalarının frontend karşılığı. Dikkat: bu üç istek de auth: false
// ile gider — login'in Bearer token'a ihtiyacı yok (token almaya gidiyoruz),
// refresh/logout ise kimliğini Authorization header'ından değil httpOnly
// COOKIE'den alır (tarayıcı credentials: 'include' sayesinde otomatik ekler).
// auth: false ayrıca http.js'teki "401 görünce refresh dene" döngüsünü de
// devre dışı bırakır — login'e yanlış şifre girince refresh denemek anlamsız,
// refresh'in kendisi 401 dönünce tekrar refresh denemek sonsuz döngü olurdu.
import { apiFetch, refreshAccessToken } from './http'
import { tokenStore } from '../auth/tokenStore'

export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })
  tokenStore.set(data.accessToken)
  return data.user
}

// Sayfa açılışında (F5 sonrası) oturumu sessizce geri kurar: cookie'deki
// refresh token hâlâ geçerliyse yeni access token + user bilgisi gelir.
export async function restoreSession() {
  const data = await refreshAccessToken()
  return data.user
}

export async function logout() {
  try {
    // Backend'e haber ver ki DB'deki refresh token'ı NULL'lasın (gerçek
    // invalidation) ve cookie'yi temizlesin.
    await apiFetch('/api/auth/logout', { method: 'POST', auth: false })
  } finally {
    // Backend'e ulaşılamasa bile lokal oturumu mutlaka düşür — kullanıcı
    // "çıkış yap"a bastıysa arayüz asla oturumda kalmış gibi davranmamalı.
    tokenStore.clear()
  }
}
