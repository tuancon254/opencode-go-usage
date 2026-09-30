import { test } from "node:test"
import assert from "node:assert/strict"
import { dataDirs } from "./datadir.ts"

test("dataDirs includes ~/.local/share/opencode on win32", () => {
  // This machine stores auth.json under ~/.local/share even though it is Windows.
  const dirs = dataDirs({
    platform: "win32",
    env: { USERPROFILE: "C:/Users/me", HOME: "C:/Users/me", APPDATA: "C:/Users/me/AppData/Roaming" },
  })
  assert.ok(
    dirs.some((d) => d.replace(/\\/g, "/").endsWith("/me/.local/share/opencode")),
    `expected ~/.local/share/opencode, got ${JSON.stringify(dirs)}`,
  )
})

test("dataDirs includes %APPDATA%\\opencode on win32", () => {
  const dirs = dataDirs({
    platform: "win32",
    env: { USERPROFILE: "C:/Users/me", HOME: "C:/Users/me", APPDATA: "C:/Users/me/AppData/Roaming" },
  })
  assert.ok(
    dirs.some((d) => d.replace(/\\/g, "/").endsWith("/AppData/Roaming/opencode")),
    `expected APPDATA/opencode, got ${JSON.stringify(dirs)}`,
  )
})

test("dataDirs puts XDG_DATA_HOME first when set", () => {
  const dirs = dataDirs({
    platform: "linux",
    env: { XDG_DATA_HOME: "/custom/data", HOME: "/home/me" },
  })
  assert.equal(dirs[0], "/custom/data/opencode")
})

test("dataDirs uses ~/.local/share on darwin", () => {
  const dirs = dataDirs({ platform: "darwin", env: { HOME: "/Users/me" } })
  assert.equal(dirs[0], "/Users/me/.local/share/opencode")
})

test("dataDirs includes the Library fallback for older mac installs", () => {
  const dirs = dataDirs({ platform: "darwin", env: { HOME: "/Users/me" } })
  assert.ok(dirs.some((d) => d.includes("Library/Application Support")), JSON.stringify(dirs))
})

test("dataDirs falls back to USERPROFILE when HOME is unset on win32", () => {
  // PowerShell leaves HOME empty; USERPROFILE is the reliable variable there.
  const dirs = dataDirs({ platform: "win32", env: { USERPROFILE: "C:/Users/me" } })
  assert.ok(
    dirs.some((d) => d.replace(/\\/g, "/").endsWith("/me/.local/share/opencode")),
    JSON.stringify(dirs),
  )
})

test("dataDirs never repeats a directory", () => {
  const dirs = dataDirs({
    platform: "win32",
    env: { HOME: "C:/Users/me", USERPROFILE: "C:/Users/me", APPDATA: "C:/Users/me" },
  })
  assert.equal(new Set(dirs).size, dirs.length, `duplicates in ${JSON.stringify(dirs)}`)
})

test("dataDirs returns an empty list when there is no home to work from", () => {
  assert.deepEqual(dataDirs({ platform: "linux", env: {} }), [])
})
