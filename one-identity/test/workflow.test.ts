import { afterEach, describe, expect, it, vi } from "vitest";

import { createRunState } from "../src/core/run-state.js";
import type { IdentityPack } from "../src/core/types.js";
import { buildTelegramWorkflow } from "../src/providers/telegram.js";
import { runProviderWorkflow } from "../src/core/workflow.js";
import { setupTempHome } from "./helpers.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    fn?.();
  }
  vi.restoreAllMocks();
});

function packFixture(): IdentityPack {
  return {
    schema: "one-identity/v1",
    packId: "wf",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accounts: {},
    targets: [],
  };
}

describe("workflow runner", () => {
  it("blocks when required input is missing", async () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    const run = createRunState("wf");
    const pack = packFixture();
    const result = await runProviderWorkflow({
      workflow: buildTelegramWorkflow(),
      run,
      pack,
      options: {},
      nonInteractive: true,
      ask: async () => undefined,
      log: () => {},
    });

    expect(result.status).toBe("blocked");
    expect(result.blockedStepId).toBe("telegram-create-bot");
  });

  it("completes telegram workflow with valid token", async () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            result: { id: 123, username: "fixture_bot" },
          }),
          { status: 200 },
        ),
      ),
    );

    const run = createRunState("wf");
    const pack = packFixture();
    const result = await runProviderWorkflow({
      workflow: buildTelegramWorkflow(),
      run,
      pack,
      options: {
        telegramBotToken: "123:abc",
      },
      nonInteractive: true,
      ask: async () => undefined,
      log: () => {},
    });

    expect(result.status).toBe("completed");
    expect(pack.accounts.telegram?.botUsername).toBe("fixture_bot");
  });
});
