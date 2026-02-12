import { afterEach, describe, expect, it } from "vitest";

import { setConfigValue } from "../src/core/config.js";
import { resolveProvisionOptions } from "../src/core/provision-options.js";
import { setupTempHome } from "./helpers.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    fn?.();
  }
});

describe("resolveProvisionOptions", () => {
  it("loads defaults from config and allows flag overrides", () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    setConfigValue({ profile: "default", key: "agentmail.api_key", value: "sk-from-config", secret: true });
    setConfigValue({ profile: "default", key: "telegram.bot_token", value: "tg-from-config", secret: true });
    setConfigValue({ profile: "default", key: "bitwarden.email", value: "founder@example.com" });
    setConfigValue({ profile: "default", key: "bitwarden.password", value: "pw-from-config", secret: true });
    setConfigValue({ profile: "default", key: "bitwarden.signup_done", value: "true" });

    const resolved = resolveProvisionOptions({
      profile: "default",
      useConfig: true,
      options: {
        telegramBotToken: "tg-override",
      },
    });

    expect(resolved.agentmailApiKey).toBe("sk-from-config");
    expect(resolved.telegramBotToken).toBe("tg-override");
    expect(resolved.bitwardenEmail).toBe("founder@example.com");
    expect(resolved.bitwardenPassword).toBe("pw-from-config");
    expect(resolved.bitwardenSkipSignup).toBe(true);
  });
});
