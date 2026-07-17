/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { setOnSessionExpired } from '../api/http'

// Oturum durumunun tek sahibi (single source of truth). Component'lar
// "kullanıcı kim, giriş yapmış mı" sorularını buradan sorar; token'ın
// kendisiyle hiçbir component muhatap olmaz (o, tokenStore + http.js'in işi).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Üç durumlu status şart: sadece user null'a bakarak karar verseydik,
  // uygulama açılışındaki "cookie ile oturumu geri kurma" (bootstrap) anında
  // henüz cevap gelmeden kullanıcıyı login'e fırlatırdık. 'loading' bu
  // "henüz bilmiyoruz" penceresini temsil eder (ProtectedRoute bunu bekletir).
  const [status, setStatus] = useState('loading') // 'loading' | 'authenticated' | 'anonymous'

  useEffect(() => {
    // http.js herhangi bir istekte oturumun kurtarılamaz şekilde düştüğünü
    // görürse (401 + refresh başarısız) bize haber verir; state temizlenince
    // ProtectedRoute otomatik olarak /login'e yönlendirir. (TODO.md Week 9:
    // "401 -> login sayfasına yönlendir" maddesinin merkezi çözümü.)
    setOnSessionExpired(() => {
      setUser(null)
      setStatus('anonymous')
    })

    // Bootstrap / silent login: F5 sonrası bellek sıfırlandı ama httpOnly
    // cookie yerinde duruyor olabilir — şifre sormadan oturumu geri kur.
    // Not: React StrictMode dev'de effect'i iki kez çalıştırır; iki çağrı
    // http.js'teki paylaşılan refreshPromise sayesinde TEK isteğe iner
    // (token rotation yüzünden iki ayrı refresh, ikincisini 401 ile düşürürdü).
    authApi
      .restoreSession()
      .then((restoredUser) => {
        setUser(restoredUser)
        setStatus('authenticated')
      })
      .catch(() => {
        // Cookie yok/geçersiz — normal bir durum, kullanıcı login olacak.
        setStatus('anonymous')
      })
  }, [])

  const value = useMemo(
    () => ({
      user,
      status,
      // Rol bazlı UI kararı tek yerden: form gösterilsin mi vb.
      // DİKKAT: Bu sadece UI konforu — gerçek yetki denetimi HER ZAMAN
      // backend'de (requireRole). Frontend'deki gizleme bir güvenlik
      // önlemi değildir; DevTools'la aşılabilir.
      canEdit: user?.role === 'ADMIN' || user?.role === 'EDITOR',
      login: async (email, password) => {
        const loggedInUser = await authApi.login(email, password)
        setUser(loggedInUser)
        setStatus('authenticated')
      },
      logout: async () => {
        await authApi.logout()
        setUser(null)
        setStatus('anonymous')
      },
    }),
    [user, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı')
  return ctx
}
