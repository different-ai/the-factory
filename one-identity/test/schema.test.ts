import { describe, expect, it } from "vitest";

import { validatePack } from "../src/core/schema.js";

describe("identity pack schema", () => {
  it("accepts agentmail + telegram + bitwarden pack", () => {
    const pack = validatePack({
      schema: "one-identity/v1",
      packId: "demo",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accounts: {
        email: {
          provider: "agentmail",
          inboxId: "hello@agentmail.to",
          address: "hello@agentmail.to",
          apiKeyRef: "secret://demo/agentmail/api_key",
        },
        telegram: {
          provider: "telegram",
          identityId: "demo",
          botUsername: "demo_bot",
          tokenRef: "secret://demo/telegram/bot_token",
        },
        bitwarden: {
          provider: "bitwarden",
          accountEmail: "demo@example.com",
          vault: "oneclaw",
          itemRefs: ["bw://item/abc"],
          sessionRef: "secret://demo/bitwarden/session",
        },
      },
      targets: ["owpenbot", "openclaw", "nanoclaw"],
    });

    expect(pack.packId).toBe("demo");
    expect(pack.accounts.email?.provider).toBe("agentmail");
  });
});
