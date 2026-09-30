import { Plugin } from "@opencode/plugin"

/**
 * This plugin has no server-side behaviour: everything happens in the terminal.
 * The server entry exists because a package listed in `opencode.json` is loaded
 * by the server first, and the CLI then picks up `./tui` from that same package.
 */
export default Plugin.define({
  id: "opencode-usage-go",
  setup() {},
})
