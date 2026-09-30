import { test } from "node:test"
import assert from "node:assert/strict"
import { parseUsage, formatReset, barFor, severity, type Usage } from "./usage.ts"

const NOW = Date.parse("2026-09-30T12:00:00Z")

test("parseUsage reads the three windows in order", () => {
  const usage = parseUsage(
    {
      usage: {
        rolling: { status: "ok", percent: 0, resetsAt: "2026-09-30T13:39:19Z" },
        weekly: { status: "ok", percent: 25, resetsAt: "2026-10-05T00:00:00Z" },
        monthly: { status: "ok", percent: 12, resetsAt: "2026-10-25T15:13:56Z" },
      },
    },
    NOW,
  )
  assert.deepEqual(usage.map((w) => w.id), ["rolling", "weekly", "monthly"])
  assert.deepEqual(usage.map((w) => w.percent), [0, 25, 12])
})

test("parseUsage returns empty when usage key is missing", () => {
  assert.deepEqual(parseUsage({ hello: "world" }, NOW), [])
})

test("parseUsage returns empty when usage is not an object", () => {
  assert.deepEqual(parseUsage({ usage: "nope" }, NOW), [])
})

test("parseUsage drops a window whose status is not ok", () => {
  const usage = parseUsage(
    {
      usage: {
        rolling: { status: "ok", percent: 5, resetsAt: "2026-09-30T13:00:00Z" },
        weekly: { status: "error", percent: 50, resetsAt: "2026-10-05T00:00:00Z" },
        monthly: { status: "ok", percent: 12, resetsAt: "2026-10-25T00:00:00Z" },
      },
    },
    NOW,
  )
  assert.deepEqual(usage.map((w) => w.id), ["rolling", "monthly"])
})

test("parseUsage drops a window with a non-numeric percent", () => {
  const usage = parseUsage(
    {
      usage: {
        rolling: { status: "ok", percent: "lots", resetsAt: "2026-09-30T13:00:00Z" },
        weekly: { status: "ok", percent: 25, resetsAt: "2026-10-05T00:00:00Z" },
        monthly: { status: "ok", percent: 12, resetsAt: "2026-10-25T00:00:00Z" },
      },
    },
    NOW,
  )
  assert.deepEqual(usage.map((w) => w.id), ["weekly", "monthly"])
})

test("parseUsage clamps percent above 100 and below 0", () => {
  const usage = parseUsage(
    {
      usage: {
        rolling: { status: "ok", percent: 140, resetsAt: "2026-09-30T13:00:00Z" },
        weekly: { status: "ok", percent: -5, resetsAt: "2026-10-05T00:00:00Z" },
        monthly: { status: "ok", percent: 12, resetsAt: "2026-10-25T00:00:00Z" },
      },
    },
    NOW,
  )
  assert.equal(usage[0].percent, 100)
  assert.equal(usage[1].percent, 0)
})

test("parseUsage computes resetInMs from resetsAt", () => {
  const [rolling] = parseUsage(
    { usage: { rolling: { status: "ok", percent: 0, resetsAt: "2026-09-30T13:39:19Z" } } },
    NOW,
  )
  assert.equal(rolling.resetInMs, Date.parse("2026-09-30T13:39:19Z") - NOW)
})

test("parseUsage drops a window with an unparseable resetsAt", () => {
  const usage = parseUsage(
    {
      usage: {
        rolling: { status: "ok", percent: 5, resetsAt: "whenever" },
        weekly: { status: "ok", percent: 25, resetsAt: "2026-10-05T00:00:00Z" },
        monthly: { status: "ok", percent: 12, resetsAt: "2026-10-25T00:00:00Z" },
      },
    },
    NOW,
  )
  assert.deepEqual(usage.map((w) => w.id), ["weekly", "monthly"])
})

test("parseUsage handles non-object input", () => {
  assert.deepEqual(parseUsage(null, NOW), [])
  assert.deepEqual(parseUsage("nope", NOW), [])
  assert.deepEqual(parseUsage(42, NOW), [])
})

test("formatReset renders hours and minutes under a day", () => {
  assert.equal(formatReset(0), "0m")
  assert.equal(formatReset(90_000), "1m")
  assert.equal(formatReset(3_600_000), "1h 0m")
  assert.equal(formatReset(5_400_000), "1h 30m")
})

test("formatReset renders days and hours at a day or more", () => {
  assert.equal(formatReset(86_400_000), "1d 0h")
  assert.equal(formatReset(100 * 3_600_000), "4d 4h")
})

test("formatReset clamps negative time to 0m", () => {
  assert.equal(formatReset(-5_000), "0m")
})

test("barFor fills in proportion to percent across the width", () => {
  assert.equal(barFor(0, 10), "░░░░░░░░░░")
  assert.equal(barFor(100, 10), "█".repeat(10))
  assert.equal(barFor(50, 10), "█".repeat(5) + "░".repeat(5))
})

test("barFor rounds the filled count and clamps out-of-range percent", () => {
  assert.equal(barFor(25, 10), "███" + "░".repeat(7))
  assert.equal(barFor(-10, 10), "░░░░░░░░░░")
  assert.equal(barFor(200, 10), "█".repeat(10))
})

test("severity crosses thresholds at 50, 75 and 100", () => {
  assert.equal(severity(0), "low")
  assert.equal(severity(49.9), "low")
  assert.equal(severity(50), "mid")
  assert.equal(severity(74.9), "mid")
  assert.equal(severity(75), "high")
  assert.equal(severity(99.9), "high")
  assert.equal(severity(100), "max")
})
