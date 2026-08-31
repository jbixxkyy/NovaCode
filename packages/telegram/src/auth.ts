import { randomBytes } from "node:crypto"
import type { Bot } from "grammy"
import type { Config } from "./config"
import type { Store } from "./store"
import type { Logger } from "./logging"

export interface AuthorizeOk {
  ok: true
  kind: "dm" | "group"
  topic?: number
}
export interface AuthorizeFail {
  ok: false
  reason: string
}
export type AuthorizeResult = AuthorizeOk | AuthorizeFail

export interface AuthorizeCtx {
  chatId: number
  chatType: "private" | "group" | "supergroup" | "channel" | string
  fromId?: number
  text?: string
  isTopicMessage?: boolean
  threadId?: number
  hasTopicsEnabled?: boolean
  replyToBotMessage?: boolean
}

export interface ChatContext {
  isDm: boolean
  threadId?: number
  hasTopicsEnabled?: boolean
}

export class AuthPolicy {
  private startedAt = Date.now()

  constructor(
    private readonly config: Config,
    private readonly store: Store,
    private readonly log: Logger,
  ) {}

  uptimeMs(): number {
    return Date.now() - this.startedAt
  }

  isMention(text: string, botUsername: string): boolean {
    if (!text) return false
    if (text.includes(`@${botUsername}`)) return true
    return false
  }

  extractCommandMention(text: string): string | null {
    const m = text.match(/^\/(\w+)(?:@(\w+))?/)
    return m?.[2] ?? null
  }

  async authorize(ctx: AuthorizeCtx, botUsername: string): Promise<AuthorizeResult> {
    const isDm = ctx.chatType === "private"

    if (isDm) {
      return this.authorizeDm(ctx, botUsername)
    }

    return this.authorizeGroup(ctx, botUsername)
  }

  private async authorizeDm(ctx: AuthorizeCtx, botUsername: string): Promise<AuthorizeResult> {
    const policy = this.config.dmPolicy
    if (policy === "disabled") {
      return { ok: false, reason: "dm-disabled" }
    }
    if (!ctx.fromId) {
      return { ok: false, reason: "no-user" }
    }

    if (policy === "open") {
      return { ok: true, kind: "dm" }
    }

    if (policy === "allowlist") {
      const allowed = this.config.dmAllowFrom.includes(ctx.fromId)
      return allowed ? { ok: true, kind: "dm" } : { ok: false, reason: "not-allowed" }
    }

    if (!this.store.isPaired(ctx.fromId)) {
      const code = randomBytes(4).toString("hex")
      this.store.createPairing(code, ctx.fromId)
      this.log.info(`pairing code issued for user ${ctx.fromId}: ${code}`)
      return { ok: false, reason: `pairing-required:${code}` }
    }

    return { ok: true, kind: "dm" }
  }

  private authorizeGroup(ctx: AuthorizeCtx, botUsername: string): AuthorizeResult {
    const policy = this.config.groupPolicy
    if (policy === "disabled") {
      return { ok: false, reason: "group-disabled" }
    }

    const groupKey = String(ctx.chatId)
    const groupConfig = this.config.groups[groupKey]
    const topicConfig = ctx.threadId && groupConfig?.topics ? groupConfig.topics[String(ctx.threadId)] : undefined

    const effectiveAllow: number[] | undefined =
      topicConfig?.allowFrom ?? groupConfig?.allowFrom ?? (this.config.groupAllowFrom.length ? this.config.groupAllowFrom : undefined)

    const requireMention = topicConfig?.requireMention ?? groupConfig?.requireMention ?? this.config.requireMention

    if (policy === "allowlist") {
      if (!ctx.fromId) return { ok: false, reason: "no-user" }
      const inGlobalAllow = this.config.groupAllowFrom.includes(ctx.fromId)
      const inGroupAllow = !!effectiveAllow && effectiveAllow.includes(ctx.fromId)
      if (!inGlobalAllow && !inGroupAllow) {
        return { ok: false, reason: "not-allowed" }
      }
    }

    if (requireMention) {
      const text = ctx.text ?? ""
      const mentioned = ctx.replyToBotMessage || this.isMention(text, botUsername)
      const cmdMention = this.extractCommandMention(text)
      const isCommandWithBot = cmdMention !== null && cmdMention === botUsername
      if (!mentioned && !isCommandWithBot) {
        return { ok: false, reason: "mention-required" }
      }
    }

    return { ok: true, kind: "group", topic: ctx.threadId }
  }

  pair(userId: number, code: string): boolean {
    const entry = this.store.consumePairing(code, userId)
    if (!entry) return false
    return this.store.pair(userId)
  }
}