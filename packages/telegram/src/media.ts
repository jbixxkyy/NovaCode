import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Bot, GrammyError, InputFile } from "grammy"
import type { Logger } from "./logging"

const MAX_BYTES_DEFAULT = 20 * 1024 * 1024
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 1000

export type MediaKind = "photo" | "document" | "audio" | "voice" | "video" | "video_note" | "sticker"

export interface MediaInput {
  type: MediaKind
  fileId: string
  fileUniqueId: string
  mime?: string
  filename?: string
  width?: number
  height?: number
  duration?: number
}

export interface DownloadOpts {
  downloadDir?: string
  maxBytes?: number
}

function extFromMime(mime?: string): string {
  if (!mime) return ""
  if (mime === "image/jpeg") return ".jpg"
  if (mime === "image/png") return ".png"
  if (mime === "image/gif") return ".gif"
  if (mime === "image/webp") return ".webp"
  if (mime === "audio/ogg") return ".ogg"
  if (mime === "audio/mpeg") return ".mp3"
  if (mime === "video/mp4") return ".mp4"
  const slash = mime.indexOf("/")
  return slash >= 0 ? `.${mime.slice(slash + 1)}` : ""
}

export class MediaHandler {
  private readonly bot: Bot
  private readonly log: Logger
  private readonly downloadDir: string
  private readonly maxBytes: number
  private dirReady: Promise<void> | null = null

  constructor(bot: Bot, log: Logger, opts: DownloadOpts = {}) {
    this.bot = bot
    this.log = log
    this.downloadDir = opts.downloadDir ?? join(tmpdir(), "telegram-media")
    this.maxBytes = opts.maxBytes ?? MAX_BYTES_DEFAULT
  }

  private ensureDir(): Promise<void> {
    if (!this.dirReady) {
      this.dirReady = mkdir(this.downloadDir, { recursive: true }).then(() => undefined)
    }
    return this.dirReady
  }

  static fromMessage(message: any): MediaInput[] {
    if (!message) return []
    const out: MediaInput[] = []

    if (Array.isArray(message.photo) && message.photo.length > 0) {
      const largest = message.photo[message.photo.length - 1]
      out.push({
        type: "photo",
        fileId: largest.file_id,
        fileUniqueId: largest.file_unique_id,
        mime: "image/jpeg",
        width: largest.width,
        height: largest.height,
      })
    }

    if (message.document) {
      out.push({
        type: "document",
        fileId: message.document.file_id,
        fileUniqueId: message.document.file_unique_id,
        mime: message.document.mime_type,
        filename: message.document.file_name,
      })
    }

    if (message.audio) {
      out.push({
        type: "audio",
        fileId: message.audio.file_id,
        fileUniqueId: message.audio.file_unique_id,
        mime: message.audio.mime_type,
        filename: message.audio.file_name,
        duration: message.audio.duration,
      })
    }

    if (message.voice) {
      out.push({
        type: "voice",
        fileId: message.voice.file_id,
        fileUniqueId: message.voice.file_unique_id,
        mime: message.voice.mime_type ?? "audio/ogg",
        duration: message.voice.duration,
      })
    }

    if (message.video) {
      out.push({
        type: "video",
        fileId: message.video.file_id,
        fileUniqueId: message.video.file_unique_id,
        mime: message.video.mime_type,
        filename: message.video.file_name,
        width: message.video.width,
        height: message.video.height,
        duration: message.video.duration,
      })
    }

    if (message.video_note) {
      out.push({
        type: "video_note",
        fileId: message.video_note.file_id,
        fileUniqueId: message.video_note.file_unique_id,
        mime: "video/mp4",
        duration: message.video_note.duration,
      })
    }

    if (message.sticker) {
      const sticker = message.sticker
      const mime = sticker.is_animated
        ? "application/vnd.tg-sticker-anim"
        : sticker.is_video
          ? "video/webm"
          : "image/webp"
      out.push({
        type: "sticker",
        fileId: sticker.file_id,
        fileUniqueId: sticker.file_unique_id,
        mime,
        filename: `sticker.${sticker.is_animated ? "tgs" : sticker.is_video ? "webm" : "webp"}`,
        width: sticker.width,
        height: sticker.height,
      })
    }

    return out
  }

  static resolveUrl(url: string): string {
    if (url.startsWith("file://")) {
      try {
        return decodeURI(new URL(url).pathname)
      } catch {
        return url.slice("file://".length)
      }
    }
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    return url
  }

  async download(fileId: string, hintMime?: string, hintFilename?: string): Promise<string> {
    await this.ensureDir()

    let lastErr: unknown
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.downloadOnce(fileId, hintMime, hintFilename)
      } catch (err) {
        lastErr = err
        const wait = retryDelayMs(err, attempt)
        if (wait === null) break
        this.log.warn(`download retry ${attempt + 1}/${MAX_RETRIES} after ${wait}ms:`, errMessage(err))
        await sleep(wait)
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }

  private async downloadOnce(fileId: string, hintMime?: string, hintFilename?: string): Promise<string> {
    const file = await this.bot.api.getFile(fileId)
    const relPath = file.file_path
    if (!relPath) throw new Error("getFile returned no file_path")

    const url = `https://api.telegram.org/file/bot${this.bot.token}/${relPath}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
    }

    const contentLength = Number(res.headers.get("content-length") ?? "0")
    if (contentLength > this.maxBytes) {
      throw new MediaTooLargeError(contentLength, this.maxBytes)
    }

    const filename = hintFilename ?? relPath.split("/").pop() ?? fileId
    const safeName = `${Date.now()}_${file.file_unique_id ?? fileId.slice(0, 8)}${guessExt(filename, hintMime)}`
    const dest = join(this.downloadDir, safeName)

    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > this.maxBytes) throw new MediaTooLargeError(buf.byteLength, this.maxBytes)
    await Bun.write(dest, buf)

    return dest
  }
}

export class MediaTooLargeError extends Error {
  readonly size: number
  readonly limit: number
  constructor(size: number, limit: number) {
    super(`media too large: ${size} > ${limit}`)
    this.name = "MediaTooLargeError"
    this.size = size
    this.limit = limit
  }
}

function guessExt(filename: string, hintMime?: string): string {
  if (filename.includes(".")) return ""
  return extFromMime(hintMime)
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryDelayMs(err: unknown, attempt: number): number | null {
  const retryAfter = extractRetryAfter(err)
  if (retryAfter !== undefined) {
    if (retryAfter > 30) return null
    return retryAfter * 1000
  }
  if (err instanceof MediaTooLargeError) return null
  if (attempt >= MAX_RETRIES - 1) return null
  return BACKOFF_BASE_MS * 2 ** attempt
}

function extractRetryAfter(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined
  const e = err as GrammyError & { parameters?: { retry_after?: number } }
  const ra = e.parameters?.retry_after
  if (typeof ra === "number" && Number.isFinite(ra) && ra >= 0) return ra
  return undefined
}

interface GroupBuf {
  parts: MediaInput[]
  lastAt: number
  timer: ReturnType<typeof setTimeout> | null
}

export class AlbumBuffer {
  private groups = new Map<string, GroupBuf>()
  private readonly windowMs: number
  private readonly onFlush?: (groupId: string, parts: MediaInput[]) => void

  constructor(opts: { windowMs?: number; onFlush?: (groupId: string, parts: MediaInput[]) => void } = {}) {
    this.windowMs = opts.windowMs ?? 800
    this.onFlush = opts.onFlush
  }

  push(message: any): { media: MediaInput[]; groupId: string } | undefined {
    const groupId = message?.media_group_id
    if (!groupId) return undefined
    const parts = MediaHandler.fromMessage(message)
    if (!parts.length) return undefined

    const existing = this.groups.get(groupId)
    if (existing) {
      existing.parts.push(...parts)
      existing.lastAt = Date.now()
      this.scheduleFlush(groupId)
      return undefined
    }

    const buf: GroupBuf = { parts: [...parts], lastAt: Date.now(), timer: null }
    this.groups.set(groupId, buf)
    this.scheduleFlush(groupId)
    return undefined
  }

  private scheduleFlush(groupId: string): void {
    const buf = this.groups.get(groupId)
    if (!buf) return
    if (buf.timer) clearTimeout(buf.timer)
    buf.timer = setTimeout(() => {
      this.flush(groupId)
    }, this.windowMs)
  }

  flush(groupId?: string): { media: MediaInput[]; groupId: string } | undefined {
    if (groupId !== undefined) {
      const buf = this.groups.get(groupId)
      if (!buf) return undefined
      if (buf.timer) clearTimeout(buf.timer)
      this.groups.delete(groupId)
      const media = buf.parts
      this.onFlush?.(groupId, media)
      return { media, groupId }
    }
    for (const [id, buf] of this.groups) {
      if (buf.timer) clearTimeout(buf.timer)
      this.groups.delete(id)
      const media = buf.parts
      this.onFlush?.(id, media)
      return { media, groupId: id }
    }
    return undefined
  }

  size(): number {
    return this.groups.size
  }

  clear(): void {
    for (const buf of this.groups.values()) {
      if (buf.timer) clearTimeout(buf.timer)
    }
    this.groups.clear()
  }
}

export function toInputFile(pathOrUrl: string): InputFile | string {
  const resolved = MediaHandler.resolveUrl(pathOrUrl)
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) return resolved
  return new InputFile(resolved)
}