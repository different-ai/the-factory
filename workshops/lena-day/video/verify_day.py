#!/usr/bin/env python3
"""Extract review evidence from the *encoded delivery*, not intermediate renders.
Usage: verify_day.py <day.json>. Creates JPEG samples, contact sheets, and metadata.
This checks technical integrity; the contact sheets still require human visual review.
"""
import json
import math
import subprocess
import sys
from pathlib import Path
from PIL import Image,ImageDraw

cfg=json.loads(Path(sys.argv[1]).read_text()); work=Path(cfg['work']); out=Path(cfg['out'])
timeline=json.loads((work/'timeline.json').read_text()); fps=timeline['fps']
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(out)]))
v=next(s for s in probe['streams'] if s['codec_type']=='video'); a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'])==(1920,1080)
assert v['codec_name']=='h264' and a['codec_name']=='aac'
assert abs(float(probe['format']['duration'])-timeline['duration'])<.2
samples=[]
for p in timeline['parts']:
    if p['kind']=='turn':
        td=p['typingDuration']; times=[.6,1.5+td*.6,1.5+td+1.0,1.5+td+3.5,p['duration']-1.5]
    else: times=[min(1,p['duration']*.2),p['duration']*.65]
    for t in times:
        samples.append(dict(at=p['start']+t,beat=p['beat'],kind=p['kind'],scene=p.get('scene') or p.get('marker') or Path(p['path']).parent.name))
frames=work/'encoded-review'; frames.mkdir(exist_ok=True)
select='+'.join(f'eq(n,{round(s["at"]*fps)})' for s in samples)
subprocess.run(['ffmpeg','-v','error','-y','-i',str(out),'-vf',f'select={select.replace(",",chr(92)+",")}','-fps_mode','vfr','-q:v','2',str(frames/'frame-%04d.jpg')],check=True)
paths=sorted(frames.glob('frame-*.jpg'))
assert len(paths)==len(samples),(len(paths),len(samples))
for p,s in zip(paths,samples): s['path']=str(p)
for page in range(math.ceil(len(samples)/12)):
    sheet=Image.new('RGB',(1920,960),(22,24,30)); d=ImageDraw.Draw(sheet)
    for j,s in enumerate(samples[page*12:(page+1)*12]):
        x=(j%4)*480; y=(j//4)*320
        im=Image.open(s['path']); im.thumbnail((480,270)); sheet.paste(im,(x,y))
        d.text((x+10,y+277),f'{s["at"]:.2f}s | {s["beat"]} | {s["kind"]}',fill='white')
        d.text((x+10,y+296),s['scene'][:65],fill=(170,180,195))
    sheet.save(frames/f'contact-{page+1:02d}.jpg',quality=92)
result=dict(file=str(out),size=out.stat().st_size,duration=probe['format']['duration'],video={k:v[k] for k in ('codec_name','width','height','r_frame_rate','pix_fmt')},audio={k:a[k] for k in ('codec_name','sample_rate','channels')},samples=samples,visualReview='pending: inspect extracted encoded frames before publishing')
(work/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('Encoded samples:',len(samples),'contact sheets:',math.ceil(len(samples)/12),'duration:',probe['format']['duration'])
