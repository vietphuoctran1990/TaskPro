// Lightweight logger. Diagnostic `log`/`warn` output is silenced in production
// builds to keep the console clean; `error` is always emitted so genuine
// failures remain visible for support/debugging.
const isDev = import.meta.env.DEV

export const logger = {
  log:  (...args: unknown[]) => { if (isDev) console.log(...args) },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args) },
  error: (...args: unknown[]) => { console.error(...args) },
}
