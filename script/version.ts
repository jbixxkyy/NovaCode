#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const output = [`version=${Script.version}`]
const sha = process.env.GITHUB_SHA ?? (await $`git rev-parse HEAD`.text()).trim()

if (!Script.preview) {
  try {
    await $`bun script/changelog.ts --to ${sha}`.cwd(process.cwd())
    const file = `${process.cwd()}/UPCOMING_CHANGELOG.md`
    const body = await Bun.file(file)
      .text()
      .catch(() => "No notable changes")
    const dir = process.env.RUNNER_TEMP ?? "/tmp"
    const notesFile = `${dir}/novacode-release-notes.txt`
    await Bun.write(notesFile, body)
    await $`gh release create v${Script.version} -d --target ${sha} --title "NovaCode v${Script.version}" --notes-file ${notesFile} --repo ${process.env.GH_REPO}`
    const release = await $`gh release view v${Script.version} --json tagName,databaseId --repo ${process.env.GH_REPO}`.json()
    output.push(`release=${release.databaseId}`)
    output.push(`tag=${release.tagName}`)
  } catch (e) {
    console.warn("gh release create failed, continuing without draft:", e)
    // create a fake release id for downstream jobs to still package
    output.push(`release=0`)
    output.push(`tag=v${Script.version}`)
  }
} else if (Script.channel === "beta") {
  try {
    await $`gh release create v${Script.version} -d --title "NovaCode v${Script.version}" --repo ${process.env.GH_REPO}`
    const release =
      await $`gh release view v${Script.version} --json tagName,databaseId --repo ${process.env.GH_REPO}`.json()
    output.push(`release=${release.databaseId}`)
    output.push(`tag=${release.tagName}`)
  } catch (e) {
    console.warn("gh beta release failed:", e)
    output.push(`release=0`)
    output.push(`tag=v${Script.version}`)
  }
}

output.push(`repo=${process.env.GH_REPO}`)

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\n"))
}

process.exit(0)
