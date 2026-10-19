#!/usr/bin/env python3
"""Build real-evidence full-day cut. Usage: build_day.py <run> <output-dir>.
Fails closed on non-PASS scenes or missing footage. Never fabricates a result.
"""
import json
import subprocess
import sys
from pathlib import Path

RUN=Path(sys.argv[1]).resolve(); OUT=Path(sys.argv[2]).resolve(); OUT.mkdir(parents=True,exist_ok=True)
HERE=Path(__file__).resolve().parent
A=Path.home()/'Documents/Workshops/enterprise-day-in-the-life/video/audio-v3'
N=json.loads((HERE/'narration-v3.json').read_text())
M=json.loads((RUN/'gpt-sol-fast/day-matrix.json').read_text()); rows={r['id']:r for r in M['rows']}
missing=[f'D{i}' for i in range(17) if rows.get(f'D{i}',{}).get('status')!='PASS']
if missing: raise RuntimeError('Cannot publish failed/missing scenes: '+', '.join(missing))
FILM=RUN/'film/gpt-sol-fast'; markers=json.loads((FILM/'markers.json').read_text())
labels={m['label'] for m in markers}
def service(scene,suffix=None):
    candidates=[m['label'] for m in markers if m['label'].startswith(scene+':service:') and (suffix is None or m['label'].endswith(suffix))]
    if not candidates: raise ValueError('No service result '+scene+' '+str(suffix))
    return candidates[-1]
slides={}
for scene in ('D4','D6','D8'):
    sha=rows[scene].get('evidence',{}).get('sha256')
    if not sha: raise ValueError('No validated export for '+scene)
    deck=RUN/'gpt-sol-fast/private-artifacts'/f'{sha}.pptx'
    out=OUT/'slides'/scene
    subprocess.run([str(HERE/'render_pptx.sh'),str(deck),str(out)],check=True)
    slides[scene]=sorted(out.glob('slide-*.png'))
def turn(scene,label=None): return dict(kind='turn',scene=scene,**({'label':label} if label else {}))
def still(m,label=None,surface='services',rect=None,duration=5.5,offset=500):
    return dict(kind='still',marker=m,surface=surface,duration=duration,offset=offset,**({'rect':rect} if rect else {}),**({'label':label} if label else {}))
def slide(scene,index=0): return dict(kind='slide',path=str(slides[scene][index]),duration=6.5)
def beat(id,parts):
    custom=OUT/'audio'/f'{id}.mp3'
    return dict(id=id,audio=str(custom if custom.exists() else A/f'{id}.mp3'),narration=N[id],parts=parts)
MAIL=dict(x=615,y=60,width=815,height=550)
FILES=dict(x=0,y=0,width=990,height=552)
FOLDERS=dict(x=0,y=65,width=760,height=670)
beats=[
 beat('intro',[still('D1:service:draft','A day with Lena · Account manager at Acme Robotics',rect=MAIL,duration=18)]),
 beat('brief',[still('D1:run-visible','09:00 · The morning brief is ready',surface='owner-app',duration=4),still('D1:service:draft',rect=MAIL,duration=7)]),
 beat('ask',[turn('D2')]),
 beat('setup',[turn('D0','How she set it up'),still('D0:proposal','Review, then Create Automation',surface='owner-app',duration=5),still('D1:automation-detail',surface='owner-app',duration=5)]),
 beat('inbox',[turn('D3'),still(service('D3','folders'),'To do · In progress · Done',rect=FOLDERS)]),
 beat('compare',[turn('D4'),still(service('D4','reply'),'Reply to Mateo · saved as a draft',rect=MAIL,duration=7,offset=2500),still(service('D4','.pptx'),'The slide, saved to Open Drive',rect=FILES,duration=4,offset=300),slide('D4')]),
 beat('skill',[turn('D5')]),
 beat('reuse',[turn('D6'),slide('D6')]),
 beat('share',[turn('D7')]),
 beat('deck',[turn('D8'),*[slide('D8',i) for i in range(min(4,len(slides['D8'])))]]),
 beat('admin',[turn('D9'),still(service('D9'),'Documentation task · assigned to Nora',rect=dict(x=220,y=50,width=1160,height=780)),turn('D10'),still(service('D10'),'IT service request · no password changed',rect=dict(x=220,y=50,width=1160,height=780))]),
 beat('dog',[turn('D11')]),
 beat('meeting',[turn('D12a'),turn('D12b'),still(service('D12'),'Same meeting · new time',rect=MAIL,duration=6)]),
 beat('done',[turn('D13'),still(service('D13','folders'),'Customer reply drafts retained · threads organized in Done',rect=FOLDERS)]),
 beat('app',[turn('D14'),still('D14:app-visible','Pilot forecast · from the connected file',surface='owner-app',rect=dict(x=720,y=40,width=710,height=900),duration=9)]),
 beat('activity',[still('D15:activity',"Next morning · Nora’s Activity",surface='recipient-app',rect=dict(x=240,y=50,width=1050,height=750),duration=13)]),
 beat('end',[still('D16:feedback','Questions or problems? Tell us',surface='feedback',duration=8),still('D16:feedback','Teams · the OpenWork team',surface='feedback',duration=5),still('D16:feedback','ben@openworklabs.com · guillaume@openworklabs.com',surface='feedback',duration=8)])
]
cfg=dict(film=str(FILM),scene='D4',slide=str(slides['D4'][0]),work=str(OUT/'work'),out=str(OUT/'lena-day-full.mp4'),beats=beats,workers=8)
(OUT/'day.json').write_text(json.dumps(cfg,indent=2)+'\n')
print(OUT/'day.json')
