"""Draw every landmark in docs/tools/framing/scene/scene.json on the photo, to check each line sits on the body part.

Run from the repository root: python figures/framing/overlay.py
Writes figures/framing/landmarks.jpg (the whole photo) and landmarks-detail.jpg (the speaker at 2x).
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from scene import extended_photo

ROOT = Path(__file__).resolve().parents[2]
SCENE = json.loads((ROOT / "docs/tools/framing/scene/scene.json").read_text())
OUT = Path(__file__).resolve().parent
FONT = ImageFont.truetype("DejaVuSans-Bold.ttf", 22)

photo = extended_photo(SCENE)
w, h = SCENE["photo"]["width"], SCENE["photo"]["height"]
canvas = Image.new("RGB", (photo.width, h + 420), (40, 0, 40))
canvas.paste(photo, (0, 0))
draw = ImageDraw.Draw(canvas)
draw.line([(w, 0), (w, h)], fill=(255, 0, 255), width=2)
draw.text((w + 10, 10), "mirrored past here", font=FONT, fill=(255, 0, 255))
draw.line([(0, h), (canvas.width, h)], fill=(255, 0, 255), width=2)
draw.text((10, h + 10), "below the photo", font=FONT, fill=(255, 0, 255))

COLORS = [(255, 80, 80), (255, 200, 0), (80, 255, 120), (0, 220, 255), (200, 120, 255), (255, 255, 255)]
for i, (name, mark) in enumerate(SCENE["landmarks"].items()):
    color = COLORS[i % len(COLORS)]
    y = mark["y"]
    draw.line([(900, y), (1800, y)], fill=color, width=2)
    label = name + (" (est.)" if mark.get("estimated") else "")
    draw.text((1810 + (i % 2) * 230, y - 12), label, font=FONT, fill=color)
    if "x" in mark:
        draw.ellipse([mark["x"] - 6, y - 6, mark["x"] + 6, y + 6], outline=color, width=3)
    for x in mark.get("xs", []):
        draw.ellipse([x - 8, y - 8, x + 8, y + 8], outline=color, width=3)

eyes = SCENE["landmarks"]["eyes"]
look = SCENE["lookDirection"]
draw.line([(eyes["x"], eyes["y"]), (eyes["x"] + look["x"] * 160, eyes["y"] + look["y"] * 160)], fill=(255, 0, 255), width=4)
draw.text((eyes["x"] + look["x"] * 160 - 90, eyes["y"] - 36), "looks", font=FONT, fill=(255, 0, 255))

canvas.save(OUT / "landmarks.jpg", quality=85)
canvas.crop((950, 220, 1750, 1306)).resize((1600, 2172)).save(OUT / "landmarks-detail.jpg", quality=85)
print("wrote", OUT / "landmarks.jpg", OUT / "landmarks-detail.jpg")
