"""Fetch only explicit public sticker paths; keep the source manifest beside them."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
import json

root = Path(__file__).resolve().parents[1]
out = root / 'public/stickers'
out.mkdir(parents=True, exist_ok=True)
items = []

def add(repo, revision, path, group, filename=None):
    name = filename or Path(path).name
    items.append({'source': f'https://raw.githubusercontent.com/{repo}/{revision}/{path}',
                  'path': f'/stickers/{group}/{name}', 'repo': f'https://github.com/{repo}', 'group': group})

stitch = ['stitchbareng','stitchbareng1','stitchbareng2','stitchbareng3','stitchblue','stitchblue1','stitchblue2','stitchblue3','stitchpink','stitchpink1','stitchpink2']
for name in stitch:
    add('rafalino26/moncinox_vault','44f0d19abeeff5c16da101d2ff19bd95dbb75226',f'public/stickers/{name}.png','stitch')
nailong = ['sticker-bajak-laut','sticker-berdiri','sticker-bunga','sticker-hati','sticker-headphone','sticker-jungkir','sticker-khawatir','sticker-manyun','sticker-melet','sticker-semangat']
nailong += [f'sticker-extra-{i:02}' for i in range(1,16)]
for name in nailong:
    add('rafalino26/scrapbook-online','bd02fbd53c51088ccf437cb9d2072f80373f5bef',f'public/nailong/{name}.webp','nailong')
for name in ['SOURCES.md','sticker-sources.json']:
    add('rafalino26/scrapbook-online','bd02fbd53c51088ccf437cb9d2072f80373f5bef',f'public/nailong/{name}','nailong')

emoji = {'1f338':'cherry-blossom','1f33c':'daisy','1f337':'tulip','1f33b':'sunflower','1f98b':'butterfly','1f380':'pink-bow','1f497':'pink-heart','1f49c':'purple-heart','1f495':'two-hearts','1f48c':'love-letter','1f31f':'glowing-star','2728':'sparkles','1f308':'rainbow','1f352':'cherries','1f353':'strawberry','1f370':'cake','1f9cb':'bubble-tea','1f431':'cat','1f43b':'bear','1f430':'bunny','1f438':'frog','1f43c':'panda','1f986':'duck','1f308':'rainbow','1f344':'mushroom'}
for code, name in emoji.items():
    add('jdecked/twemoji','v16.0.1',f'assets/svg/{code}.svg','cute',f'{name}.svg')
add('jdecked/twemoji','v16.0.1','LICENSE-GRAPHICS','cute','LICENSE-GRAPHICS.txt')

def fetch(item):
    destination = root / 'public' / item['path'].lstrip('/')
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        with urlopen(Request(item['source'],headers={'User-Agent':'Ramon-asset-preparation'}),timeout=35) as response:
            destination.write_bytes(response.read())
    return f"{item['path']} ({destination.stat().st_size} bytes)"

with ThreadPoolExecutor(max_workers=5) as pool:
    for message in pool.map(fetch,items):
        print(message)
(out / 'sources.json').write_text(json.dumps(items,indent=2),encoding='utf-8')
