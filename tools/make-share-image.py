# Builds public/assets/share.jpg — the picture messengers (Telegram, WhatsApp, VK) show under the link:
# a screenshot of the closed envelope with the wax seal (the page's entrance screen, opened with ?share).
# Usage (from the project root, with the site running locally: npm start):
#   pip install pillow  &&  python tools/make-share-image.py
# Then bump ?v= of og:image in public/index.html so messengers fetch the new picture.
import os, shutil, subprocess, sys, tempfile
from PIL import Image

URL = os.environ.get('SHARE_URL', 'http://127.0.0.1:3000/?share')
OUT = 'public/assets/share.jpg'
W, H = 1200, 630

CANDIDATES = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'chromium', 'chromium-browser',
]
browser = next((c for c in CANDIDATES if os.path.exists(c) or shutil.which(c)), None)
if not browser:
    sys.exit('Chrome / Edge not found')

tmp = os.path.join(tempfile.mkdtemp(), 'shot.png')
subprocess.run([
    browser, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    f'--window-size={W},{H}', '--force-device-scale-factor=1',
    '--virtual-time-budget=6000',  # let fonts and the envelope drawing finish
    f'--screenshot={tmp}', URL,
], check=True, capture_output=True)

img = Image.open(tmp).convert('RGB')
if img.size != (W, H):
    img = img.resize((W, H), Image.LANCZOS)
img.save(OUT, quality=88, optimize=True, progressive=True)
print('saved', OUT, img.size)
