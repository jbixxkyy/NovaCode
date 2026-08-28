/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeNovacodeContent from "./skill/customize-novacode.md" with { type: "text" }

export const CustomizeNovacodeContent = customizeNovacodeContent
export const CustomizeNovacodeName = "customize-novacode"
export const CustomizeNovacodeDescription =
  "Use ONLY when the user is editing or creating NovaCode configuration: novacode.json, novacode.jsonc, files under .novacode/, or files under ~/.config/novacode/. Also use when creating or fixing NovaCode agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code."

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: CustomizeNovacodeName,
            description: CustomizeNovacodeDescription,
            location: AbsolutePath.make("/builtin/customize-novacode.md"),
            content: CustomizeNovacodeContent,
          }),
        }),
      )
    })
  }),
})
