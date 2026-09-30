import { createElement, insert, setProp } from "@opentui/solid"
import { createTextAttributes } from "@opentui/core"
import { createSignal } from "solid-js"
import type { JSX } from "@opentui/solid"
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import { dataDirs } from "./datadir.ts"
import { resolveApiKey } from "./key.ts"
import { barFor, formatReset, parseUsage, severity, type Severity, type UsageWindow } from "./usage.ts"

const USAGE_URL = "https://opencode.ai/zen/go/v1/usage"
const BAR_WIDTH = 10
const LABEL_WIDTH = 6
const PERCENT_WIDTH = 4
const BOLD = createTextAttributes({ bold: true })

type Child = JSX.Element | string | number | null | undefined | false
type Theme = Context["theme"]

interface State {
  windows: UsageWindow[]
  error: string | undefined
  loadedAt: number | undefined
}

function element(tag: string, props: Record<string, unknown>, children: Child[] = []): JSX.Element {
  const node = createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) setProp(node, key, value)
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) insert(node, child)
  }
  return node as unknown as JSX.Element
}

function text(props: Record<string, unknown>, children: Child[] = []): JSX.Element {
  return element("text", props, children)
}

function box(props: Record<string, unknown>, children: Child[] = []): JSX.Element {
  return element("box", props, children)
}

/** opencode keeps auth.json in its data dir: XDG_DATA_HOME, else ~/.local/share on
 *  every platform, and %APPDATA% on Windows. */
function authDirs(): string[] {
  return dataDirs({ platform: process.platform, env: process.env })
}

/** Severity band -> theme color, so the bar follows the active theme in both
 *  light and dark mode instead of hardcoding ANSI values. */
function barColor(theme: Theme, level: Severity): unknown {
  const feedback = theme.text.feedback
  if (level === "max") return feedback.error.base
  if (level === "high") return theme.increase(feedback.warning.base)
  if (level === "mid") return feedback.warning.base
  return feedback.success.base
}

function padEnd(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length)
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value
}

export default Plugin.define({
  id: "opencode-usage-go",
  async setup(context) {
    const refreshMs = typeof context.options.refreshMs === "number" ? context.options.refreshMs : 30_000
    const timeoutMs = typeof context.options.timeoutMs === "number" ? context.options.timeoutMs : 10_000
    // Options let the auth store be pointed somewhere else; without it we
    // derive opencode's own data dirs.
    const authDir =
      typeof context.options.dataDir === "string" && context.options.dataDir.trim()
        ? [context.options.dataDir.trim()]
        : authDirs()

    const [getState, setState] = createSignal<State>({ windows: [], error: undefined, loadedAt: undefined })
    let inFlight: AbortController | undefined

    async function refresh(): Promise<void> {
      inFlight?.abort()
      const controller = new AbortController()
      inFlight = controller
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const key = resolveApiKey({
          dataDirs: authDir,
          option: typeof context.options.apiKey === "string" ? context.options.apiKey : undefined,
          env: process.env,
        })
        if (!key) {
          setState((prev) => ({ ...prev, error: "no key" }))
          return
        }
        const response = await fetch(USAGE_URL, {
          headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 403) {
          setState((prev) => ({ ...prev, error: "auth" }))
          return
        }
        if (!response.ok) {
          setState((prev) => ({ ...prev, error: `http ${response.status}` }))
          return
        }
        const windows = parseUsage(await response.json(), Date.now())
        if (windows.length === 0) {
          setState((prev) => ({ ...prev, error: "empty" }))
          return
        }
        setState({ windows, error: undefined, loadedAt: Date.now() })
      } catch (cause) {
        if (controller.signal.aborted) return
        const message = cause instanceof Error ? cause.message : String(cause)
        setState((prev) => ({ ...prev, error: message.includes("abort") ? "timeout" : "offline" }))
      } finally {
        clearTimeout(timer)
        if (inFlight === controller) inFlight = undefined
      }
    }

    // Re-read the signal inside the slot so the host repaints when it changes.
    const tick = () => getState()

    function render(): JSX.Element {
      const state = tick()
      const theme = context.theme
      const rows: JSX.Element[] = [text({ fg: theme.text.base, attributes: BOLD }, ["OpenCode Go"])]

      if (state.error && state.windows.length === 0) {
        rows.push(
          text({ fg: theme.text.feedback.warning.muted }, [
            state.error === "no key" ? "no api key" : state.error === "auth" ? "auth failed" : `unavailable (${state.error})`,
          ]),
        )
        return box({ flexDirection: "column" }, rows)
      }

      const now = Date.now()
      for (const window of state.windows) {
        const color = barColor(theme, severity(window.percent))
        const detail = state.error ? "stale" : formatReset(window.resetInMs - (now - (state.loadedAt ?? now)))
        rows.push(
          box({ flexDirection: "row" }, [
            text({ fg: theme.text.muted }, [padEnd(window.label, LABEL_WIDTH)]),
            text({ fg: color }, [barFor(window.percent, BAR_WIDTH)]),
            text({ fg: theme.text.base }, [` ${padStart(`${Math.round(window.percent)}%`, PERCENT_WIDTH)}`]),
            text({ fg: theme.text.muted }, [` · ${detail}`]),
          ]),
        )
      }
      return box({ flexDirection: "column" }, rows)
    }

    const stopEvent = context.data.on("session.execution.succeeded", () => {
      void refresh()
    })
    const interval = setInterval(() => void refresh(), refreshMs)
    void refresh()

    const releaseSlot = context.ui.slot({ append: "sidebar.content", render: () => render() as JSX.Element })

    return () => {
      stopEvent()
      clearInterval(interval)
      inFlight?.abort()
      releaseSlot()
    }
  },
})
