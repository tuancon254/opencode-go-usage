import { test } from "node:test"
import assert from "node:assert/strict"
import { testRender } from "@opentui/solid"
import plugin from "./tui.ts"

const THEME = {
  text: {
    base: "#ffffff",
    muted: "#888888",
    feedback: {
      error: { base: "#ff0000", muted: "#aa0000" },
      warning: { base: "#ffaa00", muted: "#885500" },
      success: { base: "#00ff00", muted: "#00aa00" },
      info: { base: "#0000ff", muted: "#0000aa" },
    },
  },
  increase: (color: unknown) => color,
} as any

/** Real payload shape from https://opencode.ai/zen/go/v1/usage, captured 2026-09-30. */
const PAYLOAD = {
  usage: {
    rolling: { status: "ok", percent: 0, resetsAt: new Date(Date.now() + 99 * 60_000).toISOString() },
    weekly: { status: "ok", percent: 25, resetsAt: new Date(Date.now() + 4 * 86_400_000).toISOString() },
    monthly: { status: "ok", percent: 12, resetsAt: new Date(Date.now() + 24 * 86_400_000).toISOString() },
  },
}

function makeContext(options: Record<string, unknown>) {
  const claims: any[] = []
  const context = {
    options,
    app: { version: "2.0.20", channel: "test" },
    location: undefined,
    theme: THEME,
    renderer: { requestRender() {} },
    client: {},
    data: {
      on() {
        return () => {}
      },
    },
    ui: {
      slot(claim: any) {
        claims.push(claim)
        return () => {
          const i = claims.indexOf(claim)
          if (i >= 0) claims.splice(i, 1)
        }
      },
    },
  } as any
  return { context, claims }
}

test("setup claims sidebar.content and cleanup releases it", async () => {
  const { context, claims } = makeContext({ apiKey: "sk-test", refreshMs: 600_000, dataDir: "C:/nonexistent" })
  const cleanup = await plugin.setup(context, {} as any)
  try {
    assert.equal(claims.length, 1)
    assert.equal(claims[0].append, "sidebar.content")
    assert.equal(typeof claims[0].render, "function")
  } finally {
    await cleanup?.()
  }
  assert.equal(claims.length, 0, "cleanup must release the slot")
})

test("sidebar draws the three windows with their real percentages", async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify(PAYLOAD), { status: 200 })) as typeof fetch
  const { context, claims } = makeContext({ apiKey: "sk-test", refreshMs: 600_000, dataDir: "C:/nonexistent" })
  const cleanup = await plugin.setup(context, {} as any)
  let app: Awaited<ReturnType<typeof testRender>> | undefined
  try {
    app = await testRender(() => claims[0].render({ sessionID: "ses_test" }), { width: 60, height: 12 })
    await app.waitFor(() => app!.captureCharFrame().includes("25%"), { maxPasses: 200 })
    const frame = app.captureCharFrame()
    assert.match(frame, /OpenCode Go/)
    assert.match(frame, /5h\s+░{10}\s+0%/) // rolling at 0% is an empty bar
    assert.match(frame, /Week\s+███░{7}\s+25%/) // 25% of 10 cells
    assert.match(frame, /Month\s+█░{9}\s+12%/) // 12% of 10 cells rounds to 1
    assert.match(frame, /·\s+\d+m|·\s+\d+d/) // a reset countdown is shown
  } finally {
    await cleanup?.()
    await app?.renderer.destroy?.()
    globalThis.fetch = original
  }
})

test("a 401 renders an auth failure line instead of numbers", async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response("nope", { status: 401 })) as typeof fetch
  const { context, claims } = makeContext({ apiKey: "sk-bad", refreshMs: 600_000, dataDir: "C:/nonexistent" })
  const cleanup = await plugin.setup(context, {} as any)
  let app: Awaited<ReturnType<typeof testRender>> | undefined
  try {
    app = await testRender(() => claims[0].render({ sessionID: "ses_test" }), { width: 60, height: 12 })
    await app.waitFor(() => app!.captureCharFrame().includes("auth failed"), { maxPasses: 200 })
    const frame = app.captureCharFrame()
    assert.match(frame, /auth failed/)
    assert.doesNotMatch(frame, /%/)
  } finally {
    await cleanup?.()
    await app?.renderer.destroy?.()
    globalThis.fetch = original
  }
})

test("a missing api key renders a no-key line and never calls the API", async () => {
  const original = globalThis.fetch
  let called = false
  globalThis.fetch = (async () => {
    called = true
    return new Response(JSON.stringify(PAYLOAD), { status: 200 })
  }) as typeof fetch
  const { context, claims } = makeContext({ apiKey: "   ", refreshMs: 600_000, dataDir: "C:/nonexistent-opencode-store" })
  const cleanup = await plugin.setup(context, {} as any)
  let app: Awaited<ReturnType<typeof testRender>> | undefined
  try {
    app = await testRender(() => claims[0].render({ sessionID: "ses_test" }), { width: 60, height: 12 })
    await app.waitFor(() => app!.captureCharFrame().includes("no api key"), { maxPasses: 200 })
    assert.equal(called, false, "must not call the API without a key")
  } finally {
    await cleanup?.()
    await app?.renderer.destroy?.()
    globalThis.fetch = original
  }
})
