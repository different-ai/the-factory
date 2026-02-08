/*
Mock UI sketch for Agent Lab (macOS-only direction).

- This is not production code.
- Purpose: capture layout + interaction ideas for the PRD.
- Tech choice (React) is illustrative; production could be Solid/Tauri.
*/

import React, { useCallback, useEffect, useRef, useState } from "react";

/* ==============================
   UTILS
   ============================== */
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PALETTES = [
  { body: "#6366f1", bg: "#eef2ff" },
  { body: "#8b5cf6", bg: "#f5f3ff" },
  { body: "#3b82f6", bg: "#eff6ff" },
  { body: "#10b981", bg: "#ecfdf5" },
  { body: "#f59e0b", bg: "#fffbeb" },
  { body: "#ef4444", bg: "#fef2f2" },
  { body: "#ec4899", bg: "#fdf2f8" },
  { body: "#0ea5e9", bg: "#f0f9ff" },
];

function AgentAvatar({ seed = "agent", size = 32 }: { seed?: string; size?: number }) {
  const h = hashStr(seed);
  const p = PALETTES[h % PALETTES.length];
  const shape = h % 3;
  const eyeStyle = (h >> 4) % 3;
  const hasAntenna = (h >> 8) % 3 === 0;
  const body =
    shape === 0 ? (
      <path d="M24 48C24 24 34 14 50 14C66 14 76 24 76 48C76 76 66 86 50 86C34 86 24 76 24 48Z" fill={p.body} />
    ) : shape === 1 ? (
      <rect x="23" y="20" width="54" height="56" rx="18" fill={p.body} />
    ) : (
      <ellipse cx="50" cy="52" rx="27" ry="33" fill={p.body} />
    );
  const eyes =
    eyeStyle === 0 ? (
      <>
        <circle cx="40" cy="44" r="3.5" fill="white" />
        <circle cx="60" cy="44" r="3.5" fill="white" />
      </>
    ) : eyeStyle === 1 ? (
      <>
        <rect x="37" y="42" width="6" height="4" rx="2" fill="white" />
        <rect x="57" y="42" width="6" height="4" rx="2" fill="white" />
      </>
    ) : (
      <>
        <ellipse cx="40" cy="44" rx="4" ry="5" fill="white" />
        <ellipse cx="60" cy="44" rx="4" ry="5" fill="white" />
        <circle cx="41" cy="44.5" r="2" fill={p.body} />
        <circle cx="61" cy="44.5" r="2" fill={p.body} />
      </>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", flexShrink: 0 }}>
      {hasAntenna && (
        <>
          <line x1="50" y1="14" x2="50" y2="5" stroke={p.body} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="4" r="2.5" fill={p.body} />
        </>
      )}
      {body}
      {eyes}
      <path
        d="M44,58 Q50,63 56,58"
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

/* ==============================
   ICONS
   ============================== */
const Ic = ({ d, size = 18, color = "currentColor", sw = 1.8 }: { d: string; size?: number; color?: string; sw?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d={d} />
  </svg>
);

const P = {
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  folder: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  check: "M20 6L9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  x: "M18 6L6 18M6 6l12 12",
  share: "M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7 M16 6l-4-4-4 4 M12 2v14",
  chevRight: "M9 18l6-6-6-6",
  chevDown: "M6 9l6 6 6-6",
  settings:
    "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z",
  play: "M5 3l14 9-14 9z",
  clock: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
  terminal: "M4 17l6-6-6-6M12 19h8",
  globe: "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  hash: "M4 9h16M4 15h16M10 3l-2 18M16 3l-2 18",
  phone:
    "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z",
  trash: "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  calendar: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18",
  copy:
    "M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  pkg:
    "M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
};

/* ==============================
   DATA
   ============================== */
const PRECONFIG = {
  name: "Scout",
  seed: "scout-01",
  skills: [
    { id: "web-search", name: "web-search", desc: "Search and summarize web content", tags: ["RESEARCH"] },
    { id: "transcribe", name: "local-transcribe", desc: "Transcribe audio/video locally with Whisper", tags: ["MEDIA", "LOCAL"] },
    { id: "file-ops", name: "file-writer", desc: "Read, create, and edit workspace files", tags: ["FILES"] },
  ],
  plugins: [
    { id: "scheduler", name: "opencode-scheduler", enabled: true },
    { id: "browser", name: "@different-ai/opencode-browser", enabled: true },
  ],
  apps: [
    { id: "notion", name: "Notion", url: "https://mcp.notion.com/mcp", status: "Connected" },
    { id: "linear", name: "Linear", url: "https://mcp.linear.app/mcp", status: "Connected" },
  ],
  automations: [
    {
      id: "fb-klipsch",
      name: "fb-marketplace-klipsch-heresy",
      schedule: "Every day at 09:00",
      status: "NOT RUN YET",
      prompt:
        'Use browser tools to search Facebook Marketplace for speakers matching "Klipsch Heresy IV" or "Klipsch Heresy III" within 5 miles of 94117. Capture top listings with title, price, location, and URL.',
      context: "/Users/ben/digital-empire",
      lastRun: "Never",
      created: "1/29/2026",
    },
  ],
  bot: { email: null, slack: null, whatsapp: null },
  folders: [
    { path: "~/projects/openwork", rw: false },
    { path: "~/documents", rw: false },
    { path: "~/downloads", rw: true },
  ],
};

const SKILL_CREATION_CHAT = [
  {
    role: "user",
    text: "create a skill that monitors my competitor's pricing pages daily and alerts me on Slack if anything changes",
  },
  { role: "step", label: "Creating skill: competitor-price-monitor" },
  { role: "step", label: "Writing SKILL.md with instructions" },
  { role: "step", label: "Configuring Slack webhook integration" },
  {
    role: "agent",
    text:
      "Created skill `competitor-price-monitor` in `.opencode/skills/competitor-price-monitor/`.\n\nIt will:\n1. Visit configured competitor URLs\n2. Extract pricing data and compare against last snapshot\n3. Post a Slack message if any price changed\n\nI also created an automation to run this daily at 8am. You can edit the competitor URLs in the skill config.\n\nWant me to do a test run now?",
  },
];

const SAMPLE_TASK = [
  { role: "user", text: "transcribe ~/downloads/demo-video.mov with subtitles. jargon: openwork, skills, agents, llms" },
  { role: "step", label: "Verify input video file exists", detail: "-rw-r--r--  staff  1.1G  ~/downloads/demo-video.mov" },
  { role: "step", label: "Check transcription dependencies", detail: "faster-whisper: installed OK\nffmpeg: available OK" },
  {
    role: "step",
    label: "Transcribe video locally (Whisper large-v3)",
    detail: "Model: faster-whisper large-v3 (on-device)\nJargon seeding: openwork, skills, agents, LLMs\nProcessing 4:23 of audio...",
  },
  {
    role: "step",
    label: "Generate subtitle files",
    detail: "transcripts/demo-video.srt  (52 segments)\ntranscripts/demo-video.vtt\ntranscripts/demo-video.txt",
  },
  { role: "step", label: "Jargon cleanup pass", detail: '"art infrastructure" -> "auth infrastructure"\n"whatsapp" -> "WhatsApp"' },
  {
    role: "agent",
    text:
      "Done. Transcribed ~/downloads/demo-video.mov using Whisper large-v3 (fully local).\n\nGenerated:\n- transcripts/demo-video.srt\n- transcripts/demo-video.vtt\n- transcripts/demo-video.txt\n\nJargon terms were seeded for accuracy. I also ran a cleanup pass to fix common mishearings.",
  },
];

/* ==============================
   MAIN EXPORT - WINDOW MOCK
   ============================== */
export default function AgentLabWindowMock() {
  const CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 3px; }
    button { font-family: inherit; cursor: pointer; }
    code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
    .hover-row:hover { background: #f8f9fb !important; }
    textarea:focus, input:focus { outline: none; }
    textarea::placeholder, input::placeholder { color: #bbb; }

    @keyframes fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes dot-pulse { 0%,100% { opacity: 0.15; } 50% { opacity: 0.8; } }
    .fade-up { animation: fade-up 0.25s ease-out both; }
  `;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, Segoe UI, Helvetica, Arial, sans-serif",
        background:
          "radial-gradient(1200px 900px at 15% 10%, rgba(99,102,241,0.22), transparent 55%), radial-gradient(900px 700px at 85% 10%, rgba(14,165,233,0.16), transparent 55%), linear-gradient(180deg, #0b1020, #060812)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <style>{CSS}</style>
      <div
        style={{
          width: "min(1180px, 100%)",
          height: "min(760px, 100%)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 25px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)",
          background: "#fff",
        }}
      >
        <AgentLabApp onClose={() => undefined} />
      </div>
    </div>
  );
}

/* ==============================
   AGENT LAB APP (inside the window)
   ============================== */
function AgentLabApp({ onClose }: { onClose: () => void }) {
  const [workers] = useState([PRECONFIG]);
  const [activeWorker, setActiveWorker] = useState<typeof PRECONFIG | null>(null);
  const [rightTab, setRightTab] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<number | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRunning]);

  const enterWorker = (w: any) => {
    setActiveWorker(w);
    setRightTab(null);
    setMessages([]);
    const s = { id: Date.now(), title: "New session", time: "Just now" };
    setSessions([s]);
    setActiveSession(s.id);
  };

  const runSequence = useCallback(
    (seq: any[]) => {
      if (isRunning) return;
      setIsRunning(true);
      setExpandedSteps({});
      let i = 0;
      const tick = () => {
        if (i < seq.length) {
          setTimeout(
            () => {
              setMessages((prev) => [...prev, seq[i]]);
              i++;
              tick();
            },
            seq[i].role === "step" ? 600 + Math.random() * 400 : i === 0 ? 100 : 500,
          );
        } else setIsRunning(false);
      };
      tick();
    },
    [isRunning],
  );

  const toggleStep = (idx: number) => setExpandedSteps((p) => ({ ...p, [idx]: !p[idx] }));

  const newSession = () => {
    const s = { id: Date.now(), title: "New session", time: "Just now" };
    setSessions((p) => [s, ...p]);
    setActiveSession(s.id);
    setMessages([]);
    setRightTab(null);
  };

  const TitleBar = ({ title }: { title: string }) => (
    <div
      style={{
        height: 38,
        display: "flex",
        alignItems: "center",
        background: "#f6f6f6",
        borderBottom: "1px solid #e0e0e0",
        padding: "0 14px",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", gap: 7 }}>
        <div
          onClick={onClose}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#ff5f57",
            cursor: "pointer",
            border: "0.5px solid rgba(0,0,0,0.1)",
          }}
        />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fdbc40", border: "0.5px solid rgba(0,0,0,0.1)" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#33c748", border: "0.5px solid rgba(0,0,0,0.1)" }} />
      </div>
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 13, fontWeight: 600, color: "#555" }}>{title}</div>
    </div>
  );

  if (!activeWorker) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>
        <TitleBar title="Agent Lab" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 520, padding: 32 }} className="fade-up">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <Ic d={P.terminal} size={20} color="#999" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em" }}>Agents</span>
            </div>
            {workers.map((w, i) => (
              <button
                key={i}
                onClick={() => enterWorker(w as any)}
                className="hover-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 12,
                  marginBottom: 8,
                  background: "white",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                }}
              >
                <AgentAvatar seed={(w as any).seed} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{(w as any).name}</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                    {(w as any).skills.length} skills - {(w as any).plugins.length} plugins - {(w as any).apps.length} apps
                  </div>
                </div>
                <Ic d={P.chevRight} size={16} color="#ccc" />
              </button>
            ))}
            <button
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 10,
                border: "1.5px dashed #ddd",
                background: "transparent",
                fontSize: 13,
                fontWeight: 500,
                color: "#999",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ic d={P.plus} size={15} /> Create agent
            </button>
          </div>
        </div>
        <BottomBar />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>
      <TitleBar title="Agent Lab" />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left sidebar */}
        <div style={{ width: 220, borderRight: "1px solid #f0f0f0", display: "flex", flexDirection: "column", background: "#fafbfc", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setActiveWorker(null)} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 8, padding: 0 }}>
              <AgentAvatar seed={activeWorker.seed} size={24} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{activeWorker.name}</div>
                <div style={{ fontSize: 10, color: "#999" }}>Local</div>
              </div>
            </button>
          </div>
          <div style={{ padding: "8px 12px 4px", fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" }}>Tasks</div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setActiveSession(s.id);
                  setRightTab(null);
                }}
                className="hover-row"
                style={{
                  padding: "7px 14px",
                  cursor: "pointer",
                  background: activeSession === s.id && !rightTab ? "#eef0ff" : "transparent",
                  borderRight: activeSession === s.id && !rightTab ? "2px solid #6366f1" : "2px solid transparent",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: activeSession === s.id ? 600 : 400,
                    color: "#333",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.title}
                </div>
                <div style={{ fontSize: 10, color: "#bbb" }}>{s.time}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: "1px solid #f0f0f0" }}>
            <button
              onClick={newSession}
              style={{
                width: "100%",
                padding: "6px 0",
                borderRadius: 6,
                border: "none",
                background: "transparent",
                fontSize: 11,
                color: "#888",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Ic d={P.plus} size={12} /> New session
            </button>
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "8px 20px", borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#999", display: "flex", alignItems: "center", gap: 6 }}>
            {rightTab ? (
              <>
                <span style={{ color: "#bbb" }}>{activeWorker.name}</span>
                <Ic d={P.chevRight} size={11} color="#ccc" />
                <span style={{ fontWeight: 600, color: "#333", textTransform: "capitalize" }}>{rightTab}</span>
              </>
            ) : (
              <span>{sessions.find((s) => s.id === activeSession)?.title || "New session"}</span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {!rightTab && (
              <ChatPanel
                worker={activeWorker}
                messages={messages}
                isRunning={isRunning}
                expandedSteps={expandedSteps}
                toggleStep={toggleStep}
                chatEndRef={chatEndRef}
                onRunSample={() => runSequence(SAMPLE_TASK)}
                onCreateSkill={() => runSequence(SKILL_CREATION_CHAT)}
              />
            )}
            {rightTab === "skills" && <SkillsPanel worker={activeWorker} />}
            {rightTab === "plugins" && <PluginsPanel worker={activeWorker} />}
            {rightTab === "apps" && <AppsPanel worker={activeWorker} />}
            {rightTab === "automations" && <AutomationsPanel worker={activeWorker} />}
            {rightTab === "share" && <SharePanel worker={activeWorker} />}
            {rightTab === "config" && <ConfigPanel worker={activeWorker} />}
          </div>

          {!rightTab && (
            <div style={{ padding: "8px 20px 10px", borderTop: "1px solid #f0f0f0" }}>
              <div style={{ maxWidth: 640, margin: "0 auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (chatInput.trim() && !isRunning) {
                        setMessages((p) => [...p, { role: "user", text: chatInput.trim() }]);
                        setChatInput("");
                      }
                    }
                  }}
                  placeholder={`Ask ${activeWorker.name}...`}
                  rows={1}
                  style={{ width: "100%", border: "none", padding: "10px 12px 4px", fontSize: 13, color: "#333", resize: "none", fontFamily: "inherit", lineHeight: 1.5, background: "transparent" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 10px 6px" }}>
                  <span style={{ fontSize: 11, color: "#bbb", display: "flex", alignItems: "center", gap: 4 }}>
                    <AgentAvatar seed={activeWorker.seed} size={12} /> {activeWorker.name}
                  </span>
                  <button
                    disabled={!chatInput.trim() || isRunning}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: chatInput.trim() ? "#111" : "#f0f0f0",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={chatInput.trim() ? "#fff" : "#ccc"} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right nav */}
        <div style={{ width: 160, borderLeft: "1px solid #f0f0f0", background: "#fff", padding: "12px 8px", flexShrink: 0 }}>
          {[
            { id: "share", label: "Share", icon: P.share },
            { id: "automations", label: "Automations", icon: P.clock },
            { id: "skills", label: "Skills", icon: P.zap },
            { id: "plugins", label: "Plugins", icon: P.pkg },
            { id: "apps", label: "Apps", icon: P.globe },
            { id: "config", label: "Config", icon: P.settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setRightTab(rightTab === item.id ? null : item.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 8,
                marginBottom: 1,
                border: "none",
                textAlign: "left",
                background: rightTab === item.id ? "#f3f4f6" : "transparent",
                color: rightTab === item.id ? "#111" : "#666",
                fontWeight: rightTab === item.id ? 600 : 400,
                fontSize: 13,
              }}
            >
              <Ic d={item.icon} size={16} color={rightTab === item.id ? "#111" : "#999"} /> {item.label}
            </button>
          ))}
        </div>
      </div>
      <BottomBar />
    </div>
  );
}

/* ==============================
   CHAT PANEL
   ============================== */
function ChatPanel({ worker, messages, isRunning, expandedSteps, toggleStep, chatEndRef, onRunSample, onCreateSkill }: any) {
  if (!messages.length && !isRunning) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, paddingBottom: 32 }} className="fade-up">
        <Ic d={P.zap} size={24} color="#ccc" />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#333" }}>What do you want to do?</div>
          <div style={{ fontSize: 13, color: "#999", marginTop: 3 }}>Pick a starting point or type below.</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
          <Chip label="Transcribe a video" onClick={onRunSample} />
          <Chip label="Create a new skill" onClick={onCreateSkill} />
          <Chip label="Set up an automation" onClick={() => {}} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {messages.map((m: any, i: number) => (
          <div key={i} className="fade-up">
            {m.role === "user" && <div style={{ padding: "10px 14px", background: "#f8f9fb", borderRadius: 10, fontSize: 13, lineHeight: 1.6, color: "#333" }}>{m.text}</div>}
            {m.role === "step" && <StepRow label={m.label} detail={m.detail} expanded={!!expandedSteps[i]} onToggle={() => toggleStep(i)} />}
            {m.role === "agent" && (
              <div style={{ padding: "10px 0", fontSize: 13, lineHeight: 1.7, color: "#333", whiteSpace: "pre-wrap" }}>
                {m.text}
                <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
                  <button style={{ background: "none", border: "none", color: "#ccc", padding: 3 }}>
                    <Ic d={P.copy} size={13} color="#ccc" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {isRunning && (
          <div style={{ display: "flex", gap: 3, padding: "6px 0" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#999", animation: `dot-pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

function SkillsPanel({ worker }: any) {
  return (
    <div style={{ padding: "20px 28px", maxWidth: 680 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Skills</div>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        Skills are scoped capabilities. Managed in <code className="mono" style={{ fontSize: 11, background: "#f5f5f5", padding: "1px 4px", borderRadius: 3 }}>.opencode/skills/</code>
      </p>
      {worker.skills.map((s: any) => (
        <div key={s.id} style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{s.name}</span>
            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, background: "#ecfdf5", color: "#15803d", fontWeight: 600 }}>Enabled</span>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>{s.desc}</div>
          {s.tags && <div style={{ display: "flex", gap: 4, marginTop: 6 }}>{s.tags.map((t: string) => <span key={t} style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "#f5f5f5", color: "#999", textTransform: "uppercase" }}>{t}</span>)}</div>}
        </div>
      ))}
    </div>
  );
}

function PluginsPanel({ worker }: any) {
  return (
    <div style={{ padding: "20px 28px", maxWidth: 680 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 3 }}>OpenCode plugins</h2>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 3 }}>
        Manage <code className="mono" style={{ fontSize: 11, background: "#f5f5f5", padding: "1px 4px", borderRadius: 3 }}>opencode.json</code> plugins.
      </p>
      <div style={{ fontSize: 11, color: "#bbb", marginBottom: 16 }}>Config: opencode.json (local)</div>
      {worker.plugins.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Enabled</div>
          {worker.plugins.map((p: any) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 5 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{p.name}</span>
              <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#f5f5f5", color: "#888", textTransform: "uppercase" }}>Enabled</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Add plugin</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input placeholder="opencode-wakatime" style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 12 }} />
        <button style={{ padding: "8px 16px", borderRadius: 6, background: "#111", color: "#fff", border: "none", fontSize: 12, fontWeight: 600 }}>Add</button>
      </div>
    </div>
  );
}

function AppsPanel({ worker }: any) {
  return (
    <div style={{ padding: "20px 28px", maxWidth: 680 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 3 }}>MCP (Alpha)</h2>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
        MCP servers let you connect services with your own credentials. <span style={{ color: "#6366f1", cursor: "pointer" }}>Docs -&gt;</span>
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        <span>Connected</span>
        <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>From opencode.json - + Add MCP</span>
      </div>
      {worker.apps.map((a: any) => (
        <div key={a.id} style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{a.name.toLowerCase()}</div>
              <div className="mono" style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{a.url}</div>
            </div>
            <span style={{ padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: "#ecfdf5", color: "#15803d", border: "1px solid #bbf7d0" }}>{a.status}</span>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 20, marginBottom: 8 }}>
        Quick Connect <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 6 }}>OAuth + local</span>
      </div>
      {["Notion", "Linear", "Slack"].map((n) => (
        <div key={n} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{n}</span>
          <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 10, fontWeight: 600, background: "#ecfdf5", color: "#15803d", border: "1px solid #bbf7d0" }}>Connected</span>
        </div>
      ))}
    </div>
  );
}

function SharePanel({ worker }: any) {
  const connect = {
    kind: "openwork.connect.v1",
    hostUrl: "http://127.0.0.1:8787",
    workspaceId: "ws_agent_scout",
    workspaceUrl: "http://127.0.0.1:8787/w/ws_agent_scout",
    token: "<token>",
    tokenScope: "collaborator",
    createdAt: 0,
  };

  return (
    <div style={{ padding: "20px 28px", maxWidth: 680 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 3 }}>Share</h2>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 14 }}>
        Sharing is the product. This agent can be local or hosted - the share flow stays the same.
      </p>

      <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Workspace URL</div>
        <div className="mono" style={{ fontSize: 12, color: "#111" }}>{connect.workspaceUrl}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 600, color: "#333", display: "flex", alignItems: "center", gap: 6 }}>
          <Ic d={P.copy} size={14} color="#666" /> Copy connect JSON
        </button>
        <button style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 600, color: "#333" }}>Create viewer token</button>
        <button style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", fontSize: 12, fontWeight: 600, color: "#333" }}>Create collaborator token</button>
        <button style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #111", background: "#111", fontSize: 12, fontWeight: 700, color: "#fff" }}>Deploy (Beta)</button>
      </div>

      <div style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fafbfc" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Connect artifact</div>
        <pre className="mono" style={{ fontSize: 11, color: "#555", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{JSON.stringify({ ...connect, createdAt: Date.now() }, null, 2)}</pre>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#999" }}>
        Tip: create a restricted agent for sharing rather than exposing your personal agent.
      </div>
    </div>
  );
}

function AutomationsPanel({ worker }: any) {
  return (
    <div style={{ padding: "20px 28px", maxWidth: 680 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Ic d={P.terminal} size={20} color="#999" />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>Automations</h2>
          <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "#f5f5f5", color: "#999" }}>BETA</span>
        </div>
        <button style={{ padding: "6px 14px", borderRadius: 6, background: "#111", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <Ic d={P.plus} size={12} color="#fff" /> New automation
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>Automations that run on a schedule from the connected server.</p>
      {worker.automations.map((a: any) => (
        <div key={a.id} style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <Ic d={P.calendar} size={14} color="#999" />
            <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{a.name}</span>
            <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "#f5f5f5", color: "#999" }}>{a.status}</span>
            <div style={{ flex: 1 }} />
            <button style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #e5e7eb", background: "white", fontSize: 11, color: "#555", display: "flex", alignItems: "center", gap: 3 }}>
              <Ic d={P.play} size={11} color="#555" /> Run
            </button>
            <button style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #fecaca", background: "white", fontSize: 11, color: "#dc2626", display: "flex", alignItems: "center", gap: 3 }}>
              <Ic d={P.trash} size={11} color="#dc2626" /> Delete
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 10, paddingLeft: 22 }}>{a.schedule}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 6, border: "1px solid #f0f0f0", background: "#fafbfc" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Prompt</div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{a.prompt}</div>
            </div>
            <div style={{ width: 180, padding: "10px 12px", borderRadius: 6, border: "1px solid #f0f0f0", background: "#fafbfc" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Run Context</div>
              <div className="mono" style={{ fontSize: 11, color: "#555", display: "flex", alignItems: "center", gap: 3 }}>
                <Ic d={P.folder} size={12} color="#999" /> {a.context}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10, color: "#bbb" }}>
            <span>Last run {a.lastRun}</span>
            <span>Created {a.created}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfigPanel({ worker }: any) {
  return (
    <div style={{ padding: "20px 28px", maxWidth: 680 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 16 }}>Config</h2>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Bot Surfaces</div>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>Give {worker.name} an identity people can message directly.</p>
      {[
        { label: "Email", icon: P.mail, desc: "Assign an email address" },
        { label: "Slack", icon: P.hash, desc: "Connect to a Slack workspace" },
        { label: "WhatsApp", icon: P.phone, desc: "Connect a WhatsApp number" },
      ].map((b) => (
        <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 5 }}>
          <Ic d={b.icon} size={16} color="#999" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#333" }}>{b.label}</div>
            <div style={{ fontSize: 11, color: "#999" }}>{b.desc}</div>
          </div>
          <button style={{ padding: "4px 12px", borderRadius: 5, border: "1px solid #e5e7eb", background: "white", fontSize: 11, color: "#555" }}>Connect</button>
        </div>
      ))}
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 20, marginBottom: 8 }}>Folder Access</div>
      {worker.folders.map((f: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 6, border: "1px solid #e5e7eb", marginBottom: 4 }}>
          <Ic d={P.folder} size={13} color="#999" />
          <span className="mono" style={{ flex: 1, fontSize: 12, color: "#333" }}>{f.path}</span>
          <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: f.rw ? "#fef3c7" : "#ecfdf5", color: f.rw ? "#b45309" : "#15803d" }}>{f.rw ? "rw" : "ro"}</span>
        </div>
      ))}
      <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 20, marginBottom: 8 }}>Runtime</div>
      <div style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12, color: "#666", lineHeight: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Sandbox</span>
          <span style={{ color: "#15803d", fontWeight: 600 }}>Docker</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Host</span>
          <span className="mono" style={{ fontWeight: 500 }}>localhost:8080</span>
        </div>
      </div>
    </div>
  );
}

function StepRow({ label, detail, expanded, onToggle }: any) {
  return (
    <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #f0f0f0", background: "#fafbfc", marginBottom: 2 }}>
      <button
        onClick={detail ? onToggle : undefined}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "transparent",
          border: "none",
          textAlign: "left",
          fontSize: 12,
          cursor: detail ? "pointer" : "default",
        }}
      >
        <Ic d={P.check} size={12} color="#22c55e" sw={2.5} />
        <span style={{ flex: 1, color: "#555", fontWeight: 500 }}>{label}</span>
        {detail && <Ic d={expanded ? P.chevDown : P.chevRight} size={11} color="#ccc" />}
      </button>
      {expanded && detail && <div className="mono" style={{ padding: "4px 10px 8px 28px", fontSize: 11, color: "#999", whiteSpace: "pre-wrap", lineHeight: 1.5, borderTop: "1px solid #f0f0f0" }}>{detail}</div>}
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: "6px 12px", borderRadius: 16, border: "1px solid #e5e7eb", background: "white", fontSize: 12, color: "#555", fontFamily: "inherit" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#999")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      {label}
    </button>
  );
}

function BottomBar() {
  return (
    <div style={{ height: 24, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderTop: "1px solid #f0f0f0", background: "#fafafa", fontSize: 10, color: "#bbb", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
        <span>Local</span>
      </div>
      <Ic d={P.settings} size={10} color="#ccc" />
    </div>
  );
}
