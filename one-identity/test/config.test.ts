import { afterEach, describe, expect, it } from "vitest";

import { checkConfig, getConfigValue, listConfig, setConfigValue, unsetConfigValue } from "../src/core/config.js";
import { setupTempHome } from "./helpers.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    fn?.();
  }
});

describe("config state API", () => {
  it("sets and retrieves secret/non-secret keys", () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    setConfigValue({ profile: "default", key: "bitwarden.email", value: "founder@example.com" });
    setConfigValue({ profile: "default", key: "telegram.bot_token", value: "123:abc", secret: true });

    const email = getConfigValue({ profile: "default", key: "bitwarden.email", reveal: true });
    const tokenHidden = getConfigValue({ profile: "default", key: "telegram.bot_token" });
    const tokenShown = getConfigValue({ profile: "default", key: "telegram.bot_token", reveal: true });

    expect(email?.value).toBe("founder@example.com");
    expect(tokenHidden?.value).not.toBe("123:abc");
    expect(tokenShown?.value).toBe("123:abc");
  });

  it("checks provider requirements and unsets keys", () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    setConfigValue({ profile: "default", key: "agentmail.api_key", value: "sk-abc", secret: true });
    setConfigValue({ profile: "default", key: "telegram.bot_token", value: "123:abc", secret: true });
    setConfigValue({ profile: "default", key: "bitwarden.email", value: "founder@example.com" });
    setConfigValue({ profile: "default", key: "bitwarden.password", value: "pw-123", secret: true });
    setConfigValue({ profile: "default", key: "bitwarden.signup_done", value: "true" });

    const before = checkConfig({ profile: "default", providers: ["agentmail", "telegram", "bitwarden"] });
    expect(before.ready).toBe(true);

    const unset = unsetConfigValue({ profile: "default", key: "telegram.bot_token" });
    expect(unset.removed).toBe(true);

    const after = checkConfig({ profile: "default", providers: ["agentmail", "telegram", "bitwarden"] });
    expect(after.ready).toBe(false);
    expect(after.missing).toContain("telegram.bot_token");

    const listed = listConfig({ profile: "default", reveal: false });
    expect(listed.count).toBeGreaterThan(0);
  });
});
