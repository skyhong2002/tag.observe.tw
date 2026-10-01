"""Generate 新文易數 logo, favicon and share-image sources as outlined SVG.

Needs fontTools and Noto Serif TC (SIL OFL) in /tmp/logo:
  curl -LO https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/TC/NotoSerifTC-{Regular,SemiBold,Bold}.otf
Drafts and the share-image SVG go to artifacts/brand/; rasterise with rsvg-convert
(web/src/app/opengraph-image.png, apple-icon.png at 180px, favicon.ico at 16/32/48px).
"""
import pathlib
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = pathlib.Path('/home/deck/Projects/tag.analysis.tw/artifacts/brand')
OUT.mkdir(parents=True, exist_ok=True)
INK, ACCENT, MUTED, PAPER = '#1c1c1f', '#d9480f', '#a1a1aa', '#ffffff'
fonts = {w: TTFont(f'/tmp/logo/NotoSerifTC-{w}.otf') for w in ('Regular', 'SemiBold', 'Bold')}


def glyph(ch, weight, x, y, size, fill=INK):
    """Outlined glyph whose 1000-unit em box has its top-left corner at (x, y)."""
    f = fonts[weight]
    gs = f.getGlyphSet()
    name = f.getBestCmap()[ord(ch)]
    pen = SVGPathPen(gs)
    gs[name].draw(pen)
    k = size / 1000
    return (f'<path fill="{fill}" transform="translate({x:.2f} {y:.2f}) scale({k:.5f} {-k:.5f}) '
            f'translate(0 -880)" d="{pen.getCommands()}"/>')


def block(size, gap, weight='SemiBold', cx=256, cy=256, fill=INK):
    x0, y0 = cx - size - gap / 2, cy - size - gap / 2
    x1, y1 = cx + gap / 2, cy + gap / 2
    return ''.join(glyph(c, weight, x, y, size, fill)
                   for c, x, y in (('新', x0, y0), ('文', x1, y0), ('易', x0, y1), ('數', x1, y1)))


def svg(body, bg=None, size=512):
    back = f'<rect width="512" height="512" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}">'
            f'{back}{body}</svg>')


V = {}
# A: faithful redraw of the old logo, for reference.
V['a-original'] = (block(168, 30, 'Regular')
                   + glyph('{', 'Regular', 4, 160, 210, MUTED) + glyph('}', 'Regular', 446, 160, 210, MUTED)
                   + glyph('#', 'Regular', 243, 236, 40, INK))
# B: the square alone.
V['b-block'] = block(200, 14)
# C: two bars side by side, "read both sides".
V['c-bars'] = (block(196, 40)
               + f'<rect x="241" y="232" width="9" height="48" fill="{INK}"/>'
               + f'<rect x="262" y="232" width="9" height="48" fill="{ACCENT}"/>')
# D: hairline cross splitting four sources, accent point where they meet.
V['d-cross'] = (block(196, 40)
                + f'<path d="M256 50V462M50 256H462" stroke="{MUTED}" stroke-width="2.5"/>'
                + f'<rect x="247" y="247" width="18" height="18" fill="{ACCENT}" transform="rotate(45 256 256)"/>')
# E: one circle split in two halves, "same event, two tellings".
V['e-halves'] = (block(196, 40)
                 + f'<path d="M252 234a22 22 0 0 0 0 44z" fill="{INK}"/>'
                 + f'<path d="M260 234a22 22 0 0 1 0 44z" fill="{ACCENT}"/>')
# F: prism, one ray in and a split ray out.
V['f-prism'] = (block(196, 40)
                + f'<path d="M256 238l17 30h-34z" fill="none" stroke="{INK}" stroke-width="3.5" stroke-linejoin="round"/>'
                + f'<path d="M264 252l-6 16" stroke="{ACCENT}" stroke-width="3.5" stroke-linecap="round"/>')

# Favicons: the square on an ink tile, and a single 易 with the split-circle accent.
V['icon-block'] = (f'<rect width="512" height="512" rx="96" fill="{INK}"/>' + block(214, 18, 'Bold', fill=PAPER))
V['icon-yi'] = (f'<rect width="512" height="512" rx="96" fill="{INK}"/>'
                + glyph('易', 'Bold', 66, 58, 380, PAPER)
                + f'<path d="M404 380a34 34 0 0 0 0 68z" fill="{PAPER}"/>'
                + f'<path d="M414 380a34 34 0 0 1 0 68z" fill="{ACCENT}"/>')

for name, body in V.items():
    (OUT / f'{name}.svg').write_text(svg(body))

# Contact sheet: each draft large, plus 64/32/16 px renders to judge legibility.
cells = []
for i, (name, body) in enumerate(V.items()):
    col, row = i % 4, i // 4
    ox, oy = 20 + col * 300, 20 + row * 380
    cells.append(f'<g transform="translate({ox} {oy})"><rect width="280" height="360" rx="12" fill="#f4f4f5"/>'
                 f'<svg x="12" y="12" width="256" height="256" viewBox="0 0 512 512">{body}</svg>'
                 + ''.join(f'<svg x="{x}" y="{300 - s / 2:.0f}" width="{s}" height="{s}" viewBox="0 0 512 512">'
                           f'<rect width="512" height="512" fill="#fff"/>{body}</svg>'
                           for x, s in ((20, 64), (110, 32), (170, 16)))
                 + f'<text x="200" y="306" font-family="monospace" font-size="15" fill="#52525b">{name}</text></g>')
rows = (len(V) + 3) // 4
(OUT / 'sheet.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1220" height="{rows * 380 + 20}">'
                               f'<rect width="100%" height="100%" fill="#fff"/>{"".join(cells)}</svg>')
print('\n'.join(sorted(p.name for p in OUT.iterdir())))

# ---- Final assets (chosen: e-halves logo, icon-yi favicon) ----
WEB = pathlib.Path('/home/deck/Projects/tag.analysis.tw/web')


def halves(cx, cy, r, gap, left=INK, right=ACCENT):
    return (f'<path d="M{cx - gap / 2:.2f} {cy - r:.2f}a{r} {r} 0 0 0 0 {2 * r}z" fill="{left}"/>'
            f'<path d="M{cx + gap / 2:.2f} {cy - r:.2f}a{r} {r} 0 0 1 0 {2 * r}z" fill="{right}"/>')


def run(text, weight, x, y, size, fill):
    """Proportional text run using each glyph's own advance width."""
    f = fonts[weight]
    out = []
    for ch in text:
        out.append(glyph(ch, weight, x, y, size, fill))
        x += f['hmtx'][f.getBestCmap()[ord(ch)]][0] * size / 1000
    return ''.join(out)


def raw(body, w, h, label='新文易數'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{label}">'
            f'<title>{label}</title>{body}</svg>')


(WEB / 'public/brand').mkdir(parents=True, exist_ok=True)
(WEB / 'public/brand/logo.svg').write_text(raw(V['e-halves'], 512, 512))
# Horizontal lockup for the header: 新文 ◐ 易數, ink as currentColor so it follows light/dark mode.
row = ''.join(glyph(c, 'SemiBold', x, 0, 100, 'currentColor') for c, x in (('新', 0), ('文', 96), ('易', 240), ('數', 336)))
lock = row + halves(218, 50, 14, 4, 'currentColor')
(WEB / 'public/brand/wordmark.svg').write_text(raw(lock, 436, 100))
# The header inlines the same lockup so the ink can follow light/dark mode.
(WEB / 'src/components/Wordmark.tsx').write_text(
    '// Generated by tools/brand-assets.py from Noto Serif TC (SIL OFL); ink follows currentColor.\n'
    'export default function Wordmark({ className }: { className?: string }) {\n'
    '  return (\n'
    '    <svg viewBox="0 0 436 100" className={className} role="img" aria-label="新文易數">\n'
    f'      {lock.replace(chr(34) + "/>", chr(34) + " />")}\n'
    '    </svg>\n'
    '  );\n'
    '}\n')
icon = V['icon-yi']
(WEB / 'src/app/icon.svg').write_text(raw(icon, 512, 512))
(OUT / 'icon-yi-512.svg').write_text(svg(icon))

# Share image 1200x630: logo block left, name and tagline right.
tag = ''.join(glyph(c, 'Regular', 600 + i * 46, 350, 46, '#52525b') for i, c in enumerate('同一件事，各家怎麼說'))
name = ''.join(glyph(c, 'Bold', 600 + i * 104, 210, 104) for i, c in enumerate('新文易數'))
og = (f'<rect width="1200" height="630" fill="#fafafa"/>'
      f'<svg x="70" y="85" width="460" height="460" viewBox="0 0 512 512">{V["e-halves"]}</svg>'
      f'<rect x="560" y="200" width="3" height="230" fill="{ACCENT}"/>{name}{tag}'
      + run('tag.observe.tw', 'Regular', 602, 440, 26, '#a1a1aa'))
(OUT / 'og.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">{og}</svg>')
print('final assets written')
