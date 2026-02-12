import { spawnSync } from "node:child_process";

export type VerificationResult = {
  ok: boolean;
  detail: string;
  meta?: Record<string, string | boolean>;
};

function agentmailBaseUrl(): string {
  const raw = process.env.AGENTMAIL_API_BASE_URL?.trim();
  if (!raw) return "https://api.agentmail.to/v0";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function telegramBaseUrl(): string {
  const raw = process.env.TELEGRAM_API_BASE_URL?.trim();
  if (!raw) return "https://api.telegram.org";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export async function verifyAgentmailApiKey(apiKey: string): Promise<VerificationResult> {
  try {
    const response = await fetch(`${agentmailBaseUrl()}/inboxes`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: `AgentMail rejected API key (HTTP ${response.status})`,
      };
    }
    return {
      ok: true,
      detail: "AgentMail API key verified",
    };
  } catch (error) {
    return {
      ok: false,
      detail: `AgentMail verification failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

type TelegramGetMe = {
  ok?: boolean;
  result?: {
    username?: string;
    id?: number;
  };
};

export async function verifyTelegramBotToken(token: string): Promise<VerificationResult> {
  try {
    const response = await fetch(`${telegramBaseUrl()}/bot${encodeURIComponent(token)}/getMe`, {
      method: "GET",
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: `Telegram getMe failed (HTTP ${response.status})`,
      };
    }

    const payload = (await response.json()) as TelegramGetMe;
    if (!payload.ok || !payload.result?.username) {
      return {
        ok: false,
        detail: "Telegram token invalid or missing username",
      };
    }

    return {
      ok: true,
      detail: `Telegram token verified for @${payload.result.username}`,
      meta: {
        username: payload.result.username,
      },
    };
  } catch (error) {
    return {
      ok: false,
      detail: `Telegram verification failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function hasBwCli(): boolean {
  const out = spawnSync("sh", ["-c", "command -v bw"], { encoding: "utf8" });
  return out.status === 0;
}

export function verifyBitwardenCredentials(email: string, password: string): VerificationResult {
  if (!hasBwCli()) {
    return {
      ok: false,
      detail: "Bitwarden CLI (bw) is not installed",
    };
  }

  const login = spawnSync("bw", ["login", email, password, "--raw"], { encoding: "utf8" });
  if (login.status === 0 && (login.stdout || "").trim()) {
    return {
      ok: true,
      detail: "Bitwarden login verified",
    };
  }

  const unlock = spawnSync("bw", ["unlock", "--passwordenv", "ONECLAW_BITWARDEN_PASSWORD", "--raw"], {
    encoding: "utf8",
    env: {
      ...process.env,
      ONECLAW_BITWARDEN_PASSWORD: password,
    },
  });
  if (unlock.status === 0 && (unlock.stdout || "").trim()) {
    return {
      ok: true,
      detail: "Bitwarden unlock verified",
    };
  }

  const errorText = (login.stderr || unlock.stderr || "verification failed").trim();
  return {
    ok: false,
    detail: `Bitwarden verification failed: ${errorText}`,
  };
}
