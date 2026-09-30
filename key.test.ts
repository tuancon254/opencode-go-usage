import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveApiKey } from "./key.ts"

function dataDir(auth: unknown | null): string {
  const dir = mkdtempSync(join(tmpdir(), "ocug-"))
  mkdirSync(join(dir, "opencode"), { recursive: true })
  if (auth !== null) writeFileSync(join(dir, "opencode", "auth.json"), JSON.stringify(auth))
  return dir
}

test("resolveApiKey reads the key from the opencode auth store", () => {
  const dir = dataDir({ "opencode-go": { type: "api", key: "sk-from-store" } })
  assert.equal(resolveApiKey({ dataDirs: [join(dir, "opencode")] }), "sk-from-store")
})

test("resolveApiKey prefers an explicit option over the store", () => {
  const dir = dataDir({ "opencode-go": { type: "api", key: "sk-from-store" } })
  const key = resolveApiKey({ dataDirs: [join(dir, "opencode")], option: "  sk-from-option  " })
  assert.equal(key, "sk-from-option")
})

test("resolveApiKey falls back to the env var", () => {
  const dir = dataDir(null)
  const key = resolveApiKey({ dataDirs: [join(dir, "opencode")], env: { OPENCODE_API_KEY: "sk-env" } })
  assert.equal(key, "sk-env")
})

test("resolveApiKey uses the env var when the store has no go entry", () => {
  const dir = dataDir({ openai: { type: "api", key: "sk-openai" } })
  const key = resolveApiKey({ dataDirs: [join(dir, "opencode")], env: { OPENCODE_API_KEY: "sk-env" } })
  assert.equal(key, "sk-env")
})

test("resolveApiKey returns undefined when nothing is available", () => {
  const dir = dataDir(null)
  assert.equal(resolveApiKey({ dataDirs: [join(dir, "opencode")] }), undefined)
})

test("resolveApiKey returns undefined when auth.json is malformed", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocug-"))
  mkdirSync(join(dir, "opencode"), { recursive: true })
  writeFileSync(join(dir, "opencode", "auth.json"), "{not json")
  assert.equal(resolveApiKey({ dataDirs: [join(dir, "opencode")] }), undefined)
})

test("resolveApiKey ignores a non-string key", () => {
  const dir = dataDir({ "opencode-go": { type: "api", key: 12345 } })
  assert.equal(resolveApiKey({ dataDirs: [join(dir, "opencode")] }), undefined)
})

test("resolveApiKey ignores a blank key", () => {
  const dir = dataDir({ "opencode-go": { type: "api", key: "   " } })
  assert.equal(resolveApiKey({ dataDirs: [join(dir, "opencode")] }), undefined)
})

test("resolveApiKey reads OPENCODE_AUTH_CONTENT when present", () => {
  const dir = dataDir(null)
  const key = resolveApiKey({
    dataDirs: [join(dir, "opencode")],
    env: { OPENCODE_AUTH_CONTENT: JSON.stringify({ "opencode-go": { key: "sk-injected" } }) },
  })
  assert.equal(key, "sk-injected")
})

test("resolveApiKey skips a missing directory and reads a later one", () => {
  const missing = join(mkdtempSync(join(tmpdir(), "ocug-")), "opencode")
  const real = join(dataDir({ "opencode-go": { type: "api", key: "sk-second" } }), "opencode")
  const key = resolveApiKey({ dataDirs: [missing, real] })
  assert.equal(key, "sk-second")
})

test("resolveApiKey handles an empty directory list", () => {
  assert.equal(resolveApiKey({ dataDirs: [] }), undefined)
})
