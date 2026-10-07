"""Slide 12, 4th laptop screen: a 'planned feature' card for the local LLM explanations.
It is a labelled concept card, not a screenshot: the feature does not exist in the app yet."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "assets" / "figures" / "ui_explain_planned.png"
W, H = 1920, 1200
F = "C:/Windows/Fonts/"
font = lambda name, size: ImageFont.truetype(F + name, size)

img = Image.new("RGB", (W, H), (246, 247, 251))
d = ImageDraw.Draw(img)
# top bar like the app shell
d.rectangle([0, 0, W, 64], fill=(255, 255, 255))
d.text((116, 14), "CAMEX", font=font("segoeuib.ttf", 30), fill=(14, 26, 51))
d.text((262, 18), "/  Explain", font=font("segoeui.ttf", 26), fill=(91, 103, 129))

# planned badge
d.rounded_rectangle([160, 130, 420, 190], radius=30, fill=(254, 243, 199), outline=(217, 119, 6), width=3)
d.text((198, 138), "PLANNED", font=font("segoeuib.ttf", 34), fill=(180, 83, 9))

d.text((160, 225), "Plain-language explanation", font=font("segoeuib.ttf", 84), fill=(14, 26, 51))
d.text((160, 330), "of every analysis result", font=font("segoeuib.ttf", 84), fill=(14, 26, 51))

rows = [
    ("Model", "Gemma 3 4B · 4-bit · runs locally, offline"),
    ("Input", "the result file: cells · neurites · NTI parts · QC"),
    ("Rule", "numbers come from the pipeline, never from the LLM"),
    ("Always shown", "uncalibrated NTI · descriptive, not a prediction"),
]
y = 480
for k, v in rows:
    d.rounded_rectangle([160, y, 1760, y + 96], radius=22, fill=(255, 255, 255), outline=(227, 231, 238), width=2)
    d.text((210, y + 24), k, font=font("segoeuib.ttf", 40), fill=(124, 58, 237))
    d.text((560, y + 24), v, font=font("segoeui.ttf", 40), fill=(31, 41, 55))
    y += 112
img.save(OUT)
print(OUT, img.size)
