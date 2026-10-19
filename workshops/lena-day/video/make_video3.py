#!/usr/bin/env python3
"""Editor v3: narrated demo cut from REAL passive CDP films, with Cap-style auto zoom and visual anchors.

Every UI pixel is a captured frame. The editor only chooses time ranges, crops/zooms (camera),
and draws overlays OUTSIDE the UI content: step chip, "Lena asks" card with her exact prompt,
"Result" card naming where the outcome landed, honest cut tags and captions.
Frames are rendered at 30 fps and piped to ffmpeg per beat.

Usage: make_video3.py <config.json>
"""
import json, math, re, shutil, subprocess, sys, textwrap
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS = 1920, 1080, 30
BG, INK, MUTED, ACCENT = (238, 241, 239), (25, 43, 55), (83, 100, 110), (1, 22, 39)
TAG_BG, TAG_INK, TAG_LINE = (255, 248, 230), (110, 72, 10), (161, 123, 54)
GREEN, TEAL = (22, 121, 74), (16, 98, 112)
FONT = "/System/Library/Fonts/SFNS.ttf"
BOX = (200, 78, 1720, 854)          # frame area on canvas; anchors live in the band below and never cover UI
BOX_W, BOX_H = BOX[2] - BOX[0], BOX[3] - BOX[1]
ASPECT = BOX_W / BOX_H

def font(size, weight=500):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([100, min(96, max(17, size)), 400, weight])
    except Exception: pass
    return f
F = dict(chip=font(30, 650), side=font(24, 450), cap=font(26, 460), tag=font(23, 620), title=font(64, 700), sub=font(32, 450),
         label=font(21, 680), card=font(27, 520), avatar=font(20, 700))

cfg = json.loads(Path(sys.argv[1]).read_text())
FILMS = {name: Path(path) for name, path in cfg["films"].items()}
OUT = Path(cfg["out"]); WORK = OUT.parent / "work3"
PERSON = cfg.get("person", {"name": "Lena Hoffmann", "initials": "LH"})

def load(profile):
    root = FILMS[profile]
    markers = json.loads((root / "markers.json").read_text())
    surfaces = {}
    for d in root.iterdir():
        cap = d / "capture.json"
        if cap.exists():
            surfaces[d.name] = [(f["receivedAt"], str(d / f["file"])) for f in json.loads(cap.read_text())["frames"] if (d / f["file"]).exists()]
    return markers, surfaces
DATA = {p: load(p) for p in FILMS}

def marker(profile, pattern, after=None, last=False):
    hits = [m["at"] for m in DATA[profile][0] if re.fullmatch(pattern, m["label"]) and (after is None or m["at"] >= after)]
    return (hits[-1] if last else hits[0]) if hits else None
def frame_at(profile, surface, t):
    best = DATA[profile][1][surface][0][1]
    for at, path in DATA[profile][1][surface]:
        if at <= t: best = path
        else: break
    return best
def frames_between(profile, surface, t0, t1):
    out = [(0.0, frame_at(profile, surface, t0))]
    out += [((at - t0) / 1000, p) for at, p in DATA[profile][1][surface] if t0 < at < t1]
    return out

def is_app(src): return "/owner-app/" in src or "/recipient-app/" in src
@lru_cache(maxsize=64)
def source(src):
    img = Image.open(src).convert("RGB")
    return img
def base_rect(src):
    img = source(src)
    if is_app(src): return (225, 0, img.width - 35, img.height - 185)   # transcript only: no sidebar/composer
    return (0, 0, img.width, img.height)

# ---------- camera ----------
def fit_rect(base, cx, cy, zoom):
    """Rect of the box aspect inside base, `zoom`× tighter than the base fit, centred near (cx, cy)."""
    bx0, by0, bx1, by1 = base; bw, bh = bx1 - bx0, by1 - by0
    if bw / bh > ASPECT: h0 = bh; w0 = bh * ASPECT
    else: w0 = bw; h0 = bw / ASPECT
    w, h = w0 / zoom, h0 / zoom
    x0 = min(max(cx - w / 2, bx0), bx1 - w); y0 = min(max(cy - h / 2, by0), by1 - h)
    return (x0, y0, x0 + w, y0 + h)
def lerp(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def ease(t): t = min(max(t, 0.0), 1.0); return t * t * (3 - 2 * t)

def text_extent(src, rect):
    """Vertical extent of non-background content inside rect (for focusing the end of an answer)."""
    img = source(src).crop(tuple(int(v) for v in rect)).convert("L").resize((200, max(1, int(200 * (rect[3] - rect[1]) / (rect[2] - rect[0])))))
    bg = img.getpixel((img.width // 2, 2)); rows = []
    for y in range(img.height):
        # Middle 84% only: panel borders and scrollbars run the full height and are not content.
        row = [abs(img.getpixel((x, y)) - bg) for x in range(16, img.width - 16, 2)]
        if sum(1 for v in row if v > 40) > 3: rows.append(y)
    if not rows: return rect[1], rect[3]
    s = (rect[3] - rect[1]) / img.height
    return rect[1] + rows[0] * s, rect[1] + rows[-1] * s

def change_focus(prev, cur, base):
    """Centre of the region that changed between two frames (Cap/Screen Studio style auto-zoom)."""
    a = source(prev).crop(tuple(int(v) for v in base)).convert("L").resize((240, 166))
    b = source(cur).crop(tuple(int(v) for v in base)).convert("L").resize((240, 166))
    diff = ImageChops.difference(a, b).point(lambda v: 255 if v > 28 else 0)
    box = diff.getbbox()
    if not box: return None
    sx, sy = (base[2] - base[0]) / 240, (base[3] - base[1]) / 166
    return (base[0] + (box[0] + box[2]) / 2 * sx, base[1] + (box[1] + box[3]) / 2 * sy, (box[3] - box[1]) * sy)

# ---------- overlays ----------
def wrap(text, fnt, width, d):
    words, lines, line = text.split(), [], ""
    for w_ in words:
        test = (line + " " + w_).strip()
        if d.textlength(test, font=fnt) <= width: line = test
        else: lines.append(line); line = w_
    if line: lines.append(line)
    return lines

@lru_cache(maxsize=512)
def overlay(chip, side, caption, tag, ask, result, title_json):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    title = json.loads(title_json) if title_json else None
    if title:
        d.text((160, 330), title["title"], font=F["title"], fill=INK)
        y = 440
        for line in title.get("lines", []):
            for wl in wrap(line, F["sub"], 1500, d): d.text((160, y), wl, font=F["sub"], fill=MUTED); y += 46
            y += 14
    else:
        if chip: d.text((60, 30), chip, font=F["chip"], fill=ACCENT)
        if side: tw = d.textlength(side, font=F["side"]); d.text((W - 60 - tw, 36), side, font=F["side"], fill=MUTED)
        if tag:
            tw = d.textlength(tag, font=F["tag"]); tx, ty = BOX[2] - tw - 36, BOX[1] + 20
            d.rounded_rectangle((tx - 16, ty - 10, tx + tw + 16, ty + 38), 9, fill=TAG_BG + (245,), outline=TAG_LINE, width=2)
            d.text((tx, ty), tag, font=F["tag"], fill=TAG_INK)
        for kind, text in (("ask", ask), ("result", result)):
            if not text: continue
            lines = wrap(text, F["card"], 1380, d)[:2]
            cw = max(d.textlength(l, font=F["card"]) for l in lines) + 120; ch = 46 + 36 * len(lines)
            x0 = BOX[0]; y0 = BOX[3] + 14; y1 = y0 + ch
            shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle((x0 + 2, y0 + 6, x0 + cw + 2, y1 + 6), 18, fill=(0, 0, 0, 70))
            layer.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
            d.rounded_rectangle((x0, y0, x0 + cw, y1), 18, fill=(255, 255, 255, 250), outline=(TEAL if kind == "ask" else GREEN) + (255,), width=3)
            cx, cy = x0 + 44, y0 + ch / 2
            if kind == "ask":
                d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=TEAL)
                iw = d.textlength(PERSON["initials"], font=F["avatar"]); d.text((cx - iw / 2, cy - 14), PERSON["initials"], font=F["avatar"], fill=(255, 255, 255))
                d.text((x0 + 84, y0 + 10), f"{PERSON['name'].split()[0]} asks", font=F["label"], fill=TEAL)
            else:
                d.ellipse((cx - 24, cy - 24, cx + 24, cy + 24), fill=GREEN)
                d.line((cx - 11, cy + 1, cx - 3, cy + 9, cx + 12, cy - 8), fill=(255, 255, 255), width=5, joint="curve")
                d.text((x0 + 84, y0 + 10), "Result", font=F["label"], fill=GREEN)
            y = y0 + 38
            for l in lines: d.text((x0 + 84, y), l, font=F["card"], fill=INK); y += 36
    if caption:
        lines = wrap(caption, F["cap"], 1640, d)[:2]
        y = H - 18 - 34 * len(lines)
        for l in lines: tw = d.textlength(l, font=F["cap"]); d.text(((W - tw) / 2, y), l, font=F["cap"], fill=MUTED); y += 34
    return layer

def render(job):
    """job = (src | None, rect, overlay args) → raw RGB bytes for one output frame."""
    src, rect, ov = job
    canvas = Image.new("RGB", (W, H), BG)
    if src:
        img = source(src).crop(tuple(int(round(v)) for v in rect))
        s = min(BOX_W / img.width, BOX_H / img.height)
        img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.BICUBIC)
        x = BOX[0] + (BOX_W - img.width) // 2; y = BOX[1] + (BOX_H - img.height) // 2
        ImageDraw.Draw(canvas).rounded_rectangle((x - 2, y - 2, x + img.width + 1, y + img.height + 1), 10, outline=(196, 206, 209), width=2)
        canvas.paste(img, (x, y))
    canvas = canvas.convert("RGBA"); canvas.alpha_composite(overlay(*ov))
    return canvas.convert("RGB").tobytes()

# ---------- timeline building ----------
def duration(path): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())
def captions_for(text, total):
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    words = [max(1, len(s.split())) for s in sentences]; t, out = 0.0, []
    for s, w in zip(sentences, words): span = total * w / sum(words); out.append((t, t + span, s)); t += span
    return out

ZOOM = 1.75
def segment_turn(profile, part):
    t0 = marker(profile, part["start"]); t1 = marker(profile, part["end"], after=t0, last=part.get("endLast", False))
    if t0 is None or t1 is None: raise SystemExit(f"missing markers {part}")
    lead, tail = part.get("lead", 3.0), part.get("tail", 3.5); worked = (t1 - t0) / 1000; surface = part.get("surface", "owner-app")
    segs = []
    clips = [(t0 + 300, t1 - 300, None)] if worked <= lead + tail + 1.5 else ([(t0 + 300, t0 + lead * 1000, None)] if lead > 0 else []) + [(t1 - tail * 1000, t1 - 300, part.get("cutTag", "Jump cut · worked for {s} s").format(s=round(worked)))]
    for i, (a, b, cut) in enumerate(clips):
        segs.append(dict(kind="play", frames=frames_between(profile, surface, a, b), fixed=(b - a) / 1000, tag=cut or part.get("tag"), chip=part.get("chip"), ask=part.get("ask", True) and (i == 0 or len(clips) == 1) and not cut, askText=part.get("askText"), result=None, camera="follow-top" if i == 0 and not cut else "follow"))
    hold = frame_at(profile, surface, t1 - 300)
    segs.append(dict(kind="hold", frames=[(0.0, hold)], fixed=None, weight=part.get("weight", 1.4), tag=part.get("doneTag"), chip=part.get("chip"), ask=False, result=part.get("outcome"), camera="answer"))
    return segs

def build_beat(beat):
    audio = Path(beat["audio"]); A = duration(audio); total = A + beat.get("pad", 0.9); profile = beat.get("profile")
    segs = []
    for part in beat["parts"]:
        k = part["kind"]
        if k == "title": segs.append(dict(kind="title", frames=[(0.0, None)], fixed=None, weight=part.get("weight", 1.0), title=part))
        elif k == "turn": segs += segment_turn(profile, part)
        elif k == "still":
            t = marker(profile, part["marker"], last=part.get("last", False))
            if t is None:
                if part.get("optional"): continue
                raise SystemExit(f"missing marker {part}")
            later = [m["at"] for m in DATA[profile][0] if m["at"] > t + 20]
            limit = min(later) - 30 if later and part.get("bounded", True) else float("inf")
            src = frame_at(profile, part["surface"], min(t + part.get("settle", 2500), limit))
            segs.append(dict(kind="hold", frames=[(0.0, src)], fixed=None, weight=part.get("weight", 1.0), tag=part.get("tag"), chip=part.get("chip"), ask=False, result=part.get("result"), camera=("focus", part.get("focus")) if part.get("focus") else ("push", 1.1)))
        elif k == "images":
            for path in part["paths"]:
                segs.append(dict(kind="hold", frames=[(0.0, str(path))], fixed=None, weight=part.get("weight", 1.0), tag=part.get("tag"), chip=part.get("chip"), ask=False, result=part.get("result"), camera=("push", 1.05, "top")))
    fixed = sum(s["fixed"] for s in segs if s["fixed"] is not None)
    flex = [s for s in segs if s["fixed"] is None]
    remaining = max(total - fixed, 2.0 * len(flex)); total = fixed + remaining
    wsum = sum(s.get("weight", 1.0) for s in flex)
    for s in flex: s["fixed"] = remaining * s.get("weight", 1.0) / wsum
    return segs, total, A

def camera_track(seg, n):
    """Per-output-frame crop rects for a segment."""
    frames = seg["frames"]; dur = seg["fixed"]
    times = [i / FPS for i in range(n)]
    srcs = []
    for t in times:
        cur = frames[0][1]
        for ft, p in frames:
            if ft <= t: cur = p
            else: break
        srcs.append(cur)
    if seg["kind"] == "title": return srcs, [None] * n
    base = base_rect(srcs[0]); full = fit_rect(base, (base[0] + base[2]) / 2, (base[1] + base[3]) / 2, 1.0)
    cam = seg["camera"]
    if cam in ("follow", "follow-top") and is_app(srcs[0]):
        # Follow where pixels change; smooth heavily so the camera glides instead of jumping.
        rects, fy = [], None; prev = srcs[0]
        targets = {}
        for p in dict.fromkeys(srcs):
            if p != prev:
                c = change_focus(prev, p, base)
                if c: targets[p] = c[1]
            prev = p
        top, bottom = text_extent(srcs[-1], base)
        fy = (top + (base[3] - base[1]) / ZOOM / 2 - 30) if cam == "follow-top" else (bottom - (base[3] - base[1]) / ZOOM / 2 + 60)
        for i, p in enumerate(srcs):
            goal = targets.get(p, fy)
            fy = goal if fy is None else fy + (goal - fy) * 0.08
            z = 1.0 + (ZOOM - 1.0) * ease(i / max(1, FPS * 0.7))
            rects.append(fit_rect(base, (base[0] + base[2]) / 2, fy, z))
        return srcs, rects
    if cam == "answer" and is_app(srcs[0]):
        top, bottom = text_extent(srcs[0], base)
        target = fit_rect(base, (base[0] + base[2]) / 2, bottom - (base[3] - base[1]) / ZOOM / 2 + 70, ZOOM)
        return srcs, [lerp(full, target, ease((i / FPS - 0.35) / 0.9)) for i in range(n)]
    if isinstance(cam, tuple) and cam[0] == "focus":
        fx0, fy0, fx1, fy1 = cam[1]; bw, bh = base[2] - base[0], base[3] - base[1]
        cx, cy = base[0] + (fx0 + fx1) / 2 * bw, base[1] + (fy0 + fy1) / 2 * bh
        zoom = max(1.0, min(2.4, min(bw / ((fx1 - fx0) * bw) / (bw / (full[2] - full[0])), bh / ((fy1 - fy0) * bh) / (bh / (full[3] - full[1])))))
        target = fit_rect(base, cx, cy, zoom)
        return srcs, [lerp(full, target, ease((i / FPS - 0.5) / 1.1)) for i in range(n)]
    zoom = cam[1] if isinstance(cam, tuple) else 1.08
    anchor_y = base[1] if len(cam) > 2 and cam[2] == "top" else (base[1] + base[3]) / 2
    target = fit_rect(base, (base[0] + base[2]) / 2, anchor_y, zoom)
    return srcs, [lerp(full, target, i / max(1, n - 1)) for i in range(n)]

def render_beat(index, beat, pool):
    segs, total, A = build_beat(beat)
    caps = captions_for(beat["narration"], A) if beat.get("captions", True) else []
    jobs, t_global = [], 0.0
    for seg in segs:
        n = max(1, round(seg["fixed"] * FPS)); srcs, rects = camera_track(seg, n)
        for i in range(n):
            t = t_global + i / FPS
            cap = next((c for a, b, c in caps if a <= t < b), "")
            title = json.dumps({"title": seg["title"]["title"], "lines": seg["title"].get("lines", [])}) if seg["kind"] == "title" else ""
            ask_text = (seg.get("askText") or beat.get("ask") or "") if seg.get("ask") else ""
            ov = (seg.get("chip") or beat.get("chip", ""), beat.get("side", ""), cap, seg.get("tag") or "", ask_text, seg.get("result") or "", title)
            jobs.append((srcs[i], rects[i], ov))
        t_global += n / FPS
    out = WORK / f"beat{index:02d}.mp4"
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(audio_path(beat)),
                           "-filter_complex", f"[1:a]apad,atrim=0:{t_global:.3f},afade=t=out:st={max(0, t_global - 0.25):.3f}:d=0.25[a]", "-map", "0:v", "-map", "[a]",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{t_global:.3f}", str(out)], stdin=subprocess.PIPE)
    for frame in pool.imap(render, jobs, chunksize=8): ff.stdin.write(frame)
    ff.stdin.close(); ff.wait()
    if ff.returncode: raise SystemExit(f"ffmpeg failed on beat {index}")
    print(f"beat {index:02d} {beat['id']}: audio {A:.1f}s video {t_global:.1f}s ({len(jobs)} frames)", flush=True)
    return out
def audio_path(beat): return Path(beat["audio"])

if __name__ == "__main__":
    shutil.rmtree(WORK, ignore_errors=True); WORK.mkdir(parents=True)
    only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
    with Pool(8) as pool:
        clips = [render_beat(i, b, pool) for i, b in enumerate(cfg["beats"]) if not only or b["id"] in only]
    (WORK / "all.txt").write_text("".join(f"file '{c}'\n" for c in clips))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(WORK / "all.txt"), "-c", "copy", "-movflags", "+faststart", str(OUT)], check=True)
    print("wrote", OUT, f"{duration(OUT):.1f}s")
