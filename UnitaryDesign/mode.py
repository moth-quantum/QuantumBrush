# modes/base.py

from quantum_engine import QuantumGateEngine
from postprocessing import PostProcessor
from config import BACKGROUNDS
from PIL import Image

class QuantumArtMode:

    def __init__(self, size=128, seed=None):
        self.size = size
        self.engine = QuantumGateEngine()
        self.pp = PostProcessor()

    def blank(self, mode_name):
        bg = BACKGROUNDS[mode_name]
        return Image.new("RGB",(self.size,self.size),bg)

    def run(self):
        raise NotImplementedError
