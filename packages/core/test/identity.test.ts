import { describe, expect, test } from "bun:test"
import { APP_NAME, appEnv, appEnvTruthy, isAppConfigDir, novaKey } from "@opencode-ai/core/identity"

describe("identity", () => {
  test("product name is novacode", () => {
    expect(APP_NAME).toBe("novacode")
    expect(novaKey("OPENCODE_DB")).toBe("NOVACODE_DB")
  })

  test("appEnv prefers NOVACODE_ over OPENCODE_", () => {
    const previousNova = process.env.NOVACODE_CONFIG
    const previousOpen = process.env.OPENCODE_CONFIG
    process.env.OPENCODE_CONFIG = "/old"
    process.env.NOVACODE_CONFIG = "/new"
    expect(appEnv("OPENCODE_CONFIG")).toBe("/new")
    delete process.env.NOVACODE_CONFIG
    expect(appEnv("OPENCODE_CONFIG")).toBe("/old")
    if (previousNova === undefined) delete process.env.NOVACODE_CONFIG
    else process.env.NOVACODE_CONFIG = previousNova
    if (previousOpen === undefined) delete process.env.OPENCODE_CONFIG
    else process.env.OPENCODE_CONFIG = previousOpen
  })

  test("appEnvTruthy and config dir detection", () => {
    expect(appEnvTruthy("OPENCODE_PURE")).toBe(false)
    expect(isAppConfigDir("/repo/.novacode")).toBe(true)
    expect(isAppConfigDir("/repo/.opencode")).toBe(true)
    expect(isAppConfigDir("/repo/src")).toBe(false)
  })
})
