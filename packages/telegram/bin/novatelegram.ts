#!/usr/bin/env bun
import { existsSync } from "node:fs"
import { resolve } from "node:path"

function findRepoRoot(start: string): string | undefined {
  let dir = start
  while (true) {
    if (existsSync(resolve(dir, "packages/novatelegram/package.json"))) return dir
    if (existsSync(resolve(dir, "packages/telegram/package.json"))) return dir
    const parent = resolve(dir, "..")
    if (parent === dir) return undefined
    dir = parent
  }
}

const repoRoot = findRepoRoot(process.cwd()) ?? findRepoRoot(import.meta.dir)

if (!repoRoot) {
  console.error("❌ Could not locate packages/telegram. Run from inside the novacode repo.")
  process.exit(1)
}

const telegramDir = existsSync(resolve(repoRoot, "packages/novatelegram"))
  ? resolve(repoRoot, "packages/novatelegram")
  : resolve(repoRoot, "packages/telegram")
process.chdir(telegramDir)

if (!existsSync(resolve(telegramDir, ".env")) && !process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ Missing TELEGRAM_BOT_TOKEN. Set it in .env or the environment.")
  process.exit(1)
}

const bun = Bun.spawn(["bun", "run", "dev"], {
  cwd: telegramDir,
  env: process.env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
})

await bun.exited