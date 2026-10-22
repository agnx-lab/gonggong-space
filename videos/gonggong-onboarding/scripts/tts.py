# MiniMax TTS for every line in lines.tsv -> audio/<id>.mp3 (skips existing files).
import json, sys, time, urllib.request
from pathlib import Path

root = Path(__file__).resolve().parent.parent
key = (Path.home() / '.minimax' / 'api_key').read_text().strip()
VOICE = {'N': ('Chinese (Mandarin)_Reliable_Executive', 1.1, 'calm'), 'G': ('Chinese (Mandarin)_Cute_Spirit', 1.05, 'happy'), 'F': ('male-qn-qingse', 1.0, 'fearful')}
only = set(sys.argv[1:])

for row in (root / 'lines.tsv').read_text().splitlines():
    lid, who, _, text = row.split('\t')
    out = root / 'audio' / f'{lid}.mp3'
    if (only and lid not in only) or (not only and out.exists()):
        continue
    vid, speed, emo = VOICE[who]
    body = {
        'model': 'speech-2.8-hd', 'text': text, 'stream': False, 'language_boost': 'Chinese',
        'voice_setting': {'voice_id': vid, 'speed': speed, 'vol': 1, 'pitch': 0, 'emotion': emo},
        'audio_setting': {'sample_rate': 32000, 'bitrate': 128000, 'format': 'mp3', 'channel': 1},
    }
    req = urllib.request.Request('https://api.minimaxi.com/v1/t2a_v2', json.dumps(body).encode(),
                                 {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    for attempt in range(5):
        try:
            res = json.loads(urllib.request.urlopen(req, timeout=120).read())
            break
        except OSError as e:
            print(lid, 'retry', e, file=sys.stderr)
            time.sleep(3)
    else:
        sys.exit(f'{lid}: network failed')
    if res.get('base_resp', {}).get('status_code') != 0:
        sys.exit(f'{lid}: {res.get("base_resp")}')
    out.write_bytes(bytes.fromhex(res['data']['audio']))
    print(lid, res.get('extra_info', {}).get('audio_length'))
