"""Play Store graphics: 512px hi-res icon + 1024x500 feature graphic.
Usage: python scripts/make-store-graphics.py   (writes docs/play-store/graphics/)"""
import importlib.util, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'play-store', 'graphics')
os.makedirs(OUT, exist_ok=True)

# Reuse the app icon renderer without running its main block.
src = open(os.path.join(ROOT, 'scripts', 'make-icon.py'), encoding='utf8').read()
src = src.split('fg = art(scale=')[0]
ns = {'__name__': 'icon', 'sys': sys}
sys.argv = [sys.argv[0], OUT]
exec(compile(src, 'make-icon.py', 'exec'), ns)
art, background, N = ns['art'], ns['background'], ns['N']

full = Image.alpha_composite(background(), art(scale=0.92)).resize((512, 512), Image.LANCZOS)
full.convert('RGB').save(os.path.join(OUT, 'icon-512.png'))

W, H, S = 1024, 500, 2
fg = Image.new('RGBA', (W * S, H * S), (11, 15, 12, 255))
glow = Image.new('L', fg.size, 0)
ImageDraw.Draw(glow).ellipse([W * S - 760 * S, -120 * S, W * S + 40 * S, 640 * S], fill=150)
glow = glow.filter(ImageFilter.GaussianBlur(140 * S))
fg.paste(Image.new('RGBA', fg.size, (34, 197, 94, 255)), (0, 0), glow.point(lambda v: int(v * 0.5)))
broc = art(scale=1.0).resize((440 * S, 440 * S), Image.LANCZOS)
fg.alpha_composite(broc, (W * S - 500 * S, 30 * S))

d = ImageDraw.Draw(fg)
bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 92 * S)
semi = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 34 * S)
reg = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 26 * S)
d.text((64 * S, 120 * S), 'Brocolli', font=bold, fill=(241, 245, 242, 255))
d.text((68 * S, 236 * S), 'Split it before it gets awkward.', font=semi, fill=(74, 222, 128, 255))
d.text((68 * S, 300 * S), 'Catches your UPI payments · splits in a swipe', font=reg, fill=(148, 163, 184, 255))
d.text((68 * S, 338 * S), 'Settle up on UPI in one tap', font=reg, fill=(148, 163, 184, 255))
fg.resize((W, H), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, 'feature-graphic.png'))
print('wrote', OUT)
