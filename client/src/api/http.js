// ---------------------------------------------------------------------------
// Tüm HTTP trafiğinin geçtiği TEK kapı.
//
// Component'ların içinde çıplak fetch() YOK (TODO.md Week 9 kuralı) — çünkü
// her isteğin ortak dertleri var: base URL, Authorization header'ı,
// credentials, 401 yakalayıp sessizce token yenileme, hata normalizasyonu.
// Bunlar her component'a kopyalanırsa hem tekrar (DRY ihlali) hem de tutarsız
// hata davranışı doğar. Backend'deki katmanlama neyse (route -> store -> db),
// bu dosya da frontend'in aynı disiplinidir.
// ---------------------------------------------------------------------------
import { tokenStore } from '../auth/tokenStore'

const BASE_URL = import.meta.env.VITE_API_URL

// Hataları tek tipe indiriyoruz: UI kodu "response mu, TypeError mü, JSON mu
// text mi" diye uğraşmaz; sadece err.status ve err.kind'a bakar.
//   kind: 'network' -> sunucuya hiç ulaşılamadı (backend kapalı, CORS, DNS...)
//   kind: 'http'    -> sunucu ulaşıldı ama 4xx/5xx döndü (status dolu)
export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'http', body = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.kind = kind
    this.body = body
  }
}

async function parseErrorBody(res) {
  // Backend genelde { error: '...' } döner ama örn. rate limiter düz metin
  // döndürür — ikisini de tolere et.
  const text = await res.text().catch(() => '')
  try {
    return JSON.parse(text)
  } catch {
    return text ? { error: text } : null
  }
}

async function rawRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  // Access token bellekteyse Authorization header'ına ekle.
  const token = tokenStore.get()
  if (auth && token) headers['Authorization'] = `Bearer ${token}`

  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // credentials: 'include' — httpOnly refresh cookie'sinin cross-origin
      // isteklerde TAŞINMASI için şart. Tek başına yetmez: backend de
      // cors({ credentials: true }) ile "kimlikli isteğe izin veriyorum"
      // demeli. İki taraftan biri eksikse cookie sessizce gönderilmez
      // (detaylı açıklama: ana README "CORS" bölümü).
      credentials: 'include',
    })
  } catch {
    // fetch yalnızca istek HİÇ tamamlanamazsa reject eder (sunucu kapalı,
    // CORS engeli, ağ kopuk). 4xx/5xx buraya DÜŞMEZ — onlar aşağıda.
    throw new ApiError(
      'Sunucuya ulaşılamadı. Backend çalışıyor mu? (İpucu: bu bir CORS engeli de olabilir — tarayıcı konsoluna bak.)',
      { kind: 'network' },
    )
  }
}

// Aynı anda birden çok istek 401 yerse (ör. sayfa açılışında 3 paralel çağrı)
// HEPSİNİN ayrı ayrı /refresh çağırmasını istemeyiz: token rotation yüzünden
// ilk yenileme eskisini geçersiz kılar, diğerleri 401 alıp oturumu düşürürdü.
// Çözüm: uçuştaki refresh promise'ini paylaş — herkes aynı yenilemeyi bekler.
let refreshPromise = null

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await rawRequest('/api/auth/refresh', { method: 'POST', auth: false })
      if (!res.ok) {
        const body = await parseErrorBody(res)
        throw new ApiError(body?.error || 'Oturum yenilenemedi.', { status: res.status, body })
      }
      const data = await res.json()
      tokenStore.set(data.accessToken)
      return data // { accessToken, user }
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// Oturum tamamen düştüğünde (refresh de başarısız) AuthContext'in haberdar
// olması için callback kaydı. http.js bir React modülü olmadığından context'e
// doğrudan erişemez; bağımlılık yönü tersine çevrilmiş olur (DIP'in frontend
// hâli: alt katman üst katmanı import etmez, üst katman kendini kaydeder).
let onSessionExpired = null
export function setOnSessionExpired(callback) {
  onSessionExpired = callback
}

export async function apiFetch(path, options = {}) {
  let res = await rawRequest(path, options)

  // 401 = access token yok/süresi dolmuş. Kullanıcıyı hemen login'e atmak
  // yerine önce sessizce yenilemeyi dene (silent refresh), sonra isteği
  // BİR KEZ tekrarla. Refresh de tutmazsa oturum gerçekten bitmiştir.
  if (res.status === 401 && options.auth !== false) {
    try {
      await refreshAccessToken()
    } catch {
      tokenStore.clear()
      onSessionExpired?.()
      throw new ApiError('Oturum süresi doldu. Lütfen tekrar giriş yapın.', { status: 401 })
    }
    res = await rawRequest(path, options)
  }

  if (!res.ok) {
    const body = await parseErrorBody(res)
    throw new ApiError(body?.error || `İstek başarısız oldu (HTTP ${res.status}).`, {
      status: res.status,
      body,
    })
  }

  if (res.status === 204) return null
  return res.json()
}
