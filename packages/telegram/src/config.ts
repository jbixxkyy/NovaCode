import { z } from "zod"

const dmPolicy = z.enum(["pairing", "allowlist", "open", "disabled"]).default("pairing")
const groupPolicy = z.enum(["open", "allowlist", "disabled"]).default("allowlist")
const logLevel = z.enum(["debug", "info", "warn", "error"]).default("info")
const transport = z.enum(["polling", "webhook"]).default("polling")

const topicOverride = z
  .object({
    allowFrom: z.array(z.number()).optional(),
    requireMention: z.boolean().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
  })
  .strict()

const groupConfig = z
  .object({
    allowFrom: z.array(z.number()).optional(),
    requireMention: z.boolean().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    topics: z.record(z.string(), topicOverride).optional(),
  })
  .strict()

const streaming = z
  .object({
    enabled: z.boolean().default(true),
    debounceMs: z.number().int().nonnegative().default(400),
    minDelta: z.number().int().nonnegative().default(80),
  })
  .strict()
  .default({ enabled: true, debounceMs: 400, minDelta: 80 })

const reactions = z
  .object({
    enabled: z.boolean().default(true),
    ackEmoji: z.string().default("👀"),
    doneEmoji: z.string().default("✅"),
    forwardInbound: z.boolean().default(false),
  })
  .strict()
  .default({ enabled: true, ackEmoji: "👀", doneEmoji: "✅", forwardInbound: false })

const approvals = z
  .object({
    enabled: z.boolean().default(true),
    allowAlways: z.boolean().default(true),
  })
  .strict()
  .default({ enabled: true, allowAlways: true })

const webhook = z
  .object({
    url: z.string().url(),
    host: z.string().default("127.0.0.1"),
    port: z.number().int().positive().default(8787),
    path: z.string().default("/telegram"),
    secret: z.string().optional(),
    cert: z.string().optional(),
  })
  .strict()

const polling = z
  .object({
    stallTimeoutMs: z.number().int().positive().default(120_000),
    maxBackoffMs: z.number().int().positive().default(60_000),
    initialBackoffMs: z.number().int().nonnegative().default(1_000),
  })
  .strict()
  .default({ stallTimeoutMs: 120_000, maxBackoffMs: 60_000, initialBackoffMs: 1_000 })

export const ConfigSchema = z
  .object({
    token: z.string().optional(),
    dmPolicy,
    dmAllowFrom: z.array(z.number()).default([]),
    groupPolicy,
    groupAllowFrom: z.array(z.number()).default([]),
    groups: z.record(z.string(), groupConfig).default({}),
    requireMention: z.boolean().default(true),
    transport,
    webhook: webhook.optional(),
    streaming,
    reactions,
    approvals,
    polling,
    customCommands: z.record(z.string(), z.string()).default({}),
    logLevel,
    stateFile: z.string().default(".telegram-state.json"),
    projectDir: z.string().default(process.cwd()),
  })
  .strict()

export type Config = z.infer<typeof ConfigSchema>

function numList(name: string): number[] {
  const raw = process.env[name]
  if (!raw) return []
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
}

function parseEnvOverrides(): Partial<Config> {
  const out: Partial<Config> = {}
  if (process.env.TELEGRAM_BOT_TOKEN) out.token = process.env.TELEGRAM_BOT_TOKEN
  if (process.env.TELEGRAM_DM_POLICY) out.dmPolicy = process.env.TELEGRAM_DM_POLICY as Config["dmPolicy"]
  if (process.env.TELEGRAM_GROUP_POLICY) out.groupPolicy = process.env.TELEGRAM_GROUP_POLICY as Config["groupPolicy"]
  const allow = numList("TELEGRAM_DM_ALLOW_FROM")
  if (allow.length) out.dmAllowFrom = allow
  const groupAllow = numList("TELEGRAM_GROUP_ALLOW_FROM")
  if (groupAllow.length) out.groupAllowFrom = groupAllow
  if (process.env.TELEGRAM_REQUIRE_MENTION) {
    out.requireMention = process.env.TELEGRAM_REQUIRE_MENTION === "true" || process.env.TELEGRAM_REQUIRE_MENTION === "1"
  }
  if (process.env.TELEGRAM_TRANSPORT) out.transport = process.env.TELEGRAM_TRANSPORT as Config["transport"]
  if (process.env.TELEGRAM_LOG_LEVEL) out.logLevel = process.env.TELEGRAM_LOG_LEVEL as Config["logLevel"]
  if (process.env.TELEGRAM_STATE_FILE) out.stateFile = process.env.TELEGRAM_STATE_FILE
  if (process.env.TELEGRAM_PROJECT_DIR) out.projectDir = process.env.TELEGRAM_PROJECT_DIR
  if (process.env.TELEGRAM_POLLING_STALL_MS) {
    const v = Number(process.env.TELEGRAM_POLLING_STALL_MS)
    if (Number.isFinite(v) && v > 0) {
      const base = (out.polling as Config["polling"] | undefined) ?? { stallTimeoutMs: v, maxBackoffMs: 60_000, initialBackoffMs: 1_000 }
      out.polling = { ...base, stallTimeoutMs: v }
    }
  }
  return out
}

export async function loadConfig(): Promise<Config> {
  const path = process.env.TELEGRAM_CONFIG ?? "./telegram.json"
  const file = Bun.file(path)
  const exists = await file.exists()
  const base: unknown = exists ? await file.json().catch(() => ({})) : {}
  const merged = ConfigSchema.parse({ ...(base as object), ...parseEnvOverrides() })
  if (!merged.token) {
    const envToken = process.env.TELEGRAM_BOT_TOKEN
    if (!envToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set and no token in config file")
    }
    merged.token = envToken
  }
  return merged
}