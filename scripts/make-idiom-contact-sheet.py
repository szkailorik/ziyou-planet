#!/usr/bin/env python3
"""Build a labeled contact sheet for visual QA of generated idiom scenes."""

from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont, ImageOps


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("usage: make-idiom-contact-sheet.py OUTPUT INPUT...")

    output = Path(sys.argv[1])
    sources = [Path(value) for value in sys.argv[2:]]
    tile_w, tile_h, label_h = 400, 250, 28
    columns = 2
    rows = (len(sources) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile_w, rows * (tile_h + label_h)), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)

    for index, source in enumerate(sources):
        with Image.open(source) as image:
            tile = ImageOps.fit(image.convert("RGB"), (tile_w, tile_h), Image.Resampling.LANCZOS)
        x = (index % columns) * tile_w
        y = (index // columns) * (tile_h + label_h)
        sheet.paste(tile, (x, y))
        draw.text((x + 8, y + tile_h + 5), source.stem, fill="#222", font=font)

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, "JPEG", quality=88)


if __name__ == "__main__":
    main()
