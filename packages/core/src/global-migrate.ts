export * as GlobalMigrate from "./global-migrate"

import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { APP_NAME, LEGACY_APP_NAME } from "./identity"

export { APP_NAME, LEGACY_APP_NAME }

export type AppDirs = {
  data: string
  config: string
  cache: string
  state: string
}

export function shouldMigrateLegacyApp(input: { db?: string; testHome?: string; skip?: boolean }) {
  if (input.skip) return false
  if (input.db === ":memory:") return false
  if (input.testHome) return false
  return true
}

export function isFreshDir(dir: string) {
  try {
    return readdirSync(dir).length === 0
  } catch {
    return true
  }
}

export function renameLegacyDataFiles(dataDir: string) {
  if (!existsSync(dataDir)) return
  for (const name of readdirSync(dataDir)) {
    if (!name.startsWith(LEGACY_APP_NAME)) continue
    if (name.endsWith(".json") || name.endsWith(".jsonc")) continue
    renameSync(join(dataDir, name), join(dataDir, APP_NAME + name.slice(LEGACY_APP_NAME.length)))
  }
}

function copyIfFresh(from: string, to: string) {
  if (!existsSync(from)) return false
  if (!isFreshDir(to)) return false
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true })
  return true
}

const MIN_REAL_DB_BYTES = 8192

export function copyMissingLegacyDatabases(fromDir: string, toDir: string) {
  if (!existsSync(fromDir)) return
  mkdirSync(toDir, { recursive: true })
  for (const name of readdirSync(fromDir)) {
    if (!name.startsWith(LEGACY_APP_NAME)) continue
    if (name.endsWith(".json") || name.endsWith(".jsonc")) continue
    const destName = APP_NAME + name.slice(LEGACY_APP_NAME.length)
    const source = join(fromDir, name)
    const dest = join(toDir, destName)
    if (existsSync(dest) && statSync(dest).size > MIN_REAL_DB_BYTES) continue
    if (existsSync(dest) && destName.endsWith(".db")) continue
    try {
      cpSync(source, dest)
    } catch {
      // Source or dest may be locked by a running app.
    }
  }
}

export function migrateLegacyAppDirs(input: { from: AppDirs; to: AppDirs }) {
  const copied = copyIfFresh(input.from.data, input.to.data)
  if (copied) {
    renameLegacyDataFiles(input.to.data)
    writeFileSync(
      join(input.to.data, ".migrated-from-opencode"),
      `${JSON.stringify({ from: input.from.data, at: Date.now() })}\n`,
    )
  }
  copyMissingLegacyDatabases(input.from.data, input.to.data)
  copyIfFresh(input.from.config, input.to.config)
  copyIfFresh(input.from.cache, input.to.cache)
  copyIfFresh(input.from.state, input.to.state)
}
