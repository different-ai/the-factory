import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { exportPackToTarget } from "../src/adapters/index.js";
import { setConfigValue } from "../src/core/config.js";
import { ensurePack } from "../src/core/packs.js";
import { resolveProvisionOptions } from "../src/core/provision-options.js";
import { createRunState } from "../src/core/run-state.js";
import { getWorkflow } from "../src/providers/index.js";
import { runProviderWorkflow } from "../src/core/workflow.js";
import { setupTempHome } from "./helpers.js";

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) {
    const fn = cleanups.pop();
    await fn?.();
  }
});

function startMockServer(): Promise<{ baseUrl: string; stop: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url || "";
      const method = req.method || "GET";

      if (method === "POST" && url === "/v0/inboxes") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ inbox_id: "agent@agentmail.to" }));
        return;
      }

      if (method === "GET" && url === "/v0/inboxes/agent%40agentmail.to") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ inbox_id: "agent@agentmail.to" }));
        return;
      }

      if (method === "GET" && url === "/v0/inboxes") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [] }));
        return;
      }

      if (method === "GET" && url.startsWith("/bot") && url.endsWith("/getMe")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, result: { id: 100, username: "mock_bot" } }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to start mock server");
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        stop: () =>
          new Promise<void>((done, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }
              done();
            });
          }),
      });
    });
  });
}

function installFakeBw(): { dir: string; restore: () => void; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oneclaw-bw-"));
  const scriptPath = path.join(dir, "bw");
  const script = `#!/bin/sh
cmd="$1"
if [ "$cmd" = "login" ]; then
  echo "session-123"
  exit 0
fi
if [ "$cmd" = "unlock" ]; then
  echo "session-123"
  exit 0
fi
if [ "$cmd" = "list" ]; then
  echo "[]"
  exit 0
fi
if [ "$cmd" = "encode" ]; then
  cat
  exit 0
fi
if [ "$cmd" = "create" ]; then
  echo '{"id":"item-1"}'
  exit 0
fi
echo "unsupported" >&2
exit 1
`;
  fs.writeFileSync(scriptPath, script, "utf8");
  fs.chmodSync(scriptPath, 0o755);

  const previousPath = process.env.PATH || "";
  process.env.PATH = `${dir}:${previousPath}`;
  return {
    dir,
    restore: () => {
      process.env.PATH = previousPath;
    },
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("mocked e2e provisioning", () => {
  it("provisions all providers from config and renders targets", async () => {
    const temp = setupTempHome();
    cleanups.push(() => {
      temp.restore();
      temp.cleanup();
    });

    const mock = await startMockServer();
    cleanups.push(() => {
      return mock.stop();
    });

    const fakeBw = installFakeBw();
    cleanups.push(() => {
      fakeBw.restore();
      fakeBw.cleanup();
    });

    const prevAgentmail = process.env.AGENTMAIL_API_BASE_URL;
    const prevTelegram = process.env.TELEGRAM_API_BASE_URL;
    process.env.AGENTMAIL_API_BASE_URL = `${mock.baseUrl}/v0`;
    process.env.TELEGRAM_API_BASE_URL = mock.baseUrl;
    cleanups.push(() => {
      if (prevAgentmail === undefined) delete process.env.AGENTMAIL_API_BASE_URL;
      else process.env.AGENTMAIL_API_BASE_URL = prevAgentmail;
      if (prevTelegram === undefined) delete process.env.TELEGRAM_API_BASE_URL;
      else process.env.TELEGRAM_API_BASE_URL = prevTelegram;
    });

    setConfigValue({ profile: "default", key: "agentmail.api_key", value: "am-key", secret: true });
    setConfigValue({ profile: "default", key: "telegram.bot_token", value: "tg-token", secret: true });
    setConfigValue({ profile: "default", key: "bitwarden.email", value: "founder@example.com" });
    setConfigValue({ profile: "default", key: "bitwarden.password", value: "pw-123", secret: true });
    setConfigValue({ profile: "default", key: "bitwarden.signup_done", value: "true" });

    const resolved = resolveProvisionOptions({
      profile: "default",
      useConfig: true,
      options: {},
    });

    const pack = ensurePack("e2e", ["owpenbot", "openclaw", "nanoclaw"]);
    const run = createRunState(pack.packId);

    for (const provider of ["agentmail", "telegram", "bitwarden"] as const) {
      const result = await runProviderWorkflow({
        workflow: getWorkflow(provider),
        run,
        pack,
        options: {
          ...resolved,
        },
        nonInteractive: true,
        ask: async () => undefined,
        log: () => {},
      });
      expect(result.status).toBe("completed");
    }

    expect(pack.accounts.email?.provider).toBe("agentmail");
    expect(pack.accounts.telegram?.provider).toBe("telegram");
    expect(pack.accounts.bitwarden?.provider).toBe("bitwarden");

    const owpenbot = exportPackToTarget(pack, "owpenbot");
    const openclaw = exportPackToTarget(pack, "openclaw");
    const nanoclaw = exportPackToTarget(pack, "nanoclaw");

    expect(owpenbot).toContain("agent@agentmail.to");
    expect(openclaw).toContain("mock_bot");
    expect(nanoclaw).toContain("AGENTMAIL_API_KEY=am-key");
  });
});
