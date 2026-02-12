import { RGBA, TextAttributes, type InputRenderable, type KeyEvent } from "@opentui/core";
import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { For, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { createStore } from "solid-js/store";

export type BootstrapDraft = {
  agentmailApiKey: string;
  telegramBotToken: string;
  bitwardenEmail: string;
  bitwardenPassword: string;
  bitwardenSignupDone: boolean;
  runProvision: boolean;
};

export type BootstrapTuiResult = {
  cancelled: boolean;
  draft: BootstrapDraft;
};

type ActiveField = "agentmailApiKey" | "telegramBotToken" | "bitwardenEmail" | "bitwardenPassword";

type BootstrapTuiInput = {
  profile: string;
  packId: string;
  initial: BootstrapDraft;
  demo?: boolean;
};

const theme = {
  text: RGBA.fromInts(235, 235, 235),
  textMuted: RGBA.fromInts(150, 150, 160),
  accent: RGBA.fromInts(120, 180, 255),
  success: RGBA.fromInts(90, 210, 140),
  warning: RGBA.fromInts(240, 200, 90),
  panel: RGBA.fromInts(28, 28, 32),
};

function mask(value: string): string {
  if (!value) return "<unset>";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function fieldTitle(field: ActiveField): string {
  if (field === "agentmailApiKey") return "AgentMail API key";
  if (field === "telegramBotToken") return "Telegram bot token";
  if (field === "bitwardenEmail") return "Bitwarden email";
  return "Bitwarden password";
}

function readDraft(draft: BootstrapDraft, field: ActiveField): string {
  if (field === "agentmailApiKey") return draft.agentmailApiKey;
  if (field === "telegramBotToken") return draft.telegramBotToken;
  if (field === "bitwardenEmail") return draft.bitwardenEmail;
  return draft.bitwardenPassword;
}

const demoValues: Record<ActiveField, string> = {
  agentmailApiKey: "am_demo_sk_live_8f3m2q1z4",
  telegramBotToken: "7312459901:AAH_demo_token_x8c4",
  bitwardenEmail: "founder+demo@oneclaw.dev",
  bitwardenPassword: "Oneclaw!Demo!2026",
};

export function startBootstrapTui(input: BootstrapTuiInput): Promise<BootstrapTuiResult> {
  return new Promise<BootstrapTuiResult>((resolve) => {
    let finishDone = false;
    let inputNode: InputRenderable | undefined;

    const finish = (renderer: ReturnType<typeof useRenderer>, result: BootstrapTuiResult) => {
      if (finishDone) return;
      finishDone = true;
      renderer.destroy();
      resolve(result);
    };

    render(
      () => {
        const renderer = useRenderer();
        const dimensions = useTerminalDimensions();
        renderer.disableStdoutInterception();

        const [state, setState] = createStore({
          active: "agentmailApiKey" as ActiveField,
          editing: true,
          note: input.demo ? "Demo mode active: auto-filling..." : "Enter values then press S to save.",
          draft: {
            ...input.initial,
          },
        });

        const writeDraft = (field: ActiveField, value: string) => {
          if (field === "agentmailApiKey") {
            setState("draft", "agentmailApiKey", value);
            return;
          }
          if (field === "telegramBotToken") {
            setState("draft", "telegramBotToken", value);
            return;
          }
          if (field === "bitwardenEmail") {
            setState("draft", "bitwardenEmail", value);
            return;
          }
          setState("draft", "bitwardenPassword", value);
        };

        const [now, setNow] = createSignal(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 1000);
        onCleanup(() => clearInterval(interval));

        onMount(() => {
          if (!input.demo) return;
          const timers: Array<ReturnType<typeof setTimeout>> = [];
          let clock = 160;
          const schedule = (fn: () => void, delta: number) => {
            clock += delta;
            timers.push(
              setTimeout(() => {
                if (finishDone) return;
                fn();
              }, clock),
            );
          };

          const fields: ActiveField[] = ["agentmailApiKey", "telegramBotToken", "bitwardenEmail", "bitwardenPassword"];
          for (const field of fields) {
            schedule(() => {
              setState("active", field);
              setState("editing", true);
              setState("note", `Demo typing ${fieldTitle(field)}...`);
              writeDraft(field, "");
              inputNode?.focus();
            }, 180);

            const value = demoValues[field];
            for (let i = 1; i <= value.length; i += 1) {
              const partial = value.slice(0, i);
              schedule(() => {
                writeDraft(field, partial);
              }, 24);
            }

            schedule(() => {
              setState("note", `${fieldTitle(field)} auto-filled`);
            }, 140);
          }

          schedule(() => {
            setState("draft", "bitwardenSignupDone", true);
            setState("note", "Demo set bitwarden.signup_done=true");
          }, 220);

          schedule(() => {
            setState("draft", "runProvision", true);
            setState("note", "Demo set run_provision=true");
          }, 180);

          schedule(() => {
            setState("editing", false);
            inputNode?.blur();
            setState("note", "Demo complete. Auto-saving now...");
          }, 220);

          schedule(() => {
            finish(renderer, { cancelled: false, draft: { ...state.draft } });
          }, 450);

          onCleanup(() => {
            for (const timer of timers) {
              clearTimeout(timer);
            }
          });
        });

        const rows = createMemo(() => [
          { hotkey: "1", label: "AgentMail API key", value: mask(state.draft.agentmailApiKey) },
          { hotkey: "2", label: "Telegram bot token", value: mask(state.draft.telegramBotToken) },
          { hotkey: "3", label: "Bitwarden email", value: state.draft.bitwardenEmail || "<unset>" },
          { hotkey: "4", label: "Bitwarden password", value: mask(state.draft.bitwardenPassword) },
          { hotkey: "5", label: "Bitwarden signup done", value: state.draft.bitwardenSignupDone ? "true" : "false" },
          { hotkey: "P", label: "Run provision after save", value: state.draft.runProvision ? "true" : "false" },
        ]);

        useKeyboard((event: KeyEvent) => {
          if (event.ctrl && event.name === "c") {
            event.preventDefault();
            finish(renderer, { cancelled: true, draft: { ...state.draft } });
            return;
          }

          if (event.name === "q") {
            event.preventDefault();
            finish(renderer, { cancelled: true, draft: { ...state.draft } });
            return;
          }

          if (event.name === "s") {
            event.preventDefault();
            finish(renderer, { cancelled: false, draft: { ...state.draft } });
            return;
          }

          if (event.name === "1") {
            event.preventDefault();
            setState("active", "agentmailApiKey");
            setState("editing", true);
            setTimeout(() => inputNode?.focus(), 1);
            return;
          }

          if (event.name === "2") {
            event.preventDefault();
            setState("active", "telegramBotToken");
            setState("editing", true);
            setTimeout(() => inputNode?.focus(), 1);
            return;
          }

          if (event.name === "3") {
            event.preventDefault();
            setState("active", "bitwardenEmail");
            setState("editing", true);
            setTimeout(() => inputNode?.focus(), 1);
            return;
          }

          if (event.name === "4") {
            event.preventDefault();
            setState("active", "bitwardenPassword");
            setState("editing", true);
            setTimeout(() => inputNode?.focus(), 1);
            return;
          }

          if (event.name === "5") {
            event.preventDefault();
            setState("draft", "bitwardenSignupDone", !state.draft.bitwardenSignupDone);
            return;
          }

          if (event.name === "p") {
            event.preventDefault();
            setState("draft", "runProvision", !state.draft.runProvision);
            return;
          }

          if (event.name === "escape") {
            event.preventDefault();
            setState("editing", false);
            inputNode?.blur();
          }
        });

        return (
          <box flexDirection="column" width={dimensions().width} height={dimensions().height} paddingLeft={2} paddingRight={2}>
            <box paddingTop={1} flexDirection="row" justifyContent="space-between">
              <text fg={theme.text} attributes={TextAttributes.BOLD}>oneclaw bootstrap</text>
              <text fg={theme.textMuted}>{new Date(now()).toLocaleTimeString()}</text>
            </box>
            <text fg={theme.textMuted}>profile: {input.profile} | pack: {input.packId}</text>

            <For each={input.demo ? ["ONECLAW_DEMO=1"] : []}>
              {(tag) => (
                <text fg={theme.accent}>mode: {tag}</text>
              )}
            </For>

            <box paddingTop={1} flexDirection="column" gap={1}>
              <For each={rows()}>
                {(row) => (
                  <box flexDirection="row" gap={2}>
                    <text fg={theme.accent}>[{row.hotkey}]</text>
                    <text fg={theme.text}>{row.label}</text>
                    <text fg={theme.textMuted}>{row.value}</text>
                  </box>
                )}
              </For>
            </box>

            <box paddingTop={1}>
              <text fg={theme.warning}>Active field: {fieldTitle(state.active)}</text>
            </box>

            <box paddingTop={1} backgroundColor={theme.panel}>
              <input
                focused={state.editing}
                value={readDraft(state.draft, state.active)}
                placeholder="Type value and press Enter"
                onInput={(value: string) => {
                  if (state.active === "agentmailApiKey") {
                    writeDraft("agentmailApiKey", value);
                    setState("note", "AgentMail API key updated");
                    return;
                  }
                  if (state.active === "telegramBotToken") {
                    writeDraft("telegramBotToken", value);
                    setState("note", "Telegram token updated");
                    return;
                  }
                  if (state.active === "bitwardenEmail") {
                    writeDraft("bitwardenEmail", value);
                    setState("note", "Bitwarden email updated");
                    return;
                  }
                  writeDraft("bitwardenPassword", value);
                  setState("note", "Bitwarden password updated");
                }}
                ref={(node: InputRenderable) => {
                  inputNode = node;
                  setTimeout(() => inputNode?.focus(), 1);
                }}
              />
            </box>

            <box paddingTop={1}>
              <text fg={theme.success}>{state.note}</text>
            </box>

            <box paddingTop={1}>
              <text fg={theme.textMuted}>Actions: [1-4] edit field  [5] toggle signup done  [P] toggle run provision  [S] save  [Q] quit</text>
            </box>
          </box>
        );
      },
      {
        targetFps: 30,
        gatherStats: false,
        exitOnCtrlC: false,
        useMouse: true,
        autoFocus: false,
      },
    );
  });
}
