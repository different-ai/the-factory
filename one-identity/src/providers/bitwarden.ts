import { spawnSync } from "node:child_process";

import type { ProviderWorkflow, WorkflowStepContext } from "../core/workflow.js";

type BwExecResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
};

function runBw(args: string[], options?: { input?: string; env?: NodeJS.ProcessEnv }): BwExecResult {
  const out = spawnSync("bw", args, {
    encoding: "utf8",
    input: options?.input,
    env: {
      ...process.env,
      ...(options?.env || {}),
    },
  });
  return {
    ok: out.status === 0,
    stdout: (out.stdout || "").trim(),
    stderr: (out.stderr || "").trim(),
  };
}

function hasBwCli(): boolean {
  const out = spawnSync("sh", ["-c", "command -v bw"], { encoding: "utf8" });
  return out.status === 0;
}

async function resolveCredential(
  ctx: WorkflowStepContext,
  key: "bitwardenEmail" | "bitwardenPassword",
  prompt: string,
): Promise<string | undefined> {
  const explicit = ctx.getOption(key);
  if (explicit) return explicit;
  const remembered = ctx.getData(key);
  if (remembered) return remembered;
  if (ctx.nonInteractive) return undefined;
  return ctx.ask(prompt);
}

function normalizeRefs(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function findExistingItem(session: string, name: string): string | undefined {
  const list = runBw(["list", "items", "--search", name, "--session", session]);
  if (!list.ok || !list.stdout) return undefined;
  try {
    const items = JSON.parse(list.stdout) as Array<{ id?: string; name?: string }>;
    const exact = items.find((item) => item.name === name && item.id);
    if (exact?.id) return exact.id;
    const first = items.find((item) => item.id);
    return first?.id;
  } catch {
    return undefined;
  }
}

function createSecureNote(session: string, name: string, notes: string): string | undefined {
  const existing = findExistingItem(session, name);
  if (existing) return existing;

  const template = {
    type: 2,
    name,
    notes,
  };
  const encoded = runBw(["encode"], { input: JSON.stringify(template) });
  if (!encoded.ok || !encoded.stdout) return undefined;

  const created = runBw(["create", "item", encoded.stdout, "--session", session]);
  if (!created.ok || !created.stdout) return undefined;

  try {
    const payload = JSON.parse(created.stdout) as { id?: string };
    return payload.id;
  } catch {
    return undefined;
  }
}

function upsertRef(existing: string[], next: string): string[] {
  if (existing.includes(next)) return existing;
  return [...existing, next];
}

function completeSignupByFlag(ctx: WorkflowStepContext): boolean {
  if (ctx.getFlag("bitwardenSkipSignup")) return true;
  if (ctx.getFlag("bitwardenAlreadyCreated")) return true;
  return ctx.getData("bitwardenSignupComplete") === "true";
}

export function buildBitwardenWorkflow(): ProviderWorkflow {
  return {
    provider: "bitwarden",
    steps: [
      {
        id: "bitwarden-credentials",
        kind: "manual_checkpoint",
        detail: "Resolve Bitwarden account credentials",
        run: async (ctx) => {
          const email = await resolveCredential(ctx, "bitwardenEmail", "Bitwarden account email: ");
          const password = await resolveCredential(ctx, "bitwardenPassword", "Bitwarden master password: ");
          if (!email || !password) {
            return {
              status: "blocked",
              detail:
                "Bitwarden email/password required. Run agentmint config set bitwarden.email <email> and agentmint config set bitwarden.password --stdin --secret.",
            };
          }
          ctx.setData("bitwardenEmail", email);
          ctx.setData("bitwardenPassword", password);
          return { status: "completed", detail: `Credentials captured for ${email}` };
        },
      },
      {
        id: "bitwarden-signup",
        kind: "browser_task",
        detail: "Ensure Bitwarden account exists",
        run: async (ctx) => {
          if (completeSignupByFlag(ctx)) {
            ctx.setData("bitwardenSignupComplete", "true");
            return { status: "completed", detail: "Signup checkpoint acknowledged" };
          }

          const email = ctx.getData("bitwardenEmail") || "<your-email>";
          return {
            status: "blocked",
            detail:
              `Create Bitwarden account in browser using ${email}: https://vault.bitwarden.com/#/register . Then run agentmint config set bitwarden.signup_done true and re-run.`,
          };
        },
      },
      {
        id: "bitwarden-login-verify",
        kind: "verify",
        detail: "Log into Bitwarden CLI and capture session",
        run: async (ctx) => {
          if (!hasBwCli()) {
            return {
              status: "blocked",
              detail: "Bitwarden CLI (bw) not found. Install from https://bitwarden.com/help/cli/",
            };
          }

          const email = ctx.getData("bitwardenEmail");
          const password = ctx.getData("bitwardenPassword");
          if (!email || !password) {
            return { status: "blocked", detail: "Missing Bitwarden credentials in state." };
          }

          const login = runBw(["login", email, password, "--raw"]);
          if (login.ok && login.stdout) {
            ctx.setData("bitwardenSession", login.stdout);
            return { status: "completed", detail: "Bitwarden login verified" };
          }

          const unlock = runBw(["unlock", "--passwordenv", "ONECLAW_BITWARDEN_PASSWORD", "--raw"], {
            env: { ONECLAW_BITWARDEN_PASSWORD: password },
          });
          if (unlock.ok && unlock.stdout) {
            ctx.setData("bitwardenSession", unlock.stdout);
            return { status: "completed", detail: "Bitwarden unlock verified" };
          }

          return {
            status: "blocked",
            detail: `Bitwarden login failed: ${login.stderr || unlock.stderr || "unknown error"}`,
          };
        },
      },
      {
        id: "bitwarden-seed-items",
        kind: "api_call",
        detail: "Create initial Bitwarden secure notes for identity pack",
        run: async (ctx) => {
          const session = ctx.getData("bitwardenSession");
          if (!session) {
            return { status: "blocked", detail: "Bitwarden session missing." };
          }

          const vault = ctx.getOption("bitwardenVault") || ctx.pack.accounts.bitwarden?.vault || "oneclaw";
          const refs = normalizeRefs(ctx.getData("bitwardenItemRefs") || "");

          const metadataId = createSecureNote(
            session,
            `oneclaw/${ctx.pack.packId}/metadata`,
            `Identity pack ${ctx.pack.packId}\nGenerated at ${new Date().toISOString()}\nVault: ${vault}`,
          );
          if (!metadataId) {
            return {
              status: "blocked",
              detail: "Failed creating Bitwarden metadata item. Ensure bw is unlocked and network is available.",
            };
          }

          let nextRefs = upsertRef(refs, `bw://item/${metadataId}`);

          if (ctx.pack.accounts.email?.provider === "agentmail") {
            const item = createSecureNote(
              session,
              `oneclaw/${ctx.pack.packId}/agentmail`,
              `AgentMail inbox: ${ctx.pack.accounts.email.inboxId}`,
            );
            if (item) nextRefs = upsertRef(nextRefs, `bw://item/${item}`);
          }

          if (ctx.pack.accounts.telegram?.provider === "telegram") {
            const item = createSecureNote(
              session,
              `oneclaw/${ctx.pack.packId}/telegram`,
              `Telegram bot: @${ctx.pack.accounts.telegram.botUsername}`,
            );
            if (item) nextRefs = upsertRef(nextRefs, `bw://item/${item}`);
          }

          ctx.setData("bitwardenVault", vault);
          ctx.setData("bitwardenItemRefs", nextRefs.join(","));
          return { status: "completed", detail: `Seeded ${nextRefs.length} Bitwarden items` };
        },
      },
      {
        id: "bitwarden-persist-pack",
        kind: "persist_secret",
        detail: "Persist Bitwarden account in identity pack",
        run: async (ctx) => {
          const email = ctx.getData("bitwardenEmail");
          const password = ctx.getData("bitwardenPassword");
          const session = ctx.getData("bitwardenSession");
          const vault = ctx.getData("bitwardenVault") || ctx.getOption("bitwardenVault") || "oneclaw";
          const itemRefs = normalizeRefs(ctx.getData("bitwardenItemRefs") || "");
          if (!email || !password) {
            return { status: "blocked", detail: "Bitwarden email/password missing before persist." };
          }

          const masterPasswordRef = ctx.putSecret("bitwarden", "master_password", password);
          const sessionRef = session ? ctx.putSecret("bitwarden", "session", session) : undefined;

          ctx.pack.accounts.bitwarden = {
            provider: "bitwarden",
            accountEmail: email,
            vault,
            itemRefs,
            ...(sessionRef ? { sessionRef } : {}),
            masterPasswordRef,
          };
          ctx.pack.updatedAt = new Date().toISOString();
          return { status: "completed", detail: "Bitwarden account saved into identity pack" };
        },
      },
    ],
  };
}
