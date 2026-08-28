import { Config } from "effect"
import { appEnv, appEnvTruthy, novaKey } from "../identity"

export function truthy(key: string) {
  const value = (key.startsWith("OPENCODE_") ? appEnv(key) : process.env[key])?.toLowerCase()
  return value === "true" || value === "1"
}

function enabledByExperimental(key: string) {
  const explicit = appEnv(key)
  if (explicit !== undefined) return appEnvTruthy(key)
  return appEnvTruthy("OPENCODE_EXPERIMENTAL")
}

function configBool(openCodeKey: string) {
  return Config.boolean(novaKey(openCodeKey)).pipe(
    Config.orElse(() => Config.boolean(openCodeKey)),
    Config.withDefault(false),
  )
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  OPENCODE_AUTO_HEAP_SNAPSHOT: appEnvTruthy("OPENCODE_AUTO_HEAP_SNAPSHOT"),
  OPENCODE_GIT_BASH_PATH: appEnv("OPENCODE_GIT_BASH_PATH"),
  OPENCODE_CONFIG: appEnv("OPENCODE_CONFIG"),
  OPENCODE_CONFIG_CONTENT: appEnv("OPENCODE_CONFIG_CONTENT"),
  OPENCODE_DISABLE_AUTOUPDATE: appEnvTruthy("OPENCODE_DISABLE_AUTOUPDATE"),
  OPENCODE_ALWAYS_NOTIFY_UPDATE: appEnvTruthy("OPENCODE_ALWAYS_NOTIFY_UPDATE"),
  OPENCODE_DISABLE_PRUNE: appEnvTruthy("OPENCODE_DISABLE_PRUNE"),
  OPENCODE_DISABLE_TERMINAL_TITLE: appEnvTruthy("OPENCODE_DISABLE_TERMINAL_TITLE"),
  OPENCODE_SHOW_TTFD: appEnvTruthy("OPENCODE_SHOW_TTFD"),
  OPENCODE_DISABLE_AUTOCOMPACT: appEnvTruthy("OPENCODE_DISABLE_AUTOCOMPACT"),
  OPENCODE_DISABLE_MODELS_FETCH: appEnvTruthy("OPENCODE_DISABLE_MODELS_FETCH"),
  OPENCODE_DISABLE_MOUSE: appEnvTruthy("OPENCODE_DISABLE_MOUSE"),
  OPENCODE_FAKE_VCS: appEnv("OPENCODE_FAKE_VCS"),
  OPENCODE_SERVER_PASSWORD: appEnv("OPENCODE_SERVER_PASSWORD"),
  OPENCODE_SERVER_USERNAME: appEnv("OPENCODE_SERVER_USERNAME"),
  OPENCODE_DISABLE_FFF:
    appEnv("OPENCODE_DISABLE_FFF") === undefined ? process.platform === "win32" : appEnvTruthy("OPENCODE_DISABLE_FFF"),

  OPENCODE_EXPERIMENTAL_FILEWATCHER: configBool("OPENCODE_EXPERIMENTAL_FILEWATCHER"),
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: configBool("OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER"),
  OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    appEnv("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT") === undefined
      ? process.platform === "win32"
      : appEnvTruthy("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  OPENCODE_MODELS_URL: appEnv("OPENCODE_MODELS_URL"),
  OPENCODE_MODELS_PATH: appEnv("OPENCODE_MODELS_PATH"),
  OPENCODE_DB: appEnv("OPENCODE_DB"),
  get OPENCODE_DISABLE_CHANNEL_DB() {
    return appEnvTruthy("OPENCODE_DISABLE_CHANNEL_DB")
  },

  OPENCODE_WORKSPACE_ID: appEnv("OPENCODE_WORKSPACE_ID"),
  OPENCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("OPENCODE_EXPERIMENTAL_WORKSPACES"),

  get OPENCODE_DISABLE_PROJECT_CONFIG() {
    return appEnvTruthy("OPENCODE_DISABLE_PROJECT_CONFIG")
  },
  get OPENCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("OPENCODE_EXPERIMENTAL_REFERENCES")
  },
  get OPENCODE_TUI_CONFIG() {
    return appEnv("OPENCODE_TUI_CONFIG")
  },
  get OPENCODE_CONFIG_DIR() {
    return appEnv("OPENCODE_CONFIG_DIR")
  },
  get OPENCODE_PURE() {
    return appEnvTruthy("OPENCODE_PURE")
  },
  get OPENCODE_PERMISSION() {
    return appEnv("OPENCODE_PERMISSION")
  },
  get OPENCODE_PLUGIN_META_FILE() {
    return appEnv("OPENCODE_PLUGIN_META_FILE")
  },
  get OPENCODE_CLIENT() {
    return appEnv("OPENCODE_CLIENT") ?? "cli"
  },
}
