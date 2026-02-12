#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import path from "node:path";
import process from "node:process";

import { Command } from "commander";

import { applyPack, exportPackToTarget, writeExport } from "./adapters/index.js";
import { helperPrompt } from "./bootstrap/helper-prompt.js";
import { runDoctor } from "./core/doctor.js";
import {
  checkConfig,
  getConfigValue,
  getRequiredConfigKeys,
  listConfig,
  setConfigValue,
  unsetConfigValue,
} from "./core/config.js";
import { appendProvisioningRun, ensurePack, loadPack, savePack } from "./core/packs.js";
import { resolveProvisionOptions, type RawOptions } from "./core/provision-options.js";
import { clearRunState, createRunState, loadRunState, saveRunState, type ProvisionRunState } from "./core/run-state.js";
import { isTargetId, validatePack } from "./core/schema.js";
import { TARGETS, type ProvisioningRunLog, type TargetId } from "./core/types.js";
import {
  verifyAgentmailApiKey,
  verifyBitwardenCredentials,
  verifyTelegramBotToken,
  type VerificationResult,
} from "./core/verifiers.js";
import { getWorkflow, isProviderId, PROVIDERS, type ProviderId } from "./providers/index.js";
import { runProviderWorkflow } from "./core/workflow.js";

type BootstrapDraft = {
  agentmailApiKey: string;
  telegramBotToken: string;
  bitwardenEmail: string;
  bitwardenPassword: string;
  bitwardenSignupDone: boolean;
  runProvision: boolean;
};

function parseCsv(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTargets(raw: string | undefined): TargetId[] {
  const items = parseCsv(raw);
  if (!items.length) return [];
  const invalid = items.filter((item) => !isTargetId(item));
  if (invalid.length) {
    throw new Error(`Invalid targets: ${invalid.join(", ")}. Valid: ${TARGETS.join(", ")}`);
  }
  return items as TargetId[];
}

function parseProviders(raw: string | undefined): ProviderId[] {
  const items = parseCsv(raw);
  const list = items.length ? items : [...PROVIDERS];
  const invalid = list.filter((item) => !isProviderId(item));
  if (invalid.length) {
    throw new Error(`Invalid providers: ${invalid.join(", ")}. Valid: ${PROVIDERS.join(", ")}`);
  }
  return list as ProviderId[];
}

function isDemoModeEnabled(): boolean {
  const raw = process.env.ONECLAW_DEMO?.trim().toLowerCase();
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw);
}

function profileFrom(opts: RawOptions, fallback = "default"): string {
  const raw = typeof opts.profile === "string" ? opts.profile.trim() : "";
  return raw || fallback;
}

async function askInteractive(prompt: string): Promise<string | undefined> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return undefined;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(prompt);
    const trimmed = answer.trim();
    return trimmed || undefined;
  } finally {
    rl.close();
  }
}

async function readStdinTrimmed(): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text || undefined;
}

function asLog(run: ProvisionRunState): ProvisioningRunLog {
  const steps = Object.entries(run.providers)
    .flatMap(([provider, state]) =>
      state.steps.map((step) => ({
        provider,
        stepId: step.stepId,
        kind: step.kind,
        status: step.status,
        detail: step.detail,
        updatedAt: step.updatedAt,
      })),
    )
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  return {
    runId: run.runId,
    startedAt: run.createdAt,
    updatedAt: run.updatedAt,
    completed: Object.values(run.providers).every((provider) => provider.completed),
    steps,
  };
}

function pickOutputPath(packId: string, target: TargetId): string {
  if (target === "nanoclaw") return path.resolve(`${packId}.nanoclaw.env`);
  return path.resolve(`${packId}.${target}.json`);
}

function printValue(value: unknown, asJson: boolean) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (typeof value === "string") {
    process.stdout.write(`${value}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function runProvision(input: {
  packId: string;
  providers: ProviderId[];
  targets: TargetId[];
  options: RawOptions;
  profile: string;
  useConfig: boolean;
  nonInteractive: boolean;
  asJson: boolean;
}) {
  const resolved = resolveProvisionOptions({
    profile: input.profile,
    options: input.options,
    useConfig: input.useConfig,
  });

  let pack = ensurePack(input.packId, input.targets);
  let run = loadRunState(input.packId) || createRunState(input.packId);

  for (const provider of input.providers) {
    const workflow = getWorkflow(provider);
    const result = await runProviderWorkflow({
      workflow,
      run,
      pack,
      options: {
        ...resolved,
      },
      nonInteractive: input.nonInteractive,
      ask: askInteractive,
      log: (message) => {
        if (!input.asJson) process.stderr.write(`${message}\n`);
      },
    });

    saveRunState(run);
    pack = savePack(pack);

    if (result.status === "blocked") {
      return {
        status: "blocked" as const,
        provider,
        step: result.blockedStepId,
        reason: result.blockedReason,
        resumeCommand: `oneclaw provision --pack ${input.packId} --providers ${input.providers.join(",")}`,
      };
    }
  }

  const runLog = asLog(run);
  pack = appendProvisioningRun(pack, runLog);
  clearRunState(input.packId);
  return {
    status: "ok" as const,
    packId: input.packId,
    providers: input.providers,
    targets: pack.targets,
    accounts: Object.keys(pack.accounts),
  };
}

function initialDraft(profile: string, runProvisionByDefault: boolean): BootstrapDraft {
  const agentmail = getConfigValue({ profile, key: "agentmail.api_key", reveal: true })?.value || "";
  const telegram = getConfigValue({ profile, key: "telegram.bot_token", reveal: true })?.value || "";
  const bwEmail = getConfigValue({ profile, key: "bitwarden.email", reveal: true })?.value || "";
  const bwPassword = getConfigValue({ profile, key: "bitwarden.password", reveal: true })?.value || "";
  const signup = (getConfigValue({ profile, key: "bitwarden.signup_done", reveal: true })?.value || "").toLowerCase();
  return {
    agentmailApiKey: agentmail,
    telegramBotToken: telegram,
    bitwardenEmail: bwEmail,
    bitwardenPassword: bwPassword,
    bitwardenSignupDone: ["1", "true", "yes", "on"].includes(signup),
    runProvision: runProvisionByDefault,
  };
}

async function collectBootstrapDraft(input: {
  profile: string;
  packId: string;
  useTui: boolean;
  runProvisionByDefault: boolean;
  demoMode: boolean;
}): Promise<{ cancelled: boolean; draft: BootstrapDraft }> {
  const initial = initialDraft(input.profile, input.runProvisionByDefault);
  if (input.demoMode && (!input.useTui || !process.stdin.isTTY || !process.stdout.isTTY)) {
    return {
      cancelled: false,
      draft: {
        agentmailApiKey: "am_demo_sk_live_8f3m2q1z4",
        telegramBotToken: "7312459901:AAH_demo_token_x8c4",
        bitwardenEmail: "founder+demo@oneclaw.dev",
        bitwardenPassword: "Oneclaw!Demo!2026",
        bitwardenSignupDone: true,
        runProvision: true,
      },
    };
  }

  if (input.useTui && process.stdin.isTTY && process.stdout.isTTY) {
    try {
      const tui = await import("./tui/bootstrap.js");
      return tui.startBootstrapTui({
        profile: input.profile,
        packId: input.packId,
        initial,
        demo: input.demoMode,
      });
    } catch (error) {
      process.stderr.write(`OpenTUI unavailable, falling back to prompt mode: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  const ask = async (label: string, fallback: string): Promise<string> => {
    const answer = await askInteractive(`${label}${fallback ? ` [${fallback}]` : ""}: `);
    return answer || fallback;
  };

  const signupDefault = initial.bitwardenSignupDone ? "true" : "false";
  const runDefault = initial.runProvision ? "true" : "false";
  return {
    cancelled: false,
    draft: {
      agentmailApiKey: await ask("AgentMail API key", initial.agentmailApiKey),
      telegramBotToken: await ask("Telegram bot token", initial.telegramBotToken),
      bitwardenEmail: await ask("Bitwarden email", initial.bitwardenEmail),
      bitwardenPassword: await ask("Bitwarden password", initial.bitwardenPassword),
      bitwardenSignupDone: ["1", "true", "yes", "on"].includes(
        (await ask("Bitwarden signup done (true/false)", signupDefault)).toLowerCase(),
      ),
      runProvision: ["1", "true", "yes", "on"].includes((await ask("Run provision after save (true/false)", runDefault)).toLowerCase()),
    },
  };
}

function persistBootstrapDraft(profile: string, draft: BootstrapDraft) {
  setConfigValue({ profile, key: "agentmail.api_key", value: draft.agentmailApiKey, secret: true });
  setConfigValue({ profile, key: "telegram.bot_token", value: draft.telegramBotToken, secret: true });
  setConfigValue({ profile, key: "bitwarden.email", value: draft.bitwardenEmail });
  setConfigValue({ profile, key: "bitwarden.password", value: draft.bitwardenPassword, secret: true });
  setConfigValue({ profile, key: "bitwarden.signup_done", value: draft.bitwardenSignupDone ? "true" : "false" });
}

async function verifyFromConfig(profile: string): Promise<Record<string, VerificationResult>> {
  const agentmailKey = getConfigValue({ profile, key: "agentmail.api_key", reveal: true })?.value || "";
  const telegramToken = getConfigValue({ profile, key: "telegram.bot_token", reveal: true })?.value || "";
  const bitwardenEmail = getConfigValue({ profile, key: "bitwarden.email", reveal: true })?.value || "";
  const bitwardenPassword = getConfigValue({ profile, key: "bitwarden.password", reveal: true })?.value || "";

  const checks: Record<string, VerificationResult> = {
    agentmail: agentmailKey
      ? await verifyAgentmailApiKey(agentmailKey)
      : { ok: false, detail: "Missing agentmail.api_key" },
    telegram: telegramToken
      ? await verifyTelegramBotToken(telegramToken)
      : { ok: false, detail: "Missing telegram.bot_token" },
    bitwarden:
      bitwardenEmail && bitwardenPassword
        ? verifyBitwardenCredentials(bitwardenEmail, bitwardenPassword)
        : { ok: false, detail: "Missing bitwarden.email or bitwarden.password" },
  };
  return checks;
}

const program = new Command();
program
  .name("oneclaw")
  .description("Identity pack CLI for AI assistants")
  .version("0.1.0")
  .showHelpAfterError();

program
  .command("bootstrap")
  .description("Collect bootstrap credentials and persist config state")
  .option("--profile <profile>", "Config profile", "default")
  .option("--pack <packId>", "Default pack for follow-up provision", "founder")
  .option("--run-provision", "Run provision after saving state")
  .option("--providers <providers>", `Comma-separated providers (${PROVIDERS.join(",")})`, "agentmail,telegram,bitwarden")
  .option("--targets <targets>", `Comma-separated targets (${TARGETS.join(",")})`, TARGETS.join(","))
  .option("--no-tui", "Disable OpenTUI mode")
  .option("--json", "Output json")
  .action(async (opts: RawOptions) => {
    const demoMode = isDemoModeEnabled();
    const requestedProfile = profileFrom(opts);
    const profile = demoMode && requestedProfile === "default" ? "demo" : requestedProfile;
    const packId = (typeof opts.pack === "string" && opts.pack.trim()) || "founder";
    const providers = parseProviders(opts.providers as string | undefined);
    const targets = parseTargets(opts.targets as string | undefined);
    const asJson = Boolean(opts.json);
    const runProvisionAfterSave = Boolean(opts.runProvision);

    const collected = await collectBootstrapDraft({
      profile,
      packId,
      useTui: opts.tui !== false,
      runProvisionByDefault: runProvisionAfterSave,
      demoMode,
    });

    if (collected.cancelled) {
      printValue({ status: "cancelled", profile }, asJson);
      return;
    }

    persistBootstrapDraft(profile, collected.draft);

    const check = checkConfig({ profile, providers, reveal: false });
    const verification = await verifyFromConfig(profile);
    const verified = {
      agentmail: verification.agentmail.ok,
      telegram: verification.telegram.ok,
      bitwarden: verification.bitwarden.ok,
    };

    let provisionResult: unknown = undefined;
    const shouldRunProvision = collected.draft.runProvision || runProvisionAfterSave;
    if (shouldRunProvision && check.ready && Object.values(verified).every(Boolean)) {
      provisionResult = await runProvision({
        packId,
        providers,
        targets,
        options: {
          profile,
        },
        profile,
        useConfig: true,
        nonInteractive: true,
        asJson,
      });
    }

    printValue(
      {
        status: "ok",
        profile,
        packId,
        required: getRequiredConfigKeys(providers).map((item) => item.key),
        demoMode,
        check,
        verification,
        provision: provisionResult,
      },
      asJson,
    );
  });

program
  .command("bootstrap-prompt")
  .description("Print helper prompt for another setup AI")
  .option("--json", "Output json")
  .action((opts: RawOptions) => {
    const prompt = helperPrompt();
    printValue(opts.json ? { prompt } : prompt, Boolean(opts.json));
  });

const configCommand = program.command("config").description("Manage persisted oneclaw config state");

configCommand
  .command("set")
  .description("Set a config key")
  .argument("<key>")
  .argument("[value]")
  .option("--profile <profile>", "Config profile", "default")
  .option("--secret", "Store as secret")
  .option("--stdin", "Read value from stdin")
  .option("--json", "Output json")
  .action(async (key: string, value: string | undefined, opts: RawOptions) => {
    const profile = profileFrom(opts);
    const fromStdin = Boolean(opts.stdin) ? await readStdinTrimmed() : undefined;
    const fromArg = value?.trim();
    const fromPrompt = fromStdin || fromArg ? undefined : await askInteractive(`${key}: `);
    const finalValue = fromStdin || fromArg || fromPrompt;
    if (!finalValue) {
      throw new Error(`No value provided for ${key}. Use [value], --stdin, or interactive input.`);
    }
    const result = setConfigValue({
      profile,
      key,
      value: finalValue,
      secret: Boolean(opts.secret),
    });
    printValue(result, Boolean(opts.json));
  });

configCommand
  .command("get")
  .description("Get a config key")
  .argument("<key>")
  .option("--profile <profile>", "Config profile", "default")
  .option("--reveal", "Reveal secret values")
  .option("--json", "Output json")
  .action((key: string, opts: RawOptions) => {
    const profile = profileFrom(opts);
    const result = getConfigValue({ profile, key, reveal: Boolean(opts.reveal) });
    if (!result) {
      printValue({ profile, key, found: false }, Boolean(opts.json));
      process.exitCode = 1;
      return;
    }
    printValue({ ...result, found: true }, Boolean(opts.json));
  });

configCommand
  .command("list")
  .description("List stored config keys")
  .option("--profile <profile>", "Config profile", "default")
  .option("--reveal", "Reveal secret values")
  .option("--json", "Output json")
  .action((opts: RawOptions) => {
    const profile = profileFrom(opts);
    const result = listConfig({ profile, reveal: Boolean(opts.reveal) });
    printValue(result, Boolean(opts.json));
  });

configCommand
  .command("unset")
  .description("Remove a config key")
  .argument("<key>")
  .option("--profile <profile>", "Config profile", "default")
  .option("--json", "Output json")
  .action((key: string, opts: RawOptions) => {
    const profile = profileFrom(opts);
    const result = unsetConfigValue({ profile, key });
    printValue(result, Boolean(opts.json));
  });

configCommand
  .command("check")
  .description("Check required config for providers")
  .option("--providers <providers>", `Comma-separated providers (${PROVIDERS.join(",")})`, "agentmail,telegram,bitwarden")
  .option("--profile <profile>", "Config profile", "default")
  .option("--verify", "Run provider verification checks")
  .option("--json", "Output json")
  .action(async (opts: RawOptions) => {
    const profile = profileFrom(opts);
    const providers = parseProviders(opts.providers as string | undefined);
    const check = checkConfig({ profile, providers, reveal: false });
    if (!opts.verify) {
      printValue(check, Boolean(opts.json));
      return;
    }

    const verification = await verifyFromConfig(profile);
    printValue(
      {
        ...check,
        verification,
        verified: Object.fromEntries(Object.entries(verification).map(([provider, result]) => [provider, result.ok])),
      },
      Boolean(opts.json),
    );
  });

program
  .command("provision")
  .description("Provision identities and update the pack")
  .requiredOption("--pack <packId>", "Identity pack id")
  .option("--providers <providers>", `Comma-separated providers (${PROVIDERS.join(",")})`)
  .option("--targets <targets>", `Comma-separated targets (${TARGETS.join(",")})`)
  .option("--profile <profile>", "Config profile", "default")
  .option("--no-config", "Disable config profile lookup")
  .option("--non-interactive", "Fail instead of prompting")
  .option("--json", "Output json")
  .option("--agentmail-api-key <value>")
  .option("--agentmail-username <value>")
  .option("--agentmail-domain <value>")
  .option("--agentmail-display-name <value>")
  .option("--agentmail-inbox-id <value>")
  .option("--agentmail-webhook-secret <value>")
  .option("--force-agentmail-create", "Force creating a new AgentMail inbox")
  .option("--telegram-bot-token <value>")
  .option("--telegram-bot-username <value>")
  .option("--telegram-identity-id <value>")
  .option("--bitwarden-email <value>")
  .option("--bitwarden-password <value>")
  .option("--bitwarden-vault <value>")
  .option("--bitwarden-skip-signup", "Skip Bitwarden signup checkpoint")
  .option("--bitwarden-already-created", "Alias for --bitwarden-skip-signup")
  .action(async (opts: RawOptions) => {
    const packId = String(opts.pack);
    const providers = parseProviders(opts.providers as string | undefined);
    const targets = parseTargets(opts.targets as string | undefined);
    const profile = profileFrom(opts);
    const nonInteractive = Boolean(opts.nonInteractive);
    const asJson = Boolean(opts.json);
    const result = await runProvision({
      packId,
      providers,
      targets,
      options: opts,
      profile,
      useConfig: opts.config !== false,
      nonInteractive,
      asJson,
    });
    if (result.status === "blocked") {
      process.exitCode = 2;
    }
    printValue(result, asJson);
  });

program
  .command("export")
  .description("Export a pack to target config format")
  .requiredOption("--pack <packId>")
  .requiredOption("--target <target>")
  .option("--out <path>")
  .option("--dry-run")
  .option("--json")
  .action((opts: RawOptions) => {
    const target = String(opts.target);
    if (!isTargetId(target)) {
      throw new Error(`Invalid target: ${target}`);
    }

    const pack = loadPack(String(opts.pack));
    const dryRun = Boolean(opts.dryRun);
    const asJson = Boolean(opts.json);
    const outPath = opts.out ? path.resolve(String(opts.out)) : pickOutputPath(pack.packId, target);
    const rendered = writeExport(pack, target, outPath, dryRun);

    printValue(
      {
        status: "ok",
        target,
        outPath,
        dryRun,
        preview: rendered.slice(0, 1200),
      },
      asJson,
    );
  });

program
  .command("apply")
  .description("Apply a pack directly to a target file")
  .requiredOption("--pack <packId>")
  .requiredOption("--target <target>")
  .requiredOption("--path <path>")
  .option("--dry-run")
  .option("--json")
  .action((opts: RawOptions) => {
    const target = String(opts.target);
    if (!isTargetId(target)) {
      throw new Error(`Invalid target: ${target}`);
    }
    const pack = loadPack(String(opts.pack));
    const dryRun = Boolean(opts.dryRun);
    const result = applyPack(pack, target, path.resolve(String(opts.path)), dryRun);
    printValue({ status: "ok", target, dryRun, result }, Boolean(opts.json));
  });

program
  .command("show")
  .description("Show pack JSON")
  .requiredOption("--pack <packId>")
  .option("--json")
  .action((opts: RawOptions) => {
    const pack = loadPack(String(opts.pack));
    printValue(pack, Boolean(opts.json));
  });

program
  .command("validate")
  .description("Validate pack schema")
  .requiredOption("--pack <packId>")
  .option("--json")
  .action((opts: RawOptions) => {
    const pack = loadPack(String(opts.pack));
    const validated = validatePack(pack);
    printValue({ status: "ok", packId: validated.packId }, Boolean(opts.json));
  });

program
  .command("doctor")
  .description("Check runtime dependencies")
  .option("--json")
  .action((opts: RawOptions) => {
    const checks = runDoctor();
    printValue(checks, Boolean(opts.json));
  });

program
  .command("render")
  .description("Print rendered target output to stdout")
  .requiredOption("--pack <packId>")
  .requiredOption("--target <target>")
  .action((opts: RawOptions) => {
    const target = String(opts.target);
    if (!isTargetId(target)) throw new Error(`Invalid target: ${target}`);
    const pack = loadPack(String(opts.pack));
    process.stdout.write(exportPackToTarget(pack, target));
  });

program.action(async () => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    program.outputHelp();
    return;
  }
  const demoMode = isDemoModeEnabled();
  const profile = demoMode ? "demo" : "default";
  const result = await collectBootstrapDraft({
    profile,
    packId: "founder",
    useTui: true,
    runProvisionByDefault: false,
    demoMode,
  });
  if (result.cancelled) return;
  persistBootstrapDraft(profile, result.draft);
  printValue(
    {
      status: "ok",
      profile,
      demoMode,
      message: "Bootstrap values saved. Run oneclaw config check --verify --json next.",
    },
    false,
  );
});

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
