import type { Bot } from "grammy"
import type { Logger } from "./logging"
import type { Store, SessionEntry } from "./store"
import type { Config } from "./config"

export interface InboundReaction {
  chatId: number
  messageId: number
  userId?: number
  added: string[]
  removed: string[]
}

interface ReactionTypeEmoji {
  type: "emoji"
  emoji: string
}

interface ReactionUpdate {
  chat: { id: number }
  message_id: number
  user?: { id: number }
  old_reaction: Array<ReactionTypeEmoji | { type: string; [k: string]: unknown }>
  new_reaction: Array<ReactionTypeEmoji | { type: string; [k: string]: unknown }>
}

export class Reactions {
  constructor(
    private readonly bot: Bot,
    private readonly log: Logger,
    private readonly config: Config,
    private readonly store: Store,
  ) {}

  async set(chatId: number, messageId: number, emoji: string): Promise<void> {
    if (!this.config.reactions.enabled) return
    const reaction: ReactionTypeEmoji = { type: "emoji", emoji }
    await this.bot.api
      .setMessageReaction(chatId, messageId, [reaction] as never)
      .catch((err: unknown) => this.log.debug("set reaction failed:", err))
  }

  async clear(chatId: number, messageId: number): Promise<void> {
    if (!this.config.reactions.enabled) return
    await this.bot.api
      .setMessageReaction(chatId, messageId, [] as never)
      .catch((err: unknown) => this.log.debug("clear reaction failed:", err))
  }

  listen(): void {
    if (!this.config.reactions.enabled) return
    this.bot.on("message_reaction", (ctx) => {
      const reaction = ctx.messageReaction as ReactionUpdate | undefined
      if (!reaction) return
      this.handle(reaction)
    })
  }

  private handle(reaction: ReactionUpdate): void {
    const chatId = reaction.chat.id
    const sessions = this.findSessionsByChat(chatId)
    if (sessions.length === 0) {
      this.log.debug("reaction on untracked chat", chatId, "msg", reaction.message_id)
      return
    }

    const added = extractEmojis(reaction.new_reaction)
    const removed = extractEmojis(reaction.old_reaction).filter((e) => !added.includes(e))

    const event: InboundReaction = {
      chatId,
      messageId: reaction.message_id,
      userId: reaction.user?.id,
      added,
      removed,
    }

    if (this.config.reactions.forwardInbound) {
      this.log.info(
        "reaction",
        chatId,
        "msg",
        reaction.message_id,
        "user",
        event.userId,
        "added",
        added.join(",") || "-",
        "removed",
        removed.join(",") || "-",
      )
    } else {
      this.log.debug(
        "reaction",
        chatId,
        "msg",
        reaction.message_id,
        "added",
        added.join(",") || "-",
        "removed",
        removed.join(",") || "-",
      )
    }
  }

  private findSessionsByChat(chatId: number): SessionEntry[] {
    const prefix = `${chatId}`
    const topicPrefix = `${chatId}:topic:`
    const out: SessionEntry[] = []
    for (const [key, entry] of this.store.sessionEntries()) {
      if (key === prefix || key.startsWith(topicPrefix)) out.push(entry)
    }
    return out
  }
}

function extractEmojis(reactions: ReactionUpdate["old_reaction"]): string[] {
  const out: string[] = []
  for (const r of reactions) {
    if (r.type === "emoji" && typeof (r as ReactionTypeEmoji).emoji === "string") {
      out.push((r as ReactionTypeEmoji).emoji)
    }
  }
  return out
}