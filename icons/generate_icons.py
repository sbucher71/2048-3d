import os
from io import BytesIO

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
except ImportError as e:
    raise SystemExit("Pillow not installed. Run: pip install --user pillow")

SIZES = [192, 512]
BG_TOP = (29, 9, 54)      # theme purple
BG_BOT = (15, 18, 38)     # deep blue
TILE = (255, 153, 51)     # accent
TEXT = (255, 255, 255)

# Try Segoe UI (Windows) else default
FONT_CANDIDATES = [
    "C:/Windows/Fonts/segoeui.ttf",
    "/System/Library/Fonts/SFNS.ttf",
]

def get_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                pass
    # fallback
    return ImageFont.load_default()


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ctx = ImageDraw.Draw(img)

    # background gradient
    for y in range(size):
        t = y / (size - 1)
        r = int(BG_TOP[0] * (1 - t) + BG_BOT[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOT[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOT[2] * t)
        ctx.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # tile-like rounded square
    pad = int(size * 0.14)
    rect = [pad, pad, size - pad, size - pad]
    radius = int(size * 0.12)
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tctx = ImageDraw.Draw(tile)
    # shadow
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sctx = ImageDraw.Draw(shadow)
    sctx.rounded_rectangle([rect[0]+4, rect[1]+10, rect[2]+4, rect[3]+10], radius=radius, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(size*0.04)))
    img.alpha_composite(shadow)

    # tile face
    tctx.rounded_rectangle(rect, radius=radius, fill=TILE)
    # glossy highlight
    hi = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    hctx = ImageDraw.Draw(hi)
    hi_rect = [rect[0]+6, rect[1]+6, rect[2]-6, int((rect[1]+rect[3])/2)]
    hctx.rounded_rectangle(hi_rect, radius=int(radius*0.8), fill=(255, 255, 255, 40))
    tile.alpha_composite(hi)
    img.alpha_composite(tile)

    # text
    txt = "2048"
    f = get_font(int(size * 0.42))
    try:
        bbox = ctx.textbbox((0, 0), txt, font=f)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    except Exception:
        # Fallback for very old Pillow
        tw, th = f.getsize(txt)
    tx = (size - tw) // 2
    ty = int(size * 0.54 - th / 2)
    # slight shadow for text
    ctx.text((tx+2, ty+2), txt, font=f, fill=(0,0,0,120))
    ctx.text((tx, ty), txt, font=f, fill=TEXT)

    return img


def main():
    out_dir = os.path.dirname(__file__)
    for s in SIZES:
        icon = make_icon(s)
        path = os.path.join(out_dir, f"icon-{s}.png")
        icon.save(path, format="PNG")
        print(f"Wrote {path}")

if __name__ == "__main__":
    main()
