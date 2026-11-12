#!/usr/bin/env python3
"""Assemble one blind review round.

  python3 docs/design-review/tools/make_round.py ROUND BASELINE_DIR NEW_DIR [REFERENCE_DIR]

Copies the review states (`review: true` in states.mjs) from the fixed
baseline set and this round's new set, plus the fixed reference set, into
/tmp/tag-hc/rounds/rROUND/{A,B,C} in random order, with a byte-identical copy
of brief.md. The A/B/C mapping is written outside the review folder, to
/tmp/tag-hc/private/rROUND.json.
"""
import hashlib
import json
import random
import re
import shutil
import sys
from pathlib import Path

ROOT = Path('/tmp/tag-hc')
DOCS = Path(__file__).resolve().parents[1]


def review_ids():
    source = (DOCS / 'tools/states.mjs').read_text(encoding='utf-8')
    return re.findall(r"\{ id: '([^']+)'[^}]*review: true", source)


def main():
    number, baseline, new = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    reference = Path(sys.argv[4]) if len(sys.argv) > 4 else ROOT / 'sets/reference'
    ids = review_ids()
    sets = {'baseline': baseline, 'new': new, 'reference': reference}
    labels = ['A', 'B', 'C']
    random.SystemRandom().shuffle(labels)
    mapping = dict(zip(labels, sets))
    out = ROOT / f'rounds/r{number}'
    if out.exists():
        shutil.rmtree(out)
    for label, name in mapping.items():
        target = out / label
        target.mkdir(parents=True)
        for image in sorted(sets[name].glob('*.png')):
            if name == 'reference' or image.name.rsplit('_', 1)[0] in ids:
                shutil.copy2(image, target / image.name)
    brief = DOCS / 'brief.md'
    shutil.copy2(brief, out / 'brief.md')
    digest = hashlib.sha256(brief.read_bytes()).hexdigest()
    counts = {label: len(list((out / label).glob('*.png'))) for label in labels}
    private = ROOT / 'private'
    private.mkdir(parents=True, exist_ok=True)
    (private / f'r{number}.json').write_text(json.dumps({'round': number, 'mapping': mapping, 'sets': {k: str(v) for k, v in sets.items()}, 'counts': counts, 'briefSha256': digest}, indent=2))
    print(out, counts, digest)


if __name__ == '__main__':
    main()
