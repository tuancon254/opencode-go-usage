export type WindowId = "rolling" | "weekly" | "monthly"

export interface UsageWindow {
  id: WindowId
  label: string
  percent: number
  resetInMs: number
}

export type Severity = "low" | "mid" | "high" | "max"

const WINDOW_ORDER: WindowId[] = ["rolling", "weekly", "monthly"]

const WINDOW_LABELS: Record<WindowId, string> = {
  rolling: "5h",
  weekly: "Week",
  monthly: "Month",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

/**
 * Parse the opencode-go usage payload. Windows are returned in a stable order
 * and a window is kept only when the response reports a complete, healthy one.
 */
export function parseUsage(data: unknown, now: number): UsageWindow[] {
  if (!isRecord(data)) return []
  const usage = data.usage
  if (!isRecord(usage)) return []

  const result: UsageWindow[] = []
  for (const id of WINDOW_ORDER) {
    const raw = usage[id]
    if (!isRecord(raw)) continue
    if (raw.status !== "ok") continue

    const percent = raw.percent
    if (typeof percent !== "number" || !Number.isFinite(percent)) continue

    const resetAt = typeof raw.resetsAt === "string" ? Date.parse(raw.resetsAt) : Number.NaN
    if (!Number.isFinite(resetAt)) continue

    result.push({
      id,
      label: WINDOW_LABELS[id],
      percent: clampPercent(percent),
      resetInMs: resetAt - now,
    })
  }
  return result
}

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** Countdown to a reset, rounded down to the minute. */
export function formatReset(resetInMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(resetInMs / MINUTE))
  if (totalMinutes * MINUTE < DAY) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`
  }
  const days = Math.floor(totalMinutes / 60 / 24)
  const hours = Math.floor(totalMinutes / 60) % 24
  return `${days}d ${hours}h`
}

const EMPTY = "░"
const FILLED = "█"

/** A fixed-width bar whose filled count is proportional to `percent`. */
export function barFor(percent: number, width: number): string {
  const filled = Math.round((clampPercent(percent) / 100) * width)
  return FILLED.repeat(filled) + EMPTY.repeat(width - filled)
}

/** Severity band for a percentage, used to pick the bar color. */
export function severity(percent: number): Severity {
  if (percent >= 100) return "max"
  if (percent >= 75) return "high"
  if (percent >= 50) return "mid"
  return "low"
}
