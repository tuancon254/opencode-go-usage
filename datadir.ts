const OPENCODE_DIR = "opencode"

function normalize(dir: string): string {
  return dir.replace(/[\\/]+$/, "")
}

function push(dirs: string[], seen: Set<string>, dir: string | undefined) {
  if (!dir) return
  const trimmed = normalize(dir)
  if (!trimmed || seen.has(trimmed)) return
  seen.add(trimmed)
  dirs.push(trimmed)
}

export interface DataDirEnv {
  platform: NodeJS.Platform | string
  env: Record<string, string | undefined>
}

/**
 * Every directory opencode might keep `auth.json` in, most specific first.
 *
 * opencode stores its data under `~/.local/share/opencode` on *all* platforms
 * including Windows, so that path is checked before the Windows-native
 * `%APPDATA%`. Windows terminals (PowerShell) also leave `HOME` unset, so
 * `USERPROFILE` is used as the home directory there.
 */
export function dataDirs({ platform, env }: DataDirEnv): string[] {
  const dirs: string[] = []
  const seen = new Set<string>()

  push(dirs, seen, env.XDG_DATA_HOME ? `${normalize(env.XDG_DATA_HOME)}/${OPENCODE_DIR}` : undefined)

  const home = env.HOME || (platform === "win32" ? env.USERPROFILE : undefined)
  if (home) {
    push(dirs, seen, `${normalize(home)}/.local/share/${OPENCODE_DIR}`)
    // Older macOS installs used the Application Support location.
    push(dirs, seen, `${normalize(home)}/Library/Application Support/${OPENCODE_DIR}`)
  }

  if (platform === "win32") {
    push(dirs, seen, env.APPDATA ? `${normalize(env.APPDATA)}/${OPENCODE_DIR}` : undefined)
    if (!env.APPDATA && env.USERPROFILE) {
      push(dirs, seen, `${normalize(env.USERPROFILE)}/AppData/Roaming/${OPENCODE_DIR}`)
    }
  }

  return dirs
}
