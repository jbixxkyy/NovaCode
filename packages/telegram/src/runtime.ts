import { Bot } from "grammy"
import { apiThrottler } from "@grammyjs/transformer-throttler"

export { Bot }
export { run } from "@grammyjs/runner"
export { apiThrottler } from "@grammyjs/transformer-throttler"

export interface BotOptions {
  throttler?: boolean
}

export function createBot(token: string, opts: BotOptions = {}) {
  const bot = new Bot(token)
  if (opts.throttler !== false) {
    bot.api.config.use(apiThrottler())
  }
  return bot
}