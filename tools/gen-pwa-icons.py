"""Web App (PWA) icons derived from web/src/app/icon.svg (made by brand-assets.py).

Writes web/public/pwa/icon-{192,512}.png (rounded tile, purpose "any") and
maskable-{192,512}.png (full-bleed tile, glyph inside the 80% safe circle).
Needs rsvg-convert. Run: python3 tools/gen-pwa-icons.py
"""
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'web/src/app/icon.svg').read_text()
out = ROOT / 'web/public/pwa'
out.mkdir(parents=True, exist_ok=True)

tile = re.search(r'<rect [^>]*fill="(#[0-9a-fA-F]+)"/>', src)
ink = tile.group(1)
body = src[tile.end():src.rindex('</svg>')]
k = 0.72  # keeps the glyph's corners inside the maskable safe zone (r = 40%)
maskable = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="{ink}"/>'
            f'<g transform="translate({256 * (1 - k):.2f} {256 * (1 - k):.2f}) scale({k})">{body}</g></svg>')

for name, svg in (('icon', src), ('maskable', maskable)):
    for size in (192, 512):
        subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), '-o', str(out / f'{name}-{size}.png')],
                       input=svg.encode(), check=True)
        print(out / f'{name}-{size}.png')
