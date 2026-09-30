import { readFileSync } from "node:fs"
import { join } from "node:path"

const AUTH_ENTRY = "opencode-go"
const AUTH_FILE = "auth.json"
const API_KEY_ENV = "OPENCODE_API_KEY"
const AUTH_CONTENT_ENV = "OPENCODE_AUTH_CONTENT"

export interface ResolveInput {
  /** candidate opencode data directories, most specific first; each is checked for auth.json */
  dataDirs: readonly string[]
  /** explicit key from plugin options; wins over everything */
  option?: string | undefined
  env?: Record<string, string | undefined> | undefined
}

function readEntry(text: string): string | undefined {
  try {
    const stored = (JSON.parse(text) as Record<string, { key?: unknown }> | undefined)?.[AUTH_ENTRY]
    const key = stored?.key
    if (typeof key === "string" && key.trim()) return key
  } catch {
    // malformed auth content; treat as absent
  }
  return undefined
}

/**
 * Resolve the opencode-go key the way opencode does: explicit option first,
 * then the injectable auth env, then the on-disk auth store, then the
 * provider's env var. Returns undefined when no key is available.
 */
export function resolveApiKey(input: ResolveInput): string | undefined {
  const option = input.option?.trim()
  if (option) return option

  const env = input.env
  const injected = env?.[AUTH_CONTENT_ENV]
  if (injected) {
    const key = readEntry(injected)
    if (key) return key
  }

  for (const dir of input.dataDirs) {
    try {
      const key = readEntry(readFileSync(join(dir, AUTH_FILE), "utf8"))
      if (key) return key
    } catch {
      // not this directory; try the next candidate
    }
  }

  const fromEnv = env?.[API_KEY_ENV]?.trim()
  return fromEnv ? fromEnv : undefined
}
