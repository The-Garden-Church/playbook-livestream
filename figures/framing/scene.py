from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]


def extended_photo(scene):
    """The photo plus a mirrored strip on the right, the same picture the framing tool draws."""
    photo = Image.open(ROOT / "docs/tools/framing/scene" / scene["image"]).convert("RGB")
    extra = scene["mirrorRight"]
    out = Image.new("RGB", (photo.width + extra, photo.height))
    out.paste(photo, (0, 0))
    out.paste(ImageOps.mirror(photo.crop((photo.width - extra, 0, photo.width, photo.height))), (photo.width, 0))
    return out
