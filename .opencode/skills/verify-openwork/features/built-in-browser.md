# Built-in browser input and layout

A user can keep editing a page in OpenWork's built-in browser while resizing, zooming, switching tabs, hiding panels and moving between conversations, without a stale viewport or native view painted over the wrong conversation.

## Sub-features

- `browser-recover`: returning to a tab resets retained viewport emulation.
- `browser-resize`: browser bounds follow panel/window resizing and 90–120% app zoom.
- `browser-input`: typed input survives layout changes in the same document.
- `browser-overlay`: dialogs and hidden panels do not leave a browser view on top.
- `browser-chat-isolation`: neighboring chats do not display the owning chat's browser; reopening restores it.

## How to get to it (user POV)

- In the prepared conversation's side panel, choose the first viewport-probe browser tab, then the other tab and back.
- Resize using the visible panel separator and app zoom controls exercised by the spec.
- Type into the local fixture page textbox.
- Close/open the side panel, open the command palette and toggle the sidebar, then visit another conversation and return.

## Driving it with @openwork/testkit

Preconditions:

- Native Electron, isolated workspace/session and native browser pane. Headless Chrome cannot prove BrowserView geometry or native input routing.
- `browser-panel.ts` worlds prepare only local pages: a deterministic data URL with a textbox/button for geometry, and the owned local server URL for recovery. No external site or model/Den service is needed.
- The recovery world intentionally leaves a 1440×900 CDP viewport override as a fault witness before input; do not bypass the tab-switch recovery by clearing it manually.

```sh
pnpm -C _repos/openwork evals:e2e browser-panel-viewport-recovery --local --engine v1 --surface electron
```

- **Recover.** Click `{ role: "button", label: /^Select tab: .*viewport-probe=first$/ }` as the existing spec directs. Read `probe.browserState()` and `probe.browserTabMetrics(targetId)` for the returned tab: emulation must converge to the actual visible panel viewport.
- **Type.** Bind `user.on(page)` to the world's child browser surface; `user.on(page).type({ role: "textbox" }, "Keep this browser input through layout changes")` types the spec's exact draft. Read the page afterward: exact input text, URL/title and `performance.timeOrigin` remain unchanged by layout changes.
- **Resize/zoom.** Use `{ role: "separator" }` with trusted keyboard input from the spec and app zoom. `probe.zoom()` and `probe.dom` observe the rendered app; native/browser bounds match container bounds within one DIP for three consecutive samples within five seconds.
- **Overlay and restore.** Use `{ role: "button", label: "Close side panel" }`, `{ role: "button", label: "Open side panel" }`, command-palette `{ placeholder: "Search actions and settings…" }` and `{ role: "option", label: /^Toggle sidebar/ }`. The browser must not paint over dialogs/closed panels or a neighboring conversation. Return to the owner and type again in its retained page.
- **Observe geometry.** The current source projection is `[data-slot="resizable-panel"]:has(button[aria-label="Reload page"]) .relative.min-h-0.flex-1.overflow-hidden > .h-full.overflow-hidden`. It is a read-only measurement selector, not the user entry point. Save the existing JSON geometry/focus evidence alongside action/result screenshots when producing a complete visual proof.

## Gotchas

- Source: `evals/specs/browser-panel-viewport-recovery.e2e.test.ts`, `evals/worlds/browser-panel.ts`. The command runs two journeys; report each result/count, not just the file's exit code.
- Do not replace fixture pages with the user's browser tabs or navigate to live websites. This proves native layout/input continuity, not authentication or external browser profiles.
- Existing spec records explicit machine assertions and geometry/focus JSON but no explicit screenshots. Add screenshots through testkit before claiming the full visual evidence standard; geometry alone does not show the user action/result.
- Initial skill-generation proof does not execute this map. Missing child surface/native browser support is a blocker, not permission to emulate it in a plain web tab.
