# -*- coding: utf-8 -*-
"""生成 App 图标（一次性脚本，改配色后重跑即可）"""
import os
import numpy as np
from PIL import Image, ImageDraw

S = 512
OUT = os.path.dirname(os.path.abspath(__file__))

C_BG_1 = (107, 133, 255)
C_BG_2 = (63, 87, 214)
C_WHITE = (255, 255, 255)
C_HEAD = (79, 110, 247)
C_DOT = (226, 232, 250)
C_DOT_HI = (79, 110, 247)


def gradient(size=S, c1=C_BG_1, c2=C_BG_2):
    """对角渐变背景"""
    y, x = np.mgrid[0:size, 0:size]
    t = (x + y) / (2.0 * (size - 1))
    arr = np.zeros((size, size, 3), dtype=np.uint8)
    for i in range(3):
        arr[:, :, i] = (c1[i] + (c2[i] - c1[i]) * t).astype(np.uint8)
    return Image.fromarray(arr, 'RGB').convert('RGBA')


def draw_calendar(img, scale=1.0):
    """在图上画一个日历；scale<1 用于 maskable 的留白"""
    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S / 2

    cw, ch = 300 * scale, 280 * scale
    x0, y0 = cx - cw / 2, cy - ch / 2 + 6 * scale
    x1, y1 = x0 + cw, y0 + ch
    r = 46 * scale

    # 白色卡身
    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=C_WHITE)

    # 顶部彩色条（只有上面两个角是圆的）
    hh = 66 * scale
    d.rounded_rectangle([x0, y0, x1, y0 + hh], radius=r, fill=C_HEAD)
    d.rectangle([x0, y0 + hh - r, x1, y0 + hh], fill=C_HEAD)

    # 顶部两个小圆环
    ring_w, ring_h = 22 * scale, 34 * scale
    for rx in (x0 + cw * 0.26, x1 - cw * 0.26):
        d.rounded_rectangle(
            [rx - ring_w / 2, y0 - ring_h * 0.35, rx + ring_w / 2, y0 + ring_h * 0.65],
            radius=ring_w / 2, fill=C_WHITE,
        )

    # 日历格子：4 列 x 3 行
    cols, rows = 4, 3
    dot = 34 * scale
    gap = 16 * scale
    grid_w = cols * dot + (cols - 1) * gap
    grid_h = rows * dot + (rows - 1) * gap
    gx = cx - grid_w / 2
    gy = y0 + hh + (ch - hh - grid_h) / 2

    for r_ in range(rows):
        for c_ in range(cols):
            dx = gx + c_ * (dot + gap)
            dy = gy + r_ * (dot + gap)
            # 一个高亮点，避免整片灰
            color = C_DOT_HI if (r_ == 1 and c_ == 0) else C_DOT
            d.rounded_rectangle([dx, dy, dx + dot, dy + dot], radius=8 * scale, fill=color)

    return img


def rounded_outer(img, radius=112):
    """给普通图标加圆角遮罩（iOS/部分启动器会自己裁，但桌面更整齐）"""
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def save(img, name):
    img.save(os.path.join(OUT, name), 'PNG', optimize=True)
    print('written', name)


# 普通图标（圆角）
base = gradient()
base = draw_calendar(base)
save(rounded_outer(base).resize((512, 512), Image.LANCZOS), 'icon-512.png')
save(rounded_outer(base).resize((192, 192), Image.LANCZOS), 'icon-192.png')

# maskable：满幅背景 + 内容缩到安全区
m = gradient()
m = draw_calendar(m, scale=0.72)
save(m, 'icon-maskable-512.png')
