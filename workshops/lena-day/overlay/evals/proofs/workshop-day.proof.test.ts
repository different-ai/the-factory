import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";
import { spec } from "@openwork/testkit";
import { browserScript, evaluateOnSurface } from "@openwork/cdp";
import { workshopNarrative } from "../worlds/workshop-narrative.ts";
import { workshopTurnTerminal as terminal } from "../worlds/workshop-turn-diagnostics.ts";

/**
 * "A day with Lena": short, human-sized prompts against fresh in-memory workplace services.
 * Every check reads the services/Den independently after the turn; the observer never performs a
 * business write the model was asked to do (the only operator actions are the simulated 09:00
 * dispatch of the model's own saved job and an admin connector grant, both labelled in the matrix).
 */
const test = spec.world(workshopNarrative, {
  timeout: 420_000,
  needs: { placement: "local", commands: ["bun", "infisical"], optIn: ["OPENWORK_WORKSHOP_NARRATIVE", "OPENWORK_WORKSHOP_DAY"] },
  resources: { surfaces: ["appWeb", "web"], services: ["den"] },
});
const profile = process.env.OPENWORK_WORKSHOP_PROFILE ?? "gpt-sol-fast";
// Smaller open-weight models are ~3× slower per step; give them the same task with a proportionate clock.
const TURN_MS = profile === "qwen-27b" ? 600_000 : 360_000;
type Json = Record<string, unknown>;
const record = (value: unknown): Json => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => JSON.stringify(value ?? "");
interface Row { askedQuestion?: string; id: string; title: string; status: "PASS" | "FAIL" | "BLOCKED"; reasons: string[]; latencyMs: number; prompt?: string; operator?: string; evidence?: Json }

test("a day with Lena: short prompts, real tools, independent readback", { timeout: 2_400_000 }, async ({ world: subject, user, agent, probe, step }) => {
  const rows: Row[] = [];
  if (!subject.ready) throw new Error(subject.blockedReason);
  const world = subject;
  const appUser = user.on(world.app);
  const appAgent = agent.on(world.app);
  // Film mode: 2x device pixels so close-ups of the composer and answer stay sharp, visible typing, Enter to send.
  const FILM_HIRES = process.env.OPENWORK_WORKSHOP_FILM_HIRES === "1";
  await appUser.resizeViewport({ width: 1440, height: 1000, deviceScaleFactor: FILM_HIRES ? 2 : 1 });
  const services = user.on(world.serviceBrowser);
  if (FILM_HIRES) await services.resizeViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  /** Film-only, read-only: where the composer, send button and latest answer are on screen (CSS px). */
  const screenRects = () => probe.eval(world.app, () => {
    const box = (element: Element | null | undefined) => { if (!element) return null; const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; };
    const editor = Array.from(document.querySelectorAll('[contenteditable="true"][data-lexical-editor="true"]')).find((element) => element.getBoundingClientRect().width > 0) ?? null;
    const named = (element: Element) => (element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.textContent ?? "").trim();
    const send = Array.from(document.querySelectorAll("button")).find((element) => named(element) === "Run task" && element.getBoundingClientRect().width > 0) ?? null;
    let shell: Element | null = editor;
    while (shell?.parentElement && send && !shell.contains(send)) shell = shell.parentElement;
    const assistants = Array.from(document.querySelectorAll('[data-message-role="assistant"]')).filter((element) => element.getBoundingClientRect().height > 0);
    const finalText = Array.from(assistants.at(-1)?.querySelectorAll(".text-foreground.prose") ?? []).at(-1) ?? null;
    const users = Array.from(document.querySelectorAll('[data-message-role="user"]')).filter((element) => element.getBoundingClientRect().height > 0);
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, editor: box(editor), composer: box(shell), send: box(send), answer: box(finalText), prompt: box(users.at(-1)) };
  }).catch(() => null);
  const assistantText = (messages: unknown, since: Set<unknown>) => list(messages).map(record).filter((message) => record(message.info).role === "assistant" && !since.has(record(message.info).id)).flatMap((message) => list(message.parts).map(record).filter((part) => part.type === "text").map((part) => String(part.text ?? ""))).join("\n");
  const toolNames = (messages: unknown, since: Set<unknown>) => list(messages).map(record).filter((message) => !since.has(record(message.info).id)).flatMap((message) => list(message.parts).map(record).filter((part) => part.type === "tool").map((part) => `${part.tool} ${text(record(record(part.state).input))}`));
  const ids = (messages: unknown) => new Set(list(messages).map((message) => record(record(message).info).id));

  /** One human turn in the composer; optional new session. Returns snapshots around it. */
  /** Picks a Library skill from the composer's "/" menu (what a person does to run a saved skill). */
  async function pickSkill(match: RegExp) {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await appUser.type("composer", "/", { replace: true });
      await new Promise((resolve) => setTimeout(resolve, 900));
      const picked = await evaluateOnSurface(world.app, browserScript((pattern: string) => {
        const options = Array.from(document.querySelectorAll('[role="listbox"][aria-label="Commands"] [role="option"]'));
        const option = options.find((element) => /Skill/.test(element.textContent ?? "") && new RegExp(pattern, "i").test(element.textContent ?? ""));
        if (!option) return "";
        option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); (option as HTMLElement).click();
        return option.textContent ?? "";
      }, [match.source])).catch(() => "");
      if (picked) return String(picked);
      // New skills reach the composer on its next refresh; focus is one of its triggers.
      await evaluateOnSurface(world.app, () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    await appUser.type("composer", "", { replace: true });
    return "";
  }
  /** The app can still be finishing its first boot; retry the product's own New session a few times. */
  async function newSession(title: string) {
    for (let attempt = 1; ; attempt++) {
      try { await appAgent.createSession(title); await appUser.see("composer"); return; }
      catch (error) { if (attempt >= 4) throw error; await new Promise((resolve) => setTimeout(resolve, 15_000)); }
    }
  }
  async function turn(id: string, prompt: string, options: { session?: string; skill?: RegExp } = {}) {
    if (options.session) await newSession(options.session);
    const before = await world.observe();
    const since = ids(before.messages);
    const inferenceStart = before.inference.length;
    const pickedSkill = options.skill ? await pickSkill(options.skill) : "";
    if (pickedSkill) world.markScene(`${id}:skill-picked`);
    const started = Date.now();
    if (FILM_HIRES) {
      // What a person does on camera: click into the composer, type, press Enter.
      world.markScene(`${id}:typing`, { rects: await screenRects() });
      await appUser.type("composer", prompt, { replace: !pickedSkill, intervalMs: 28 });
      world.markScene(`${id}:typed`, { rects: await screenRects() });
      await appUser.press("Enter");
      world.markScene(`${id}:enter`);
      // Enter is the product's own submit; fall back to the button only if the draft is still there.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const pending = await probe.eval(world.app, () => (Array.from(document.querySelectorAll('[contenteditable="true"][data-lexical-editor="true"]')).find((element) => element.getBoundingClientRect().width > 0)?.textContent ?? "").trim().length).catch(() => 0);
      if (pending > 0) await appUser.click("Run task");
    } else {
      await appUser.type("composer", prompt, { replace: !pickedSkill });
      await appUser.click("Run task");
    }
    world.markScene(`${id}:prompt`);
    const stopFollow = world.followLatest();
    let completed = true;
    await probe.eventually(() => world.current(), { within: TURN_MS, intervalMs: 500, label: `${id} assistant finished`, until: (value) => terminal(value.messages, since) }).catch(async () => {
      completed = false;
      await appAgent.run("composer.stop").catch(() => undefined);
      world.abortInferenceAfter(inferenceStart + 1);
    });
    await stopFollow();
    world.markScene(`${id}:answered`, FILM_HIRES ? { rects: await screenRects() } : undefined);
    await world.settleInference();
    let after = await world.observe();
    // A person answers a clarifying question; record that it happened rather than hiding it.
    let askedQuestion = "";
    const firstAnswer = assistantText(after.messages, since).trim();
    if (completed && /\?\s*$/.test(firstAnswer) && firstAnswer.length < 600) {
      askedQuestion = firstAnswer.split("\n").at(-1) ?? firstAnswer;
      const replySince = ids(after.messages);
      await appUser.type("composer", "Yes, please go ahead.", { replace: true });
      await appUser.click("Run task");
      world.markScene(`${id}:reply`);
      const stopReplyFollow = world.followLatest();
      await probe.eventually(() => world.current(), { within: TURN_MS, intervalMs: 500, label: `${id} assistant finished after reply`, until: (value) => terminal(value.messages, replySince) }).catch(async () => {
        completed = false;
        await appAgent.run("composer.stop").catch(() => undefined);
      });
      await stopReplyFollow();
      world.markScene(`${id}:answered`);
      await world.settleInference();
      after = await world.observe();
    }
    const latencyMs = Date.now() - started;
    return { before, after, since, completed, latencyMs, askedQuestion, pickedSkill, answer: assistantText(after.messages, since), tools: toolNames(after.messages, since), requests: after.inference.slice(inferenceStart) };
  }
  async function show(id: string, url: string, expectText: string, label = expectText) {
    await services.navigate(url);
    world.markScene(`${id}:service:${label}`);
    await services.see({ text: expectText }, { timeoutMs: 15_000 }).catch(() => undefined);
    await services.screenshot();
  }
  const ms = (state: unknown) => record(state);
  const newItems = (before: unknown[], after: unknown[]) => { const old = new Set(before.map((item) => record(item).id)); return after.map(record).filter((item) => !old.has(item.id)); };
  const files = (snapshot: { microsoft: unknown }) => list(ms(snapshot.microsoft).files);
  const mails = (snapshot: { microsoft: unknown }) => list(ms(snapshot.microsoft).messages).map(record);
  const sentNothing = (before: { microsoft: unknown }, after: { microsoft: unknown }) => newItems(mails(before).filter((mail) => mail.parentFolderId === "sentitems"), mails(after).filter((mail) => mail.parentFolderId === "sentitems")).length === 0;
  async function pptxCheck(file: Json | undefined, sessionId: string | null, mustContain: RegExp[]) {
    if (!file) return { ok: false, reason: "No new PowerPoint file in OneDrive", slides: 0 };
    const inspected = await world.inspectPptx(String(file.id), sessionId ?? "");
    if (!("artifact" in inspected) || !inspected.artifact.validPresentation) return { ok: false, reason: `PowerPoint did not open: ${inspected.reason}`, slides: 0 };
    const missing = mustContain.filter((pattern) => !pattern.test(inspected.artifact.extractedText));
    return { ok: missing.length === 0, reason: missing.length ? `Deck is missing ${missing.map(String).join(", ")}` : "", slides: inspected.artifact.slideCount, sha256: inspected.artifact.sha256 };
  }
  const record_ = (row: Row) => { rows.push(row); world.markScene(`${row.id}:end:${row.status}`); console.log(`[day ${profile}] ${row.id} ${row.status} ${Math.round(row.latencyMs / 1000)}s ${row.reasons.join("; ").slice(0, 200)}`); };
  let lastSessionPath = "";
  const only = process.env.OPENWORK_WORKSHOP_DAY_ONLY?.split(",").map((value) => value.trim()).filter(Boolean);
  async function scene(id: string, title: string, body: () => Promise<Omit<Row, "id" | "title">>) {
    if (only?.length && !only.includes(id)) return;
    await step(`${id}: ${title}`, async () => {
      world.markScene(`${id}:start`);
      const here = String(await evaluateOnSurface(world.app, () => location.pathname + location.search).catch(() => ""));
      if (/\/session\//.test(here)) lastSessionPath = here;
      try { record_({ id, title, ...(await body()) }); }
      catch (error) {
        record_({ id, title, status: "FAIL", reasons: [error instanceof Error ? error.message.slice(0, 400) : "error"], latencyMs: 0 });
        // Never leave the app parked outside a chat (e.g. on Automations): later steps start from a session.
        await evaluateOnSurface(world.app, browserScript((path: string) => { if (!/\/session\//.test(location.pathname) && path) { history.pushState(history.state, "", path); window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })); } return true; }, [lastSessionPath])).catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await appAgent.run("composer.stop").catch(() => undefined);
      }
    });
  }
  const verdict = (reasons: string[], completed: boolean) => (!completed ? "FAIL" : reasons.length ? "FAIL" : "PASS") as Row["status"];
  const checks = (pairs: Array<[boolean, string]>) => pairs.filter(([ok]) => !ok).map(([, reason]) => reason);

  // ── Morning: the brief Lena set up (shown as "how it's set up"), then its first real run.
  const setupPrompt = "Every weekday at 9am, put a short news brief for France, the US, Germany and Japan in a draft email for me.";
  let automationId = "";
  await scene("D0", "Set up the morning brief as an Automation", async () => {
    const t = await turn("D0", setupPrompt, { session: "Morning brief" });
    // The proposal card sits inside the collapsed "Worked for …" steps; open them the way a person would.
    await evaluateOnSurface(world.app, () => { const toggle = Array.from(document.querySelectorAll("button,summary,[role=button]")).filter((element) => /^Worked for/.test(element.textContent?.trim() ?? "")).at(-1); (toggle as HTMLElement | undefined)?.click(); return Boolean(toggle); }).catch(() => false);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await evaluateOnSurface(world.app, () => { document.querySelector("[data-openwork-automation-proposal]")?.scrollIntoView({ block: "center" }); return true; }).catch(() => false);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const card = await evaluateOnSurface(world.app, () => { const node = document.querySelector("[data-openwork-automation-proposal]"); return node ? { text: node.textContent ?? "", resolution: node.getAttribute("data-automation-model-resolution") ?? "" } : null; });
    world.markScene("D0:proposal");
    if (card) await appUser.click({ role: "button", label: "Create Automation" }).catch(() => undefined);
    const deadline = Date.now() + 30_000;
    while (card && Date.now() < deadline && !automationId) {
      automationId = String(await evaluateOnSurface(world.app, () => document.querySelector("[data-openwork-automation-proposal]")?.getAttribute("data-automation-created") ?? ""));
      if (!automationId) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    world.markScene("D0:created");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const stored = automationId ? record(await world.readDenAs("owner", `/v1/automations/${encodeURIComponent(automationId)}`)) : {};
    const reasons = checks([[Boolean(card), "No Automation proposal"], [Boolean(automationId), `Create Automation did not succeed (model resolution: ${card?.resolution ?? "none"})`], [/9|09/.test(text(stored)), "Saved Automation has no 9am schedule"], [!newItems(mails(t.before), mails(t.after)).some((mail) => /brief|news/i.test(String(mail.subject))), "Brief was produced before it was due"]]);
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, prompt: setupPrompt, evidence: { automationId, modelResolution: card?.resolution, schedule: text(record(stored.automation ?? stored).schedule).slice(0, 200) } };
  });
  await scene("D1", "The Automation runs (Run now) and the brief arrives", async () => {
    if (!automationId) return { status: "BLOCKED", reasons: ["No Automation to run"], latencyMs: 0 };
    const before = await world.observe();
    const started = Date.now();
    const sessionPath = String(await evaluateOnSurface(world.app, () => location.pathname + location.search));
    await appUser.click({ role: "button", label: "Open Automation" });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    world.markScene("D1:automations");
    // Open this Automation's detail (what clicking it in the list does); Run now lives there.
    await evaluateOnSurface(world.app, browserScript((id: string) => { const url = new URL(location.href); url.searchParams.set("automation", id); history.pushState(history.state, "", url.pathname + url.search); window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })); return true; }, [automationId]));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    world.markScene("D1:automation-detail");
    await appUser.click({ role: "button", label: "Run now" });
    world.markScene("D1:run-now");
    let run: Json = {};
    const deadline = Date.now() + 360_000;
    while (Date.now() < deadline) {
      const runs = list(record(await world.readDenAs("owner", `/v1/automations/${encodeURIComponent(automationId)}/runs`)).items ?? record(await world.readDenAs("owner", `/v1/automations/${encodeURIComponent(automationId)}/runs`)).runs).map(record);
      run = runs[0] ?? {};
      if (["succeeded", "failed", "cancelled", "error"].includes(String(run.status))) break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    world.markScene("D1:run-done");
    // Open this run's receipt so the page shows the finished state (what a person clicks after Run now).
    if (run.id) await evaluateOnSurface(world.app, browserScript((id: string, runId: string) => { const url = new URL(location.href); url.searchParams.set("automation", id); url.searchParams.set("run", runId); history.pushState(history.state, "", url.pathname + url.search); window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })); return true; }, [automationId, String(run.id)])).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    world.markScene("D1:run-visible");
    const after = await world.observe();
    const draft = newItems(mails(before), mails(after)).find((mail) => mail.isDraft === true && [/france/i, /germany/i, /japan/i].every((country) => country.test(text(mail.body))));
    const runnerErrors = after.inference.slice(before.inference.length).filter((request) => request.status !== "completed").map((request) => ({ route: request.route, status: request.status, http: request.httpStatus, rejection: request.rejection, upstream: request.upstreamError }));
    const newDrafts = newItems(mails(before), mails(after)).filter((mail) => mail.isDraft === true).map((mail) => ({ subject: mail.subject, body: text(mail.body).slice(0, 300) }));
    const newsCalls = list(ms(after.news).audit).length - list(ms(before.news).audit).length;
    console.log(`[day ${profile}] D1 run ${JSON.stringify({ status: run.status, summary: String(run.resultSummary ?? run.result_summary ?? run.summary ?? "").slice(0, 600), newDrafts, newsCalls, mailAudit: list(ms(after.microsoft).audit).slice(list(ms(before.microsoft).audit).length).map((entry) => record(entry).name) }).slice(0, 2500)}`);
    if (run.status !== "succeeded" || runnerErrors.length) console.log(`[day ${profile}] D1 runner diagnostics ${JSON.stringify({ status: run.status, error: run.error, runnerErrors, runnerRequests: after.inference.length - before.inference.length }).slice(0, 2500)}`);
    const reasons = checks([[run.status === "succeeded", `Automation run ${String(run.status ?? "not found")}`], [Boolean(draft), "No draft brief covering France, Germany and Japan"], [sentNothing(before, after), "Mail was sent"]]);
    if (draft) await show("D1", `${world.urls.outlook}?message=${encodeURIComponent(String(draft.id))}`, "Edit draft", "draft");
    // Back to the chat, where the rest of the day happens.
    await evaluateOnSurface(world.app, browserScript((path: string) => { history.pushState(history.state, "", path); window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })); return true; }, [sessionPath]));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return { status: reasons.length ? "FAIL" : "PASS", reasons, latencyMs: Date.now() - started, operator: "Run now clicked in the Automations page (instead of waiting for 09:00)", evidence: { runStatus: run.status, runId: run.id, draft: draft?.subject } };
  });
  const followPrompt = "Anything in this morning's brief that matters for Blue Harbor or Northwind?";
  await scene("D2", "Ask about the brief", async () => {
    const t = await turn("D2", followPrompt, { session: "Morning brief follow-up" });
    const reasons = checks([[t.answer.trim().length > 40, "No useful answer"], [/blue harbor|northwind/i.test(t.answer), "Answer doesn't relate to her customers"], [sentNothing(t.before, t.after), "Mail was sent"]]);
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: followPrompt };
  });

  // ── Organise the day.
  const sortPrompt = "Set up To do, In progress and Done folders in Outlook and sort my inbox into them.";
  await scene("D3", "Sort the inbox into To do / In progress / Done", async () => {
    const t = await turn("D3", sortPrompt, { session: "Inbox" });
    const folders = list(ms(t.after.microsoft).folders).map(record);
    const wanted = ["to do", "in progress", "done"].map((name) => folders.find((folder) => String(folder.displayName).toLowerCase() === name));
    const customIds = new Set(wanted.filter(Boolean).map((folder) => folder!.id));
    const received = mails(t.after).filter((mail) => !mail.isDraft && ["mail-northwind-1", "mail-northwind-2", "mail-blueharbor-1", "mail-blueharbor-2", "mail-finance", "mail-design"].includes(String(mail.id)));
    const sorted = received.filter((mail) => customIds.has(mail.parentFolderId));
    const reasons = checks([[wanted.every(Boolean), "Missing one of To do / In progress / Done"], [sorted.length >= 5, `Only ${sorted.length} of 6 inbox messages sorted`], [received.length === 6, "A message disappeared"]]);
    await show("D3", world.urls.outlook, "To do", "folders");
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: sortPrompt, evidence: { folders: wanted.map((folder) => folder ? { name: folder.displayName, count: folder.totalItemCount } : null) } };
  });

  // ── Customer work, then make it repeatable.
  const comparePrompt = "Blue Harbor wants to know how Atlas 2 and Atlas Lift compare for their pallet moves. Can you make me a one-slide summary and draft a reply to Mateo?";
  let firstComparisonMs = 0;
  await scene("D4", "Customer comparison slide + reply", async () => {
    const t = await turn("D4", comparePrompt, { session: "Blue Harbor comparison" });
    firstComparisonMs = t.latencyMs;
    const deck = newItems(files(t.before), files(t.after)).find((file) => /\.pptx$/i.test(String(file.name)));
    const check = await pptxCheck(deck, t.after.sessionId, [/Atlas\s*2/i, /Atlas\s*Lift/i, /1[,.]?200/]);
    const reply = newItems(mails(t.before), mails(t.after)).find((mail) => mail.isDraft === true && mail.conversationId === "thread-blueharbor");
    const reasons = checks([[check.ok, check.reason], [Boolean(reply), "No draft reply in the Blue Harbor thread"], [sentNothing(t.before, t.after), "Mail was sent"]]);
    if (deck) await show("D4", `${world.urls.oneDrive}?item=${encodeURIComponent(String(deck.id))}`, String(deck.name));
    if (reply) await show("D4", `${world.urls.outlook}?message=${encodeURIComponent(String(reply.id))}`, "Edit draft", "reply");
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: comparePrompt, evidence: { deck: deck?.name, slides: check.slides, sha256: check.sha256 } };
  });
  const skillPrompt = "That's exactly what I needed. Save it as a skill so I can do this for other customers.";
  let skillPluginId = "";
  let skillSlug = "";
  await scene("D5", "Save it as a skill", async () => {
    const libraryBefore = text(await world.readDenAs("owner", "/v1/me/library"));
    const t = await turn("D5", skillPrompt);
    const library = await world.readDenAs("owner", "/v1/me/library");
    const created = t.tools.find((name) => /create_skill/.test(name));
    const afterCreate = text(t.after.messages).split("create_skill").slice(1).join("");
    const pluginId = /plg_[0-9a-z]{26}/.exec(afterCreate)?.[0] ?? "";
    skillPluginId = pluginId;
    // The saved skill's name (frontmatter slug) is what Activity and the "/" menu show.
    skillSlug = /Skill created: ([a-z0-9-]+)/.exec(afterCreate)?.[1] ?? /\\"name\\":\\"([a-z0-9-]+)\\"/.exec(afterCreate)?.[1] ?? "";
    const reasons = checks([[Boolean(created), "create_skill was not called"], [text(library) !== libraryBefore, "Library unchanged"], [Boolean(pluginId), "No skill plugin id returned"]]);
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: skillPrompt, evidence: { pluginId } };
  });
  const reusePrompt = "Northwind is asking the same thing for moving totes from the dock to the line.";
  await scene("D6", "Second customer, using the skill", async () => {
    const t = await turn("D6", reusePrompt, { session: "Northwind comparison", skill: /compar/ });
    const usedSkill = t.tools.some((name) => /get_skill/.test(name));
    const deck = newItems(files(t.before), files(t.after)).find((file) => /\.pptx$/i.test(String(file.name)));
    const check = await pptxCheck(deck, t.after.sessionId, [/Atlas\s*2/i, /Atlas\s*Lift/i]);
    const reply = newItems(mails(t.before), mails(t.after)).find((mail) => mail.isDraft === true && mail.conversationId === "thread-northwind");
    const reasons = checks([[usedSkill, "The saved skill was not loaded"], [check.ok, check.reason], [Boolean(reply), "No draft reply in the Northwind thread"], [sentNothing(t.before, t.after), "Mail was sent"]]);
    if (deck) await show("D6", `${world.urls.oneDrive}?item=${encodeURIComponent(String(deck.id))}`, String(deck.name));
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: `${t.pickedSkill ? "[/skill] " : ""}${reusePrompt}`, evidence: { usedSkill, pickedSkill: t.pickedSkill.slice(0, 120), faster: t.latencyMs < firstComparisonMs, firstMs: firstComparisonMs, secondMs: t.latencyMs, deck: deck?.name, slides: check.slides, sha256: check.sha256 } };
  });
  const sharePrompt = "Nice. Share that skill with Nora.";
  await scene("D7", "Share the skill with Nora", async () => {
    const t = await turn("D7", sharePrompt);
    const org = record(await world.readDenAs("recipient", "/v1/org"));
    const noraMember = String(record(org.currentMember).id ?? "");
    const access = skillPluginId ? await world.readDenAs("owner", `/v1/plugins/${skillPluginId}/access`) : null;
    const grant = list(record(access).items).map(record).find((item) => item.orgMembershipId === noraMember && !item.removedAt);
    const reasons = checks([[Boolean(skillPluginId), "No skill to share"], [Boolean(grant), "Nora has no access grant"]]);
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: sharePrompt, evidence: { role: grant?.role } };
  });

  // ── Account review.
  const deckPrompt = "Make me a short deck for tomorrow's review of Northwind and Blue Harbor.";
  await scene("D8", "Account review deck", async () => {
    const t = await turn("D8", deckPrompt, { session: "Account review" });
    const deck = newItems(files(t.before), files(t.after)).find((file) => /\.pptx$/i.test(String(file.name)));
    const check = await pptxCheck(deck, t.after.sessionId, [/Northwind/i, /Blue\s*Harbor/i, /\$\s?\d/]);
    const reasons = checks([[check.ok, check.reason], [check.slides >= 3, `Only ${check.slides} slides`]]);
    if (deck) await show("D8", `${world.urls.oneDrive}?item=${encodeURIComponent(String(deck.id))}`, String(deck.name));
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: deckPrompt, evidence: { deck: deck?.name, slides: check.slides, sha256: check.sha256 } };
  });

  // ── Small admin.
  const jiraPrompt = "Can you ask Nora to update the Project XYZ docs? Make it a Jira task.";
  await scene("D9", "Jira task for Nora", async () => {
    const t = await turn("D9", jiraPrompt, { session: "Docs follow-up" });
    const before = new Set(list(record(ms(t.before.atlassian).jira).issues).map((issue) => record(issue).id));
    const issue = list(record(ms(t.after.atlassian).jira).issues).map(record).find((item) => !before.has(item.id) && item.project === "DOC");
    const reasons = checks([[Boolean(issue), "No DOC issue"], [issue?.assignee === "nora", "Not assigned to Nora"], [/xyz/i.test(String(issue?.summary ?? "")), "Summary doesn't mention Project XYZ"]]);
    if (issue) await show("D9", `${world.urls.jira}/browse/${issue.key}`, String(issue.key));
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: jiraPrompt, evidence: { key: issue?.key, summary: issue?.summary } };
  });
  const itPrompt = "I'm locked out of Windows. Can you open an IT ticket for me?";
  await scene("D10", "IT ticket", async () => {
    const t = await turn("D10", itPrompt, { session: "Locked out" });
    const before = new Set(list(record(ms(t.before.atlassian).jira).issues).map((issue) => record(issue).id));
    const issue = list(record(ms(t.after.atlassian).jira).issues).map(record).find((item) => !before.has(item.id) && item.project === "ITSD");
    const reasons = checks([[Boolean(issue), "No IT service desk request"], [/windows login/i.test(text(issue)), "Application is not Windows login"], [!/password\s*[:=]/i.test(t.answer), "Asked for or echoed a password"]]);
    if (issue) await show("D10", `${world.urls.jira}/browse/${issue.key}`, "Windows login");
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: itPrompt, evidence: { key: issue?.key } };
  });
  const dogPrompt = "Can I bring my dog to the office?";
  await scene("D11", "Honest answer when the handbook is silent", async () => {
    const t = await turn("D11", dogPrompt, { session: "Office question" });
    const reasons = checks([[/people op(s|erations)|camila|\bHR\b|human resources/i.test(t.answer), "Doesn't say who to ask (People Ops)"], [/(couldn.t|could not|can.t|cannot|didn.t|did not|no) .{0,40}(find|policy|mention)|not (documented|covered|mentioned)|(says|is) nothing about/i.test(t.answer), "Doesn't say the policy wasn't found"]]);
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: dogPrompt };
  });
  const bookPrompt = "Book 30 minutes with Nora and Priya on Monday at 10 to go over the Atlas comparison.";
  const movePrompt = "Actually, can you move it to Tuesday at 11?";
  await scene("D12", "Book, then move, a meeting", async () => {
    const first = await turn("D12a", bookPrompt, { session: "Atlas review meeting" });
    const second = await turn("D12b", movePrompt);
    const created = newItems(list(ms(first.before.microsoft).events), list(ms(second.after.microsoft).events)).filter((event) => /atlas/i.test(String(event.subject)));
    const meeting = created[0];
    const start = String(record(meeting?.start).dateTime ?? "");
    const people = text(meeting?.attendees);
    const reasons = checks([[created.length === 1, `${created.length} Atlas meetings exist (want exactly one)`], [/2026-10-20T11:00/.test(start), `Final start is ${start || "missing"}, not Tuesday 11:00`], [/nora@acme\.test/.test(people) && /priya@acme\.test/.test(people), "Nora and Priya not both invited"]]);
    if (meeting) await show("D12", `${world.urls.outlook}?event=${encodeURIComponent(String(meeting.id))}`, String(meeting.subject));
    return { status: verdict(reasons, first.completed && second.completed), reasons, latencyMs: first.latencyMs + second.latencyMs, askedQuestion: [first.askedQuestion, second.askedQuestion].filter(Boolean).join(" | ") || undefined, prompt: `${bookPrompt} → ${movePrompt}`, evidence: { start, tz: record(meeting?.start).timeZone } };
  });
  const donePrompt = "I've answered Blue Harbor and Northwind — move those threads to Done.";
  await scene("D13", "Close the loop: threads to Done", async () => {
    const t = await turn("D13", donePrompt, { session: "Wrap up" });
    const done = list(ms(t.after.microsoft).folders).map(record).find((folder) => String(folder.displayName).toLowerCase() === "done");
    const threadMail = mails(t.after).filter((mail) => !mail.isDraft && ["thread-blueharbor", "thread-northwind"].includes(String(mail.conversationId)));
    const reasons = checks([[Boolean(done), "No Done folder"], [threadMail.length > 0 && threadMail.every((mail) => mail.parentFolderId === done?.id), "Not every Blue Harbor/Northwind message is in Done"]]);
    await show("D13", world.urls.outlook, "Done", "folders");
    return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: donePrompt };
  });

  // ── Optional advanced: an App (only when the Den App builder is on).
  if (process.env.OPENWORK_WORKSHOP_DAY_APPS === "1") {
    const appPrompt = "Can you build me a small app that shows my two pilots — units, value and status — from the forecast in OneDrive?";
    await scene("D14", "Build a small App", async () => {
      const t = await turn("D14", appPrompt, { session: "Pilot tracker app" });
      const created = t.tools.some((name) => /create_app/.test(name));
      const reasons = checks([[created, "create_app was not called"], [!/error|failed/i.test(t.answer.slice(-200)) || created, "App build failed"]]);
      await new Promise((resolve) => setTimeout(resolve, 6000));
      world.markScene("D14:app-visible");
      return { status: verdict(reasons, t.completed), reasons, latencyMs: t.latencyMs, askedQuestion: t.askedQuestion || undefined, prompt: appPrompt };
    });
  }

  // ── Stay up to date: what Nora sees.
  await scene("D15", "Nora's Activity: a shared skill and a new connector", async () => {
    const started = Date.now();
    const connector = await world.grantTeamConnector();
    world.markScene("D15:granted");
    let activity = "";
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await world.openActivity("recipient");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      activity = String(await world.activityText("recipient"));
      if (/was shared with you/i.test(activity) && /ready to use/i.test(activity)) break;
      await evaluateOnSurface(world.recipientApp, () => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 12_000));
    }
    world.markScene("D15:activity");
    await user.on(world.recipientApp).screenshot();
    // Must be Lena's own skill: other items (e.g. organization plugins) can also be "shared with you".
    const skillName = skillSlug;
    const sharedSkill = Boolean(skillName) && activity.toLowerCase().includes(`${skillName.toLowerCase()} was shared with you`);
    const reasons = checks([[sharedSkill, `Lena's skill${skillName ? ` (${skillName})` : ""} not in Nora's Activity`], [/ready to use/i.test(activity), `${connector} not in Nora's Activity`]]);
    return { status: reasons.length ? "FAIL" : "PASS", reasons, latencyMs: Date.now() - started, operator: `Admin opened the ${connector} connector to the whole team (off camera)`, evidence: { activity: activity.slice(0, 600) } };
  });

  // ── After the day: where to send feedback (opened, never submitted).
  await scene("D16", "Feedback form (opened only)", async () => {
    await appUser.click({ role: "button", label: "Account menu" });
    await appUser.click({ role: "menuitem", label: "Feedback" });
    const surface = await world.feedbackSurface();
    world.markScene("D16:feedback");
    await user.on(surface).screenshot();
    return { status: "PASS", reasons: [], latencyMs: 0, operator: "Form opened for the closing shot; nothing submitted" };
  });

  const observations = (await world.observe()).inference;
  const estimatedUsd = observations.reduce((sum, request) => sum + (request.estimatedUsd ?? 0), 0);
  await writeFile(join(world.reportDir, "day-matrix.json"), JSON.stringify({ profile, model: world.model, person: world.person, rows, passed: rows.filter((row) => row.status === "PASS").length, total: rows.length, estimatedUsd, requests: observations.length }, null, 2) + "\n");
  expect(rows.filter((row) => row.status !== "PASS").map((row) => `${row.id} ${row.status}: ${row.reasons.join("; ")}`)).toEqual([]);
});
