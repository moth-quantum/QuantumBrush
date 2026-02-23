# painter.py

import random
import numpy as np
from PIL import ImageDraw, Image
import math

class CanvasPainter:

    def __init__(self, canvas):
        self.canvas = canvas
        self.draw = ImageDraw.Draw(canvas)
        self.size = canvas.size[0]

    def circles(self, n=5, palette=None):
        for _ in range(n):
            r = random.randint(10, 30)
            x = random.randint(r, self.size-r)
            y = random.randint(r, self.size-r)
            col = random.choice(palette)
            self.draw.ellipse([x-r,y-r,x+r,y+r], fill=col)

    def gaussian_splat(self, n=5, palette=None):
        arr = np.array(self.canvas, dtype=np.float32)
        size = self.size
        Y,X = np.mgrid[:size,:size]
        for _ in range(n):
            cx,cy = random.randint(0,size-1), random.randint(0,size-1)
            r = random.randint(15,40)
            col = np.array(random.choice(palette))
            blob = np.exp(-((X-cx)**2+(Y-cy)**2)/(2*r**2))
            for c in range(3):
                arr[:,:,c] += blob * col[c]
        self.canvas = Image.fromarray(arr.clip(0,255).astype(np.uint8))

    def get_canvas(self):
        return self.canvas.copy()
