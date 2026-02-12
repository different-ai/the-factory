import { afterEach, describe, expect, it } from "vitest";

import { exportPackToTarget } from "../src/adapters/index.js";
import { setSecret } from "../src/core/secrets.js";
import type { IdentityPack } from "../src/core/types.js";
import { setupTempHome } from "./helpers.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    fn?.();
  }
});

function fixturePack(): IdentityPack {
  return {
    schema: "one-identity/v1",
    packId: "fixture",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accounts: {
      email: {
        provider: "agentmail",
        inboxId: "agent@agentmail.to",
        address: "agent@agentmail.to",
        apiKeyRef: "secret://fixture/agentmail/api_key",
      },
      telegram: {
        provider: "telegram",
        identityId: "default",
        botUsername: "oneclaw_bot",
        tokenRef: "secret://fixture/telegram/bot_token",
      },
      bitwarden: {
        provider: "bitwarden",
        accountEmail: "vault@example.com",
        vault: "oneclaw",
        itemRefs: ["bw://item/123"],
        sessionRef: "secret://fixture/bitwarden/session",
      },
    },
    targets: ["owpenbot", "openclaw", "nanoclaw"],
  };
}

describe("target adapters", () => {
  it("renders all targets with resolved secrets", () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    setSecret("fixture", "agentmail", "api_key", "am-key");
    setSecret("fixture", "telegram", "bot_token", "tg-token");
    setSecret("fixture", "bitwarden", "session", "bw-session");

    const pack = fixturePack();
    const owpenbot = exportPackToTarget(pack, "owpenbot");
    const openclaw = exportPackToTarget(pack, "openclaw");
    const nanoclaw = exportPackToTarget(pack, "nanoclaw");

    expect(owpenbot).toContain("agentmail");
    expect(owpenbot).toContain("am-key");
    expect(openclaw).toContain("agent@agentmail.to");
    expect(openclaw).toContain("tg-token");
    expect(nanoclaw).toContain("AGENTMAIL_API_KEY=am-key");
    expect(nanoclaw).toContain("BITWARDEN_SESSION=bw-session");
  });
});
