# modes/aurora.py

from .base import QuantumArtMode
from painter import CanvasPainter
from config import PALETTES
from utils import clamp_image

class AuroraMode(QuantumArtMode):

    def run(self):

        canvas = self.blank("aurora")
        painter = CanvasPainter(canvas)

        palette = PALETTES["aurora"]
        painter.gaussian_splat(n=8, palette=palette)
        painter.circles(n=10, palette=palette)

        current = painter.get_canvas()

        for i in range(3):
            current = self.engine.rx_sweep(current, 0.05 + i*0.02)
            current = clamp_image(current)

        current = self.pp.glow(current, radius=4)
        current = self.pp.saturation(current, factor=1.6)

        return current
