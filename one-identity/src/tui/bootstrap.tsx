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
  installOpenwork: boolean;
  installOpenclaw: boolean;
  installNanoclaw: boolean;
};

export type BootstrapTuiResult = {
  cancelled: boolean;
  draft: BootstrapDraft;
};

type BootstrapTuiInput = {
  profile: string;
  packId: string;
  initial: BootstrapDraft;
  demo?: boolean;
};

type FieldKey = "agentmailApiKey" | "telegramBotToken" | "bitwardenEmail" | "bitwardenPassword";
type TargetKey = "installOpenwork" | "installOpenclaw" | "installNanoclaw";

type StepDef = {
  title: string;
  subtitle: string;
};

const steps: StepDef[] = [
  { title: "Credentials", subtitle: "Secure provider keys" },
  { title: "Install Targets", subtitle: "Where to apply identity" },
  { title: "Review", subtitle: "Inspect generated state" },
  { title: "Actions", subtitle: "Save or install" },
];

const fields: Array<{ key: FieldKey; label: string; secret: boolean; placeholder: string }> = [
  { key: "agentmailApiKey", label: "AgentMail API key", secret: true, placeholder: "sk_..." },
  { key: "telegramBotToken", label: "Telegram bot token", secret: true, placeholder: "123456:AA..." },
  { key: "bitwardenEmail", label: "Bitwarden email", secret: false, placeholder: "you@example.com" },
  { key: "bitwardenPassword", label: "Bitwarden password", secret: true, placeholder: "********" },
];

const targets: Array<{ key: TargetKey; label: string; detail: string }> = [
  { key: "installOpenwork", label: "OpenWork", detail: "OpenWork config" },
  { key: "installOpenclaw", label: "OpenClaw", detail: "openclaw config" },
  { key: "installNanoclaw", label: "NanoClaw", detail: "env export" },
];

const actions = ["Save only", "Install selected"] as const;

const theme = {
  bg: RGBA.fromInts(14, 16, 22),
  card: RGBA.fromInts(24, 28, 37),
  cardSoft: RGBA.fromInts(20, 23, 31),
  text: RGBA.fromInts(241, 244, 248),
  muted: RGBA.fromInts(150, 156, 171),
  accent: RGBA.fromInts(91, 197, 255),
  active: RGBA.fromInts(182, 233, 255),
  ok: RGBA.fromInts(102, 224, 151),
  warn: RGBA.fromInts(253, 205, 111),
  danger: RGBA.fromInts(255, 130, 130),
  chipOff: RGBA.fromInts(44, 34, 39),
  chipOn: RGBA.fromInts(36, 72, 54),
  chipFocus: RGBA.fromInts(39, 58, 85),
  chipPressed: RGBA.fromInts(81, 138, 193),
};

const demoValues: Record<FieldKey, string> = {
  agentmailApiKey: "am_demo_sk_live_8f3m2q1z4",
  telegramBotToken: "7312459901:AAH_demo_token_x8c4",
  bitwardenEmail: "founder+demo@oneclaw.dev",
  bitwardenPassword: "Oneclaw!Demo!2026",
};

function mask(value: string): string {
  if (!value) return "<unset>";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function stepMark(current: number, index: number): string {
  if (index < current) return "DONE";
  if (index === current) return "LIVE";
  return "NEXT";
}

function speedScale(): number {
  const raw = process.env.ONECLAW_DEMO_SPEED?.trim();
  if (!raw) return 3.4;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3.4;
  return parsed;
}

function selectedTargets(draft: BootstrapDraft): string[] {
  const out: string[] = [];
  if (draft.installOpenwork) out.push("OpenWork");
  if (draft.installOpenclaw) out.push("OpenClaw");
  if (draft.installNanoclaw) out.push("NanoClaw");
  return out;
}

export function startBootstrapTui(input: BootstrapTuiInput): Promise<BootstrapTuiResult> {
  return new Promise<BootstrapTuiResult>((resolve) => {
    let done = false;
    let inputNode: InputRenderable | undefined;

    const finish = (renderer: ReturnType<typeof useRenderer>, result: BootstrapTuiResult) => {
      if (done) return;
      done = true;
      renderer.destroy();
      resolve(result);
    };

    render(
      () => {
        const renderer = useRenderer();
        const dimensions = useTerminalDimensions();
        renderer.disableStdoutInterception();

        const [state, setState] = createStore({
          step: 0,
          fieldIndex: 0,
          targetIndex: 0,
          actionIndex: 0,
          pressedTarget: null as TargetKey | null,
          pressedAction: null as number | null,
          editing: true,
          note: input.demo
            ? "Demo: cinematic mode enabled. Auto-driving the wizard..."
            : "Step 1: choose field with Up/Down, press Enter to edit.",
          draft: {
            ...input.initial,
          },
        });

        const [now, setNow] = createSignal(Date.now());
        const ticker = setInterval(() => setNow(Date.now()), 1000);
        onCleanup(() => clearInterval(ticker));

        const step = createMemo(() => steps[state.step] || steps[0]);
        const activeField = createMemo(() => fields[state.fieldIndex] || fields[0]);
        const targetList = createMemo(() => selectedTargets(state.draft));

        const progress = createMemo(() => Math.round(((state.step + 1) / steps.length) * 100));
        const progressBar = createMemo(() => {
          const width = 24;
          const fill = Math.max(0, Math.min(width, Math.round((progress() / 100) * width)));
          return `[${"█".repeat(fill)}${"░".repeat(width - fill)}]`;
        });

        const setStep = (next: number) => {
          const clamped = Math.max(0, Math.min(steps.length - 1, next));
          setState("step", clamped);
          if (clamped !== 0) {
            setState("editing", false);
            inputNode?.blur();
          }
        };

        const readField = (key: FieldKey): string => {
          if (key === "agentmailApiKey") return state.draft.agentmailApiKey;
          if (key === "telegramBotToken") return state.draft.telegramBotToken;
          if (key === "bitwardenEmail") return state.draft.bitwardenEmail;
          return state.draft.bitwardenPassword;
        };

        const writeField = (key: FieldKey, value: string) => {
          if (key === "agentmailApiKey") {
            setState("draft", "agentmailApiKey", value);
            return;
          }
          if (key === "telegramBotToken") {
            setState("draft", "telegramBotToken", value);
            return;
          }
          if (key === "bitwardenEmail") {
            setState("draft", "bitwardenEmail", value);
            return;
          }
          setState("draft", "bitwardenPassword", value);
        };

        const toggleTarget = (key: TargetKey) => {
          if (key === "installOpenwork") {
            setState("draft", "installOpenwork", !state.draft.installOpenwork);
            return;
          }
          if (key === "installOpenclaw") {
            setState("draft", "installOpenclaw", !state.draft.installOpenclaw);
            return;
          }
          setState("draft", "installNanoclaw", !state.draft.installNanoclaw);
        };

        const pulseTarget = (key: TargetKey) => {
          setState("pressedTarget", key);
          toggleTarget(key);
          setTimeout(() => {
            if (done) return;
            setState("pressedTarget", null);
          }, 130);
        };

        const pulseAction = (actionIndex: number, install: boolean) => {
          setState("actionIndex", actionIndex);
          setState("pressedAction", actionIndex);
          setTimeout(() => {
            if (done) return;
            triggerSave(install);
          }, 110);
          setTimeout(() => {
            if (done) return;
            setState("pressedAction", null);
          }, 160);
        };

        const triggerSave = (install: boolean) => {
          const next = {
            ...state.draft,
            runProvision: install,
          };
          setState("draft", "runProvision", install);
          setState("note", install ? "Install started. Persisting setup..." : "Saving profile state...");
          setTimeout(() => finish(renderer, { cancelled: false, draft: next }), 140);
        };

        onMount(() => {
          if (!input.demo) return;
          const timers: Array<ReturnType<typeof setTimeout>> = [];
          const scale = speedScale();
          let clock = 420;
          const wait = (ms: number) => Math.max(65, Math.round(ms * scale));
          const schedule = (fn: () => void, ms: number) => {
            clock += ms;
            timers.push(
              setTimeout(() => {
                if (done) return;
                fn();
              }, clock),
            );
          };

          for (let i = 0; i < fields.length; i += 1) {
            const field = fields[i];
            schedule(() => {
              setStep(0);
              setState("fieldIndex", i);
              setState("editing", true);
              writeField(field.key, "");
              setState("note", `Demo typing ${field.label}`);
              inputNode?.focus();
            }, wait(180));

            const target = demoValues[field.key];
            for (let j = 1; j <= target.length; j += 1) {
              const part = target.slice(0, j);
              schedule(() => writeField(field.key, part), wait(22));
            }

            schedule(() => setState("note", `${field.label} completed`), wait(120));
          }

          schedule(() => {
            setState("draft", "bitwardenSignupDone", true);
            setState("note", "Demo toggled signup confirmation");
          }, wait(180));

          schedule(() => {
            setStep(1);
            setState("note", "Demo moved to install targets");
          }, wait(220));

          for (let i = 0; i < targets.length; i += 1) {
            const target = targets[i];
            schedule(() => {
              setState("targetIndex", i);
              if (!state.draft[target.key]) {
                pulseTarget(target.key);
              } else {
                setState("pressedTarget", target.key);
                setTimeout(() => {
                  if (done) return;
                  setState("pressedTarget", null);
                }, 130);
              }
              setState("note", `Demo pressed ${target.label} button`);
            }, wait(190));
          }

          schedule(() => {
            setStep(2);
            setState("note", "Demo reviewing setup");
          }, wait(260));

          schedule(() => {
            setStep(3);
            setState("actionIndex", 1);
            setState("note", "Demo ready to install");
          }, wait(260));

          schedule(() => {
            setState("note", "Demo pressed INSTALL");
            pulseAction(1, true);
          }, wait(380));

          onCleanup(() => {
            for (const timer of timers) clearTimeout(timer);
          });
        });

        useKeyboard((event: KeyEvent) => {
          if (event.ctrl && event.name === "c") {
            event.preventDefault();
            finish(renderer, { cancelled: true, draft: { ...state.draft } });
            return;
          }

          if (state.step === 0 && state.editing) {
            if (event.name === "escape") {
              event.preventDefault();
              setState("editing", false);
              inputNode?.blur();
              setState("note", "Stopped editing");
              return;
            }
            if (event.name === "tab") {
              event.preventDefault();
              const next = (state.fieldIndex + 1) % fields.length;
              setState("fieldIndex", next);
              setState("note", `Editing ${fields[next]?.label || "field"}`);
              return;
            }
            if (event.name === "enter") {
              event.preventDefault();
              setState("editing", false);
              inputNode?.blur();
              setState("note", "Stopped editing");
              return;
            }
            return;
          }

          if (event.name === "q") {
            event.preventDefault();
            finish(renderer, { cancelled: true, draft: { ...state.draft } });
            return;
          }

            if (event.name === "s") {
              event.preventDefault();
              pulseAction(0, false);
              return;
            }

            if (event.name === "i") {
              event.preventDefault();
              pulseAction(1, true);
              return;
            }

          if (event.name === "n") {
            event.preventDefault();
            setStep(state.step + 1);
            setState("note", `Moved to step ${Math.min(steps.length, state.step + 2)} of ${steps.length}`);
            return;
          }

          if (event.name === "b") {
            event.preventDefault();
            setStep(state.step - 1);
            setState("note", `Moved to step ${Math.max(1, state.step)} of ${steps.length}`);
            return;
          }

          if (state.step === 0) {
            if (event.name === "up") {
              event.preventDefault();
              setState("fieldIndex", (state.fieldIndex - 1 + fields.length) % fields.length);
              return;
            }
            if (event.name === "down") {
              event.preventDefault();
              setState("fieldIndex", (state.fieldIndex + 1) % fields.length);
              return;
            }
            if (event.name === "enter" || event.name === "e") {
              event.preventDefault();
              setState("editing", true);
              setState("note", `Editing ${activeField()?.label || "field"}`);
              setTimeout(() => inputNode?.focus(), 1);
            }
            return;
          }

          if (state.step === 1) {
            if (event.name === "left") {
              event.preventDefault();
              setState("targetIndex", (state.targetIndex - 1 + targets.length) % targets.length);
              return;
            }
            if (event.name === "right") {
              event.preventDefault();
              setState("targetIndex", (state.targetIndex + 1) % targets.length);
              return;
            }
            if (event.name === "enter" || event.name === "space") {
              event.preventDefault();
              const key = targets[state.targetIndex]?.key;
              if (!key) return;
              pulseTarget(key);
              setState("note", `${targets[state.targetIndex]?.label || "Target"} toggled`);
              return;
            }
          }

          if (state.step === 3) {
            if (event.name === "left") {
              event.preventDefault();
              setState("actionIndex", (state.actionIndex - 1 + actions.length) % actions.length);
              return;
            }
            if (event.name === "right") {
              event.preventDefault();
              setState("actionIndex", (state.actionIndex + 1) % actions.length);
              return;
            }
            if (event.name === "enter" || event.name === "space") {
              event.preventDefault();
              pulseAction(state.actionIndex, state.actionIndex === 1);
            }
          }
        });

        const sideWidth = Math.max(36, Math.floor(dimensions().width * 0.33));
        const contentWidth = Math.max(54, dimensions().width - sideWidth - 6);
        const bodyHeight = Math.max(14, dimensions().height - 8);

        return (
          <box flexDirection="column" width={dimensions().width} height={dimensions().height} backgroundColor={theme.bg} paddingLeft={2} paddingRight={2}>
            <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} backgroundColor={theme.cardSoft} flexDirection="row" justifyContent="space-between">
              <box flexDirection="column">
                <text fg={theme.text} attributes={TextAttributes.BOLD}>ONECLAW BOOTSTRAP EXPERIENCE</text>
                <text fg={theme.muted}>profile {input.profile}    pack {input.packId}</text>
              </box>
              <box flexDirection="column" alignItems="flex-end">
                <text fg={theme.accent}>{new Date(now()).toLocaleTimeString()}</text>
                <For each={input.demo ? ["DEMO"] : []}>
                  {(tag: string) => <text fg={theme.warn}>{tag}</text>}
                </For>
              </box>
            </box>

            <box paddingLeft={2} paddingRight={2} paddingTop={1} flexDirection="row" gap={1}>
              <For each={steps}>
                {(item: StepDef, index) => {
                  const active = index() === state.step;
                  const complete = index() < state.step;
                  return (
                    <box
                      backgroundColor={active ? theme.chipFocus : complete ? theme.chipOn : theme.cardSoft}
                      paddingLeft={1}
                      paddingRight={1}
                      onMouseUp={() => {
                        setStep(index());
                        setState("note", `Moved to step ${index() + 1} of ${steps.length}`);
                      }}
                    >
                      <text fg={active ? theme.active : complete ? theme.ok : theme.muted}>{index() + 1}. {item.title}</text>
                    </box>
                  );
                }}
              </For>
            </box>

            <box paddingTop={1} flexDirection="row" gap={2} height={bodyHeight}>
              <box width={sideWidth} backgroundColor={theme.card} paddingLeft={1} paddingRight={1} paddingTop={1} flexDirection="column" gap={1}>
                <text fg={theme.text} attributes={TextAttributes.BOLD}>Progress</text>
                <text fg={theme.accent}>{progressBar()} {progress()}%</text>
                <For each={steps}>
                  {(item: StepDef, index) => {
                    const active = index() === state.step;
                    const complete = index() < state.step;
                    return (
                      <box backgroundColor={active ? theme.chipFocus : complete ? theme.chipOn : theme.cardSoft} paddingLeft={1} paddingRight={1}>
                        <text fg={active ? theme.active : complete ? theme.ok : theme.muted}>{stepMark(state.step, index())}  {index() + 1}. {item.title}</text>
                      </box>
                    );
                  }}
                </For>
                <box paddingTop={1} flexDirection="column" gap={1}>
                  <text fg={theme.muted}>Selected targets</text>
                  <text fg={state.draft.installOpenwork ? theme.ok : theme.muted}>OpenWork {state.draft.installOpenwork ? "ON" : "OFF"}</text>
                  <text fg={state.draft.installOpenclaw ? theme.ok : theme.muted}>OpenClaw {state.draft.installOpenclaw ? "ON" : "OFF"}</text>
                  <text fg={state.draft.installNanoclaw ? theme.ok : theme.muted}>NanoClaw {state.draft.installNanoclaw ? "ON" : "OFF"}</text>
                </box>
              </box>

              <box width={contentWidth} backgroundColor={theme.card} paddingLeft={2} paddingRight={2} paddingTop={1} flexDirection="column" gap={1}>
                <text fg={theme.active} attributes={TextAttributes.BOLD}>STEP {state.step + 1} / {steps.length}  {step().title}</text>
                <text fg={theme.muted}>{step().subtitle}</text>

                <For each={state.step === 0 ? ["credentials"] : []}>
                  {() => (
                    <box flexDirection="column" gap={1}>
                      <For each={fields}>
                        {(field, index) => {
                          const selected = index() === state.fieldIndex;
                          const value = field.secret ? mask(readField(field.key)) : readField(field.key) || "<unset>";
                          return (
                            <box
                              backgroundColor={selected ? theme.chipFocus : theme.cardSoft}
                              paddingLeft={1}
                              paddingRight={1}
                              onMouseUp={() => {
                                setState("fieldIndex", index());
                                setState("editing", true);
                                setState("note", `Editing ${field.label}`);
                                setTimeout(() => inputNode?.focus(), 1);
                              }}
                            >
                              <text fg={selected ? theme.active : theme.text}>{selected ? ">" : " "} {field.label}: {value}</text>
                            </box>
                          );
                        }}
                      </For>
                      <box backgroundColor={theme.bg} paddingLeft={1} paddingRight={1}>
                        <input
                          focused={state.step === 0 && state.editing}
                          value={readField(activeField().key)}
                          placeholder={activeField().placeholder}
                          onInput={(value: string) => {
                            writeField(activeField().key, value);
                            setState("note", `${activeField().label} updated`);
                          }}
                          ref={(node: InputRenderable) => {
                            inputNode = node;
                            if (state.step === 0 && state.editing) {
                              setTimeout(() => inputNode?.focus(), 1);
                            }
                          }}
                        />
                      </box>
                      <text fg={theme.muted}>Controls: Up/Down select • Enter edit • Esc stop editing</text>
                    </box>
                  )}
                </For>

                <For each={state.step === 1 ? ["targets"] : []}>
                  {() => (
                    <box flexDirection="column" gap={1}>
                      <box flexDirection="row" gap={1}>
                        <For each={targets}>
                          {(target, index) => {
                            const focused = index() === state.targetIndex;
                            const enabled = state.draft[target.key];
                            const pressed = state.pressedTarget === target.key;
                            return (
                              <box
                                backgroundColor={pressed ? theme.chipPressed : focused ? theme.chipFocus : enabled ? theme.chipOn : theme.chipOff}
                                paddingLeft={1}
                                paddingRight={1}
                                onMouseUp={() => {
                                  setState("targetIndex", index());
                                  pulseTarget(target.key);
                                  setState("note", `${target.label} toggled`);
                                }}
                              >
                                <text fg={pressed ? theme.active : enabled ? theme.ok : theme.text}>{target.label} {enabled ? "ON" : "OFF"}</text>
                              </box>
                            );
                          }}
                        </For>
                      </box>
                      <For each={targets}>
                        {(target) => <text fg={theme.muted}>- {target.label}: {target.detail}</text>}
                      </For>
                      <text fg={targetList().length ? theme.ok : theme.warn}>Selected: {targetList().length ? targetList().join(", ") : "none"}</text>
                      <text fg={theme.muted}>Controls: Left/Right focus • Enter toggle</text>
                    </box>
                  )}
                </For>

                <For each={state.step === 2 ? ["review"] : []}>
                  {() => (
                    <box flexDirection="column" gap={1}>
                      <box backgroundColor={theme.cardSoft} paddingLeft={1} paddingRight={1}><text fg={theme.text}>AgentMail   {mask(state.draft.agentmailApiKey)}</text></box>
                      <box backgroundColor={theme.cardSoft} paddingLeft={1} paddingRight={1}><text fg={theme.text}>Telegram    {mask(state.draft.telegramBotToken)}</text></box>
                      <box backgroundColor={theme.cardSoft} paddingLeft={1} paddingRight={1}><text fg={theme.text}>Bitwarden   {state.draft.bitwardenEmail || "<unset>"}</text></box>
                      <box backgroundColor={theme.cardSoft} paddingLeft={1} paddingRight={1}><text fg={theme.text}>Password    {mask(state.draft.bitwardenPassword)}</text></box>
                      <box backgroundColor={theme.cardSoft} paddingLeft={1} paddingRight={1}>
                        <text fg={state.draft.bitwardenSignupDone ? theme.ok : theme.warn}>Signup done {state.draft.bitwardenSignupDone ? "true" : "false"}</text>
                      </box>
                      <box backgroundColor={theme.cardSoft} paddingLeft={1} paddingRight={1}>
                        <text fg={targetList().length ? theme.ok : theme.warn}>Targets     {targetList().length ? targetList().join(", ") : "none"}</text>
                      </box>
                    </box>
                  )}
                </For>

                <For each={state.step === 3 ? ["actions"] : []}>
                  {() => (
                    <box flexDirection="column" gap={1}>
                      <box flexDirection="row" gap={1}>
                        <For each={actions}>
                          {(label, index) => (
                            <box
                              backgroundColor={index() === state.pressedAction ? theme.chipPressed : index() === state.actionIndex ? theme.chipFocus : theme.cardSoft}
                              paddingLeft={2}
                              paddingRight={2}
                              onMouseUp={() => pulseAction(index(), index() === 1)}
                            >
                              <text fg={index() === state.pressedAction ? theme.active : index() === state.actionIndex ? theme.active : theme.muted}>{label}</text>
                            </box>
                          )}
                        </For>
                      </box>
                      <box backgroundColor={state.actionIndex === 1 ? theme.chipOn : theme.cardSoft} paddingLeft={2} paddingRight={2}>
                        <text fg={state.actionIndex === 1 ? theme.ok : theme.text}>INSTALL SELECTED TARGETS</text>
                      </box>
                      <text fg={state.draft.runProvision ? theme.ok : theme.muted}>Install state: {state.draft.runProvision ? "pressed" : "idle"}</text>
                      <text fg={theme.muted}>Controls: Left/Right choose • Enter execute</text>
                    </box>
                  )}
                </For>
              </box>
            </box>

            <box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} backgroundColor={theme.cardSoft} flexDirection="row" justifyContent="space-between">
              <text fg={state.note.toLowerCase().includes("error") ? theme.danger : theme.ok}>{state.note}</text>
              <text fg={theme.muted}>[N] next  [B] back  [I] install  [S] save  [Q] quit</text>
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
