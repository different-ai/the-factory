#!/usr/bin/env python3
"""Full narrated day, using the exact real-frame camera grammar of make_hero.py.

Usage: python3 make_day.py day.json [--stills]
Config: film, slide (D4 slide), work, out, beats:[{id,audio,parts:[...]}].
Only frames and genuine exported slides are pictured. No synthetic UI or business results.
A turn is click -> recorded typing -> Return -> explicit elapsed-time cut -> answer.
"""
import bisect
import json
import math
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

import make_hero as h

cfg = h.cfg
FPS, W, H = h.FPS, h.W, h.H
FILM = h.FILM
MARKERS = h.MARKERS
for surface in ('recipient-app', 'feedback', 'owner-web', 'recipient-web'):
    if (FILM / surface / 'capture.json').exists(): h.FR[surface] = h.frames(surface)
TIMES = {s: [t for t, _ in fr] for s, fr in h.FR.items()}
# Secondary surfaces may have been captured at 1×. Normalize their viewport before
# applying the camera; otherwise device-pixel crops can leave half the page blank.
@lru_cache(maxsize=10)
def normalized_source(path):
    image = Image.open(path).convert('RGB')
    return image if image.size == (h.SW, h.SH) else image.resize((h.SW, h.SH), Image.Resampling.LANCZOS)
h.src = normalized_source

def frame(surface, at):
    fr = h.FR[surface]
    return fr[max(0, bisect.bisect_right(TIMES[surface], at) - 1)][1]
def marker(label):
    found = [m for m in MARKERS if m['label'] == label]
    if not found: raise ValueError('Missing real evidence marker: ' + label)
    return found[-1]
def duration(path):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)]))
def camera(rect): return h.cam_fit(*h.css_rect_to_canvas(rect))
MAIN = camera(dict(x=232,y=44,width=1160,height=950))

def turn_data(scene, first_result=False):
    typing, typed = marker(scene+':typing'), marker(scene+':typed')
    enter, answered = marker(scene+':enter'), marker(scene+':answered')
    if first_result:
        # The skill is already created in the first response. Its unsolicited
        # follow-up sharing question is a separate interaction, not this result.
        answered=next(m for m in MARKERS if m['label']==scene+':answered')
    r0, r1, ra = typing['rects'], typed['rects'], answered.get('rects') or typed['rects']
    comp0, comp1 = camera({**r0['composer'],'x':r0['composer']['x']-24,'width':r0['composer']['width']+48}), camera({**r1['composer'],'x':r1['composer']['x']-24,'width':r1['composer']['width']+48})
    col = ra['composer']; answer = ra.get('answer') or dict(x=col['x'],y=100,width=col['width'],height=500)
    aw = col['width']*1.10; ah = aw*9/16
    ans = (h.WX+(col['x']+col['width']/2)*h.DPR,h.WY+(answer['y']+2+ah/2)*h.DPR,aw*h.DPR)
    ed = r0['editor']; click = (h.WX+(ed['x']+min(ed['width']/2,260))*h.DPR,h.WY+(ed['y']+ed['height']/2)*h.DPR)
    reply=None if first_result else next((m for m in MARKERS if m['label']==scene+':reply'),None)
    first_answer=next(m for m in MARKERS if m['label']==scene+':answered')
    return dict(typing=typing,typed=typed,enter=enter,answered=answered,c0=comp0,c1=comp1,answer=ans,click=click,reply=reply,firstAnswer=first_answer)

# Compile the editorial timeline. Narration never gets sped up to fit pictures.
TIMELINE=[]; BEATS=[]; total=0
for beat in cfg['beats']:
    audio=Path(beat['audio']); ad=duration(audio)
    parts=beat['parts']; minimum=sum(p.get('duration', 14.0 if p['kind']=='turn' else 5.5) for p in parts)
    length=max(ad+1.2,minimum)
    extra=length-minimum
    start=total
    for part in parts:
        part=dict(part)
        part['start']=total
        part['duration']=part.get('duration',14.0 if part['kind']=='turn' else 5.5)+extra/len(parts)
        part['beat']=beat['id']
        if part['kind']=='turn':
            part['data']=turn_data(part['scene'],part.get('firstResult',False))
            # The actual recorded typing plays at 1.5x or slower; long asks get extra time.
            real=max(0,(part['data']['typed']['at']-part['data']['typing']['at'])/1000)
            typing=max(3.0,real/1.5)
            part['typingDuration']=typing
            part['duration']=max(part['duration'],1.5+typing+2.0+1.0+6.0)+(5.0 if part['data']['reply'] else 0)
        if part['kind']=='still': marker(part['marker'])
        if part['kind']=='slide' and not Path(part['path']).exists(): raise ValueError('Missing rendered real slide '+part['path'])
        TIMELINE.append(part); total+=part['duration']
    BEATS.append(dict(id=beat['id'],start=start,duration=total-start,audio=str(audio),narration=beat.get('narration','')))
TOTAL=total
STARTS=[p['start'] for p in TIMELINE]

@lru_cache(maxsize=8)
def slide_image(path): return Image.open(path).convert('RGB')

def slide_shot(path,p):
    slide=slide_image(path)
    img=h.base_small().convert('RGBA')
    sw=int(W*(0.76+0.025*h.ease(p))); sh=int(sw*slide.height/slide.width)
    x,y=(W-sw)//2,(H-sh)//2+10
    shadow=Image.new('L',(W,H),0)
    ImageDraw.Draw(shadow).rounded_rectangle((x,y+20,x+sw,y+sh+20),18,fill=155)
    shadow=shadow.filter(ImageFilter.GaussianBlur(30))
    img.alpha_composite(Image.merge('RGBA',(*[Image.new('L',(W,H),0)]*3,shadow)))
    img.paste(slide.resize((sw,sh),Image.LANCZOS),(x,y),h.rounded_mask(sw,sh,14))
    return img

def render_turn(part,t):
    d=part['data']; td=part['typingDuration']; dur=part['duration']
    # The final result is held for the remaining time, at least six seconds.
    intro=1.5; enter0=intro+td; clarify0=enter0+2; skip0=clarify0+(5 if d['reply'] else 0); ans0=skip0+1
    answered=frame('owner-app',d['answered']['at']-120)
    if t<intro:
        cam=h.lerp_cam(h.WIDE,d['c0'],h.ease((t-.4)/1.0))
        img,box=h.window_shot(frame('owner-app',d['typing']['at']-40),cam)
        pos,_=h.to_out(d['click'],box); q=h.ease((t-.25)/.9)
        h.cursor(img,(W*.64+(pos[0]-W*.64)*q,H*.5+(pos[1]-H*.5)*q),1+.2*q,min(1,max(0,(t-.1)/.2)))
        h.ripple(img,pos,(t-1.15)/.4)
    elif t<enter0:
        p=(t-intro)/td
        at=d['typing']['at']+(d['typed']['at']-d['typing']['at'])*p
        img,_=h.window_shot(frame('owner-app',at),h.lerp_cam(d['c0'],d['c1'],h.ease(p)))
        # The visible typing is accelerated; keep the picture focused on Lena's words,
        # rather than adding test/production annotations over the composer.
    elif t<clarify0:
        tt=t-enter0; at=d['typed']['at'] if tt<.9 else d['enter']['at']+(tt-.9)*1000
        img,_=h.window_shot(frame('owner-app',at),h.lerp_cam(d['c1'],h.WIDE,h.ease((tt-1.1)/.85)))
        h.keycap(img,(tt-.7)/1.0)
    elif t<skip0:
        tt=t-clarify0
        at=d['firstAnswer']['at']-50 if tt<2.5 else d['reply']['at']+300
        img,_=h.window_shot(frame('owner-app',at),MAIN)
        h.pill(img,'One clarification · Lena confirms',(W/2,46))
    elif t<ans0:
        a,_=h.window_shot(frame('owner-app',d['enter']['at']+1500),h.WIDE)
        b,_=h.window_shot(answered,h.WIDE)
        img=Image.blend(a,b,h.ease(t-skip0))
        elapsed=round((d['answered']['at']-d['enter']['at'])/1000)
        h.pill(img,f'Answer after {elapsed} s',(W/2,46),min(1,(t-skip0)/.2))
    else:
        tt=t-ans0; hold=dur-ans0
        # A slight downward pan for longer answers, bounded to the recorded answer rect.
        cam=h.lerp_cam(h.WIDE,d['answer'],h.ease((tt-.1)/.9))
        ra=d['answered'].get('rects',{}).get('answer',{})
        if ra.get('height',0)>430 and tt>2:
            delta=min(ra['height']-430,180)*h.DPR*h.ease((tt-2)/max(1,hold-3))
            cam=(cam[0],cam[1]+delta,cam[2])
        if tt>hold-.6: cam=h.lerp_cam(cam,h.WIDE,h.ease((tt-(hold-.6))/.6))
        img,_=h.window_shot(answered,cam)
    return img

def render(i):
    t=i/FPS; part=TIMELINE[max(0,bisect.bisect_right(STARTS,t)-1)]
    tt=t-part['start']; p=tt/part['duration']; kind=part['kind']
    if kind=='turn': img=render_turn(part,tt)
    elif kind=='slide': img=slide_shot(part['path'],p)
    else:
        m=marker(part['marker']); at=m['at']+part.get('offset',500)
        if part.get('until'):
            end=marker(part['until'])['at']+part.get('endOffset',500)
            # Hold the real review state, play the recorded click/result, then hold success.
            at=at+(end-at)*max(0,min(1,(tt-1.7)/1.3))
        surface=part.get('surface','services')
        target=camera(part['rect']) if part.get('rect') else h.WIDE
        cam=h.lerp_cam(h.WIDE,target,h.ease((tt-.35)/.9))
        if tt>part['duration']-.6: cam=h.lerp_cam(target,h.WIDE,h.ease((tt-(part['duration']-.6))/.6))
        img,_=h.window_shot(frame(surface,at),cam)
        if part.get('isolate') and tt > .55:
            rect=part['rect']
            original=h.src(frame(surface,at))
            crop=original.crop(tuple(round(v*h.DPR) for v in (rect['x'],rect['y'],rect['x']+rect['width'],rect['y']+rect['height'])))
            height=round(H*.86); width=round(height*crop.width/crop.height)
            x,y=(W-width)//2,(H-height)//2
            panel=h.base_small().convert('RGBA')
            shadow=Image.new('L',(W,H),0)
            ImageDraw.Draw(shadow).rounded_rectangle((x,y+12,x+width,y+height+12),18,fill=170)
            shadow=shadow.filter(ImageFilter.GaussianBlur(26))
            panel.alpha_composite(Image.merge('RGBA',(*[Image.new('L',(W,H),0)]*3,shadow)))
            panel.paste(crop.resize((width,height),Image.Resampling.LANCZOS),(x,y),h.rounded_mask(width,height,16))
            img=Image.blend(img,panel,h.ease((tt-.55)/.65))
    if part.get('label') and (tt < 1.15 or part['beat']=='end'):
        # Clear labels before close-ups, except the end-card contact details,
        # which remain visible long enough to read and use.
        end=part['duration'] if part['beat']=='end' else 1.15
        alpha=min(1,max(0,tt/.18),max(0,(end-tt)/.3))
        h.label(img,part['label'],alpha,top=True)
    if t<.6: img=Image.blend(Image.new('RGBA',(W,H),(8,9,16,255)),img,h.ease(t/.6))
    if t>TOTAL-.8: img=Image.blend(img,Image.new('RGBA',(W,H),(8,9,16,255)),h.ease((t-(TOTAL-.8))/.8))
    return img.convert('RGB').tobytes()

if __name__=='__main__':
    work=Path(cfg['work']); out=Path(cfg['out']); out.parent.mkdir(parents=True,exist_ok=True)
    receipt=dict(duration=TOTAL,fps=FPS,resolution=[W,H],beats=BEATS,parts=[{k:v for k,v in p.items() if k!='data'} for p in TIMELINE])
    (work/'timeline.json').write_text(json.dumps(receipt,indent=2)+'\n')
    if '--stills' in sys.argv or cfg.get('stills'):
        samples=cfg.get('stills') or [p['start']+min(p['duration']-.5,12 if p['kind']=='turn' else p['duration']*.6) for p in TIMELINE]
        for t in samples:
            Image.frombytes('RGB',(W,H),render(round(t*FPS))).save(work/f'still-{t:07.2f}.png')
        print('stills',len(samples),'duration',TOTAL)
    else:
        silent=work/'silent.mp4'; n=math.ceil(TOTAL*FPS)
        ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
        workers=cfg.get('workers',6)
        # Bound queued RGB frames. An unbounded imap can retain gigabytes when a
        # fast slide shot renders ahead of the encoder during a full-day export.
        with Pool(workers) as pool:
            for start in range(0,n,workers*2):
                for b in pool.imap(render,range(start,min(n,start+workers*2)),chunksize=1):
                    ff.stdin.write(b)
        ff.stdin.close()
        if ff.wait(): raise RuntimeError('Video encoder failed')
        cmd=['ffmpeg','-v','error','-y','-i',str(silent)]
        filters=[]; labels=[]
        for i,b in enumerate(BEATS):
            cmd+=['-i',b['audio']]
            delay=round((b['start']+.3)*1000)
            filters.append(f'[{i+1}:a]aresample=48000,adelay={delay}|{delay}[a{i}]'); labels.append(f'[a{i}]')
        filters.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=longest:normalize=0,alimiter=limit=0.96[a]')
        subprocess.run(cmd+['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(TOTAL),'-movflags','+faststart',str(out)],check=True)
        print('wrote',out,'duration',round(TOTAL,2))
