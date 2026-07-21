#!/usr/bin/env python3
"""Crop a generated idiom scene to the card ratio and save an efficient WebP."""

from pathlib import Path
import sys

from PIL import Image, ImageOps


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: process-idiom-image.py INPUT OUTPUT")

    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    target.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image = ImageOps.fit(image, (800, 500), method=Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=84, method=6)


if __name__ == "__main__":
    main()
