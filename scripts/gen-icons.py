"""Regenerates public/icons/*.png. Requires Pillow: pip install pillow.

Run from anywhere: python scripts/gen-icons.py
"""

from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (224, 101, 79, 255)  # ink red, matches --accent in src/App.css
FG = (237, 234, 226, 255)  # bone white, matches --ink in src/App.css


def draw_checkmark(draw, size, stroke_ratio=0.11, scale=1.0):
    """Draws a checkmark centered in a `size`x`size` canvas, scaled by `scale`."""
    s = size
    stroke = max(2, int(s * stroke_ratio))
    pts = [
        (0.22, 0.52),
        (0.42, 0.72),
        (0.78, 0.30),
    ]
    cx, cy = 0.5, 0.5
    scaled = []
    for x, y in pts:
        sx = cx + (x - cx) * scale
        sy = cy + (y - cy) * scale
        scaled.append((sx * s, sy * s))
    draw.line(scaled, fill=FG, width=stroke, joint="curve")
    r = stroke / 2
    for x, y in scaled:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=FG)


def make_icon(size, path, rounded=True, safe_scale=1.0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if rounded:
        radius = int(size * 0.06)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
    else:
        draw.rectangle([0, 0, size - 1, size - 1], fill=BG)
    draw_checkmark(draw, size, scale=safe_scale)
    img.save(path)


# "any" purpose icons — rounded corners look fine as a fallback tile
make_icon(192, os.path.join(OUT, "icon-192.png"), rounded=True, safe_scale=1.0)
make_icon(512, os.path.join(OUT, "icon-512.png"), rounded=True, safe_scale=1.0)

# maskable icons — full-bleed square, content kept within the ~80% safe zone
make_icon(192, os.path.join(OUT, "icon-maskable-192.png"), rounded=False, safe_scale=0.62)
make_icon(512, os.path.join(OUT, "icon-maskable-512.png"), rounded=False, safe_scale=0.62)

# apple touch icon (iOS ignores manifest, needs its own <link>, no transparency)
apple = Image.new("RGB", (180, 180), BG[:3])
draw = ImageDraw.Draw(apple)
draw_checkmark(draw, 180, scale=1.0)
apple.save(os.path.join(OUT, "apple-touch-icon.png"))

print("done")
