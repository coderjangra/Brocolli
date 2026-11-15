import sys, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

OUT = sys.argv[1]
SS = 4
N = 1024 * SS
BG = (11, 15, 12)

def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)

def vgrad(w, h, top, bottom):
    g = Image.new('RGBA', (1, h))
    for y in range(h):
        t = y / (h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i]-top[i])*t) for i in range(4)))
    return g.resize((w, h))

def art(scale=1.0, mono=False):
    """Broc + coin on a transparent canvas, content centred, scaled about the centre."""
    img = Image.new('RGBA', (N, N), (0,0,0,0))
    k = SS * scale
    cx0 = cy0 = N / 2
    def P(x, y):  # design coords are 1024-space around (512,512)
        return (cx0 + (x - 512) * k, cy0 + (y - 512) * k)
    def circ(d, x, y, r, fill):
        (a, b) = P(x - r, y - r); (c, e) = P(x + r, y + r)
        d.ellipse([a, b, c, e], fill=fill)

    # ---- stalk (behind floret)
    stalk = Image.new('L', (N, N), 0); sd = ImageDraw.Draw(stalk)
    poly = [P(410, 560), P(614, 560), P(588, 790), P(436, 790)]
    sd.polygon(poly, fill=255)
    (a, b) = P(436, 740); (c, e) = P(588, 840)
    sd.ellipse([a, b, c, e], fill=255)  # rounded bottom
    # ---- floret
    flo = Image.new('L', (N, N), 0); fd = ImageDraw.Draw(flo)
    blobs = [(512, 330, 150), (392, 400, 130), (632, 400, 130), (330, 505, 105), (694, 505, 105),
             (450, 500, 130), (574, 500, 130), (512, 440, 140)]
    for x, y, r in blobs: circ(fd, x, y, r, 255)
    # flatten underside slightly so the stalk tucks in
    if mono:
        sil = ImageChops.lighter(stalk, flo)
        face = Image.new('L', (N, N), 0); dd = ImageDraw.Draw(face)
        for ex in (468, 556): circ(dd, ex, 665, 20, 255)
        (a, b) = P(472, 668); (c, e) = P(552, 728)
        dd.arc([a, b, c, e], 20, 160, fill=255, width=int(14*k))
        sil = ImageChops.subtract(sil, face)
        out = Image.new('RGBA', (N, N), (255,255,255,0)); out.putalpha(sil)
        return out

    # stalk fill: lime gradient with a shade on the right
    sg = vgrad(N, N, hexc('#E4FBB0'), hexc('#BEF264'))
    img.paste(sg, (0, 0), stalk)
    shade = Image.new('L', (N, N), 0); shd = ImageDraw.Draw(shade)
    shd.polygon([P(560, 560), P(614, 560), P(588, 790), P(548, 800)], fill=90)
    shade = ImageChops.multiply(shade, stalk)
    img.paste(Image.new('RGBA', (N, N), hexc('#84CC16')), (0, 0), shade)

    # floret drop shadow onto the stalk
    sh = flo.filter(ImageFilter.GaussianBlur(14 * k)).point(lambda v: int(v * 0.55))
    sh = ImageChops.offset(sh, 0, int(18 * k))
    sh = ImageChops.multiply(sh, stalk)
    img.paste(Image.new('RGBA', (N, N), (20, 83, 45, 255)), (0, 0), sh)

    # floret gradient
    fg = vgrad(N, N, hexc('#5EEA8E'), hexc('#15803D'))
    img.paste(fg, (0, 0), flo)
    # bump texture: darker small circles, then highlights, clipped to floret
    tex = Image.new('RGBA', (N, N), (0,0,0,0)); td = ImageDraw.Draw(tex)
    for x, y, r in [(430, 560, 60), (520, 575, 58), (605, 555, 55), (360, 575, 45), (670, 570, 45)]:
        circ(td, x, y, r, (21, 128, 61, 150))
    for x, y, r in blobs:
        circ(td, x - r*0.30, y - r*0.40, r*0.30, (187, 247, 208, 55))
    tex = tex.filter(ImageFilter.GaussianBlur(10 * k))
    alpha = ImageChops.multiply(tex.getchannel('A'), flo); tex.putalpha(alpha)
    img = Image.alpha_composite(img, tex)

    # face on the stalk
    d = ImageDraw.Draw(img)
    face = hexc('#14532D')
    for ex in (468, 556):
        circ(d, ex, 665, 21, face)
        circ(d, ex + 7, 657, 7, (255, 255, 255, 255))
    (a, b) = P(474, 670); (c, e) = P(550, 728)
    d.arc([a, b, c, e], 20, 160, fill=face, width=int(13 * k))
    blush = Image.new('RGBA', (N, N), (0,0,0,0)); bd = ImageDraw.Draw(blush)
    for ex in (446, 578):
        circ(bd, ex, 702, 15, hexc('#FB7185', 150))
    img = Image.alpha_composite(img, blush.filter(ImageFilter.GaussianBlur(3 * k)))
    d = ImageDraw.Draw(img)

    # gold rupee coin, bottom right
    coin = Image.new('RGBA', (N, N), (0,0,0,0)); cd = ImageDraw.Draw(coin)
    ccx, ccy, cr = 700, 730, 92
    circ(cd, ccx + 6, ccy + 10, cr, (0, 0, 0, 110))
    coin = coin.filter(ImageFilter.GaussianBlur(10 * k)); cd = ImageDraw.Draw(coin)
    circ(cd, ccx, ccy, cr, hexc('#D97706'))
    circ(cd, ccx, ccy - 6, cr - 6, hexc('#FBBF24'))
    circ(cd, ccx, ccy - 6, cr - 22, hexc('#FCD34D'))
    font = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', int(120 * k))
    tx, ty = P(ccx, ccy - 8)
    cd.text((tx, ty), '₹', font=font, fill=hexc('#B45309'), anchor='mm')
    img = Image.alpha_composite(img, coin)
    return img

def background(full_glow=True):
    bg = Image.new('RGBA', (N, N), BG + (255,))
    glow = Image.new('L', (N, N), 0); gd = ImageDraw.Draw(glow)
    r = 360 * SS
    gd.ellipse([N/2 - r, N/2 - r - 40*SS, N/2 + r, N/2 + r - 40*SS], fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(170 * SS))
    bg.paste(Image.new('RGBA', (N, N), (34, 197, 94, 255)), (0, 0), glow.point(lambda v: int(v * 0.55)))
    return bg

def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}.png')

fg = art(scale=0.84)
bg = background()
save(fg, 'android-icon-foreground', 1024)
save(bg, 'android-icon-background', 1024)
save(art(scale=0.84, mono=True), 'android-icon-monochrome', 1024)
full = Image.alpha_composite(bg, art(scale=0.92))
save(full, 'icon', 1024)
save(full, 'favicon', 48)
save(art(scale=1.0), 'splash-icon', 512)
# preview: adaptive icon as launchers show it (circle + squircle)
prev = Image.alpha_composite(bg, fg).resize((512, 512), Image.LANCZOS)
sheet = Image.new('RGBA', (1240, 560), (40, 40, 40, 255))
m = Image.new('L', (512, 512), 0); ImageDraw.Draw(m).ellipse([0, 0, 511, 511], fill=255)
sheet.paste(prev, (20, 24), m)
m2 = Image.new('L', (512, 512), 0); ImageDraw.Draw(m2).rounded_rectangle([0, 0, 511, 511], 120, fill=255)
sheet.paste(prev, (560, 24), m2)
sheet.paste(full.resize((128,128), Image.LANCZOS), (1090, 24))
sheet.paste(full.resize((48,48), Image.LANCZOS), (1130, 180))
sheet.save(f'{OUT}/preview.png')
