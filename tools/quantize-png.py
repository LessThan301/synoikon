#!/usr/bin/env python3
"""Shrink OG images ~5x: 128-colour palette PNG (no dithering; flat UI colours survive intact).
usage: python3 tools/quantize-png.py FILE.png [...]   (needs Pillow)"""
import os, sys
from PIL import Image
before = after = 0
for f in sys.argv[1:]:
    before += os.path.getsize(f)
    Image.open(f).convert('RGB').quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(f, optimize=True)
    after += os.path.getsize(f)
if sys.argv[1:]:
    print(f'quantized {len(sys.argv) - 1} PNGs: {before // 1024} KB -> {after // 1024} KB')
