import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext.jsx'
import { FullPageSpinner, Spinner } from '../components/Feedback.jsx'
import { labelCls, inputCls, primaryBtnCls } from '../components/styles.js'

export default function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // ProtectedRoute bizi buraya yolladıysa, login sonrası kullanıcıyı gitmek
  // istediği sayfaya geri götür (state-preservation).
  const from = location.state?.from || '/items'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [pending, setPending] = useState(false)

  // Bootstrap süreci bitmeden formu gösterme: cookie'yle sessiz giriş
  // başarılı olacaksa kullanıcıya login formu FLAŞLAYIP kaybolmasın.
  if (status === 'loading') return <FullPageSpinner label="Oturum kontrol ediliyor…" />
  if (status === 'authenticated') return <Navigate to={from} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Email ve şifre alanları zorunludur.')
      return
    }

    setPending(true)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      // ApiError mesajları zaten kullanıcıya dönük: backend'in 401 mesajı
      // ("Geçersiz email veya şifre.") veya http.js'in network açıklaması.
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Marka bloğu: terminal prompt estetiği (developer console teması) */}
        <p className="mb-2 font-mono text-2xl font-semibold tracking-tight">
          <span className="text-accent">▸</span> http-lab
        </p>
        <h1 className="mb-8 text-sm text-muted">Devam etmek için hesabınla giriş yap.</h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className={labelCls}>
              Email
            </label>
            {/* type="email" + autoComplete: mobil klavye ve tarayıcı otomatik
                doldurması için semantik input tipleri */}
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelCls}>
              Şifre
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pr-12`}
              />
              {/* Şifre göster/gizle (password-toggle kuralı). İkon tek başına
                  yeterli değil -> aria-label ekran okuyucuya işlevi söyler. */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-faint transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                {showPassword ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-danger-strong/40 bg-danger-strong/10 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Async işlem sürerken buton kilitli + spinner: çifte submit'i
              engeller ve "bir şey oluyor" geri bildirimi verir. */}
          <button type="submit" disabled={pending} className={`${primaryBtnCls} w-full`}>
            {pending && <Spinner size={18} />}
            {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-faint">
          Hesabın yok mu? Kayıt şimdilik yalnızca API üzerinden:{' '}
          <code className="font-mono text-muted">POST /api/auth/register</code>
        </p>
      </div>
    </main>
  )
}
