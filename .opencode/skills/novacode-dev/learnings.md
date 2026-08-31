# novacode-dev Learnings

Accumulated non-obvious learnings captured by the `novacode-dev` skill. Read this at the start of every invocation. Append new entries at the end -- never rewrite history.

Format per entry:
```md
### YYYY-MM-DD -- <scope> -- <one-line summary>
- Insight: <non-obvious fact>
- Evidence: `path:line`
- Applied: <how to use next time>
```

---
### 2026-08-31 -- bun-global-install-from-workspace -- use `bun link`, not `bun install -g`, for workspace-local CLI bins
- Insight: `bun install --global <path>` treats the path as a package name and tries to resolve it from npm (404 on `packages/<name>`). `bun install -g .` from inside the workspace fails with "refusing to install dependency with unsafe name" because the package name starts with `@opencode-ai/` (scoped). The working pattern is: (1) `cd packages/<pkg>` then `bun link` to register the global name, then (2) `bun link <pkg>` once anywhere to materialize the bin on PATH. On Windows the bin is shimmed as `<name>.exe` in `~/.bun/bin/` and resolves via `Get-Command` even though `Test-Path` (without `.exe`) returns false.
- Evidence: `packages/telegram/bin/novatelagram.ts:1`, `packages/telegram/package.json` (`bin` field)
- Applied: For future workspace CLI bins (e.g. `nova-tui`), declare the `bin` field and use `bun link`/`bun link <pkg>`. Don't try `bun install -g`.

### 2026-08-27 -- app-web-desktop-switch -- one-click web↔desktop session switch requires active-key switching not just add/remove
- Insight: Adding/removing the desktop sidecar server via `ServerConnection` is not enough; easy switching needs `server.setActive(key)` + `navigate("/")` to move the active ServerScope while preserving per-scope tabs/projects. Keeping both servers in the list preserves tabs (tabs.tsx filters by live server list) and avoids data loss; only explicit "Disconnect" should call `server.remove`.
- Evidence: `packages/app/src/components/settings-v2/servers.tsx:51`, `packages/app/src/context/server.tsx:310`, `packages/app/src/context/tabs.tsx:122`
- Applied: Implemented `DesktopConnectionSection` with web-only guard, health check before connect, `webKey` derived from `getWebServerUrl()`, and three actions: connect+activate, switchToDesktop/switchToWeb via setActive, and disconnect with fallback to web. Verified via desktop-discovery handler `packages/opencode/src/server/routes/instance/httpapi/handlers/global.ts:151`.

### 2026-08-27 -- app-persist-rebrand -- desktop discovery shares server via global file not via persisted list
- Insight: Web discovers desktop sidecar through a file at `~/.novacode/desktop-discovery.json` exposed via `GET /global/desktop-discovery`; the web's own server list is injected at startup (`entry.tsx:getCurrentUrl`) and scoped via `canonicalLocalServer` migration. This avoids polluting `novacode.global.dat` with ephemeral sidecar URLs and keeps ServerScope "local" stable.
- Evidence: `packages/desktop/src/main/index.ts:89`, `packages/opencode/src/server/routes/instance/httpapi/handlers/global.ts:151`, `packages/app/src/entry.tsx:104`
- Applied: Use `ServerScope.fromServerKey` with canonicalLocalServer so legacy `http://localhost:4096` buckets migrate to "local" and switching does not duplicate projects.

### 2026-08-31 -- telegram-bot-commands-and-tool-updates -- enhance /model to display current and available models, and auto-delete completed tool update messages
- Insight: Telegram bot commands can fetch available providers and models via `client.config.providers()`, and transient tool call notifications can be cleaned up automatically using `setTimeout` with `bot.api.deleteMessage()`.
- Evidence: `packages/telegram/src/commands.ts:117`, `packages/telegram/src/tool-updates.ts:31`
- Applied: Use `client.config.providers()` in bot commands for interactive model selection display, and auto-delete temporary status messages to keep Telegram chat clean.
