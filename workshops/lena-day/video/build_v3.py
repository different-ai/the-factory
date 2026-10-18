#!/usr/bin/env python3
"""Build the v3 cut config from a finished day run (markers, prompts, rendered decks). Usage: build_v3.py <run_dir> <qwen_summary_json_or_-> <out.json>"""
import json, subprocess, sys
from pathlib import Path

run = Path(sys.argv[1]); qwen = None if sys.argv[2] == "-" else json.loads(Path(sys.argv[2]).read_text()); out = Path(sys.argv[3])
V = Path(__file__).resolve().parent.parent; A = V / "audio-v3"; S = V / "slides-v3"
N = json.loads((V / "build/narration-v3.json").read_text())
P = "gpt-sol-fast"
matrix = json.loads((run / P / "day-matrix.json").read_text())
rows = {r["id"]: r for r in matrix["rows"]}
prompt = lambda i: (rows.get(i, {}).get("prompt") or "").replace("[/skill] ", "")
SIDE = "Lena Hoffmann · Account Manager"

# Render each generated deck with LibreOffice (real bytes from the run).
slides = {}
for i in ("D4", "D6", "D8"):
    sha = (rows.get(i, {}).get("evidence") or {}).get("sha256")
    if not sha: continue
    deck = run / P / "private-artifacts" / f"{sha}.pptx"
    if deck.exists():
        subprocess.run([str(V / "build/render_pptx.sh"), str(deck), str(S / i)], check=True, capture_output=True)
        slides[i] = sorted(str(p) for p in (S / i).glob("slide-*.png"))

def turn(s, e, chip, **k): return dict(kind="turn", surface=k.pop("surface", "owner-app"), start=s, end=e, chip=chip, **k)
def still(m, chip, surface="services", **k): return dict(kind="still", surface=surface, marker=m, chip=chip, **k)
def imgs(paths, chip, **k): return dict(kind="images", paths=paths, chip=chip, **k)
def beat(id, parts, ask=None, **k): return dict(id=id, profile=P, chip="", side=SIDE, audio=str(A / f"{id}.mp3"), narration=N[id], parts=parts, **({"ask": ask} if ask else {}), **k)

reuse_ask = prompt("D6")
if "[/skill]" in (rows.get("D6", {}).get("prompt") or ""): reuse_ask = f"/customer comparison skill  ·  {reuse_ask}"
first, second = (rows.get("D6", {}).get("evidence") or {}).get("firstMs"), (rows.get("D6", {}).get("evidence") or {}).get("secondMs")
reuse_tag = f"First time {round(first/1000)} s · with the skill {round(second/1000)} s" if first and second else None

beats = [
  dict(id="intro", chip="", audio=str(A / "intro.mp3"), narration=N["intro"], captions=False, parts=[dict(kind="title", title="A day with Lena", lines=["Account manager at Acme Robotics. One customer question, one account review, and everything else that comes up.", "OpenWork, right next to Outlook, OneDrive, Confluence and Jira. Fictional company and people."])]),
  beat("brief", [still(r"D1:run-now", "09:00 · The morning brief runs · Automations", surface="owner-app", settle=1500, bounded=False, result="Run started · the brief is being written"),
                 still(r"D1:service:draft", "09:00 · The brief, waiting in her drafts · Outlook", bounded=False, result="Outlook: Morning news brief (draft, not sent)", focus=[0.45, 0.05, 1.0, 0.8])]),
  beat("ask", [turn(r"D2:prompt", r"D2:answered", "09:05 · A quick question · OpenWork", lead=3, tail=3, outcome="Answered against her two accounts")], ask=prompt("D2")),
  beat("setup", [turn(r"D0:prompt", r"D0:answered", "How it was set up · one sentence · OpenWork", lead=3, tail=2, weight=0.5),
                 still(r"D0:proposal", "How it was set up · review the Automation · OpenWork", surface="owner-app", settle=900, result="Weekdays at 09:00 · Create Automation", weight=1.2),
                 still(r"D1:automation-detail", "How it was set up · it's live · Automations", surface="owner-app", settle=0, result="Automation created and active", weight=1.0)], ask=prompt("D0")),
  beat("inbox", [turn(r"D3:prompt", r"D3:answered", "09:15 · Sort my inbox · OpenWork", lead=2.5, tail=3, outcome="Folders created; inbox sorted"),
                 still(r"D3:service:folders", "09:15 · To do, In progress, Done · Outlook", bounded=False, result="Outlook: To do · In progress · Done", focus=[0.0, 0.1, 0.22, 0.62])], ask=prompt("D3")),
  beat("compare", [turn(r"D4:prompt", r"D4:answered", "09:30 · A customer question · OpenWork", lead=3, tail=3, outcome="Slide saved to OneDrive · reply drafted"),
                   *( [imgs(slides["D4"][:1], "09:30 · The slide, opened from OneDrive", result="OneDrive: one-slide comparison (.pptx)", weight=1.4)] if slides.get("D4") else []),
                   still(r"D4:service:reply", "09:30 · Draft reply to Mateo · Outlook", bounded=False, result="Outlook: reply drafted, not sent", focus=[0.45, 0.05, 1.0, 0.8])], ask=prompt("D4")),
  beat("skill", [turn(r"D5:prompt", r"D5:answered", "10:00 · Save it as a skill · OpenWork", lead=2.5, tail=2.5, endLast=True, outcome="Saved as a skill")], ask=prompt("D5")),
  beat("reuse", [turn(r"D6:prompt", r"D6:answered", "11:00 · Same question, new customer · OpenWork", lead=3, tail=2.5, outcome="Done with her skill", doneTag=reuse_tag),
                 *( [imgs(slides["D6"][:1], "11:00 · Northwind's slide, opened from OneDrive", result="OneDrive: Northwind comparison (.pptx)", weight=1.3)] if slides.get("D6") else [])], ask=reuse_ask),
  beat("share", [turn(r"D7:prompt", r"D7:answered", "11:05 · Share it with Nora · OpenWork", lead=2, tail=2.5, outcome="Shared with Nora")], ask=prompt("D7")),
  beat("deck", [turn(r"D8:prompt", r"D8:answered", "13:00 · A deck for tomorrow · OpenWork", lead=2.5, tail=2, weight=0.6, outcome="Deck saved to OneDrive"),
                *( [imgs(slides["D8"][:3], "13:00 · The deck, opened from OneDrive", result="OneDrive: account review deck (.pptx)")] if slides.get("D8") else [])], ask=prompt("D8")),
  beat("admin", [turn(r"D9:prompt", r"D9:answered", "14:00 · A task for Nora · OpenWork", lead=2.5, tail=2, endLast=True, weight=0.8, askText=prompt("D9"), outcome="Jira task created for Nora"),
                 still(r"D9:service:.*", "14:00 · Created in Jira", bounded=False, weight=0.8, result="Jira: task assigned to Nora"),
                 turn(r"D10:prompt", r"D10:answered", "14:20 · Locked out · OpenWork", lead=2.5, tail=2, weight=0.8, askText=prompt("D10"), outcome="IT ticket filed"),
                 still(r"D10:service:.*", "14:20 · IT ticket in Jira", bounded=False, weight=0.8, result="Jira: Windows login reset request (request only)")]),
  beat("dog", [turn(r"D11:prompt", r"D11:answered", "15:00 · An office question · OpenWork", lead=2.5, tail=2.5, outcome="Not in the handbook: ask People Ops")], ask=prompt("D11")),
  beat("meeting", [turn(r"D12a:prompt", r"D12a:answered", "15:30 · Book a meeting · OpenWork", lead=2.5, tail=2, weight=0.5, askText=prompt("D12").split(" → ")[0]),
                   turn(r"D12b:prompt", r"D12b:answered", "15:31 · Move it · OpenWork", lead=2, tail=2, weight=0.6, askText=prompt("D12").split(" → ")[-1]),
                   still(r"D12:service:.*", "15:31 · Outlook calendar", bounded=False, result="Outlook: same meeting, Tuesday 11:00", focus=[0.45, 0.05, 1.0, 0.6])]),
  beat("done", [turn(r"D13:prompt", r"D13:answered", "17:00 · Close the loop · OpenWork", lead=2.5, tail=2, weight=0.7, outcome="Threads moved to Done"),
                still(r"D13:service:folders", "17:00 · Threads in Done · Outlook", bounded=False, result="Outlook: Done", focus=[0.0, 0.1, 0.22, 0.62])], ask=prompt("D13")),
  beat("app", [turn(r"D14:prompt", r"D14:answered", "Going further · a live app · OpenWork", lead=2.5, tail=3, weight=0.6),
               still(r"D14:app-visible", "Going further · Pilot forecast, live in OpenWork", surface="owner-app", settle=0, weight=1.6, result="App: Pilot forecast · Refresh pulls the latest numbers", focus=[0.7, 0.0, 1.0, 1.0])], ask=prompt("D14")),
  beat("activity", [still(r"D15:activity", "Next morning · Nora's Activity · OpenWork", surface="recipient-app", settle=200, result="Shared skill · new connector available", focus=[0.08, 0.05, 0.92, 0.75])]),
]
if qwen:
  beats.append(dict(id="qwen", chip="", audio=str(A / "qwen.mp3"), narration=qwen["narration"], parts=[dict(kind="title", title=qwen["title"], lines=qwen["lines"])]))
beats.append(dict(id="end", profile=P, chip="", side="", audio=str(A / "end.mp3"), narration=N["end"], parts=[still(r"D16:feedback", "Questions or problems? Tell us", surface="feedback", settle=1500), dict(kind="title", title="Talk to us", lines=["Feedback form: in OpenWork, account menu → Feedback", "Teams: message the OpenWork team", "Email: ben@openworklabs.com · guillaume@openworklabs.com"], weight=1.2)]))
cfg = dict(films={P: str(run / "film" / P)}, out=str(V / "out-v3" / "lena-day-v3.mp4"), person={"name": "Lena Hoffmann", "initials": "LH"}, beats=beats)
(V / "out-v3").mkdir(exist_ok=True); out.write_text(json.dumps(cfg, indent=1)); print("beats", len(beats), "decks", {k: len(v) for k, v in slides.items()})
