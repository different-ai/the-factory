import { afterEach, describe, expect, it } from "vitest";

import { resolveSecret, setSecret } from "../src/core/secrets.js";
import { setupTempHome } from "./helpers.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    fn?.();
  }
});

describe("secret store", () => {
  it("writes and resolves secret refs", () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    const ref = setSecret("pack-a", "agentmail", "api_key", "sk-demo-123");
    expect(ref).toBe("secret://pack-a/agentmail/api_key");
    expect(resolveSecret(ref)).toBe("sk-demo-123");
  });
});
