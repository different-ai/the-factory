import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { denFetch } from "../../evals/packages/behaviors/src/den.ts";
import type { Den } from "../../evals/packages/env/src/den.ts";
import { FAST_DEFAULT_VARIANT, catalogFastVariants } from "../../packages/types/src/cloud-model-fast.ts";
import { record } from "./acme-gateway.ts";

export interface WorkshopModelProfile {
  name: string;
  provider: "openai" | "openrouter";
  model: string;
  credentialEnv: "OPENAI_API_KEY" | "OPENROUTER_API_KEY";
  upstream: string;
  route: "/responses" | "/chat/completions";
  variant?: string;
  serviceTier?: "priority";
}

/** Fast is a request option, not a model-name suffix or a reasoning-effort alias. */
export function workshopModelProfile(argv: string[]): WorkshopModelProfile {
  function option(name: string) {
    const indices = argv.flatMap((value, index) => value === name ? [index] : []);
    if (indices.length > 1) throw new Error(`Duplicate ${name}.`);
    const index = indices[0];
    if (index === undefined) return undefined;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    return value;
  }
  const name = option("--model-profile");
  const model = option("--model");
  if (name && model) throw new Error("Use --model-profile or --model, not both.");
  if (name === "gpt-sol-fast") return {
    name, provider: "openai", model: "gpt-6.1-sol", credentialEnv: "OPENAI_API_KEY",
    upstream: "https://api.openai.com/v1", route: "/responses", variant: FAST_DEFAULT_VARIANT, serviceTier: "priority",
  };
  if (name === "qwen-27b") return {
    name, provider: "openrouter", model: "qwen/qwen3.8-27b", credentialEnv: "OPENROUTER_API_KEY",
    upstream: "https://openrouter.ai/api/v1", route: "/chat/completions",
  };
  if (name) throw new Error("--model-profile must be gpt-sol-fast or qwen-27b. No model fallback is permitted.");
  const legacy = model ?? "gpt-4.1";
  if (!/^[a-zA-Z0-9._-]+$/.test(legacy)) throw new Error("--model requires an OpenAI model ID.");
  // Keep the original world invocation compatible, but do not silently downgrade a requested subject.
  return { name: "legacy-openai", provider: "openai", model: legacy, credentialEnv: "OPENAI_API_KEY", upstream: "https://api.openai.com/v1", route: "/chat/completions" };
}

/** Capture only the selected credential, then remove paid keys before any child starts. */
export function takeWorkshopCredential(profile: WorkshopModelProfile, env: NodeJS.ProcessEnv = process.env): string {
  const key = env[profile.credentialEnv]?.trim();
  for (const name of ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "AI_GATEWAY_API_KEY", "AI_GATEWAY_AUTH_TOKEN"]) delete env[name];
  if (!key || key === "*not found*") {
    const path = profile.provider === "openrouter" ? "/openwork-ops" : "/";
    throw new Error(`BLOCKED: set ${profile.credentialEnv} from Infisical dev ${path} for this command. No service was started.`);
  }
  return key;
}

export function assertWorkshopModel(profile: WorkshopModelProfile, provider: unknown) {
  if (!record(provider) || !Array.isArray(provider.models)) throw new Error("BLOCKED: workshop provider has no model catalog.");
  const matches = provider.models.filter((model) => record(model) && model.upstreamModelId === profile.model);
  const model = matches[0];
  if (matches.length !== 1 || !record(model) || typeof model.id !== "string" || !record(model.config)) throw new Error("BLOCKED: exact workshop upstream model unavailable; no fallback.");
  if (profile.variant && (!record(provider.providerConfig) || !catalogFastVariants(model.config, provider.providerConfig.npm))) {
    throw new Error("BLOCKED: exact workshop model does not advertise verified native OpenAI priority/Fast semantics.");
  }
  return { id: model.id, config: model.config };
}

/** Only the newly booted world's canonical Den receives the paid credential. */
export async function seedWorkshopInference(den: Den, baseline: { orgId: string; providerId: string }, profile: WorkshopModelProfile, key: string) {
  const origin = new URL(den.ref.apiUrl);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !den.database || origin.username || origin.password) throw new Error("Workshop inference requires the owned local Den and its disposable database.");
  const headers = { authorization: `Bearer ${den.admin.token}`, "x-openwork-org-id": baseline.orgId };
  const created = await denFetch(den.admin, "/v1/inference-providers", {
    method: "POST", headers,
    body: JSON.stringify({ name: profile.name === "legacy-openai" ? "Workshop OpenAI" : `Workshop ${profile.name}`, providerId: profile.provider, modelIds: [profile.model],
      credential: { kind: "api_key", secret: key }, allMembers: true }),
  });
  const provider = record(created.body) && record(created.body.inferenceProvider) ? created.body.inferenceProvider : undefined;
  if (created.response.status !== 201 || typeof provider?.id !== "string") throw new Error(`BLOCKED: workshop provider creation HTTP ${created.response.status}; private response omitted. No fallback.`);
  const connected = await denFetch(den.admin, `/v1/inference-providers/${provider.id}/connect`, { headers });
  if (!connected.response.ok) throw new Error(`BLOCKED: workshop provider connect HTTP ${connected.response.status}; private response omitted.`);
  const inference = record(connected.body) ? connected.body.inferenceProvider : undefined;
  const model = assertWorkshopModel(profile, inference);
  const removed = await denFetch(den.admin, `/v1/inference-providers/${baseline.providerId}`, { method: "DELETE", headers });
  if (removed.response.status !== 204) throw new Error(`Could not remove the workshop's synthetic model: HTTP ${removed.response.status}`);
  return { providerId: provider.id, modelId: model.id, ...(profile.variant ? { variant: profile.variant } : {}) };
}

/** Explicit opt-in only: one bounded real GPT tool call through this world's gateway.
 * This is a protocol witness, not the workshop narrative or proof of engine variant selection.
 * No prompt, authorization, response ID, tool arguments or credential is retained.
 */
export async function probeWorkshopInference(den: Den, orgId: string, gatewayUrl: string, paid: { providerId: string; modelId: string }, profile: WorkshopModelProfile) {
  if (profile.name !== "gpt-sol-fast") throw new Error("Only gpt-sol-fast has an authorized startup protocol probe. Qwen inference must follow the GPT narrative.");
  const gateway = new URL(gatewayUrl);
  if (gateway.protocol !== "http:" || gateway.hostname !== "127.0.0.1" || gateway.username || gateway.password || gateway.search || gateway.hash || gateway.pathname !== "/") throw new Error("Workshop probe requires its owned loopback gateway.");
  const connected = await denFetch(den.admin, `/v1/inference-providers/${paid.providerId}/connect`, {
    headers: { authorization: `Bearer ${den.admin.token}`, "x-openwork-org-id": orgId },
  });
  const provider = record(connected.body) && record(connected.body.inferenceProvider) ? connected.body.inferenceProvider : undefined;
  if (!connected.response.ok || typeof provider?.apiKey !== "string") throw new Error("Workshop probe could not obtain its disposable gateway credential.");
  const started = Date.now();
  const route = `/api/v1/providers/${paid.providerId}/responses`;
  const response = await fetch(`${gateway.origin}${route}`, {
    method: "POST", redirect: "error", headers: { authorization: `Bearer ${provider.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: paid.modelId, service_tier: "priority", store: false, max_output_tokens: 512,
      input: "Call workshop_probe once with ok=true. Do not output prose.",
      tools: [{ type: "function", name: "workshop_probe", description: "Disposable protocol probe; no business data or writes.", strict: true,
        parameters: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false } }],
      tool_choice: { type: "function", name: "workshop_probe" } }),
    signal: AbortSignal.timeout(90_000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !record(body) || body.status !== "completed"
    || ![profile.model, paid.modelId].includes(String(body.model))
    || !["priority", "fast"].includes(String(body.service_tier))
    || !Array.isArray(body.output) || !body.output.some((item) => record(item) && item.type === "function_call" && item.name === "workshop_probe")) {
    throw new Error(`BLOCKED: GPT Responses/Fast tool-call witness failed (HTTP ${response.status}); private response omitted. No fallback or automatic retry.`);
  }
  const usage = record(body.usage) ? body.usage : {};
  const reasoning = record(body.reasoning) ? body.reasoning : {};
  return { profile: profile.name, upstreamModel: profile.model, route: `${profile.upstream}${profile.route}`,
    gatewayRoute: route, requestedVariant: profile.variant, requestedServiceTier: "priority", returnedServiceTier: String(body.service_tier),
    requestedReasoning: "unspecified (Fast/default)", returnedReasoningEffort: typeof reasoning.effort === "string" ? reasoning.effort : null,
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : null,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : null,
    maxOutputTokens: 512, elapsedMs: Date.now() - started, toolCall: true, scope: "explicit bounded gateway protocol probe; not a narrative/engine witness" };
}

export interface WorkshopInferenceWitness {
  sequence: number;
  profile: string;
  upstreamModel: string;
  route: string;
  requestedServiceTier: string | null;
  returnedServiceTier: string | null;
  requestedReasoningEffort: string | null;
  returnedReasoningEffort: string | null;
  requestedMaxOutputTokens: number | null;
  forwardedMaxOutputTokens: number;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  elapsedMs: number;
  httpStatus: number | null;
  /** Protocol metadata only: no response IDs, text, arguments, or tool results. */
  responseStatus: "queued" | "in_progress" | "completed" | "incomplete" | "failed" | "cancelled" | null;
  terminalEvent: "response.completed" | "response.incomplete" | "response.failed" | "error" | "[DONE]" | null;
  eofSeen: boolean;
  /** Saturates at 1,000,000; includes the Chat Completions [DONE] marker. */
  eventCount: number;
  finishReason: "stop" | "tool_calls" | "function_call" | "length" | "content_filter" | null;
  /** At most 32 distinct identifier pairs, each identifier at most 128 characters. */
  functionCalls: { name: string | null; callId: string | null }[];
  status: "started" | "completed" | "rejected" | "upstream-error" | "interrupted";
  rejection: string | null;
  costStatus: "unavailable" | "estimated-not-billed";
  estimatedUsd: number | null;
  /** Cost reported by the upstream usage payload, not independently reconciled against an invoice. */
  reportedCostUsd: number | null;
  /** Upstream error classification only (type/code/param and a short message), never request content or credentials. */
  upstreamError?: { type: string | null; code: string | null; param: string | null; message: string | null };
  /** A request body proves priority was requested, not which UI variant produced it. */
  variantEvidence: "priority-request-body" | "not-fast" | "automation-runner-chat-completions";
}

export interface WorkshopInferenceProxyOptions {
  maxConcurrentRequests?: number;
  maxRequests?: number;
  maxOutputTokens?: number;
  maxTotalOutputTokens?: number;
  maxInputBytes?: number;
  maxTotalInputBytes?: number;
  lifetimeMs?: number;
  requestTimeoutMs?: number;
  /** Test transport only; production callers omit this. The target URL remains pinned. */
  upstreamFetch?: typeof fetch;
  /** Also accept OpenAI Chat Completions from the local Automation runner (same pinned model and upstream). */
  allowRunnerChatCompletions?: boolean;
}

type ChatMessage = { role?: unknown; content?: unknown; tool_calls?: unknown; tool_call_id?: unknown };
function chatText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => record(part) && typeof part.text === "string" ? part.text : "").join("");
  return "";
}
/** Chat Completions request → Responses request (stateless, store=false). */
export function chatToResponses(body: Record<string, unknown>, maxOutputTokens: number) {
  const instructions: string[] = [];
  const input: unknown[] = [];
  for (const message of (Array.isArray(body.messages) ? body.messages : []) as ChatMessage[]) {
    const role = String(message.role ?? "");
    if (role === "system" || role === "developer") { instructions.push(chatText(message.content)); continue; }
    if (role === "user") { input.push({ role: "user", content: [{ type: "input_text", text: chatText(message.content) }] }); continue; }
    if (role === "assistant") {
      const text = chatText(message.content);
      if (text) input.push({ role: "assistant", content: [{ type: "output_text", text }] });
      for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
        if (!record(call) || !record(call.function)) continue;
        input.push({ type: "function_call", call_id: String(call.id), name: String(call.function.name), arguments: typeof call.function.arguments === "string" ? call.function.arguments : JSON.stringify(call.function.arguments ?? {}) });
      }
      continue;
    }
    if (role === "tool") input.push({ type: "function_call_output", call_id: String(message.tool_call_id), output: chatText(message.content) });
  }
  const tools = (Array.isArray(body.tools) ? body.tools : []).flatMap((tool) => record(tool) && record(tool.function)
    ? [{ type: "function", name: tool.function.name, description: tool.function.description ?? "", parameters: tool.function.parameters ?? { type: "object", properties: {} }, strict: false }] : []);
  return { model: body.model, input, ...(instructions.length ? { instructions: instructions.join("\n\n") } : {}), ...(tools.length ? { tools } : {}), max_output_tokens: maxOutputTokens, store: false, stream: false,
    ...(typeof body.reasoning_effort === "string" ? { reasoning: { effort: body.reasoning_effort } } : {}) };
}
/** Responses result → Chat Completions completion and equivalent stream chunks. */
export function responsesToChat(result: Record<string, unknown>, model: string) {
  let text = "";
  const calls: { id: string; type: "function"; function: { name: string; arguments: string } }[] = [];
  for (const item of Array.isArray(result.output) ? result.output : []) {
    if (!record(item)) continue;
    if (item.type === "message" && Array.isArray(item.content)) for (const part of item.content) if (record(part) && typeof part.text === "string") text += part.text;
    if (item.type === "function_call") calls.push({ id: String(item.call_id ?? item.id), type: "function", function: { name: String(item.name), arguments: typeof item.arguments === "string" ? item.arguments : "{}" } });
  }
  const incomplete = result.status === "incomplete";
  const finishReason = calls.length ? "tool_calls" : incomplete ? "length" : "stop";
  const usageIn = record(result.usage) ? result.usage : {};
  const usage = { prompt_tokens: Number(usageIn.input_tokens ?? 0), completion_tokens: Number(usageIn.output_tokens ?? 0), total_tokens: Number(usageIn.input_tokens ?? 0) + Number(usageIn.output_tokens ?? 0) };
  const id = `chatcmpl-${String(result.id ?? "workshop").slice(0, 40)}`; const created = Math.floor(Date.now() / 1000);
  const completion = { id, object: "chat.completion", created, model, choices: [{ index: 0, finish_reason: finishReason, message: { role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) } }], usage };
  const chunks = [
    { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { role: "assistant", content: text || "", ...(calls.length ? { tool_calls: calls.map((call, index) => ({ index, ...call })) } : {}) }, finish_reason: null }] },
    { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] },
    { id, object: "chat.completion.chunk", created, model, choices: [], usage },
  ];
  return { completion, chunks, finishReason: finishReason as "stop" | "tool_calls" | "length" };
}

/** Real paid upstream, but no paid key is ever put in provider config or a child environment.
 * Owned fixture config only: callers must place `provider` in the fresh world's runtime.
 * The proxy never discovers or mutates installed/org providers and never calls a business connector.
 * Creating the proxy sends NO inference request (including for Qwen).
 */
export async function startWorkshopInferenceProxy(stack: AsyncDisposableStack, profile: WorkshopModelProfile, paidKey: string, options: WorkshopInferenceProxyOptions = {}) {
  if (!["gpt-sol-fast", "qwen-27b"].includes(profile.name)) throw new Error("Recording proxy requires an exact workshop subject profile.");
  // Refuse caller-supplied profile lookalikes that could exfiltrate a paid key.
  const trusted = workshopModelProfile(["--model-profile", profile.name]);
  if (JSON.stringify(trusted) !== JSON.stringify(profile)) throw new Error("Untrusted workshop inference profile.");
  if (!paidKey.trim() || paidKey.trim() === "*not found*") throw new Error(`BLOCKED: missing ${profile.credentialEnv}; no inference attempted.`);
  const limits = {
    maxConcurrentRequests: options.maxConcurrentRequests ?? 4,
    maxRequests: options.maxRequests ?? 180,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
    maxTotalOutputTokens: options.maxTotalOutputTokens ?? 131072,
    maxInputBytes: options.maxInputBytes ?? 2 * 1024 * 1024,
    maxTotalInputBytes: options.maxTotalInputBytes ?? 32 * 1024 * 1024,
    lifetimeMs: options.lifetimeMs ?? 45 * 60_000,
    requestTimeoutMs: options.requestTimeoutMs ?? 180_000,
  };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid workshop inference bound: ${name}`);
  }
  const transport = options.upstreamFetch ?? fetch;
  const syntheticKey = `workshop-only-${randomUUID()}`;
  const witnesses: WorkshopInferenceWitness[] = [];
  const started = Date.now();
  const controllers = new Map<number, AbortController>();
  let inputBytes = 0;
  let outputReserved = 0;
  let active = 0;
  let stopped = false;
  const server = createServer(async (request, response) => {
    const requestStart = Date.now();
    const witness: WorkshopInferenceWitness = {
      sequence: witnesses.length + 1, profile: profile.name, upstreamModel: profile.model,
      route: `${profile.upstream}${profile.route}`, requestedServiceTier: null, returnedServiceTier: null,
      requestedReasoningEffort: null, returnedReasoningEffort: null, requestedMaxOutputTokens: null,
      forwardedMaxOutputTokens: 0, inputTokens: null, outputTokens: null, reasoningTokens: null,
      elapsedMs: 0, httpStatus: null, status: "started", rejection: null, costStatus: "unavailable", estimatedUsd: null, reportedCostUsd: null,
      variantEvidence: "not-fast", responseStatus: null, terminalEvent: null, eofSeen: false, eventCount: 0,
      finishReason: null, functionCalls: [],
    };
    // Unauthenticated traffic does not get to fill the in-memory witness ledger.
    if (request.method === "GET" && request.url === "/v1/models" && options.allowRunnerChatCompletions && request.headers.authorization === `Bearer ${syntheticKey}`) {
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ object: "list", data: [{ id: profile.model, object: "model", owned_by: "workshop" }] }));
      return;
    }
    if (request.headers.authorization !== `Bearer ${syntheticKey}`) {
      response.writeHead(401, { "content-type": "application/json" }).end('{"error":{"message":"Workshop synthetic authentication required"}}');
      return;
    }
    function reject(status: number, reason: string) {
      witness.status = "rejected";
      witness.rejection = reason;
      witness.httpStatus = status;
      witness.elapsedMs = Date.now() - requestStart;
      response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: `Workshop inference blocked: ${reason}` } }));
    }
    if (witnesses.length >= limits.maxRequests) { reject(429, "request-budget-exhausted"); return; }
    witnesses.push(witness);
    if (stopped || Date.now() - started >= limits.lifetimeMs) { reject(410, "world-inference-lifetime-exhausted"); return; }
    const runnerChat = Boolean(options.allowRunnerChatCompletions) && profile.route !== "/chat/completions" && request.url === "/v1/chat/completions";
    const route: WorkshopModelProfile["route"] = runnerChat ? "/chat/completions" : profile.route;
    witness.route = `${profile.upstream}${route}`;
    if (request.method !== "POST" || (request.url !== `/v1${profile.route}` && !runnerChat)) { reject(400, "wrong-protocol-route"); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > limits.maxInputBytes || inputBytes + size > limits.maxTotalInputBytes) { reject(413, "input-byte-budget-exhausted"); return; }
        chunks.push(bytes);
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!record(body) || body.model !== profile.model) { reject(400, "wrong-upstream-model"); return; }
      witness.requestedServiceTier = typeof body.service_tier === "string" ? body.service_tier : null;
      witness.requestedReasoningEffort = record(body.reasoning) && typeof body.reasoning.effort === "string" ? body.reasoning.effort
        : typeof body.reasoning_effort === "string" ? body.reasoning_effort : null;
      if (profile.serviceTier && !runnerChat && body.service_tier !== profile.serviceTier) { reject(400, "missing-priority-Fast-request-option"); return; }
      if ((!profile.serviceTier || runnerChat) && body.service_tier !== undefined) { reject(400, "unexpected-service-tier-for-Qwen"); return; }
      if (body.background === true || body.previous_response_id !== undefined || body.conversation !== undefined) { reject(400, "stored-or-background-inference-not-permitted"); return; }
      if (Array.isArray(body.tools) && body.tools.some((tool) => !record(tool) || tool.type !== "function")) { reject(400, "hosted-upstream-tools-not-permitted"); return; }
      witness.variantEvidence = runnerChat ? "automation-runner-chat-completions" : profile.serviceTier ? "priority-request-body" : "not-fast";
      // OpenAI's current models reject max_tokens on Chat Completions; OpenRouter (Qwen) still uses it.
      const tokenField = route === "/responses" ? "max_output_tokens" : profile.provider === "openai" && runnerChat ? "max_completion_tokens" : "max_tokens";
      const requested = body[tokenField] ?? body.max_completion_tokens ?? body.max_tokens;
      if (requested !== undefined && (!Number.isSafeInteger(requested) || typeof requested !== "number" || requested <= 0)) { reject(400, "invalid-output-token-bound"); return; }
      witness.requestedMaxOutputTokens = typeof requested === "number" ? requested : null;
      const allowance = Math.min(typeof requested === "number" ? requested : limits.maxOutputTokens, limits.maxOutputTokens, limits.maxTotalOutputTokens - outputReserved);
      if (allowance <= 0) { reject(429, "output-token-budget-exhausted"); return; }
      // Token bounds may be tightened, but Fast and reasoning are NEVER injected or modified.
      delete body.max_completion_tokens;
      delete body.max_tokens;
      body[tokenField] = allowance;
      if (route === "/responses") body.store = false;
      if (route === "/chat/completions" && body.stream === true) body.stream_options = { include_usage: true };
      witness.forwardedMaxOutputTokens = allowance;
      if (active >= limits.maxConcurrentRequests) { reject(429, "world-concurrent-request-budget-exhausted"); return; }
      inputBytes += size;
      outputReserved += allowance;
      active++;
      const controller = new AbortController();
      controllers.set(witness.sequence, controller);
      const timer = setTimeout(() => controller.abort(), limits.requestTimeoutMs);
      const disconnected = () => { if (!response.writableEnded) controller.abort(); };
      response.once("close", disconnected);
      let upstream: Response | undefined;
      let observedOutput: number | null = null;
      let upstreamFailed = false;
      let responsesCompleted = false;
      let chatFinished = false;
      let chatDone = false;
      function functionCall(value: unknown, chat = false) {
        if (!record(value)) return;
        const fn = chat && record(value.function) ? value.function : value;
        // Identifiers only, never arbitrary event fields or argument fragments.
        function identifier(value: unknown) {
          return typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value) ? value : null;
        }
        const name = identifier(fn.name);
        const callId = identifier(chat ? value.id : value.call_id);
        if ((name || callId) && witness.functionCalls.length < 32
          && !witness.functionCalls.some((call) => call.name === name && call.callId === callId)) witness.functionCalls.push({ name, callId });
      }
      function observe(value: unknown, streaming: boolean) {
        if (!record(value)) return;
        const result = record(value.response) ? value.response : value;
        switch (result.status) {
          case "queued": case "in_progress": case "completed": case "incomplete": case "failed": case "cancelled":
            witness.responseStatus = result.status;
        }
        switch (value.type) {
          case "response.completed":
            witness.terminalEvent = value.type;
            responsesCompleted = result.status === "completed";
            if (!responsesCompleted) upstreamFailed = true;
            break;
          case "response.incomplete": case "response.failed": case "error":
            witness.terminalEvent = value.type;
            upstreamFailed = true;
        }
        if (result.status === "failed" || result.status === "incomplete" || result.status === "cancelled"
          || value.error !== undefined && value.error !== null || result.error !== undefined && result.error !== null) upstreamFailed = true;
        if (!streaming && result.status === "completed") responsesCompleted = true;
        if (Array.isArray(result.output)) for (const item of result.output) {
          if (record(item) && item.type === "function_call") functionCall(item);
        }
        if (record(value.item) && value.item.type === "function_call") functionCall(value.item);
        if (Array.isArray(result.choices)) for (const choice of result.choices) {
          if (!record(choice)) continue;
          switch (choice.finish_reason) {
            case "stop": case "tool_calls": case "function_call": case "length": case "content_filter":
              witness.finishReason = choice.finish_reason;
              chatFinished = true;
          }
          const message = record(choice.delta) ? choice.delta : record(choice.message) ? choice.message : undefined;
          if (message && Array.isArray(message.tool_calls)) for (const call of message.tool_calls) functionCall(call, true);
          if (message && record(message.function_call)) functionCall(message.function_call);
        }
        if (typeof result.service_tier === "string") witness.returnedServiceTier = result.service_tier;
        if (record(result.reasoning) && typeof result.reasoning.effort === "string") witness.returnedReasoningEffort = result.reasoning.effort;
        const usage = record(result.usage) ? result.usage : undefined;
        if (usage) {
          if (typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0) witness.reportedCostUsd = usage.cost;
          const input = usage.input_tokens ?? usage.prompt_tokens;
          const output = usage.output_tokens ?? usage.completion_tokens;
          const details = record(usage.output_tokens_details) ? usage.output_tokens_details : record(usage.completion_tokens_details) ? usage.completion_tokens_details : {};
          if (typeof input === "number" && Number.isFinite(input) && input >= 0) witness.inputTokens = input;
          if (typeof output === "number" && Number.isFinite(output) && output >= 0) { witness.outputTokens = output; observedOutput = output; }
          if (typeof details.reasoning_tokens === "number") witness.reasoningTokens = details.reasoning_tokens;
        }
      }
      // The Automation runner speaks Chat Completions, but this model only takes function tools on /responses.
      // Like OpenWork's inference gateway, translate the request and answer formats; model and content unchanged.
      if (runnerChat && profile.route === "/responses") {
        try {
          const translated = chatToResponses(body, allowance);
          witness.route = `${profile.upstream}/responses (translated for Automation runner)`;
          const upstreamResponse = await transport(`${profile.upstream}/responses`, {
            method: "POST", redirect: "error", signal: controller.signal,
            headers: { authorization: `Bearer ${paidKey}`, "content-type": "application/json" }, body: JSON.stringify(translated),
          });
          witness.httpStatus = upstreamResponse.status;
          const raw = await upstreamResponse.text();
          let parsed: unknown = null; try { parsed = JSON.parse(raw); } catch { /* handled below */ }
          if (!upstreamResponse.ok || !record(parsed)) {
            witness.status = "upstream-error";
            const error = record(parsed) && record(parsed.error) ? parsed.error : {};
            const text = (value: unknown) => typeof value === "string" ? value.replaceAll(paidKey, "[key]").slice(0, 200) : null;
            witness.upstreamError = { type: text(error.type), code: text(error.code), param: text(error.param), message: text(error.message) };
            response.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: `Workshop upstream HTTP ${upstreamResponse.status}; private response omitted` } }));
            return;
          }
          observe(parsed, false);
          const chat = responsesToChat(parsed, profile.model);
          witness.status = parsed.status === "completed" ? "completed" : "interrupted";
          witness.finishReason = chat.finishReason;
          if (body.stream === true) {
            response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
            for (const chunk of chat.chunks) response.write(`data: ${JSON.stringify(chunk)}\n\n`);
            response.end("data: [DONE]\n\n");
            witness.terminalEvent = "[DONE]";
          } else {
            response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(chat.completion));
          }
        } catch {
          witness.status = "interrupted";
          if (!response.headersSent) response.writeHead(502, { "content-type": "application/json" }).end('{"error":{"message":"Workshop upstream interrupted; private details omitted"}}');
          else response.destroy();
        } finally {
          clearTimeout(timer); response.off("close", disconnected); controllers.delete(witness.sequence); active--;
          if (witness.outputTokens !== null) outputReserved -= Math.max(0, allowance - witness.outputTokens);
          witness.elapsedMs = Date.now() - requestStart;
          if (witness.inputTokens !== null && witness.outputTokens !== null) {
            witness.estimatedUsd = (witness.inputTokens * 4 + witness.outputTokens * 20) / 1_000_000;
            witness.costStatus = "estimated-not-billed";
          }
        }
        return;
      }
      try {
        upstream = await transport(`${profile.upstream}${route}`, {
          method: "POST", redirect: "error", signal: controller.signal,
          headers: { authorization: `Bearer ${paidKey}`, "content-type": "application/json" }, body: JSON.stringify(body),
        });
        witness.httpStatus = upstream.status;
        if (!upstream.ok || !upstream.body) {
          witness.status = "upstream-error";
          // Never relay upstream error bodies: they can echo credentials or prompt data. Keep only the classification.
          try {
            const raw = (await upstream.text()).slice(0, 8192);
            const parsed: unknown = JSON.parse(raw);
            const error = record(parsed) && record(parsed.error) ? parsed.error : {};
            const text = (value: unknown) => typeof value === "string" ? value.replaceAll(paidKey, "[key]").slice(0, 200) : null;
            witness.upstreamError = { type: text(error.type), code: text(error.code), param: text(error.param), message: text(error.message) };
          } catch { witness.upstreamError = { type: null, code: null, param: null, message: null }; }
          response.writeHead(502, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: `Workshop upstream HTTP ${upstream.status}; private response omitted` } }));
          return;
        }
        const streaming = upstream.headers.get("content-type")?.includes("text/event-stream");
        response.writeHead(upstream.status, { "content-type": streaming ? "text/event-stream" : "application/json", "cache-control": "no-store" });
        const decoder = new TextDecoder();
        let pending = "";
        function observeLine(line: string) {
          if (!line.startsWith("data:")) return;
          witness.eventCount = Math.min(1_000_000, witness.eventCount + 1);
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            chatDone = true;
            if (route === "/chat/completions") witness.terminalEvent = "[DONE]";
          } else { try { observe(JSON.parse(data), true); } catch { /* no raw events retained */ } }
        }
        const reader = upstream.body.getReader();
        while (true) {
          const next = await reader.read();
          if (next.done) { witness.eofSeen = true; break; }
          const chunk = next.value;
          response.write(chunk);
          pending += decoder.decode(chunk, { stream: true });
          if (streaming) {
            let end: number;
            while ((end = pending.indexOf("\n")) !== -1) {
              const line = pending.slice(0, end).trimEnd();
              pending = pending.slice(end + 1);
              observeLine(line);
            }
          }
          if (pending.length > 2 * 1024 * 1024) throw new Error("bounded-upstream-metadata-buffer-exceeded");
        }
        pending += decoder.decode();
        if (!streaming) { try { observe(JSON.parse(pending), false); } catch { /* preserve unavailable usage */ } }
        // EOF is transport evidence, not a successful protocol terminal. Forward bytes unchanged.
        const completed = route === "/responses" ? responsesCompleted && witness.responseStatus === "completed"
          : chatFinished && (!streaming || chatDone);
        witness.status = upstreamFailed ? "upstream-error" : completed ? "completed" : "interrupted";
        if (upstreamFailed) witness.rejection = "upstream-protocol-failure";
        else if (!completed) witness.rejection = "missing-protocol-terminal";
        response.end();
      } catch {
        witness.status = upstreamFailed ? "upstream-error" : "interrupted";
        if (upstreamFailed) witness.rejection = "upstream-protocol-failure";
        if (!response.headersSent) response.writeHead(502, { "content-type": "application/json" }).end('{"error":{"message":"Workshop upstream interrupted; private details omitted"}}');
        else response.destroy();
      } finally {
        clearTimeout(timer);
        response.off("close", disconnected);
        controllers.delete(witness.sequence);
        active--;
        // Keep the whole reservation for an interrupted/unknown-usage request.
        if (observedOutput !== null) outputReserved -= Math.max(0, allowance - observedOutput);
        witness.elapsedMs = Date.now() - requestStart;
        if (witness.inputTokens !== null && witness.outputTokens !== null) {
          const rates = profile.name === "gpt-sol-fast" ? { input: 4, output: 20 } : { input: 0.24, output: 2.2 };
          witness.estimatedUsd = (witness.inputTokens * rates.input + witness.outputTokens * rates.output) / 1_000_000;
          witness.costStatus = "estimated-not-billed";
        }
      }
    } catch {
      if (!response.headersSent) reject(400, "invalid-request-body");
      else response.destroy();
    }
  });
  server.requestTimeout = limits.requestTimeoutMs;
  server.headersTimeout = Math.min(30_000, limits.requestTimeoutMs);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  async function stop() {
    if (stopped) return;
    stopped = true;
    for (const controller of controllers.values()) controller.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  stack.defer(stop);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Workshop inference proxy did not bind.");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const providerId = `workshop-${profile.name}`;
  const provider = {
    npm: profile.provider === "openai" ? "@ai-sdk/openai" : "@ai-sdk/openai-compatible",
    name: `Workshop ${profile.name}`,
    options: { baseURL: baseUrl, apiKey: syntheticKey },
    models: { [profile.model]: {
      id: profile.model, name: profile.name === "gpt-sol-fast" ? "GPT-6.1 Sol" : "Qwen3.8 27B",
      family: profile.name === "gpt-sol-fast" ? "gpt-sol" : "qwen", reasoning: true, tool_call: true,
      temperature: profile.name !== "gpt-sol-fast", attachment: true,
      limit: { context: profile.name === "gpt-sol-fast" ? 1050000 : 1000000, output: limits.maxOutputTokens },
      ...(profile.variant ? { variants: { [profile.variant]: { serviceTier: "priority" } } } : {}),
    } },
  };
  function status() {
    const latest = witnesses.at(-1);
    if (!latest) return { status: "configured-not-yet-witnessed", reason: null };
    if (latest.status === "completed") return { status: "witnessed", reason: null };
    if (latest.status === "started") return { status: "running", reason: null };
    return { status: "blocked", reason: latest.rejection ?? `upstream-${latest.httpStatus ?? latest.status}` };
  }
  function abortAfter(sequence: number) { for (const [id, controller] of controllers) if (id >= sequence) controller.abort(); }
  return { baseUrl, providerId, modelId: profile.model, variant: profile.variant, provider, witnesses, limits, stop, status, abortAfter,
    metadata: { profile: profile.name, upstream: `${profile.upstream}${profile.route}`, requestedVariant: profile.variant ?? "default", status: "configured-not-yet-witnessed" } };
}

/** Optional fail-closed descriptor for native matrices that continue to a fresh second world. */
export async function prepareWorkshopInferenceProxy(stack: AsyncDisposableStack, profile: WorkshopModelProfile, paidKey: string | undefined, options: WorkshopInferenceProxyOptions = {}): Promise<
  { status: "blocked"; reason: string; proxy: null } | { status: "configured"; reason: null; proxy: Awaited<ReturnType<typeof startWorkshopInferenceProxy>> }
> {
  if (!paidKey?.trim() || paidKey.trim() === "*not found*") return { status: "blocked", reason: `missing-${profile.credentialEnv}`, proxy: null };
  try {
    const proxy = await startWorkshopInferenceProxy(stack, profile, paidKey, options);
    return { status: "configured", reason: null, proxy };
  } catch {
    return { status: "blocked", reason: "workshop-inference-configuration-unavailable", proxy: null };
  }
}
