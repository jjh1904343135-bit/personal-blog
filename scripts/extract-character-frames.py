"""Extract the supplied character video without synthesizing expressions."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
source = root / 'docs/public/media/about-character-loop.mp4'
output = root / 'docs/public/images/about-expressions'
output.mkdir(parents=True, exist_ok=True)
raw_output = root / 'docs/.vitepress/cache/expression-extraction'
raw_output.mkdir(parents=True, exist_ok=True)
capture = cv2.VideoCapture(str(source))
fps = capture.get(cv2.CAP_PROP_FPS)
count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
print(f'fps={fps}, frames={count}, seconds={count / fps:.2f}')
sheet = Image.new('RGB', (5 * 256, 4 * 164), '#eeeeee')
draw = ImageDraw.Draw(sheet)
for index in range(20):
    seconds = index * .5
    capture.set(cv2.CAP_PROP_POS_MSEC, seconds * 1000)
    success, frame = capture.read()
    if not success:
        break
    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    image.save(raw_output / f'frame-{index:02d}.webp', quality=88)
    thumbnail = image.copy()
    thumbnail.thumbnail((256, 144))
    x, y = (index % 5) * 256, (index // 5) * 164
    sheet.paste(thumbnail, (x, y))
    draw.text((x + 8, y + 146), f'{index:02d} / {seconds:.1f}s', fill='#111111')
sheet.save(raw_output / 'contact-sheet.jpg', quality=90)
capture.release()

# Remove only the connected sage-green background of the source video.
# Keep the actual face, eyes, mouth and clothes unchanged.
states = {'neutral': 15, 'left': 12, 'right': 3, 'up-left': 0,
          'up': 9, 'up-right': 6, 'down': 16, 'down-left': 13,
          'down-right': 18}
for state, index in states.items():
    rgb = np.array(Image.open(raw_output / f'frame-{index:02d}.webp').convert('RGB'))
    rgb = rgb[:, 280:1000]
    red, green, blue = [rgb[:, :, channel].astype(np.int16) for channel in range(3)]
    background = ((green >= red - 1) & (green > blue + 3)).astype(np.uint8)
    background = cv2.morphologyEx(background, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    _, labels = cv2.connectedComponents(background)
    border_labels = np.unique(np.concatenate([labels[0], labels[:, 0], labels[:, -1]]))
    border_labels = border_labels[border_labels != 0]
    foreground = (~np.isin(labels, border_labels)).astype(np.uint8) * 255
    foreground = cv2.morphologyEx(foreground, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    _, components, stats, _ = cv2.connectedComponentsWithStats(foreground)
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    foreground = (components == largest).astype(np.uint8) * 255
    alpha = cv2.GaussianBlur(foreground, (3, 3), .6)
    rgba = np.dstack([rgb, alpha])
    cutout = Image.fromarray(rgba)
    cutout.save(output / f'{state}.webp', quality=92)
    print(f'{state}: original video at {index * .5:.1f}s')
