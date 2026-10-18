#!/usr/bin/env python3
"""One polished beat: prompt -> result, in the style of a Cap/Screen Studio recording.

Every UI pixel is a real frame captured at 2x from the app during a real run. The editor only:
- frames those frames as a rounded window with a soft shadow on a wallpaper;
- moves a camera between REAL on-screen rects recorded during the run (composer, answer);
- draws a cursor + click ripple at the real click point, and a Return keycap when Enter was pressed;
- speeds up the typing, and skips the wait with an explicit "N min later" pill;
- shows the real generated slide (rendered from the actual .pptx) large and sharp.

Usage: make_hero.py <config.json>
"""
import json, math, subprocess, sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 60
FONT = "/System/Library/Fonts/SFNS.ttf"
cfg = json.loads(Path(sys.argv[1]).read_text())
FILM = Path(cfg["film"]); ID = cfg.get("scene", "D4")
MARKERS = json.loads((FILM / "markers.json").read_text())

def font(size, weight=500):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([100, min(96, max(17, size)), 400, weight])
    except Exception: pass
    return f

def mk(label, prefix=False):
    for m in MARKERS:
        if (m["label"].startswith(label) if prefix else m["label"] == label): return m
    raise KeyError(label)

def frames(surface):
    cap = json.loads((FILM / surface / "capture.json").read_text())
    return [(f["receivedAt"], str(FILM / surface / f["file"])) for f in cap["frames"] if (FILM / surface / f["file"]).exists()]
FR = {s: frames(s) for s in ("owner-app", "services")}
def frame_at(surface, t):
    best = FR[surface][0][1]
    for at, path in FR[surface]:
        if at <= t: best = path
        else: break
    return best

# ---------- geometry: canvas in source device pixels ----------
probe = Image.open(FR["owner-app"][-1][1]); SW, SH = probe.size
DPR = SW / 1440
PAD = int(SH * 0.10)
CH = SH + 2 * PAD; CW = int(round(CH * 16 / 9))
WX, WY = (CW - SW) // 2, PAD
RADIUS = int(14 * DPR)

def wallpaper():
    yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    xx /= CW; yy /= CH
    img = np.zeros((CH, CW, 3), np.float32) + np.array([14, 16, 34], np.float32)
    blobs = [((0.12, 0.10), (88, 70, 214), 0.55), ((0.92, 0.18), (22, 150, 160), 0.50),
             ((0.70, 1.05), (240, 118, 92), 0.55), ((0.05, 0.95), (130, 60, 200), 0.45), ((0.50, 0.45), (40, 50, 110), 0.60)]
    for (bx, by), col, r in blobs:
        d2 = ((xx - bx) * 16 / 9) ** 2 + (yy - by) ** 2
        a = np.exp(-d2 / (2 * (r * 0.55) ** 2))[..., None]
        img = img * (1 - 0.85 * a) + np.array(col, np.float32) * 0.85 * a
    img += np.random.default_rng(7).normal(0, 1.4, img.shape).astype(np.float32)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

def rounded_mask(w, h, r):
    m = Image.new("L", (w * 2, h * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), r * 2, fill=255)
    return m.resize((w, h), Image.LANCZOS)

def build_base():
    bg = wallpaper().convert("RGBA")
    sh = Image.new("L", (CW, CH), 0)
    ImageDraw.Draw(sh).rounded_rectangle((WX, WY + int(18 * DPR), WX + SW, WY + SH + int(18 * DPR)), RADIUS, fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(int(30 * DPR)))
    bg.alpha_composite(Image.merge("RGBA", (*[Image.new("L", (CW, CH), 0)] * 3, sh)))
    return bg.convert("RGB")

BASE_PATH = Path(cfg["work"]) / "base.png"; Path(cfg["work"]).mkdir(parents=True, exist_ok=True)
if not BASE_PATH.exists(): build_base().save(BASE_PATH)
WMASK_PATH = Path(cfg["work"]) / "wmask.png"
if not WMASK_PATH.exists():
    m = rounded_mask(SW, SH, RADIUS)
    # hairline border so a dark window separates from the wallpaper
    border = Image.new("L", (SW, SH), 0); ImageDraw.Draw(border).rounded_rectangle((0, 0, SW - 1, SH - 1), RADIUS, outline=255, width=max(1, int(DPR)))
    m.save(WMASK_PATH); border.save(Path(cfg["work"]) / "wborder.png")

# ---------- cameras ----------
def css_rect_to_canvas(r, pad=0.0):
    return (WX + (r["x"] - pad) * DPR, WY + (r["y"] - pad) * DPR, (r["width"] + 2 * pad) * DPR, (r["height"] + 2 * pad) * DPR)
def cam_fit(x, y, w, h, min_w=None):
    """Smallest 16:9 camera containing the rect, centred on it."""
    cw = max(w, h * 16 / 9, min_w or 0); cx, cy = x + w / 2, y + h / 2
    return (cx, cy, cw)
WIDE = (CW / 2, CH / 2, CW)
def lerp_cam(a, b, p):
    p = max(0.0, min(1.0, p))
    return (a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, math.exp(math.log(a[2]) + (math.log(b[2]) - math.log(a[2])) * p))
def ease(p):
    p = max(0.0, min(1.0, p)); return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2
def clamp_cam(c):
    """Wide shots may show wallpaper; close-ups may overshoot the window edge only by a sliver (Screen Studio look)."""
    cx, cy, cw = c; cw = min(cw, CW); ch = cw * 9 / 16
    k = min(1.0, max(0.0, (cw - SW * 0.8) / (CW - SW * 0.8)))
    ex = 36 * DPR + (max(WX, PAD) - 36 * DPR) * k; ey = 110 * DPR + (max(WX, PAD) - 110 * DPR) * k
    ax0, ay0, ax1, ay1 = max(0, WX - ex), max(0, WY - ey), min(CW, WX + SW + ex), min(CH, WY + SH + ey)
    cx = (ax0 + ax1) / 2 if cw > ax1 - ax0 else min(max(cx, ax0 + cw / 2), ax1 - cw / 2)
    cy = (ay0 + ay1) / 2 if ch > ay1 - ay0 else min(max(cy, ay0 + ch / 2), ay1 - ch / 2)
    return (cx, cy, cw)

typing, typed = mk(f"{ID}:typing"), mk(f"{ID}:typed")
enter, answered = mk(f"{ID}:enter"), mk(f"{ID}:answered")
deck_mk = next(m for m in MARKERS if m["label"].startswith(f"{ID}:service:") and m["label"].endswith(".pptx"))
reply_mk = next((m for m in MARKERS if m["label"] == f"{ID}:service:reply"), None)
R0, R1, RA = typing["rects"], typed["rects"], answered["rects"]
ed0 = R0["editor"]; click_pt = (WX + (ed0["x"] + min(ed0["width"] / 2, 260)) * DPR, WY + (ed0["y"] + ed0["height"] / 2) * DPR)
comp0 = cam_fit(*css_rect_to_canvas(R0["composer"], 24), min_w=R0["composer"]["width"] * DPR * 1.1)
comp1 = cam_fit(*css_rect_to_canvas(R1["composer"], 24), min_w=R1["composer"]["width"] * DPR * 1.1)
main_panel = {"x": 232, "y": 44, "width": 1160, "height": 950}
MAIN = cam_fit(*css_rect_to_canvas(main_panel, 0))
ans = RA.get("answer") or main_panel
# Top-aligned on the final answer text (starts at its first line), so tool-step lines above stay out of frame.
# The chat column (composer width), top-aligned just above the final answer text.
_col = RA["composer"]; _aw = _col["width"] * 1.1; _ah = _aw * 9 / 16
ANS = (WX + (_col["x"] + _col["width"] / 2) * DPR, WY + (ans["y"] - 8 + _ah / 2) * DPR, _aw * DPR)

# ---------- timeline ----------
SEG = []  # (name, duration_s)
def seg(name, d): SEG.append((name, d))
seg("intro", 1.5); seg("typing", 3.0); seg("enter", 2.0); seg("skip", 0.9); seg("answer", 4.6)
if reply_mk: seg("outlook", 4.6)
seg("onedrive", 2.6); seg("slide", 5.6); seg("outro", 1.0)
STARTS = {}; acc = 0.0
for n, d in SEG: STARTS[n] = (acc, d); acc += d
TOTAL = acc
skipped_min = max(1, round((answered["at"] - enter["at"]) / 60000))
SKIP_LABEL = f"{skipped_min} min later"

def services_cam(key):
    c = cfg.get("cams", {}).get(key)
    return cam_fit(*css_rect_to_canvas(c, 0)) if c else WIDE

SLIDE = Image.open(cfg["slide"]).convert("RGB")
ONEDRIVE_OFF = cfg.get("onedrive_offset_ms", 300)

# ---------- drawing helpers (output space) ----------
F_PILL, F_KEY, F_LABEL = font(30, 600), font(34, 600), font(28, 600)
def pill(img, text, center, alpha=1.0, dark=True):
    d = ImageDraw.Draw(img, "RGBA"); tw = d.textlength(text, font=F_PILL); w, h = tw + 56, 58
    x, y = center[0] - w / 2, center[1] - h / 2
    d.rounded_rectangle((x, y, x + w, y + h), h / 2, fill=(12, 14, 24, int(190 * alpha)) if dark else (255, 255, 255, int(235 * alpha)), outline=(255, 255, 255, int(40 * alpha)), width=1)
    d.text((x + 28, y + h / 2), text, font=F_PILL, anchor="lm", fill=(255, 255, 255, int(255 * alpha)) if dark else (20, 22, 30, int(255 * alpha)))
def label(img, text, alpha, top=False):
    if alpha <= 0: return
    d = ImageDraw.Draw(img, "RGBA"); tw = d.textlength(text, font=F_LABEL); w, h = tw + 56, 60
    x, y = (W - w) / 2, (40 if top else H - 64 - h)
    d.rounded_rectangle((x, y + 4, x + w, y + h + 4), h / 2, fill=(0, 0, 0, int(60 * alpha)))
    d.rounded_rectangle((x, y, x + w, y + h), h / 2, fill=(14, 16, 26, int(222 * alpha)), outline=(255, 255, 255, int(46 * alpha)), width=1)
    d.text((x + w / 2, y + h / 2), text, font=F_LABEL, anchor="mm", fill=(255, 255, 255, int(255 * alpha)))
def keycap(img, p):
    if p <= 0 or p >= 1: return
    a = min(1.0, p / 0.12, (1 - p) / 0.2); s = 0.9 + 0.1 * ease(min(1, p / 0.15)) - 0.05 * max(0, min(1, (p - 0.12) / 0.08)) * max(0, 1 - (p - 0.2) / 0.1)
    w, h = int(210 * s), int(78 * s); cx, cy = W / 2, H - 120
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    d.rounded_rectangle((cx - w / 2, cy - h / 2 + 6, cx + w / 2, cy + h / 2 + 6), 18, fill=(0, 0, 0, int(90 * a)))
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), 18, fill=(246, 246, 248, int(250 * a)), outline=(200, 200, 210, int(255 * a)), width=2)
    d.text((cx, cy), "return  \u23CE", font=F_KEY, anchor="mm", fill=(28, 30, 40, int(255 * a)))
    img.alpha_composite(layer)
def cursor(img, pos, scale, alpha):
    if alpha <= 0: return
    hgt = 30 * scale; pts = [(0, 0), (0, 0.84), (0.22, 0.66), (0.36, 0.98), (0.5, 0.92), (0.36, 0.61), (0.62, 0.61)]
    k = 4; size = int(hgt * 1.1 * k) + 8
    lay = Image.new("RGBA", (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    poly = [(4 + x * hgt * k, 4 + y * hgt * k) for x, y in pts]
    d.polygon([(x + 2 * k, y + 3 * k) for x, y in poly], fill=(0, 0, 0, int(70 * alpha)))
    d.polygon(poly, fill=(255, 255, 255, int(255 * alpha)), outline=(10, 10, 10, int(255 * alpha)), width=int(1.6 * k))
    lay = lay.resize((size // k, size // k), Image.LANCZOS)
    img.alpha_composite(lay, (int(pos[0]) - 1, int(pos[1]) - 1))
def ripple(img, pos, p):
    if p <= 0 or p >= 1: return
    d = ImageDraw.Draw(img, "RGBA"); r = 8 + 34 * ease(p); a = int(200 * (1 - p))
    d.ellipse((pos[0] - r, pos[1] - r, pos[0] + r, pos[1] + r), outline=(255, 255, 255, a), width=4)
    d.ellipse((pos[0] - r * 0.5, pos[1] - r * 0.5, pos[0] + r * 0.5, pos[1] + r * 0.5), fill=(255, 255, 255, int(a * 0.35)))

# ---------- frame composition ----------
@lru_cache(maxsize=6)
def base(): return Image.open(BASE_PATH).convert("RGB")
@lru_cache(maxsize=2)
def wmask(): return Image.open(WMASK_PATH)
@lru_cache(maxsize=8)
def src(path): return Image.open(path).convert("RGB")

def window_shot(path, cam):
    cx, cy, cw = clamp_cam(cam); ch = cw * 9 / 16
    box = (int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2))
    region = base().crop(box)
    ix0, iy0 = max(box[0], WX), max(box[1], WY); ix1, iy1 = min(box[2], WX + SW), min(box[3], WY + SH)
    if ix1 > ix0 and iy1 > iy0:
        s = src(path); crop = (ix0 - WX, iy0 - WY, ix1 - WX, iy1 - WY)
        region.paste(s.crop(crop), (ix0 - box[0], iy0 - box[1]), wmask().crop(crop))
    out = region.resize((W, H), Image.LANCZOS, reducing_gap=2.0)
    return out.convert("RGBA"), box

def to_out(pt, box):
    sx = W / (box[2] - box[0]); return ((pt[0] - box[0]) * sx, (pt[1] - box[1]) * sx), sx

@lru_cache(maxsize=1)
def base_small(): return base().resize((W, H), Image.LANCZOS)
DECK_NAME = deck_mk["label"].split(":service:", 1)[1]
def slide_shot(p, name_alpha=1.0):
    img = base_small().convert("RGBA")
    sw = int(W * (0.70 + 0.04 * ease(p))); sh = int(sw * SLIDE.height / SLIDE.width)
    x, y = (W - sw) // 2, (H - sh) // 2 + 20
    shadow = Image.new("L", (W, H), 0); ImageDraw.Draw(shadow).rounded_rectangle((x, y + 22, x + sw, y + sh + 22), 18, fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(34))
    img.alpha_composite(Image.merge("RGBA", (*[Image.new("L", (W, H), 0)] * 3, shadow)))
    img.paste(SLIDE.resize((sw, sh), Image.LANCZOS), (x, y), rounded_mask(sw, sh, 14))
    if name_alpha > 0: pill(img, DECK_NAME, (W / 2, max(56, y / 2 + 10)), name_alpha)
    return img

def lerp_src(t0, t1, p): return t0 + (t1 - t0) * max(0.0, min(1.0, p))

WORK_T = None
def render(i):
    t = i / FPS
    name = next((n for n, (s0, d0) in STARTS.items() if s0 <= t < s0 + d0), SEG[-1][0])
    s0, d = STARTS[name]; tt = t - s0; p = tt / d
    lab = None
    ans_frame = frame_at("owner-app", answered["at"] - 200)
    work_frame = frame_at("owner-app", enter["at"] + 1500)
    if name == "intro":
        cam = lerp_cam(WIDE, comp0, ease((tt - 0.45) / 0.9))
        img, box = window_shot(frame_at("owner-app", typing["at"] - 40), cam)
        pos, _ = to_out(click_pt, box)
        start = (W * 0.64, H * 0.50); q = ease((tt - 0.3) / 0.85)
        cur = (start[0] + (pos[0] - start[0]) * q, start[1] + (pos[1] - start[1]) * q)
        cursor(img, cur, 1.0 + 0.2 * q, min(1, max(0, (tt - 0.1) / 0.2)))
        ripple(img, pos, (tt - 1.18) / 0.4)
    elif name == "typing":
        cam = lerp_cam(comp0, comp1, ease(p))
        img, box = window_shot(frame_at("owner-app", lerp_src(typing["at"] + 250, typed["at"], p)), cam)
        pos, _ = to_out(click_pt, box); cursor(img, pos, 1.2, 1 - tt / 0.15); ripple(img, pos, (tt + 1.5 - 1.18) / 0.4)
    elif name == "enter":
        src_t = typed["at"] if tt < 0.9 else enter["at"] + (tt - 0.9) * 1000
        img, _ = window_shot(frame_at("owner-app", src_t), lerp_cam(comp1, WIDE, ease((tt - 1.1) / 0.85)))
        keycap(img, (tt - 0.7) / 1.0)
    elif name == "skip":
        a, _ = window_shot(work_frame, WIDE); b, _ = window_shot(ans_frame, WIDE)
        img = Image.blend(a, b, ease(p))
        pill(img, SKIP_LABEL, (W / 2, 46), min(1, tt / 0.2))
    elif name == "answer":
        cam = lerp_cam(WIDE, ANS, ease((tt - 0.15) / 0.9))
        if reply_mk and tt > d - 0.6: cam = lerp_cam(ANS, WIDE, ease((tt - (d - 0.6)) / 0.6))
        img, _ = window_shot(ans_frame, cam)
        a = max(0, 1 - tt / 0.6)
        if a > 0: pill(img, SKIP_LABEL, (W / 2, 46), a)
    elif name == "outlook":
        # Same window, contents switch (like changing apps), then zoom in; pull back out at the end.
        out_frame = frame_at("services", reply_mk["at"] + 2500)
        cam = lerp_cam(WIDE, services_cam("outlook"), ease((tt - 0.35) / 0.9))
        if tt > d - 0.55: cam = lerp_cam(services_cam("outlook"), WIDE, ease((tt - (d - 0.55)) / 0.55))
        img, _ = window_shot(out_frame, cam)
        if tt < 0.35: img = Image.blend(window_shot(ans_frame, WIDE)[0], img, ease(tt / 0.35))
        lab = "Reply to Mateo, saved as a draft in Open Outlook"
    elif name == "onedrive":
        od = frame_at("services", deck_mk["at"] + ONEDRIVE_OFF)
        img, _ = window_shot(od, lerp_cam(WIDE, services_cam("onedrive"), ease((tt - 0.35) / 0.85)))
        if tt < 0.35:
            prev = window_shot(frame_at("services", reply_mk["at"] + 2500), WIDE)[0] if reply_mk else window_shot(ans_frame, WIDE)[0]
            img = Image.blend(prev, img, ease(tt / 0.35))
        lab = "The slide, saved to Open Drive"
    elif name == "slide":
        img = slide_shot(p, min(1, max(0, (tt - 0.5) / 0.4), max(0, (d - tt) / 0.3)))
        if tt < 0.45:
            prev, _ = window_shot(frame_at("services", deck_mk["at"] + ONEDRIVE_OFF), services_cam("onedrive"))
            img = Image.blend(prev, img, ease(tt / 0.45))
    else:  # outro
        img = Image.blend(slide_shot(1.0, 0), Image.new("RGBA", (W, H), (8, 9, 16, 255)), ease(p))
    if lab:
        label(img, lab, min(1, max(0, (tt - 0.45) / 0.3), max(0, (d - tt) / 0.25)), top=(name in ("outlook", "onedrive")))
    return img.convert("RGB").tobytes()

if __name__ == "__main__":
    out = Path(cfg["out"]); n = int(TOTAL * FPS)
    only = cfg.get("stills")
    if only:
        for t in only:
            Image.frombytes("RGB", (W, H), render(int(t * FPS))).save(Path(cfg["work"]) / f"still-{t:05.2f}.png")
        print("stills", [STARTS]); sys.exit()
    ff = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                           "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
    with Pool(12) as pool:
        for b in pool.imap(render, range(n), chunksize=4): ff.stdin.write(b)
    ff.stdin.close(); ff.wait()
    print("wrote", out, f"{TOTAL:.1f}s", {k: round(v[0], 2) for k, v in STARTS.items()})
