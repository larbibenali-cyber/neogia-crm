#!/usr/bin/env python3
"""Génère l'icône d'application Neogia CRM (PWA / iOS) à partir de la charte
graphique existante (violet #4527EA, monogramme "N", motif du "O" circulaire
du logo). Ne dépend d'aucune donnée client : purement un asset graphique.
"""
from PIL import Image, ImageDraw, ImageFont

BRAND = (69, 39, 234)       # #4527EA
BRAND_DARK = (49, 25, 178)  # légère variante plus foncée pour un dégradé subtil
WHITE = (255, 255, 255)

FONT_PATH = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"

OUT_DIR = "client/public/icons"


def make_master(size=1024, monogram_only=False):
    img = Image.new("RGB", (size, size), BRAND)
    draw = ImageDraw.Draw(img)

    # Dégradé diagonal simple violet -> violet foncé (rappelle le dégradé du "NEO" du logo)
    for y in range(size):
        t = y / size
        r = int(BRAND[0] + (BRAND_DARK[0] - BRAND[0]) * t)
        g = int(BRAND[1] + (BRAND_DARK[1] - BRAND[1]) * t)
        b = int(BRAND[2] + (BRAND_DARK[2] - BRAND[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # Motif : anneau circulaire (rappelle le "O" du logo Neogia) autour du monogramme
    ring_margin = size * 0.12
    ring_width = max(6, int(size * 0.045))
    draw.ellipse(
        [ring_margin, ring_margin, size - ring_margin, size - ring_margin],
        outline=WHITE,
        width=ring_width,
    )

    # Monogramme "N"
    font_size = int(size * 0.46)
    font = ImageFont.truetype(FONT_PATH, font_size)
    text = "N"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=WHITE)

    return img


def make_maskable(size=1024):
    # Zone de sécurité "maskable" Android : contenu dans les 80% centraux.
    img = Image.new("RGB", (size, size), BRAND)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        r = int(BRAND[0] + (BRAND_DARK[0] - BRAND[0]) * t)
        g = int(BRAND[1] + (BRAND_DARK[1] - BRAND[1]) * t)
        b = int(BRAND[2] + (BRAND_DARK[2] - BRAND[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    safe = size * 0.8
    offset = (size - safe) / 2
    ring_margin = offset + safe * 0.10
    ring_width = max(6, int(size * 0.035))
    draw.ellipse(
        [ring_margin, ring_margin, size - ring_margin, size - ring_margin],
        outline=WHITE,
        width=ring_width,
    )

    font_size = int(safe * 0.46)
    font = ImageFont.truetype(FONT_PATH, font_size)
    text = "N"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=WHITE)

    return img


if __name__ == "__main__":
    import os
    os.makedirs(OUT_DIR, exist_ok=True)

    master = make_master(1024)
    sizes = [512, 192, 180, 167, 152, 144, 128, 120, 96, 72, 64, 32, 16]
    for s in sizes:
        master.resize((s, s), Image.LANCZOS).save(f"{OUT_DIR}/icon-{s}.png")

    maskable = make_maskable(1024)
    maskable.resize((512, 512), Image.LANCZOS).save(f"{OUT_DIR}/icon-maskable-512.png")
    maskable.resize((192, 192), Image.LANCZOS).save(f"{OUT_DIR}/icon-maskable-192.png")

    # apple-touch-icon dédié (180x180, sans transparence, coins gérés par iOS)
    master.resize((180, 180), Image.LANCZOS).save(f"{OUT_DIR}/apple-touch-icon.png")
    master.resize((32, 32), Image.LANCZOS).save("client/public/favicon-32.png")
    master.resize((16, 16), Image.LANCZOS).save("client/public/favicon-16.png")

    print("Icons generated in", OUT_DIR)
