import { describe, expect, test } from "bun:test"
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs"
import { join } from "path"
import {
  copyMissingLegacyDatabases,
  isFreshDir,
  migrateLegacyAppDirs,
  renameLegacyDataFiles,
  shouldMigrateLegacyApp,
} from "@opencode-ai/core/global-migrate"
import { rewritePathPrefix } from "@opencode-ai/core/util/path"
import { tmpdir } from "./fixture/tmpdir"

describe("shouldMigrateLegacyApp", () => {
  test("skips in-memory databases, tests, and explicit opt-out", () => {
    expect(shouldMigrateLegacyApp({})).toBe(true)
    expect(shouldMigrateLegacyApp({ db: ":memory:" })).toBe(false)
    expect(shouldMigrateLegacyApp({ testHome: "/tmp/test-home" })).toBe(false)
    expect(shouldMigrateLegacyApp({ skip: true })).toBe(false)
  })
})

describe("rewritePathPrefix", () => {
  test("rewrites the exact path and nested children", () => {
    expect(rewritePathPrefix("/old/repo", "/new/repo", "/old/repo")).toBe("/new/repo")
    expect(rewritePathPrefix("/old/repo", "/new/repo", "/old/repo/src/app.ts")).toBe("/new/repo/src/app.ts")
    expect(rewritePathPrefix("/old/repo", "/new/repo", "/other/repo")).toBe("/other/repo")
  })

  test("preserves windows slash style from the destination", () => {
    expect(
      rewritePathPrefix(
        "C:\\Users\\jblix\\Downloads\\novacode\\novacode",
        "C:\\Users\\jblix\\Documents\\work\\novacode\\novacode",
        "C:\\Users\\jblix\\Downloads\\novacode\\novacode",
      ),
    ).toBe("C:\\Users\\jblix\\Documents\\work\\novacode\\novacode")
    expect(
      rewritePathPrefix(
        "C:/Users/jblix/Downloads/novacode/novacode",
        "C:/Users/jblix/Documents/work/novacode/novacode",
        "C:/Users/jblix/Downloads/novacode/novacode/packages/app",
      ),
    ).toBe("C:/Users/jblix/Documents/work/novacode/novacode/packages/app")
  })
})

describe("migrateLegacyAppDirs", () => {
  test("copies opencode dirs once and renames database files", async () => {
    await using root = await tmpdir()
    const from = {
      data: join(root.path, "from-data"),
      config: join(root.path, "from-config"),
      cache: join(root.path, "from-cache"),
      state: join(root.path, "from-state"),
    }
    const to = {
      data: join(root.path, "to-data"),
      config: join(root.path, "to-config"),
      cache: join(root.path, "to-cache"),
      state: join(root.path, "to-state"),
    }
    mkdirSync(from.data, { recursive: true })
    mkdirSync(from.config, { recursive: true })
    writeFileSync(join(from.data, "opencode-dev.db"), "sessions")
    writeFileSync(join(from.data, "opencode-dev.db-wal"), "wal")
    writeFileSync(join(from.config, "opencode.json"), "{}")

    migrateLegacyAppDirs({ from, to })

    expect(readFileSync(join(to.data, "novacode-dev.db"), "utf8")).toBe("sessions")
    expect(readFileSync(join(to.data, "novacode-dev.db-wal"), "utf8")).toBe("wal")
    expect(readFileSync(join(to.config, "opencode.json"), "utf8")).toBe("{}")
    expect(JSON.parse(readFileSync(join(to.data, ".migrated-from-opencode"), "utf8")).from).toBe(from.data)

    writeFileSync(join(from.data, "opencode-dev.db"), "changed")
    migrateLegacyAppDirs({ from, to })
    expect(readFileSync(join(to.data, "novacode-dev.db"), "utf8")).toBe("sessions")
  })

  test("copyMissingLegacyDatabases fills in dbs that were not copied", async () => {
    await using root = await tmpdir()
    const from = join(root.path, "from")
    const to = join(root.path, "to")
    mkdirSync(from, { recursive: true })
    mkdirSync(to, { recursive: true })
    writeFileSync(join(from, "opencode-dev.db"), "dev-sessions")
    writeFileSync(join(from, "opencode.db"), "prod-sessions")
    writeFileSync(join(to, "novacode-main.db"), "already")
    copyMissingLegacyDatabases(from, to)
    expect(readFileSync(join(to, "novacode-dev.db"), "utf8")).toBe("dev-sessions")
    expect(readFileSync(join(to, "novacode.db"), "utf8")).toBe("prod-sessions")
    expect(readFileSync(join(to, "novacode-main.db"), "utf8")).toBe("already")
  })

  test("renameLegacyDataFiles leaves json config names alone", async () => {
    await using root = await tmpdir()
    writeFileSync(join(root.path, "opencode.json"), "{}")
    writeFileSync(join(root.path, "opencode.db"), "db")
    renameLegacyDataFiles(root.path)
    expect(readdirSync(root.path).sort()).toEqual(["novacode.db", "opencode.json"])
    expect(isFreshDir(root.path)).toBe(false)
  })
})
