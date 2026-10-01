/**
 * Server entrypoint. This plugin has no server-side behaviour: everything
 * happens in the terminal, in `tui.ts`.
 *
 * The entry exists because a package listed in `opencode.json` is loaded by the
 * server before the CLI picks up its `./tui` export. Without it the server has
 * no `.` entrypoint to load and the plugin never appears.
 *
 * `Plugin.define` from `@opencode/plugin` is the identity function
 * (`define(plugin) { return plugin }`), so this object is already the shape the
 * server expects. Importing it would pull the whole `@opencode/plugin` tree
 * (~200MB once installed) for a no-op; OpenCode injects the TUI imports
 * itself, so nothing here needs to resolve at install time.
 */
export default {
  id: "opencode-usage-go",
  setup() {},
}
