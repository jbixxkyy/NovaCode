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
### 2026-08-27 -- app-web-desktop-switch -- one-click web↔desktop session switch requires active-key switching not just add/remove
- Insight: Adding/removing the desktop sidecar server via `ServerConnection` is not enough; easy switching needs `server.setActive(key)` + `navigate("/")` to move the active ServerScope while preserving per-scope tabs/projects. Keeping both servers in the list preserves tabs (tabs.tsx filters by live server list) and avoids data loss; only explicit "Disconnect" should call `server.remove`.
- Evidence: `packages/app/src/components/settings-v2/servers.tsx:51`, `packages/app/src/context/server.tsx:310`, `packages/app/src/context/tabs.tsx:122`
- Applied: Implemented `DesktopConnectionSection` with web-only guard, health check before connect, `webKey` derived from `getWebServerUrl()`, and three actions: connect+activate, switchToDesktop/switchToWeb via setActive, and disconnect with fallback to web. Verified via desktop-discovery handler `packages/opencode/src/server/routes/instance/httpapi/handlers/global.ts:151`.

### 2026-08-27 -- app-persist-rebrand -- desktop discovery shares server via global file not via persisted list
- Insight: Web discovers desktop sidecar through a file at `~/.novacode/desktop-discovery.json` exposed via `GET /global/desktop-discovery`; the web's own server list is injected at startup (`entry.tsx:getCurrentUrl`) and scoped via `canonicalLocalServer` migration. This avoids polluting `novacode.global.dat` with ephemeral sidecar URLs and keeps ServerScope "local" stable.
- Evidence: `packages/desktop/src/main/index.ts:89`, `packages/opencode/src/server/routes/instance/httpapi/handlers/global.ts:151`, `packages/app/src/entry.tsx:104`
- Applied: Use `ServerScope.fromServerKey` with canonicalLocalServer so legacy `http://localhost:4096` buckets migrate to "local" and switching does not duplicate projects.
