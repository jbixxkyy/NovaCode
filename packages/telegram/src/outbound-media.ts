import { stat } from "node:fs/promises"
import { Bot, InputFile } from "grammy"
import type { Logger } from "./logging"
import { MediaHandler } from "./media"

export interface OutboundFile {
  url: string
  mime: string
  filename?: string
}

export async function sendAgentAttachments(
  bot: Bot,
  chatId: number,
  threadId: number | undefined,
  attachments: OutboundFile[],
  log: Logger,
): Promise<void> {
  if (!attachments.length) return
  const thread = threadId && threadId !== 1 ? threadId : undefined

  for (const att of attachments) {
    try {
      await sendOne(bot, chatId, thread, att, log)
    } catch (err) {
      log.warn("outbound attachment send failed:", err)
      try {
        await bot.api.sendMessage(
          chatId,
          `[attachment unavailable: ${att.filename ?? att.url}]`,
          { message_thread_id: thread },
        )
      } catch (fallbackErr) {
        log.debug("fallback text send failed:", fallbackErr)
      }
    }
  }
}

async function sendOne(
  bot: Bot,
  chatId: number,
  threadId: number | undefined,
  att: OutboundFile,
  log: Logger,
): Promise<void> {
  const localPath = await ensureReachable(att.url, log)
  const source: InputFile | string =
    localPath !== null ? new InputFile(localPath, att.filename) : att.url

  if (att.mime.startsWith("image/")) {
    await bot.api.sendPhoto(chatId, source, {
      message_thread_id: threadId,
    })
    return
  }

  await bot.api.sendDocument(chatId, source, {
    message_thread_id: threadId,
  })
}

async function ensureReachable(url: string, log: Logger): Promise<string | null> {
  if (url.startsWith("file://")) return MediaHandler.resolveUrl(url)
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url

  try {
    const head = await fetch(url, { method: "HEAD" })
    if (head.ok) return url
    log.debug("HEAD not ok for", url, head.status)
  } catch (err) {
    log.debug("HEAD failed for", url, err)
  }

  try {
    const local = MediaHandler.resolveUrl(url)
    await stat(local)
    return local
  } catch {
    return null
  }
}