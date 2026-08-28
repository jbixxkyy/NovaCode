export * as Identity from "./identity"

/** Runtime product name. Data/config/cache dirs and native config files use this. */
export const APP_NAME = "novacode"

/** Legacy OpenCode names, used only to read existing files and env vars. */
export const LEGACY_APP_NAME = "opencode"

export const CONFIG_DIR_NAMES = [".opencode", ".novacode"] as const
export const PROJECT_CONFIG_FILES = ["opencode.json", "opencode.jsonc", "novacode.json", "novacode.jsonc"] as const
export const GIT_CACHE_FILE = "novacode"

export function novaKey(openCodeKey: string) {
  return openCodeKey.startsWith("OPENCODE_") ? `NOVACODE_${openCodeKey.slice("OPENCODE_".length)}` : openCodeKey
}

/** NovaCode env first. OpenCode names are a compatibility fallback only. */
export function appEnv(openCodeKey: string) {
  const nova = novaKey(openCodeKey)
  if (nova !== openCodeKey && process.env[nova] !== undefined) return process.env[nova]
  return process.env[openCodeKey]
}

export function appEnvTruthy(openCodeKey: string) {
  const value = appEnv(openCodeKey)?.toLowerCase()
  return value === "true" || value === "1"
}

export function isAppConfigDir(dir: string, extra?: string) {
  return dir.endsWith(".novacode") || dir.endsWith(".opencode") || (extra !== undefined && dir === extra)
}
