# Prompt recall across desktop restarts

A user in a long conversation can recall previous sent prompts with the arrow keys after reload or a real app restart. Unsent edits and neighboring conversations must not inherit or lose the wrong draft.

## Sub-features

- `recall-last`: ArrowUp recalls the last and penultimate sent prompts.
- `recall-clear`: ArrowDown past the most recent prompt returns to an empty composer.
- `recall-reload`: recall survives two renderer reloads.
- `recall-restart`: recall survives an actual Electron main-process relaunch.
- `recall-draft`: a typed unsent draft is not overwritten by history navigation.
- `recall-isolation`: an unrelated conversation has no prompts from its neighbor.

## How to get to it (user POV)

- Select Long conversation in the sidebar; focus the empty composer and press ArrowUp/ArrowDown.
- Reload the app and repeat in the same conversation.
- After restarting OpenWork, reopen that conversation and repeat.
- Type an unsent draft and use history navigation; then open Unrelated short task and check its empty history.

## Driving it with @openwork/testkit

Preconditions:

- Native Electron **v1** fixture `composerPromptHistory` with 150 persisted prompts and a separate empty conversation.
- World arrangement writes engine messages with `noReply: true` before the first act. These are persisted fixtures, not 150 model calls or evidence that a model answered.
- No Den, model credentials or personal history. The world owns the restarted app and its cleanup.

```sh
pnpm -C _repos/openwork evals:e2e composer-prompt-history --local --engine v1 --surface electron
```

- **Open.** Click `{ role: "button", label: /^Long conversation/ }`; see editable `"composer"`. The well-known target resolves to `[contenteditable="true"][data-lexical-editor="true"]`.
- **Recall and clear.** Click `"composer"`; trusted `user.press("ArrowUp")` twice recalls the last prompt and then `user.see("composer", { text: "Stored history message 149 of 150." })`. The last prompt is the spec's imported `longHistoryLast` constant. ArrowDown twice clears it. Screenshot recalled values at each boot.
- **Reload.** `user.reload()` twice, waiting for the editable composer each time; repeat recall and clearing. Persisted recall, not just the last rendered text, must remain correct.
- **Restart.** The existing world calls the native shell relaunch rail, reattaches CDP and requires changed `performance.timeOrigin` within 90 seconds; repeat recall. Do not quit or relaunch an installed desktop manually.
- **Preserve draft.** Type `user.type("composer", "Keep this unsent draft")`; reload; arrow navigation must not overwrite it. Screenshot it.
- **Separate chats.** Click `{ role: "button", label: /^Unrelated short task/ }`; ArrowUp leaves its composer empty and the neighboring prompt is not displayed. This negative check is required, not optional.

## Gotchas

- Source: `evals/specs/composer-prompt-history.e2e.test.ts`, `evals/worlds/composer-prompt-history.ts`, and the `chat.ts` prompt-history world. Use the literal fixture prompts/assertions there; do not substitute personal conversation text.
- Headless reload proof cannot certify native main-process restart. The world explicitly handles the relaunched browser and waits for CDP to disappear before deleting profile state.
- The existing spec has screenshots but lacks explicit assertion-evidence lines under the newer proof contract. Add evidence through the existing testkit if a complete review verdict is required; a test exit alone does not certify it.
- This map is source-grounded, not executed by the initial skill-generation proof. A missing populated history or unsupported engine is an unmet precondition, not a reason to shorten the journey to one prompt.
