"""앱 아이콘 생성 스크립트 (개인정보 없음). 결과물: icons/*.png"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
os.makedirs(OUT, exist_ok=True)

GREEN_TOP = (47, 107, 82)
GREEN_BOT = (27, 71, 55)
PAPER = (252, 251, 247)
LINE = (208, 216, 210)
CORAL = (214, 106, 78)


def gradient(size):
    img = Image.new("RGB", (size, size), GREEN_TOP)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(size - 1, 1)
        c = tuple(int(GREEN_TOP[i] + (GREEN_BOT[i] - GREEN_TOP[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    return img


def glyph(img, size, scale=1.0):
    """종이(알림장) + 줄 + 코랄 알림 점. scale은 maskable 안전영역용."""
    d = ImageDraw.Draw(img, "RGBA")
    cx = cy = size / 2
    # 종이 크기
    w = size * 0.46 * scale
    h = size * 0.56 * scale
    left = cx - w / 2
    top = cy - h / 2 - size * 0.01 * scale
    right = cx + w / 2
    bottom = cy + h / 2 - size * 0.01 * scale
    r = size * 0.055 * scale
    # 그림자
    sh = size * 0.012 * scale
    d.rounded_rectangle([left + sh, top + sh * 2, right + sh, bottom + sh * 2],
                        radius=r, fill=(0, 0, 0, 55))
    # 종이
    d.rounded_rectangle([left, top, right, bottom], radius=r, fill=PAPER)
    # 상단 헤더 밴드
    band_h = size * 0.055 * scale
    d.rounded_rectangle([left, top, right, top + band_h], radius=r, fill=(232, 238, 233))
    d.rectangle([left, top + band_h * 0.55, right, top + band_h], fill=(232, 238, 233))
    # 왼쪽 제본 구멍
    ring_x = left + size * 0.028 * scale
    for i in range(3):
        yy = top + h * (0.30 + i * 0.22)
        d.ellipse([ring_x - size * 0.009 * scale, yy - size * 0.009 * scale,
                   ring_x + size * 0.009 * scale, yy + size * 0.009 * scale],
                  fill=(198, 208, 200))
    # 줄
    lx0 = left + w * 0.22
    lx1 = right - w * 0.14
    for i, frac in enumerate((0.42, 0.56, 0.70, 0.84)):
        yy = top + h * frac
        x1 = lx1 if i != 3 else lx1 - w * 0.22
        d.rounded_rectangle([lx0, yy, x1, yy + size * 0.016 * scale],
                            radius=size * 0.008 * scale, fill=LINE)
    # 알림 점
    dot_r = size * 0.075 * scale
    dcx = right - size * 0.005 * scale
    dcy = top + size * 0.012 * scale
    d.ellipse([dcx - dot_r, dcy - dot_r, dcx + dot_r, dcy + dot_r], fill=(0, 0, 0, 45))
    d.ellipse([dcx - dot_r + size * 0.004, dcy - dot_r + size * 0.004,
               dcx + dot_r + size * 0.004, dcy + dot_r + size * 0.004], fill=CORAL)
    d.ellipse([dcx - dot_r * 0.35, dcy - dot_r * 0.5,
               dcx + dot_r * 0.05, dcy - dot_r * 0.05], fill=(255, 255, 255, 130))


def rounded_mask(size, radius_ratio=0.22):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1],
                                        radius=int(size * 4 * radius_ratio), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def make(size, name, maskable=False, round_corners=True):
    img = gradient(size)
    if round_corners:
        img = img.convert("RGBA")
        img.putalpha(rounded_mask(size))
    glyph(img, size, scale=0.78 if maskable else 1.0)
    if not round_corners:
        img = img.convert("RGB")
    img.save(os.path.join(OUT, name), optimize=True)
    print("wrote", name, size)


make(192, "icon-192.png")
make(512, "icon-512.png")
make(512, "icon-maskable-512.png", maskable=True, round_corners=False)
make(192, "icon-maskable-192.png", maskable=True, round_corners=False)
make(180, "apple-touch-icon.png", round_corners=False)
make(64, "favicon-64.png")
