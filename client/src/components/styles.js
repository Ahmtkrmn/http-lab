// Form/buton class'larının tek kaynağı. Aynı input görünümünü LoginPage ve
// NewItemForm'a ayrı ayrı yazıp zamanla birbirinden uzaklaşmalarındansa
// (drift) string sabitleri olarak paylaşıyoruz — design token mantığının
// component seviyesindeki devamı.
//
// Erişilebilirlik notları:
// - h-11 (44px): minimum dokunma hedefi boyutu (Apple HIG 44pt kuralı)
// - focus-visible:outline-*: klavye kullanıcısı için görünür odak halkası;
//   asla outline-none ile "temizlenmez"

export const labelCls = 'mb-1.5 block text-sm font-medium text-foreground'

export const inputCls =
  'h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-base text-foreground ' +
  'placeholder:text-faint transition-colors duration-150 ' +
  'focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ' +
  'aria-invalid:border-danger-strong'

export const primaryBtnCls =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 font-semibold text-on-accent ' +
  'transition-colors duration-150 hover:bg-accent-strong ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export const ghostBtnCls =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium ' +
  'text-muted transition-colors duration-150 hover:border-danger-strong/50 hover:text-danger ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

export const fieldErrorCls = 'mt-1.5 text-sm text-danger'
