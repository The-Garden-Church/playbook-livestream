"""Cut the stage photos in source/ into the virtual camera's scene layers.

Needs `pip install "rembg[cpu]" pillow`. Writes to docs/tools/virtual-camera/scene/.
Run once per scene (`python make-scenes.py wide`, then `close`), since the
segmentation model needs most of a 16 GB machine's memory per photo.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw
from rembg import new_session, remove

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "docs" / "tools" / "virtual-camera" / "scene"

SCENES = {
    "wide": {"source": "main.png", "wall_bottom": 395},
    "close": {"source": "side.png", "wall_bottom": None},
}


def subject_mask(photo, session):
    return remove(photo, session=session, only_mask=True).convert("L")


def wall_mask(size, bottom, subject):
    mask = Image.new("L", size, 0)
    if bottom:
        ImageDraw.Draw(mask).rectangle([0, 0, size[0], bottom], fill=255)
    return ImageChops.subtract(mask, subject)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    session = new_session("birefnet-portrait")
    for name in sys.argv[1:] or SCENES:
        spec = SCENES[name]
        photo = Image.open(HERE / "source" / spec["source"]).convert("RGB")
        subject = subject_mask(photo, session)
        photo.save(OUT / f"{name}.jpg", quality=90, optimize=True)
        subject.save(OUT / f"{name}-mask-subject.png", optimize=True)
        wall_mask(photo.size, spec["wall_bottom"], subject).save(OUT / f"{name}-mask-wall.png", optimize=True)
        print("wrote", name, photo.size)


if __name__ == "__main__":
    main()
