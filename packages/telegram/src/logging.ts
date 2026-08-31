export type LogLevel = "debug" | "info" | "warn" | "error"

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

export function createLogger(level: LogLevel): Logger {
  const min = ORDER[level] ?? ORDER.info
  const make = (own: LogLevel) => (...args: unknown[]) => {
    if (ORDER[own] < min) return
    const tag = `[${own}]`
    if (own === "error") console.error(tag, ...args)
    else if (own === "warn") console.warn(tag, ...args)
    else console.log(tag, ...args)
  }
  return {
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
  }
}