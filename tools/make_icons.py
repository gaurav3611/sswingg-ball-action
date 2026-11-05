"""
Draws the app icon and splash image: the SSwinGG bat mark, in the Ground theme colours.
The bat is the same drawing as the "bat" icon of the web app (tools/icons.mjs), on a 24 unit grid.

Usage: python tools/make_icons.py        Needs: pip install pillow
"""
from PIL import Image, ImageDraw

FOREST = (30, 91, 58, 255)
IVORY = (247, 245, 238, 255)
WHITE = (255, 255, 255, 255)
SS = 4  # draw at 4x and shrink, for smooth edges


def stroke(draw: ImageDraw.ImageDraw, pts, width: float, closed: bool = False) -> None:
    """A polyline with round caps and joins, one segment at a time so no corner is left open."""
    segs = list(zip(pts, pts[1:] + ([pts[0]] if closed else [])))
    for (x1, y1), (x2, y2) in segs:
        draw.line([(x1, y1), (x2, y2)], fill=255, width=round(width))
    for x, y in pts:
        draw.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=255)


def bat_mask(size: int, mark_share: float) -> Image.Image:
    """The bat as a white-on-black mask: the blade outline, the handle, and a ring for the ball."""
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    unit = size * mark_share / 24
    off = (size - 24 * unit) / 2

    def p(x, y):
        return (off + x * unit, off + y * unit)

    w = 2 * unit
    stroke(d, [p(7, 21), p(3, 17), p(12, 8), p(16, 12)], w, closed=True)
    stroke(d, [p(14, 10), p(20, 4)], w)
    cx, cy = p(18.5, 18.5)
    r = 2.5 * unit
    d.ellipse([cx - r - w / 2, cy - r - w / 2, cx + r + w / 2, cy + r + w / 2], fill=255)
    d.ellipse([cx - r + w / 2, cy - r + w / 2, cx + r - w / 2, cy + r - w / 2], fill=0)  # the hole
    return mask


def render(size: int, background, mark_colour, mark_share: float, name: str) -> None:
    big = size * SS
    img = Image.new("RGBA", (big, big), background if background else (0, 0, 0, 0))
    mark = Image.new("RGBA", (big, big), mark_colour)
    img.paste(mark, (0, 0), bat_mask(big, mark_share))
    img.resize((size, size), Image.LANCZOS).save(f"assets/{name}")


# Launcher icon: forest square with the white bat. The corners are drawn by the phone.
render(1024, FOREST, WHITE, 0.62, "icon.png")
# Adaptive icon foreground: transparent, bat inside the central safe zone (66 percent).
render(1024, None, WHITE, 0.42, "android-icon-foreground.png")
# Splash: the mark on the ivory page colour, the same box as the app header.
render(512, FOREST, WHITE, 0.62, "splash-icon.png")
render(48, FOREST, WHITE, 0.62, "favicon.png")
print("wrote icon.png, android-icon-foreground.png, splash-icon.png, favicon.png")
