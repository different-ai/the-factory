import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { seedSemanticHash, observedWorkshopCalls, WORKSHOP_TOOL_PERMISSIONS, type SceneEvidence } from "./workshop-narrative-contract.ts";
import { workshopRunBudget } from "./workshop-run-budget.ts";
import { workshopRunIdentity } from "./workshop-run-identity.ts";
import { workshopTurnDiagnostic } from "./workshop-turn-diagnostics.ts";
import { inspectWorkshopPptx, verifyWorkshopPptxPrerequisite } from "./workshop-pptx.ts";
import type { NativeWorkflowObservation } from "./workshop-narrative-witnesses.ts";
import { addInitScript, allocateFreePort, browserScript, captureBrowserFilm, connect, evaluateOnSurface, listTargets, navigate, type Surface } from "@openwork/cdp";
import { chrome } from "@openwork/hosts";
import type { Place, Seed } from "@openwork/env";
import { denFetch, type DenSession } from "@openwork/behaviors";
import { readHeadlessRuntimeManifest, resolveHeadlessWorldRuntimePaths } from "@openwork/world";
import { denForAppWeb } from "./signed-in-app-web.ts";
import { connectDemoServer, startDemoScript } from "../../worlds/lib/demo-workspace.ts";
import { startOpenWorkplace } from "../../worlds/lib/open-workplace.ts";

/** Lena's company domain: links read http://office.acmerobotics.internal/... and the service browser maps them to local ports. */
const WORKSHOP_DOMAIN = process.env.OPENWORK_WORKSHOP_DOMAIN || "acmerobotics.internal";
const NEWS_CONNECTOR = "Morning News";
import { assertAcmeConnections, assertAcmeMcpOrigins, connectAcmeRuntime } from "../../worlds/lib/acme-runtime.ts";
import { startNarrativeInference } from "./workshop-narrative-inference.ts";
import { startWorkshopFeedback, waitForWorkshopFeedbackForm } from "./workshop-feedback.ts";
import { createWorkshopShotContext } from "../docs-shots/shots/workshop.ts";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const FIXED_NOW = "2026-10-16T15:55:00Z";
const run = promisify(execFile);
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
export interface NarrativeRow { id: string; title: string; status: "PASS" | "FAIL" | "BLOCKED"; reason: string; latencyMs: number; sessionId?: string; evidence?: Record<string, unknown> }

/** Paid inference is opt-in; all workplace services and identities are owned synthetic fixtures. */
export async function workshopNarrative(seed: Seed, { place }: { place: Place }) {
  if (place.kind !== "local") throw new Error("Workshop comparison must run on this Mac with --local.");
  for (const key of ["OPENWORK_EVAL_DEN_API_URL", "OPENWORK_EVAL_DAYTONA_DEN_SANDBOX", "OPENWORK_EVAL_DAYTONA_SANDBOX"]) if (process.env[key]) throw new Error("Workshop proof refuses shared/reused Den infrastructure.");
  const profile = process.env.OPENWORK_WORKSHOP_PROFILE ?? "gpt-sol-fast";
  // "Day in the life" demo variant: Lena as the signed-in person, short human prompts, optional App builder.
  const day = process.env.OPENWORK_WORKSHOP_DAY === "1";
  const person = day ? { name: "Lena Hoffmann", email: "lena@acme.test", fixture: "Lena Hoffmann|lena|Account Manager" } : { name: "Alex Chen", email: "alex@acme.test", fixture: "" };
  if (!["gpt-sol-fast", "qwen-27b"].includes(profile)) throw new Error("Unknown workshop model profile.");
  if (profile === "qwen-27b" && process.env.OPENWORK_WORKSHOP_GPT_PHASE_DONE !== "1") throw new Error("Run the GPT Sol Fast phase before Qwen.");
  const resources = new AsyncDisposableStack();
  const rows: NarrativeRow[] = [];
  const reportDir = process.env.OPENWORK_WORKSHOP_REPORT_DIR ?? join(REPO, "evals/results/workshop-narrative", profile);
  await mkdir(reportDir, { recursive: true });
  const identity = await workshopRunIdentity();
  const startedAt = Date.now();
  let setupStage = "exact inference preflight";
  let subjectMetadata: Record<string, unknown> = { profile };
  const redactions: string[] = [];
  const root = await realpath(await mkdtemp(join(tmpdir(), "openwork-narrative-")));
  resources.defer(() => rm(root, { recursive: true, force: true }));
  const blocked = async (reason: string, model: Record<string, unknown> = {}) => ({
    profile, ready: false as const, blockedReason: reason, model, app: null, recipientApp: null,
    reportDir, rows, fixedNow: FIXED_NOW,
    recordRow: (row: NarrativeRow) => rows.push(row),
    async finish() { await writeFile(join(reportDir, "matrix.json"), JSON.stringify({ ...identity, verdict: "INCOMPLETE", profile, model, fixedNow: FIXED_NOW, durationMs: Date.now() - startedAt, rows }, null, 2) + "\n"); },
    async [Symbol.asyncDispose]() { await resources.disposeAsync(); },
  });
  try {
    setupStage = "independent PPTX parser prerequisite (before paid inference)";
    await verifyWorkshopPptxPrerequisite();
    setupStage = "exact inference preflight";
    const inference = await startNarrativeInference(profile, resources);
    subjectMetadata = inference.metadata;
    if (!inference.ready) return blocked(inference.reason, inference.metadata);
    redactions.push(inference.provider.options.apiKey);
    setupStage = "owned native Den";
    // Day demo: a real local Automation runner (ee/apps/headless-runner) so a created cloud Automation actually runs.
    const runnerPort = day ? await allocateFreePort() : 0;
    const runnerToken = day ? `workshop-runner-${randomUUID()}-${randomUUID()}` : "";
    if (runnerToken) redactions.push(runnerToken);
    const clearEnv = Object.fromEntries(Object.keys(process.env).map((key) => [key, undefined]));
    const ownedEnv = { ...clearEnv, PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: join(root, "config"), XDG_DATA_HOME: join(root, "data"), XDG_CACHE_HOME: join(root, "cache"), NODE_OPTIONS: "", RESEND_API_KEY: "", SMTP_HOST: "", DEN_AUTOMATIONS_ENABLED: "true", DEN_AUTOMATIONS_RUNTIME_ENABLED: "true", DEN_BOOTSTRAP_ADMIN_EMAILS: "", ...(day && process.env.OPENWORK_WORKSHOP_DAY_APPS === "1" ? { DEN_APP_MCP_SERVERS_ENABLED: "true" } : {}), ...(day ? { DEN_HEADLESS_RUNNER_URL: `http://127.0.0.1:${runnerPort}`, DEN_HEADLESS_RUNNER_TOKEN: runnerToken } : {}) };
    const recipientPort = await allocateFreePort();
    const { den, webPort } = await denForAppWeb(seed, { web: true, trustedOrigins: [`http://127.0.0.1:${recipientPort}`], env: ownedEnv, org: { name: "Acme Robotics", admin: { name: person.name, email: person.email }, members: { teammate: { name: "Nora Patel", email: "nora@acme.test" }, outsider: { name: "Zoe Kim", email: "zoe@acme.test" } } } });
    redactions.push(den.admin.token, den.admin.password, den.members.teammate!.token, den.members.teammate!.password);
    // Only the Automation scenes need the eval model as an org model (and the local runner). Registering it otherwise
    // adds an org entry to the model picker that this engine cannot run, so a scene-only run could start on it.
    const onlyScenes = (process.env.OPENWORK_WORKSHOP_DAY_ONLY ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    const dayAutomations = day && (onlyScenes.length === 0 || onlyScenes.some((id) => id === "D0" || id === "D1"));
    let automationProviderId = "";
    if (dayAutomations) {
      setupStage = "owned local Automation runner and org model";
      // The eval model becomes an organization model so Automations can use it (Den re-validates on create).
      const providerResult = await denFetch(den.admin, "/v1/llm-providers", { method: "POST", headers: { authorization: `Bearer ${den.admin.token}` }, body: JSON.stringify({
        name: inference.provider.name, source: "custom", allMembers: true, memberIds: [], teamIds: [], apiKey: inference.provider.options.apiKey,
        customConfig: { id: inference.providerId, name: inference.provider.name, npm: "@ai-sdk/openai-compatible", options: { baseURL: inference.baseUrl }, env: ["WORKSHOP_PROXY_KEY"],
          models: [{ id: inference.modelId, name: Object.values(inference.provider.models)[0]?.name ?? inference.modelId, tool_call: true }] },
      }) });
      if (providerResult.response.status !== 201) throw new Error(`Could not register the workshop model with Den: HTTP ${providerResult.response.status}`);
      const createdProvider = record(providerResult.body) && record(providerResult.body.llmProvider) ? providerResult.body.llmProvider : null;
      if (typeof createdProvider?.id !== "string") throw new Error("Registered Automation provider has no stable id");
      automationProviderId = createdProvider.id;
      const runnerRoot = join(root, "runner"); await mkdir(runnerRoot, { recursive: true });
      const runnerCwd = join(REPO, "ee/apps/headless-runner");
      const runner = spawn(join(runnerCwd, "node_modules/.bin/tsx"), ["src/server.ts"], { cwd: runnerCwd, stdio: ["ignore", "pipe", "pipe"], env: {
        PATH: process.env.PATH, HOME: root, NODE_OPTIONS: "--conditions=development",
        HEADLESS_API_TOKEN: runnerToken, HEADLESS_PORT: String(runnerPort), HEADLESS_DB_PATH: join(runnerRoot, "headless.sqlite"),
        HEADLESS_MODEL_PROTOCOL: "openai", HEADLESS_MODEL_BASE_URL: inference.baseUrl, HEADLESS_MODEL: inference.modelId,
        HEADLESS_MODEL_API_KEY: inference.provider.options.apiKey, HEADLESS_MCP_URL: `${den.ref.apiUrl}/mcp/agent`, HEADLESS_TURN_TIMEOUT_MS: "300000",
      } });
      let runnerLog = ""; runner.stdout?.on("data", (chunk) => { runnerLog = (runnerLog + chunk).slice(-4000); }); runner.stderr?.on("data", (chunk) => { runnerLog = (runnerLog + chunk).slice(-4000); });
      resources.defer(async () => { runner.kill("SIGTERM"); await delay(500); });
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        if (runner.exitCode !== null) throw new Error(`Automation runner exited: ${runnerLog.slice(-600)}`);
        if (await fetch(`http://127.0.0.1:${runnerPort}/health`).then((r) => r.ok).catch(() => false)) break;
        await delay(500);
      }
      if (!(await fetch(`http://127.0.0.1:${runnerPort}/health`).then((r) => r.ok).catch(() => false))) throw new Error(`Automation runner did not start: ${runnerLog.slice(-600)}`);
    }
    setupStage = "owned synthetic services";
    // Open Outlook, Open Calendar, Open Drive, Open Jira and Open Confluence: one connection each, real-looking links.
    const workplace = await startOpenWorkplace(resources, den, { person: person.fixture, now: FIXED_NOW, domain: WORKSHOP_DOMAIN });
    const atlassian = workplace.atlassian;
    const microsoft = workplace.microsoft365;
    const ui = workplace.atlassianWeb;
    const operatorKey = randomUUID(); redactions.push(operatorKey);
    const news = await startDemoScript(resources, den, { url: new URL("../packages/labs/src/workshop-news.mjs", import.meta.url), label: "narrative-news", daytonaPort: 3986 }, { NEWS_NOW: FIXED_NOW, WORKSHOP_OPERATOR_TOKEN: operatorKey });
    await connectDemoServer(den, "news", NEWS_CONNECTOR, `${news.baseUrl}/mcp`);
    const ownedOrigins = [atlassian.baseUrl, microsoft.baseUrl, news.baseUrl];
    await assertAcmeConnections(den, ownedOrigins);
    setupStage = "owned existing feedback UI/backend";
    const feedback = await startWorkshopFeedback(resources, join(root, "feedback"));
    const org = await seed.api(den.admin, "/v1/org");
    const orgId = record(org.body) && record(org.body.organization) ? org.body.organization.id : undefined;
    if (typeof orgId !== "string") throw new Error("Owned workshop organization missing.");
    // Day demo: the morning-news connector starts as Lena's only, so a later team grant is a real access change
    // that Nora's Activity feed can report. Admin-only setup, never performed by the model.
    const newsConnectionAccess = async (access: { orgWide: boolean; memberIds: string[] }) => {
      const listed = await denFetch(den.admin, "/v1/mcp-connections?scope=manageable", { headers: { authorization: `Bearer ${den.admin.token}` } });
      const connections = record(listed.body) && Array.isArray(listed.body.connections) ? listed.body.connections.filter(record) : [];
      const news = connections.find((connection) => typeof connection.url === "string" && new URL(connection.url).origin === new URL(news_.baseUrl).origin);
      if (typeof news?.id !== "string") throw new Error("Owned morning-news connection missing.");
      const updated = await denFetch(den.admin, `/v1/mcp-connections/${encodeURIComponent(news.id)}/access`, { method: "PUT", headers: { authorization: `Bearer ${den.admin.token}` }, body: JSON.stringify({ access: { ...access, teamIds: [] } }) });
      if (!updated.response.ok) throw new Error(`Could not update morning-news access: HTTP ${updated.response.status}`);
      return news.name;
    };
    const news_ = news;
    if (day) {
      const ownerMember = record(org.body) && record(org.body.currentMember) ? String(org.body.currentMember.id) : "";
      await newsConnectionAccess({ orgWide: false, memberIds: [ownerMember] });
    }
    const brief = `# Acme Robotics workshop\n\nToday is 2026-10-16, 08:55 America/Los_Angeles. Use only connected owned tools and files in this workspace. No external business connectors or mail sends. News links point to the internal Morning News feed.\n\nProducts: Atlas 2 and Atlas Lift; full datasheets in Confluence PROD. Customer account plans in SALES document revenue, orders, relationship, growth and churn. Jira DOC belongs to documentation; Nora Patel is the documentation owner. ITSD is the IT service desk and password-reset requests require an application field. Use Windows as the requested application.\n\nDiscover exact service capabilities and schemas. Capability search finds tools, not documents. Confluence search is excerpt-only: read complete pages. Never return literal data from a script as if it came from a provider. Open Outlook uses mail_search/mail_read/mail_create_reply_draft; Open Drive uses file_find/file_read/file_write/file_create_folder; Open Calendar supports event reads, create and update. Native Workflows require real retained successful executions, saving and sharing, not a local text description.\n\nAgent webfetch, external search and browser tools are disabled in this connected-API rehearsal. Use connected APIs; ask People Ops when an internal policy is absent. Do not invent policy. Office artifacts must contain actual valid OOXML and be grounded in the report, not copied unrelated seed slides.\n`;
    // Workspace instructions a real team would keep in the workspace: context and preferences, so prompts can stay short.
    const dayBrief = `# Acme Robotics — Lena's workspace\n\nLena Hoffmann is an account manager at Acme Robotics. Customers: Northwind Logistics (Atlas 2 warehouse pilot) and Blue Harbor Foods (AtlasLift pallet pilot). Teammates: Nora Patel (product/documentation), Priya Shah (engineering), Mateo Rivera (sales), Sam Okafor (finance). Today is Friday 2026-10-16, America/Los_Angeles; use the connected clock when one exists.\n\nUse only the connected tools: Open Outlook (mail), Open Calendar, Open Drive (files), Open Confluence, Open Jira, Morning News, and OpenWork itself (skills, sharing, Workflows). Product datasheets and account plans are in Open Confluence; read full pages, not search snippets. Jira DOC is documentation; ITSD is the IT service desk (password resets need the Application field).\n\nHow Lena likes to work:\n- When a request is clear, just do it; make sensible assumptions and say what you assumed. Don't stop to ask questions.\n- Never send email. Leave drafts for her to review. Calendar events in this workspace never send invitations, so add attendees to meetings normally.\n- She works in PowerPoint and Word, never Markdown. Save documents she will open as .pptx or .docx in Open Drive.\n- Keep answers short and cite where facts came from.\n- If a tool call fails or is aborted, retry it once before giving up.\n- Don't invent policies or numbers. If something isn't documented, say so and suggest who to ask.\n\nTechnical notes for building Office files: generate the file in your shell (python-pptx/python-docx are fine) and check it opens. To save it to Open Drive, call file_create_upload_session with the file path, then upload the bytes from your shell with curl -sS -X PUT --data-binary @<file> '<uploadUrl>'. Never paste file bytes or base64 into a tool call. A .pptx main part must use content type application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml. No web browsing or external search is available.\n`;
    const appFor = async (identity: "admin" | "teammate", port?: number) => {
      const workspacePath = join(root, identity, "workspace");
      await mkdir(workspacePath, { recursive: true });
      await writeFile(join(workspacePath, day ? "AGENTS.md" : "WORKSHOP.md"), day ? dayBrief : brief);
      await writeFile(join(workspacePath, "opencode.json"), JSON.stringify({ provider: { [inference.providerId]: inference.provider }, model: `${inference.providerId}/${inference.modelId}`, small_model: `${inference.providerId}/${inference.modelId}`, enabled_providers: [inference.providerId, ...(automationProviderId ? [automationProviderId] : [])], permission: WORKSHOP_TOOL_PERMISSIONS }));
      const app = await seed.appWeb({ name: `workshop-${profile}-${identity}`, engine: "v1", workspacePath, mouse: true, den: den.ref, ...(port ? { webPort: port } : {}), env: { VITE_OPENWORK_FEEDBACK_URL: feedback.feedbackUrl, VITE_DISABLE_OPENWORK_MODELS: "1" } });
      resources.adopt(app, (owned) => owned.stop());
      // Seed-only profile bootstrap; task actions below use the real composer and product controls.
      await using init = await addInitScript(app.client, browserScript((model, variant) => {
        localStorage.setItem("openwork.defaultModel", `${model.providerID}/${model.modelID}`);
        localStorage.setItem("openwork.preferences", JSON.stringify({ defaultModel: model, modelVariant: variant, providerStepCompleted: true }));
      }, [{ providerID: inference.providerId, modelID: inference.modelId }, inference.variant]));
      await navigate(app.client, app.webUrl);
      await seed.signIn(app, identity === "admin" ? den.admin : den.members.teammate!, identity);
      const workspace = await seed.workspace(app, workspacePath);
      const paths = resolveHeadlessWorldRuntimePaths(REPO, app.handle.name);
      const manifest = await readHeadlessRuntimeManifest(paths.runtimeManifestPath);
      if (!manifest) throw new Error("Owned native app runtime manifest missing.");
      redactions.push(manifest.token, manifest.hostToken);
      await connectAcmeRuntime(den, { manifest }, orgId, identity === "admin" ? den.admin : den.members.teammate!);
      return { app, workspace, manifest, workspacePath };
    }
    setupStage = "native owner app-web sign-in";
    const owner = await appFor("admin", webPort);
    setupStage = "native recipient app-web sign-in";
    const recipient = await appFor("teammate", recipientPort);
    setupStage = "native browser surfaces and isolation assertions";
    const serviceBrowser = resources.use(await chrome({ host: place.host(), name: `workshop-${profile}-service`, startUrl: workplace.urls.jira, headless: true, hostRules: workplace.hostRules }));
    const ownerWeb = await seed.web({ den, signedInAs: "admin", startPath: "/dashboard/library", headless: true, viewport: { width: 1440, height: 1000 } });
    const recipientWeb = await seed.web({ den, signedInAs: "teammate", startPath: "/dashboard/library", headless: true, viewport: { width: 1440, height: 1000 } });
    // Optional passive CDP films for a narrated demo cut. Frames only; never drives the UI or changes timing.
    const filmRoot = process.env.OPENWORK_WORKSHOP_FILM_DIR ? join(process.env.OPENWORK_WORKSHOP_FILM_DIR, profile) : null;
    const markers: { label: string; at: number }[] = [];
    const films = new Map<string, Awaited<ReturnType<typeof captureBrowserFilm>>>();
    const film = async (label: string, surface: Surface) => {
      if (!filmRoot || films.has(label)) return;
      films.set(label, await captureBrowserFilm(surface, join(filmRoot, label)));
    };
    if (filmRoot) {
      await mkdir(filmRoot, { recursive: true });
      resources.defer(async () => { for (const capture of films.values()) await capture.stop().catch(() => undefined); await writeFile(join(filmRoot, "markers.json"), JSON.stringify(markers, null, 2) + "\n"); });
      for (const [label, surface] of [["owner-app", owner.app], ["recipient-app", recipient.app], ["services", serviceBrowser], ["owner-web", ownerWeb], ["recipient-web", recipientWeb]] as const) await film(label, surface);
    }
    const stateJson = async (url: string) => { const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) }); if (!response.ok) throw new Error(`Owned service read failed: ${response.status}`); return response.json(); };
    const engineRead = async (identity: "owner" | "recipient", path: string) => {
      const target = identity === "owner" ? owner : recipient;
      const response = await fetch(`${target.app.openworkUrl}/workspace/${target.workspace.workspaceId}/opencode${path}`, { headers: { authorization: `Bearer ${target.manifest.token}` }, redirect: "error", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Owned engine read failed: ${response.status}`);
      return response.json();
    };
    const assertIsolation = async () => {
      await assertAcmeConnections(den, ownedOrigins);
      for (const identity of ["owner", "recipient"] as const) {
        const config = await engineRead(identity, "/config");
        assertAcmeMcpOrigins(config, den.ref.apiUrl);
        const permissions = record(config) && record(config.permission) ? config.permission : {};
        if (Object.entries(WORKSHOP_TOOL_PERMISSIONS).some(([key, value]) => permissions[key] !== value)) throw new Error("Owned engine did not retain the shared connected-API tool restrictions");
      }
    };
    await assertIsolation();
    const initial = { atlassian: await stateJson(`${atlassian.baseUrl}/state`), microsoft: await stateJson(`${microsoft.baseUrl}/state`), news: await stateJson(`${news.baseUrl}/state`) };
    // Full initial service state: only exact owned origins and documented transport/auth fields normalize.
    const seedDigest = seedSemanticHash(initial, [...ownedOrigins, ui.baseUrl]);
    const readDen = (actor: DenSession, path: string) => denFetch(actor, path, { headers: { authorization: `Bearer ${actor.token}` } });
    const recipientOrg = await readDen(den.members.teammate!, "/v1/org");
    const outsiderOrg = await readDen(den.members.outsider!, "/v1/org");
    const ownerMemberId = record(org.body) && record(org.body.currentMember) ? String(org.body.currentMember.id) : "";
    const recipientMemberId = record(recipientOrg.body) && record(recipientOrg.body.currentMember) ? String(recipientOrg.body.currentMember.id) : "";
    const outsiderMemberId = record(outsiderOrg.body) && record(outsiderOrg.body.currentMember) ? String(outsiderOrg.body.currentMember.id) : "";
    async function nativeWorkflows(): Promise<NativeWorkflowObservation> {
      const list = await readDen(den.admin, "/v1/workflows");
      const items = record(list.body) && Array.isArray(list.body.items) ? list.body.items.filter(record) : [];
      const workflow = items.find((item) => item.title === "Acme product comparison");
      let details: unknown = null, grants: unknown = null, snapshots: unknown = null;
      const pluginGrants: { pluginId: string; access: unknown }[] = [];
      const boundary: NonNullable<NativeWorkflowObservation["boundary"]> = { outsiderMemberId };
      if (typeof workflow?.configObjectId === "string") {
        const id = encodeURIComponent(workflow.configObjectId);
        details = (await readDen(den.admin, `/v1/workflows/${id}`)).body;
        grants = (await readDen(den.admin, `/v1/config-objects/${id}/access`)).body;
        snapshots = { owner: (await readDen(den.admin, `/v1/workflows/${id}/snapshots`)).body, recipient: (await readDen(den.members.teammate!, `/v1/workflows/${id}/snapshots`)).body };
        if (typeof workflow.pluginId === "string") pluginGrants.push({ pluginId: workflow.pluginId, access: (await readDen(den.admin, `/v1/plugins/${encodeURIComponent(workflow.pluginId)}/access`)).body });
        for (const [key, actor, path] of [["recipientDetail", den.members.teammate!, `/v1/workflows/${id}`], ["outsiderList", den.members.outsider!, "/v1/workflows"], ["outsiderDetail", den.members.outsider!, `/v1/workflows/${id}`], ["outsiderSnapshots", den.members.outsider!, `/v1/workflows/${id}/snapshots`]] as const) {
          const read = await readDen(actor, path); boundary[key] = { status: read.response.status, body: read.body };
        }
      }
      let runs: Record<string, unknown>[] = [];
      if (den.database) {
        // Fixed read-only query against ONLY the disposable world's database; encrypted source/results are excluded.
        const observed = await run(process.execPath, ["--input-type=module", "-e", "import mysql from 'mysql2/promise';const c=await mysql.createConnection(process.env.WORKSHOP_OWNED_DB);try{const [r]=await c.query('SELECT id,org_membership_id,plugin_id,config_object_id,config_object_version_id,code_digest,status,source,script_input_digest,tool_calls,result_digest,input_schema_digest,output_schema_digest,CAST(UNIX_TIMESTAMP(started_at)*1000 AS UNSIGNED) AS started_at,CAST(UNIX_TIMESTAMP(finished_at)*1000 AS UNSIGNED) AS finished_at FROM workflow_run ORDER BY started_at');console.log(JSON.stringify(r))}finally{await c.end()}"], { cwd: join(REPO, "ee/packages/den-db"), env: { PATH: process.env.PATH, HOME: root, WORKSHOP_OWNED_DB: den.database.url }, timeout: 15000 });
        const parsed: unknown = JSON.parse(observed.stdout); if (Array.isArray(parsed)) runs = parsed.filter(record);
      }
      return { list: list.body, details, grants, snapshots, runs, ownerMemberId, recipientMemberId, pluginGrants, boundary };
    }
    const latestSession = async (identity: "owner" | "recipient") => {
      const target = identity === "owner" ? owner : recipient;
      const route = await evaluateOnSurface(target.app, () => location.pathname);
      return /\/session\/([^/]+)/.exec(route)?.[1] ?? null;
    };
    const assertSafe = async (surface: Surface) => {
      const secrets = [operatorKey, ...redactions, owner.manifest.token, owner.manifest.hostToken, recipient.manifest.token, recipient.manifest.hostToken];
      const safe = await evaluateOnSurface(surface, browserScript((values) => { const visible = [document.body?.innerText ?? "", location.href, ...Array.from(document.querySelectorAll("input,textarea")).map((element) => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : "")].join("\n"); return !values.some((value) => value && visible.includes(value)); }, [secrets]));
      if (!safe) throw new Error("Screenshot blocked: an owned credential is visibly present.");
    };
    const docshotDirectory = join(REPO, "evals/results/workshop-docshots", `${profile}-${randomUUID()}`);
    const docshots = createWorkshopShotContext({ directory: docshotDirectory, readState: async () => {
      const clean = (state: Record<string, unknown>) => Object.fromEntries(Object.entries(state).filter(([key]) => key !== "audit"));
      const persistedFeedback = await feedback.read();
      return { atlassian: clean(await stateJson(`${atlassian.baseUrl}/state`)), microsoft: clean(await stateJson(`${microsoft.baseUrl}/state`)), news: clean(await stateJson(`${news.baseUrl}/state`)), feedback: { customers: persistedFeedback.customers, threads: persistedFeedback.threads } };
    }, assertSafe });
    resources.adopt(docshots, (owned) => owned.dispose());
    return {
      profile, ready: true as const, blockedReason: null, model: inference.metadata, expectedModel: { providerID: inference.providerId, modelID: inference.modelId, variant: inference.variant }, app: owner.app, recipientApp: recipient.app, ownerWeb, recipientWeb, serviceBrowser, docshots,
      nativeWorkflows,
      readFeedback: feedback.read,
      async retainFeedbackEvidence() {
        const directory = join(reportDir, "private-observer");
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, "T08-provider.json"), JSON.stringify(await feedback.read(), null, 2) + "\n", { mode: 0o600 });
      },
      async feedbackSurface(): Promise<Surface> {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          const target = (await listTargets(owner.app.handle.cdpUrl)).find((page) => page.type === "page" && page.url.startsWith(feedback.feedbackUrl) && page.webSocketDebuggerUrl);
          if (target?.webSocketDebuggerUrl) {
            const surface: Surface = { handle: { ...owner.app.handle, name: "actual-app-feedback-tab" }, client: await connect(target.webSocketDebuggerUrl) };
            resources.adopt(surface, (owned) => owned.client.close());
            await waitForWorkshopFeedbackForm(surface);
            await film("feedback", surface);
            return surface;
          }
          await delay(100);
        }
        throw new Error("The actual app Feedback action did not open its owned landing form");
      },
      settleInference: inference.settle,
      abortInferenceAfter: inference.abortAfter,
      urls: { feedback: feedback.feedbackUrl, denWeb: den.ref.webUrl, jira: workplace.urls.jira, confluence: workplace.urls.confluence, outlook: workplace.urls.outlook, calendar: workplace.urls.calendar, oneDrive: workplace.urls.drive, news: `${news.baseUrl}/state` },
      reportDir, rows, fixedNow: FIXED_NOW, seedDigest,
      async current(identity: "owner" | "recipient" = "owner") { const sessionId = await latestSession(identity); const messages = sessionId ? await engineRead(identity, `/session/${sessionId}/message`) : []; return { sessionId, messages }; },
      async observe(identity: "owner" | "recipient" = "owner") {
        const current = await this.current(identity);
        const actor = identity === "owner" ? den.admin : den.members.teammate!;
        const workflows = await readDen(actor, "/v1/workflows");
        return { ...current, atlassian: await stateJson(`${atlassian.baseUrl}/state`), microsoft: await stateJson(`${microsoft.baseUrl}/state`), news: await stateJson(`${news.baseUrl}/state`), workflows: workflows.body, inference: inference.observations(), identity, actorEmail: actor.email };
      },
      assertIsolation,
      async captureTurnDiagnostic(label: string, identity: "owner" | "recipient" = "owner") {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(label)) throw new Error("Invalid private diagnostic label");
        const current = await this.current(identity);
        const readFailures: string[] = [];
        const read = (path: string) => engineRead(identity, path).catch(() => { readFailures.push(path); return undefined; });
        const [statuses, permissions, questions] = await Promise.all([read("/session/status"), read("/permission"), read("/question")]);
        const diagnostic = workshopTurnDiagnostic({ sessionId: current.sessionId ?? "", messages: current.messages, statuses, permissions, questions });
        const directory = join(reportDir, "private-observer"); await mkdir(directory, { recursive: true });
        await writeFile(join(directory, `${label}.diagnostic.json`), JSON.stringify({ at: Date.now(), ...diagnostic, readFailures }, null, 2) + "\n", { mode: 0o600 });
        return diagnostic;
      },
      async retainSceneEvidence(scene: SceneEvidence, native: { before: NativeWorkflowObservation; after: NativeWorkflowObservation }, recipientMessages?: unknown) {
        // Only owned synthetic business-state/audit readbacks, never runtime,
        // auth configuration, raw requests, or whole conversation snapshots.
        const business = (snapshot: SceneEvidence["before"]) => ({ atlassian: snapshot.atlassian, microsoft: snapshot.microsoft, news: snapshot.news, workflows: snapshot.workflows });
        const directory = join(reportDir, "private-observer");
        await mkdir(directory, { recursive: true });
        const operations = new Set([scene.after.atlassian, scene.after.microsoft, scene.after.news].flatMap((state) => record(state) && Array.isArray(state.audit) ? state.audit.flatMap((entry) => record(entry) && typeof entry.name === "string" ? [entry.name] : []) : []));
        const provenance = (messages: unknown) => Array.isArray(messages) ? messages.flatMap((message) => {
          if (!record(message) || !record(message.info) || message.info.role !== "assistant") return [];
          const info = message.info;
          return [Object.fromEntries(["id", "role", "providerID", "modelID", "sessionID", "agent", "finish", "time"].map((key) => [key, info[key]]))];
        }) : [];
        const actorProvenance = { owner: provenance(scene.after.messages), recipient: provenance(recipientMessages) };
        const businessToolCalls = observedWorkshopCalls(scene).filter((call) => [...operations].some((operation) => call.name === operation || call.name.endsWith(`_${operation}`) || call.name.endsWith(`:${operation}`) || call.name.endsWith(`.${operation}`)));
        let json = JSON.stringify({ id: scene.id, expected: scene.expected, before: business(scene.before), after: business(scene.after), registration: scene.scheduleRegistration ? business(scene.scheduleRegistration) : undefined, businessToolCalls, actorProvenance, native, serviceCalls: scene.serviceCalls, artifact: scene.artifact, workflow: scene.workflow, sharing: scene.sharing, schedule: scene.schedule }, null, 2);
        for (const secret of [operatorKey, ...redactions, owner.manifest.token, owner.manifest.hostToken, recipient.manifest.token, recipient.manifest.hostToken]) if (secret) json = json.replaceAll(secret, "[credential-redacted]");
        await writeFile(join(directory, `${scene.id}.json`), json + "\n", { mode: 0o600 });
      },
      async outsiderWorkflows() { return (await readDen(den.members.outsider!, "/v1/workflows")).body; },
      async workflowDetail(id: string, identity: "owner" | "recipient" = "owner") { return (await readDen(identity === "owner" ? den.admin : den.members.teammate!, `/v1/workflows/${encodeURIComponent(id)}`)).body; },
      assertScreenshotSafe: assertSafe,
      async inspectPptx(fileId: string, sessionId: string) {
        return inspectWorkshopPptx({ origin: microsoft.baseUrl, fileId, sessionId, directory: join(reportDir, "private-artifacts") });
      },
      async acknowledgeScheduledExecution(input: { eventId: string; sessionId: string; digestFileId: string; draftId: string; inferenceWitnessSequence: number }) {
        const current = await latestSession("owner");
        const paid = inference.observations().find((entry) => entry.sequence === input.inferenceWitnessSequence && entry.status === "completed");
        const state = await stateJson(`${microsoft.baseUrl}/state`);
        if (current !== input.sessionId || !paid || !state.files.some((file: Record<string, unknown>) => file.id === input.digestFileId) || !state.messages.some((mail: Record<string, unknown>) => mail.id === input.draftId && mail.isDraft === true)) throw new Error("Cannot attest a scheduled run without actual paid inference and persisted backend delivery.");
        const response = await fetch(`${news.baseUrl}/execution-receipt`, { method: "POST", headers: { "content-type": "application/json", "x-workshop-operator-token": operatorKey }, body: JSON.stringify(input) });
        if (!response.ok) throw new Error(`Owned scheduled receipt rejected: ${response.status}`);
      },
      async advanceNewsClock() {
        const response = await fetch(`${news.baseUrl}/clock`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ now: "2026-10-16T16:00:00Z" }) });
        if (!response.ok) throw new Error("Owned simulated clock advance failed.");
        return stateJson(`${news.baseUrl}/state`);
      },
      recordRow: (row: NarrativeRow) => rows.push(row),
      /** Film marker; optional data (e.g. on-screen element rects) lets the editor frame real UI instead of guessing. */
      markScene(label: string, data?: Record<string, unknown>) { if (filmRoot) markers.push({ label, at: Date.now(), ...data }); },
      person,
      /** Day demo, off camera: an admin opens the morning-news connector to the whole team. */
      async grantTeamConnector() { return newsConnectionAccess({ orgWide: true, memberIds: [] }); },
      async readDenAs(identity: "owner" | "recipient", path: string) { return (await readDen(identity === "owner" ? den.admin : den.members.teammate!, path)).body; },
      /** Opens Activity the way a person does: the sidebar bell, then View all. */
      async openActivity(identity: "owner" | "recipient" = "recipient") {
        const surface = identity === "owner" ? owner.app : recipient.app;
        const clicked = await evaluateOnSurface(surface, () => { const bell = Array.from(document.querySelectorAll("button")).find((element) => /^Activity/.test(element.getAttribute("aria-label") ?? "")); bell?.click(); return Boolean(bell); });
        if (!clicked) throw new Error("Activity bell not found");
        await delay(800);
        await evaluateOnSurface(surface, () => { const link = Array.from(document.querySelectorAll("a,button")).find((element) => element.textContent?.trim() === "View all"); (link as HTMLElement | undefined)?.click(); return Boolean(link); });
        return surface;
      },
      async activityText(identity: "owner" | "recipient" = "recipient") { return evaluateOnSurface(identity === "owner" ? owner.app : recipient.app, () => document.querySelector("[data-activity-page]")?.textContent ?? ""); },
      /** Film-only: keep the visible transcript on the newest output by pressing the app's own
       * "Jump to latest" control. Scroll position only; never types, submits or changes business state. */
      followLatest(identity: "owner" | "recipient" = "owner") {
        if (!filmRoot) return async () => undefined;
        const surface = identity === "owner" ? owner.app : recipient.app;
        const press = () => evaluateOnSurface(surface, () => { const button = Array.from(document.querySelectorAll("button")).find((element) => element.textContent?.trim() === "Jump to latest"); button?.click(); return Boolean(button); }).catch(() => false);
        let active = true;
        const loop = (async () => { while (active) { await press(); for (let slice = 0; active && slice < 10; slice++) await delay(250); } })();
        // The transcript stays static after the turn, so the film keeps the final answer without adding scene time.
        return async () => { if (!active) return; active = false; await loop; await press(); await delay(600); await press(); };
      },
      async finishDiagnostic(row: NarrativeRow) {
        await writeFile(join(reportDir, "diagnostic-result.json"), JSON.stringify({ ...identity, scope: "targeted diagnosis only; not full workshop acceptance", profile, row, rows: rows.length ? rows : [row], inference: inference.observations() }, null, 2) + "\n", { mode: 0o600 });
        if ((await workshopRunIdentity()).sourceDigest !== identity.sourceDigest) throw new Error("Workshop source changed during the diagnostic");
      },
      async finish() {
        const observations = inference.observations();
        const durationMs = Date.now() - startedAt;
        const aggregate = workshopRunBudget(rows, durationMs, observations);
        if ((await workshopRunIdentity()).sourceDigest !== identity.sourceDigest) aggregate.reasons.push("Workshop source changed during the paid run");
        const report = { ...identity, verdict: rows.every((row) => row.status === "PASS") && aggregate.reasons.length === 0 ? "PASS" : "INCOMPLETE", aggregate, docshotDirectory, profile, model: inference.metadata, fixedNow: FIXED_NOW, seedDigest, durationMs, rows, inference: observations };
        await writeFile(join(reportDir, "matrix.json"), JSON.stringify(report, null, 2) + "\n");
        if (aggregate.reasons.length) throw new Error(`Workshop aggregate verification failed: ${aggregate.reasons.join("; ")}`);
      },
      async [Symbol.asyncDispose]() { await resources.disposeAsync(); },
    };
  } catch (error) {
    await resources.disposeAsync();
    const name = error instanceof Error ? error.name : "Error";
    // Keep a full row matrix even when world construction is blocked; never manufacture successful scenes.
    let diagnostic = error instanceof Error ? error.message : "Unknown setup failure";
    for (const secret of redactions) if (secret) diagnostic = diagnostic.replaceAll(secret, "[credential-redacted]");
    diagnostic = diagnostic.replaceAll(root, "[owned-scratch]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 900);
    console.error(`[workshop] setup blocked at ${setupStage}: ${name}: ${diagnostic}`);
    return blocked(`Owned setup blocked at ${setupStage} (${name}): ${diagnostic}`, subjectMetadata);
  }
}
