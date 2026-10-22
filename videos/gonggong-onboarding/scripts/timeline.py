# Lays out frames and lines from lines.tsv + real mp3 durations -> timeline.json.
import json, subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
FRAMES = ['01-telephone', '02-promise', '03-before-after', '04-chapter', '05-login', '06-machine', '07-new-bot',
          '08-group', '09-mention', '10-approval', '11-preview', '12-more', '13-feishu', '14-cta']
LEAD = {1: 0.8, 2: 0.6, 4: 0.5}
GAP, TAIL = 0.38, 0.6


def dur(p):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)]))


rows = [r.split('\t') for r in (root / 'lines.tsv').read_text().splitlines()]
frames, t = [], 0.0
for n, name in enumerate(FRAMES, 1):
    start, local, lines = t, LEAD.get(n, 0.7), []
    for lid, who, fr, text in rows:
        if int(fr) != n:
            continue
        if lines:
            local += GAP + (0.25 if who != 'N' else 0)
        d = round(dur(root / 'audio' / f'{lid}.mp3'), 3)
        lines.append({'id': lid, 'voice': who, 'text': text, 'local': round(local, 2), 'start': round(start + local, 2), 'dur': d})
        local += d
    length = round(local + (1.6 if n == 14 else TAIL), 2)
    frames.append({'n': n, 'id': f'f{n:02d}', 'name': name, 'start': round(start, 2), 'len': length, 'lines': lines})
    t = round(start + length, 2)

(root / 'timeline.json').write_text(json.dumps({'total': t, 'frames': frames}, ensure_ascii=False, indent=1))
for f in frames:
    print(f"{f['id']} {f['start']:7.2f} len {f['len']:5.2f}  " + '  '.join(f"{l['id']}@{l['local']}+{l['dur']:.1f}" for l in f['lines']))
print('total', t)
