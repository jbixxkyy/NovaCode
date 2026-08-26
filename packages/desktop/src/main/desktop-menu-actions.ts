import { exec, spawn } from "node:child_process"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { app, BrowserWindow, shell } from "electron"
import type { DesktopMenuAction } from "@opencode-ai/app/desktop-menu"
import { createMainWindow, updateTitlebar } from "./windows"

export type DesktopMenuActionHandlers = Partial<{
  checkForUpdates: () => void
  relaunch: () => void
}>

const WEB_APP_PORT = 3000
const WEB_BACKEND_PORT = 4096
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")

let webBackendProcess: ReturnType<typeof spawn> | null = null
let webAppProcess: ReturnType<typeof spawn> | null = null

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(true))
    server.once("listening", () => {
      server.close(() => resolve(false))
    })
    server.listen(port)
  })
}

function waitForPort(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now()
  return new Promise((resolve) => {
    const check = () => {
      isPortInUse(port).then((inUse) => {
        if (inUse) return resolve(true)
        if (Date.now() - start > timeoutMs) return resolve(false)
        setTimeout(check, 500)
      })
    }
    check()
  })
}

async function startWebApp(sharedSessions: boolean) {
  const backendRunning = await isPortInUse(WEB_BACKEND_PORT)
  if (!backendRunning) {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      OPENCODE_CLIENT: "web",
    }
    if (sharedSessions) {
      const xdgData = join(app.getPath("home"), ".local", "share", "opencode")
      env.OPENCODE_DB = join(xdgData, "opencode-dev.db")
    }

    webBackendProcess = spawn("bun", ["run", "--conditions=browser", "./src/index.ts", "serve", "--port", String(WEB_BACKEND_PORT)], {
      cwd: join(root, "packages", "opencode"),
      env,
      stdio: "pipe",
      detached: true,
      shell: process.platform === "win32",
    })
    webBackendProcess.unref()

    const ready = await waitForPort(WEB_BACKEND_PORT)
    if (!ready) {
      shell.openExternal(`http://localhost:${WEB_APP_PORT}`)
      return
    }
  }

  const appRunning = await isPortInUse(WEB_APP_PORT)
  if (!appRunning) {
    webAppProcess = spawn("bun", ["run", "dev"], {
      cwd: join(root, "packages", "app"),
      stdio: "pipe",
      detached: true,
      shell: process.platform === "win32",
    })
    webAppProcess.unref()

    await waitForPort(WEB_APP_PORT)
  }

  shell.openExternal(`http://localhost:${WEB_APP_PORT}`)
}

function killByPid(pid: number) {
  if (!pid) return
  if (process.platform === "win32") {
    exec(`taskkill /F /T /PID ${pid}`)
  } else {
    exec(`kill -9 -${pid}`)
  }
}

function stopWebApp() {
  const backendPid = webBackendProcess?.pid
  const appPid = webAppProcess?.pid
  // Kill via taskkill first (kills the full process tree), before clearing refs
  if (backendPid) killByPid(backendPid)
  if (appPid) killByPid(appPid)
  webBackendProcess = null
  webAppProcess = null
}

export function runDesktopMenuAction(
  win: BrowserWindow | null,
  action: DesktopMenuAction,
  handlers: DesktopMenuActionHandlers = {},
) {
  switch (action) {
    case "app.checkForUpdates":
      handlers.checkForUpdates?.()
      return
    case "app.relaunch":
      handlers.relaunch?.()
      return
    case "window.new":
      createMainWindow()
      return
    case "window.close":
      win?.close()
      return
    case "window.minimize":
      win?.minimize()
      return
    case "window.toggleMaximize":
      if (win?.isMaximized()) {
        win.unmaximize()
        return
      }
      win?.maximize()
      return
    case "view.reload":
      win?.reload()
      return
    case "view.toggleDevTools":
      win?.webContents.toggleDevTools()
      return
    case "view.resetZoom":
      setZoom(win, 1)
      return
    case "view.zoomIn":
      setZoom(win, (win?.webContents.getZoomFactor() ?? 1) + 0.2)
      return
    case "view.zoomOut":
      setZoom(win, (win?.webContents.getZoomFactor() ?? 1) - 0.2)
      return
    case "view.toggleFullscreen":
      win?.setFullScreen(!win.isFullScreen())
      return
    case "edit.undo":
      win?.webContents.undo()
      return
    case "edit.redo":
      win?.webContents.redo()
      return
    case "edit.cut":
      win?.webContents.cut()
      return
    case "edit.copy":
      win?.webContents.copy()
      return
    case "edit.paste":
      win?.webContents.paste()
      return
    case "edit.delete":
      win?.webContents.delete()
      return
    case "edit.selectAll":
      win?.webContents.selectAll()
      return
    case "dev.webapp.shared":
      void startWebApp(true)
      return
    case "dev.webapp.standalone":
      void startWebApp(false)
      return
    case "dev.webapp.stop":
      stopWebApp()
      return
  }
}

function setZoom(win: BrowserWindow | null, value: number) {
  if (!win) return
  win.webContents.setZoomFactor(Math.min(Math.max(value, 0.2), 10))
  updateTitlebar(win)
}
