# postprocessing.py

from PIL import ImageFilter, ImageEnhance
import numpy as np
from PIL import Image

class PostProcessor:

    def glow(self, img, radius=3):
        blur = img.filter(ImageFilter.GaussianBlur(radius))
        a = np.array(img, dtype=float)
        b = np.array(blur, dtype=float)
        return Image.fromarray((a + b*0.6).clip(0,255).astype(np.uint8))

    def saturation(self, img, factor=1.5):
        return ImageEnhance.Color(img).enhance(factor)
