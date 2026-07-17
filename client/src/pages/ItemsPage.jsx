import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignOut, Package } from '@phosphor-icons/react'
import { useAuth } from '../auth/AuthContext.jsx'
import { getItems } from '../api/items.js'
import { ErrorNotice, Spinner } from '../components/Feedback.jsx'
import { ghostBtnCls } from '../components/styles.js'
import NewItemForm from '../components/NewItemForm.jsx'

// Rol rozetleri: renk TEK BAŞINA anlam taşımıyor — rol adı metin olarak
// her zaman görünür (color-not-only erişilebilirlik kuralı).
const ROLE_BADGE = {
  ADMIN: 'border-warning/40 bg-warning/10 text-warning',
  EDITOR: 'border-accent/40 bg-accent/10 text-accent',
  VIEWER: 'border-border bg-surface-raised text-muted',
}

const priceFmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })

export default function ItemsPage() {
  const { user, canEdit, logout } = useAuth()
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logoutPending, setLogoutPending] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await getItems())
    } catch (err) {
      // TODO.md Week 9 hata sözleşmesi: 401'i http.js merkezi olarak çözer
      // (sessiz refresh, olmazsa login'e düşürür) — buraya hiç ulaşmaz.
      // 403 ve network hatası ise sayfanın sorumluluğu:
      if (err.status === 403) {
        setError('Bu listeyi görüntüleme yetkin yok.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  async function handleLogout() {
    setLogoutPending(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLogoutPending(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Sticky header: temel navigasyon her scroll konumunda erişilebilir */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <p className="font-mono text-lg font-semibold tracking-tight">
            <span className="text-accent">▸</span> http-lab
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:block">{user.name}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium ${ROLE_BADGE[user.role] ?? ROLE_BADGE.VIEWER}`}
            >
              {user.role}
            </span>
            <button type="button" onClick={handleLogout} disabled={logoutPending} className={ghostBtnCls}>
              {logoutPending ? <Spinner size={16} /> : <SignOut size={16} aria-hidden="true" />}
              <span className="hidden sm:inline">Çıkış yap</span>
              <span className="sr-only sm:hidden">Çıkış yap</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {/* Yeni item formu: yalnızca EDITOR/ADMIN görür. VIEWER'a formu
            gizlemek bir UI konforu; asıl kapı backend'deki requireRole. */}
        {canEdit && <NewItemForm onCreated={(item) => setItems((prev) => [item, ...prev])} />}

        <section aria-labelledby="items-heading">
          <div className="mb-4 flex items-baseline justify-between">
            <h1 id="items-heading" className="text-xl font-bold tracking-tight">
              Items
            </h1>
            {!loading && !error && (
              <span className="font-mono text-sm text-faint">{items.length} kayıt</span>
            )}
          </div>

          {loading && (
            /* Skeleton: spinner yerine içerik iskeleti — yüklenince yerleşim
               zıplamaz (CLS) ve algılanan hız daha iyi olur. */
            <div className="space-y-2" role="status" aria-label="Items yükleniyor">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />
              ))}
            </div>
          )}

          {!loading && error && <ErrorNotice message={error} onRetry={loadItems} />}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Package size={32} className="mx-auto mb-3 text-faint" aria-hidden="true" />
              <p className="font-medium">Henüz hiç item yok</p>
              <p className="mt-1 text-sm text-muted">
                {canEdit
                  ? 'Yukarıdaki formdan ilk kaydı ekleyebilirsin.'
                  : 'Kayıt eklemek için EDITOR veya ADMIN rolü gerekir.'}
              </p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            /* Geniş içerik kendi kabında yatay kayar; sayfa gövdesi asla
               yatay scroll üretmez (horizontal-scroll kuralı). */
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-left">
                    <th scope="col" className="px-4 py-3 font-medium text-muted">Ürün</th>
                    <th scope="col" className="px-4 py-3 font-medium text-muted">Kategori</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Fiyat</th>
                    <th scope="col" className="px-4 py-3 font-medium text-muted">Eklenme</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border-subtle transition-colors duration-150 last:border-b-0 hover:bg-surface/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.description && <p className="mt-0.5 text-xs text-faint">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-surface-raised px-2 py-0.5 font-mono text-xs text-muted">
                          {item.category?.name ?? '—'}
                        </span>
                      </td>
                      {/* tabular-nums: rakamlar eşit genişlikte dizilir,
                          sağa dayalı fiyat kolonu titremez */}
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                        {priceFmt.format(item.price)}
                      </td>
                      <td className="px-4 py-3 text-muted">{dateFmt.format(new Date(item.createdAt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
