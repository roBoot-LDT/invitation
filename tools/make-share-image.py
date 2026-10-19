# Builds public/assets/share.jpg — the picture messengers (Telegram, WhatsApp, VK) show under the link.
# 1200 × 630: the two couple photos in gold frames, «Wedding day», the names and the date in the invitation's fonts.
# Usage (from the project root):  pip install pillow  &&  python tools/make-share-image.py
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

W, H = 1200, 630
FS = 'node_modules/@fontsource'
OUT = 'public/assets/share.jpg'
PHOTOS = ['public/assets/photos/couple-1.jpg', 'public/assets/photos/couple-4.jpg']

def font(path, size):
    return ImageFont.truetype(path, size)

def script_fonts(size):  # Great Vibes, with the capital «А» from Arizonia (as on the page)
    return {
        'cyr': font(f'{FS}/great-vibes/files/great-vibes-cyrillic-400-normal.woff', size),
        'lat': font(f'{FS}/great-vibes/files/great-vibes-latin-400-normal.woff', size),
        'cap': font('public/assets/fonts/script-caps.woff2', size),
    }

def pick(fonts, ch):
    if ch in 'АA':
        return fonts['cap']
    return fonts['cyr'] if 'Ѐ' <= ch <= 'ӿ' else fonts['lat']

def mixed_width(draw, text, fonts):
    return sum(draw.textlength(ch, font=pick(fonts, ch)) for ch in text)

def draw_mixed(draw, cx, y, text, fonts, fill):
    x = cx - mixed_width(draw, text, fonts) / 2
    for ch in text:
        f = pick(fonts, ch)
        draw.text((x, y), ch, font=f, fill=fill, anchor='ls')
        x += draw.textlength(ch, font=f)

# background: the sky of the invitation, fading to cream at the bottom
img = Image.new('RGB', (W, H))
top, bottom = (156, 199, 232), (246, 238, 220)
for yy in range(H):
    t = min(1, max(0, (yy - 120) / (H - 120)))
    img.paste(tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)), (0, yy, W, yy + 1))
# soft clouds along the bottom
clouds = Image.new('L', (W, H), 0)
cd = ImageDraw.Draw(clouds)
for x, y, r in [(80, 600, 150), (300, 640, 170), (600, 660, 190), (900, 640, 170), (1120, 600, 150), (450, 610, 120), (760, 615, 120)]:
    cd.ellipse((x - r, y - r * 0.6, x + r, y + r * 0.6), fill=235)
clouds = clouds.filter(ImageFilter.GaussianBlur(18))
img.paste(Image.new('RGB', (W, H), (255, 255, 255)), (0, 0), clouds)

def framed(path, w, h, angle):
    ph = ImageOps.fit(Image.open(path).convert('RGB'), (w, h), Image.LANCZOS, centering=(0.5, 0.35))
    b = 18  # gold border
    fr = Image.new('RGBA', (w + 2 * b, h + 2 * b))
    fd = ImageDraw.Draw(fr)
    for i in range(b):  # bevelled gold: light outside, darker inside
        k = i / b
        col = (round(236 - 70 * k), round(200 - 70 * k), round(110 - 60 * k), 255)
        fd.rectangle((i, i, w + 2 * b - 1 - i, h + 2 * b - 1 - i), outline=col)
    fd.rectangle((b - 3, b - 3, w + b + 2, h + b + 2), outline=(110, 79, 18, 255), width=2)
    fr.paste(ph, (b, b))
    fr = fr.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh = Image.new('RGBA', fr.size, (0, 0, 0, 0))
    sh.putalpha(fr.split()[3].point(lambda a: int(a * 0.28)))
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    return fr, sh

for i, (path, cx, ang) in enumerate([(PHOTOS[0], 190, 3.5), (PHOTOS[1], W - 190, -3.5)]):
    fr, sh = framed(path, 270, 360, ang)
    x, y = cx - fr.width // 2, 95 + (0 if i == 0 else 16)
    img.paste((40, 28, 10), (x + 3, y + 9), sh)
    img.paste(fr, (x, y), fr)

d = ImageDraw.Draw(img)
cx = W // 2
gold, ink, olive = (138, 106, 42), (59, 42, 20), (95, 111, 44)
# «WEDDING DAY» with small gold lines
prata = font(f'{FS}/prata/files/prata-latin-400-normal.woff', 26)
label = ' '.join('WEDDING') + '   ' + ' '.join('DAY')
lw = d.textlength(label, font=prata)
d.text((cx, 118), label, font=prata, fill=gold, anchor='ms')
for sx in (-1, 1):
    x0 = cx + sx * (lw / 2 + 18)
    d.line((x0, 108, x0 + sx * 46, 108), fill=gold, width=2)
# names
names = script_fonts(118)
draw_mixed(d, cx, 245, 'Аня', names, ink)
draw_mixed(d, cx, 312, '&', script_fonts(64), (201, 161, 74))
draw_mixed(d, cx, 420, 'Максим', names, ink)
# date
date_font = font(f'{FS}/prata/files/prata-latin-400-normal.woff', 64)
d.text((cx, 520), '01 · 07 · 2027', font=date_font, fill=olive, anchor='ms')

img.save(OUT, quality=86, optimize=True, progressive=True)
print('saved', OUT)
