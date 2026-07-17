import { useEffect, useState } from 'react'
import { Plus, CheckCircle } from '@phosphor-icons/react'
import { getCategories } from '../api/categories.js'
import { createItem } from '../api/items.js'
import { ErrorNotice, Spinner } from '../components/Feedback.jsx'
import { labelCls, inputCls, primaryBtnCls, fieldErrorCls } from './styles.js'

// Bu component yalnızca EDITOR/ADMIN rolüne render edilir (bkz. ItemsPage).
// Yine de submit'in 403 dönme ihtimalini ele alıyoruz: rol, oturum sırasında
// değişmiş olabilir — UI durumu her zaman backend'in kararının bir tahminidir.
export default function NewItemForm({ onCreated }) {
  const [categories, setCategories] = useState(null) // null = henüz yükleniyor
  const [catError, setCatError] = useState(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')

  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)

  async function loadCategories() {
    setCatError(null)
    try {
      setCategories(await getCategories())
    } catch (err) {
      setCatError(err.message)
    }
  }

  useEffect(() => {
    loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Başarı mesajı 3 sn sonra kendiliğinden kaybolur (toast-dismiss kuralı).
  // Timeout'u effect'te kurup cleanup'ta iptal ediyoruz: component erken
  // unmount olursa "unmounted component'ta setState" uyarısı yememek için.
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(false), 3000)
    return () => clearTimeout(t)
  }, [success])

  function validate() {
    const errors = {}
    if (!name.trim()) errors.name = 'Ürün adı zorunludur.'
    if (price === '' || Number.isNaN(Number(price)) || Number(price) < 0) {
      errors.price = 'Geçerli bir fiyat gir (0 veya üzeri).'
    }
    if (!categoryId) errors.categoryId = 'Bir kategori seç.'
    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    // Client-side doğrulama: hatayı ilgili alanın ALTINDA göster
    // (error-placement kuralı). Bu, backend doğrulamasının yerine geçmez —
    // sadece kullanıcıya turu hızlandıran erken geri bildirimdir.
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setPending(true)
    try {
      const item = await createItem({
        name: name.trim(),
        price: Number(price),
        categoryId: Number(categoryId),
        description: description.trim() || undefined,
      })
      onCreated(item)
      setName('')
      setPrice('')
      setCategoryId('')
      setDescription('')
      setSuccess(true)
    } catch (err) {
      if (err.status === 403) {
        // TODO.md Week 9 sözleşmesi: 403 -> "Yetkiniz yok" mesajı
        setSubmitError('Bu işlem için yetkin yok. (EDITOR veya ADMIN rolü gerekir.)')
      } else {
        setSubmitError(err.message)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-labelledby="new-item-heading" className="rounded-lg border border-border bg-surface p-5">
      <h2 id="new-item-heading" className="mb-4 flex items-center gap-2 text-base font-bold tracking-tight">
        <Plus size={18} className="text-accent" aria-hidden="true" />
        Yeni Item
      </h2>

      {catError ? (
        <ErrorNotice message={`Kategoriler yüklenemedi: ${catError}`} onRetry={loadCategories} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="item-name" className={labelCls}>
                Ürün adı <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <input
                id="item-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mekanik klavye"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'item-name-error' : undefined}
                className={inputCls}
              />
              {fieldErrors.name && (
                <p id="item-name-error" className={fieldErrorCls}>
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="item-price" className={labelCls}>
                Fiyat (₺) <span className="text-danger" aria-hidden="true">*</span>
              </label>
              {/* type="number" + inputMode="decimal": mobilde sayısal klavye */}
              <input
                id="item-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1499.90"
                aria-invalid={Boolean(fieldErrors.price)}
                aria-describedby={fieldErrors.price ? 'item-price-error' : undefined}
                className={`${inputCls} font-mono tabular-nums`}
              />
              {fieldErrors.price && (
                <p id="item-price-error" className={fieldErrorCls}>
                  {fieldErrors.price}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="item-category" className={labelCls}>
                Kategori <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <select
                id="item-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={categories === null}
                aria-invalid={Boolean(fieldErrors.categoryId)}
                aria-describedby={fieldErrors.categoryId ? 'item-category-error' : undefined}
                className={`${inputCls} disabled:opacity-50`}
              >
                <option value="">
                  {categories === null ? 'Kategoriler yükleniyor…' : 'Kategori seç'}
                </option>
                {(categories ?? []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <p id="item-category-error" className={fieldErrorCls}>
                  {fieldErrors.categoryId}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="item-description" className={labelCls}>
                Açıklama <span className="text-faint">(opsiyonel)</span>
              </label>
              <input
                id="item-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kısa açıklama"
                className={inputCls}
              />
            </div>
          </div>

          {submitError && (
            <p role="alert" className="mt-4 rounded-lg border border-danger-strong/40 bg-danger-strong/10 px-3.5 py-2.5 text-sm text-danger">
              {submitError}
            </p>
          )}

          {/* aria-live="polite": başarı mesajı ekran okuyucuya odak çalmadan
              duyurulur (toast-accessibility kuralı) */}
          <div className="mt-4 flex items-center gap-4" aria-live="polite">
            <button type="submit" disabled={pending} className={primaryBtnCls}>
              {pending ? <Spinner size={18} /> : <Plus size={18} aria-hidden="true" />}
              {pending ? 'Ekleniyor…' : 'Ekle'}
            </button>
            {success && (
              <span className="flex items-center gap-1.5 text-sm text-accent">
                <CheckCircle size={18} aria-hidden="true" />
                Item eklendi.
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  )
}
