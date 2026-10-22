# Generates index.html (frame hosts, step HUD, captions, audio) from timeline.json.
import json, html
from pathlib import Path

root = Path(__file__).resolve().parent.parent
tl = json.loads((root / 'timeline.json').read_text())
total = tl['total']
frames = tl['frames']
WHO = {'G': ('共字君', '#8fd6ff'), 'F': ('反推', '#ffd36b')}
STEPS = ['报到', '分工位', '招聘', '进群', '派活']
step_frames = [f for f in frames if 5 <= f['n'] <= 9]

hosts, caps, auds, cap_js = [], [], [], []
for f in frames:
    hosts.append(
        f'<div id="h-{f["id"]}" data-composition-id="{f["id"]}" data-composition-src="compositions/{f["id"]}.html" '
        f'data-start="{f["start"]}" data-duration="{f["len"]}" data-track-index="{2 + f["n"] % 2}" data-width="1920" data-height="1080"></div>'
    )
    for l in f['lines']:
        who = WHO.get(l['voice'])
        tag = f'<b style="color:{who[1]}">{who[0]}</b>' if who else ''
        caps.append(f'<div class="cap" id="k-{l["id"]}"><span>{tag}{html.escape(l["text"].replace("艾特", " @ "))}</span></div>')
        cap_js.append([l['id'], l['start'], round(l['start'] + l['dur'], 2)])
        auds.append(f'<audio id="a-{l["id"]}" src="audio/{l["id"]}.mp3" data-start="{l["start"]}" data-duration="{l["dur"]}" data-track-index="12"></audio>')

hud_start = step_frames[0]['start']
hud_len = round(step_frames[-1]['start'] + step_frames[-1]['len'] - hud_start, 2)
hud_js = [[round(f['start'] - hud_start, 2), i] for i, f in enumerate(step_frames)]
dots = ''.join(f'<span class="st" id="hd{i}"><i>{i + 1}</i>{s}</span>' for i, s in enumerate(STEPS))

page = f'''<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/gsap.min.js"></script>
    <link rel="stylesheet" href="assets/shared.css" />
    <script src="assets/shared.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #eef1f6; }}
      #root {{ width: 100%; height: 100%; position: relative; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; color: #1d1d1f; background: #eef1f6; }}
      #bg {{ position: absolute; inset: 0; background: linear-gradient(160deg, #f4f6fb 0%, #e8edf7 55%, #e6f1f1 100%); }}
      #bg .grid {{ position: absolute; inset: 0; opacity: 0.5; background-image: radial-gradient(#c7cede 1.2px, transparent 1.2px); background-size: 36px 36px; }}
      #bg .blob {{ position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.55; }}
      #hud {{ position: absolute; left: 56px; top: 40px; display: flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 800; color: #3b4152; }}
      #hud img {{ width: 40px; height: 40px; }}
      #hud .lbl {{ margin-right: 8px; }}
      #hud .st {{ display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.7); color: #6b7080; }}
      #hud .st i {{ font-style: normal; width: 28px; height: 28px; border-radius: 50%; background: #e3e7ef; color: #5b6172; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; }}
      #caps .cap {{ position: absolute; left: 0; right: 0; top: 972px; display: flex; justify-content: center; opacity: 0; }}
      #caps .cap span {{ max-width: 1560px; font-size: 31px; font-weight: 600; color: #fff; background: rgba(18, 22, 34, 0.8); padding: 10px 26px; border-radius: 14px; line-height: 1.4; text-align: center; }}
      #caps .cap b {{ margin-right: 8px; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">
      <div id="bg" class="clip" data-start="0" data-duration="{total}" data-track-index="0">
        <div class="grid"></div>
        <div class="blob" style="width: 900px; height: 900px; left: -200px; top: -300px; background: #c9d8ff"></div>
        <div class="blob" style="width: 800px; height: 800px; right: -220px; bottom: -320px; background: #c4ece8"></div>
      </div>
      {chr(10).join('      ' + h for h in hosts).strip()}
      <div id="hud" class="clip" data-start="{hud_start}" data-duration="{hud_len}" data-track-index="5">
        <img src="assets/logo.svg" alt="" /><span class="lbl">招 AI 新同事</span>{dots}
      </div>
      <div id="caps" class="clip" data-start="0" data-duration="{total}" data-track-index="6">
        {chr(10).join('        ' + c for c in caps).strip()}
      </div>
      <audio id="music" src="audio/music.wav" data-start="0" data-duration="{total}" data-track-index="10" data-volume="0.5"></audio>
      <audio id="sfx" src="audio/sfx.wav" data-start="0" data-duration="{total}" data-track-index="11" data-volume="0.5"></audio>
      {chr(10).join('      ' + a for a in auds).strip()}
    </div>
    <script>
      const HUD = {json.dumps(hud_js)}
      const HUD0 = {hud_start}
      const CAPS = {json.dumps(cap_js)}
      const tl = gsap.timeline({{ paused: true }})
      tl.fromTo('#hud', {{ opacity: 0, y: -20 }}, {{ opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }}, HUD0)
      HUD.forEach(([t, i]) => {{
        if (i > 0) {{
          tl.set(`#hd${{i - 1}}`, {{ color: '#187a35' }}, HUD0 + t)
          tl.set(`#hd${{i - 1}} i`, {{ backgroundColor: '#187a35', color: '#ffffff', textContent: '✓' }}, HUD0 + t)
        }}
        tl.set(`#hd${{i}}`, {{ color: '#0a7cff', backgroundColor: '#ffffff' }}, HUD0 + t)
        tl.fromTo(`#hd${{i}} i`, {{ backgroundColor: '#e3e7ef', color: '#5b6172', scale: 1 }}, {{ backgroundColor: '#0a66d6', color: '#ffffff', scale: 1.2, duration: 0.3, immediateRender: false }}, HUD0 + t + 0.3)
      }})
      CAPS.forEach(([id, a, b]) => {{
        tl.fromTo(`#k-${{id}}`, {{ opacity: 0, y: 10 }}, {{ opacity: 1, y: 0, duration: 0.2 }}, a)
        tl.to(`#k-${{id}}`, {{ opacity: 0, duration: 0.2 }}, b)
      }})
      window.__timelines = window.__timelines || {{}}
      window.__timelines['main'] = tl
    </script>
  </body>
</html>
'''
(root / 'index.html').write_text(page)
print('index.html written', total)
