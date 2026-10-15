# Builds public/assets/fonts/script-caps.woff2: the capital "A" of Arizonia, mapped to both the Latin "A" and
# the Cyrillic "А" (same shape). style.css puts it in front of Great Vibes, so only that one letter changes.
# Usage (from the project root):  pip install fonttools brotli  &&  python tools/make-script-caps.py
from fontTools.ttLib import TTFont
from fontTools import subset

SRC = 'node_modules/@fontsource/arizonia/files/arizonia-latin-400-normal.woff2'
OUT = 'public/assets/fonts/script-caps.woff2'

font = TTFont(SRC)
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = []  # one glyph, no ligatures or kerning needed
opts.name_IDs = ['*']
sub = subset.Subsetter(opts)
sub.populate(unicodes=[ord('A')])
sub.subset(font)

glyph = font.getBestCmap()[ord('A')]
for table in font['cmap'].tables:
    if table.isUnicode():
        table.cmap[0x0410] = glyph  # Cyrillic А -> the same glyph

font.flavor = 'woff2'
font.save(OUT)
print('saved', OUT, 'glyph', glyph)
