import { CircleNotch, WarningCircle, ArrowClockwise } from '@phosphor-icons/react'

// İkon kuralı: emoji değil SVG (Phosphor) — emoji platformlar arası tutarsız
// render edilir ve tema token'larıyla renklendirilemez.

export function Spinner({ size = 20, className = '' }) {
  return <CircleNotch size={size} className={`animate-spin ${className}`} aria-hidden="true" />
}

export function FullPageSpinner({ label }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      {/* role="status" -> ekran okuyucu, görsel spinner'ı görmese de durumu duyurur */}
      <div className="flex items-center gap-3 text-muted" role="status">
        <Spinner size={24} className="text-accent" />
        <span>{label}</span>
      </div>
    </div>
  )
}

export function ErrorNotice({ message, onRetry }) {
  return (
    // role="alert": hata belirdiği anda ekran okuyucuya kesintili duyurulur
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-danger-strong/40 bg-danger-strong/10 p-4 text-sm text-danger"
    >
      <WarningCircle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-1.5 font-medium text-danger transition-colors duration-150 hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            <ArrowClockwise size={16} aria-hidden="true" />
            Tekrar dene
          </button>
        )}
      </div>
    </div>
  )
}
