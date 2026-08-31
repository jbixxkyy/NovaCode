import type { Bot, Context } from "grammy"
import type { Logger } from "./logging"

export type CallbackHandler = (data: string, ctx: Context) => Promise<void> | void

export class CallbackRouter {
  private readonly handlers: Array<{ prefix: string; handler: CallbackHandler }> = []

  constructor(
    private readonly bot: Bot,
    private readonly log: Logger,
  ) {}

  register(prefix: string, handler: CallbackHandler): void {
    this.handlers.push({ prefix, handler })
  }

  mount(): void {
    this.bot.on("callback_query:data", async (ctx) => {
      try {
        await ctx.answerCallbackQuery()
      } catch (err) {
        this.log.debug("answerCallbackQuery failed:", err)
      }
      const data = ctx.callbackQuery.data
      if (!data) return

      const entry = this.match(data)
      if (!entry) {
        this.log.debug("no callback handler for data:", data)
        return
      }
      try {
        await entry.handler(data, ctx)
      } catch (err) {
        this.log.error("callback handler failed:", err)
      }
    })
  }

  private match(data: string): { prefix: string; handler: CallbackHandler } | undefined {
    let best: { prefix: string; handler: CallbackHandler } | undefined
    for (const entry of this.handlers) {
      if (!data.startsWith(entry.prefix)) continue
      if (!best || entry.prefix.length > best.prefix.length) best = entry
    }
    return best
  }
}