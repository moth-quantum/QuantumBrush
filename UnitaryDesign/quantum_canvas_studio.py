import numpy as np
import quantumblur as qb
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import random
import math
import argparse
import os
import time
from datetime import datetime
from collections import Counter


OUTPUT_DIR = "quantum_studio_output"


# ─────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────

def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def resize_safe(img, size):
    return img.resize((size, size), Image.LANCZOS)


def clamp_image(img):
    arr = np.array(img, dtype=np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def blend_images(a, b, alpha=0.5):
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    return Image.fromarray((a*(1-alpha) + b*alpha).clip(0,255).astype(np.uint8))


# ─────────────────────────────────────────────
# Quantum Gate Engine
# ─────────────────────────────────────────────

class QuantumGateEngine:
    """Apply quantum gate sequences using quantumblur."""

    def __init__(self, log_encoding=True):
        self.log_encoding = log_encoding
        self.gate_log = []

    def _apply(self, img, fn):
        qcs = qb.image2circuits(img, log=self.log_encoding)
        for idx, qc in enumerate(qcs):
            fn(qc, qc.num_qubits, idx)
        result = qb.circuits2image(qcs, log=self.log_encoding)
        return resize_safe(result, img.size[0])

    def rx_sweep(self, img, intensity):
        def gates(qc, n, _):
            for j in range(n):
                angle = np.pi * intensity
                qc.rx(angle, j)
                self.gate_log.append(("Rx", j))
        return self._apply(img, gates)

    def ry_sweep(self, img, intensity):
        def gates(qc, n, _):
            for j in range(n):
                angle = np.pi * intensity
                qc.ry(angle, j)
                self.gate_log.append(("Ry", j))
        return self._apply(img, gates)

    def rz_sweep(self, img, intensity):
        def gates(qc, n, _):
            for j in range(n):
                angle = np.pi * intensity
                qc.rz(angle, j)
                self.gate_log.append(("Rz", j))
        return self._apply(img, gates)

    def hadamard_spectral(self, img, intensity):
        def gates(qc, n, _):
            for j in range(n):
                qc.h(j)
                qc.ry(np.pi * intensity, j)
                qc.h(j)
                self.gate_log.append(("H", j))
        return self._apply(img, gates)

    def entangle(self, img, intensity):
        def gates(qc, n, _):
            for j in range(n-1):
                qc.cx(j, j+1)
                qc.rz(np.pi * intensity, j)
                qc.cx(j, j+1)
                self.gate_log.append(("CX", j))
        return self._apply(img, gates)

    def stats(self):
        return Counter(g for g,_ in self.gate_log)


# ─────────────────────────────────────────────
# Classical Seed Painter
# ─────────────────────────────────────────────

class CanvasPainter:
    """Create classical geometric seeds."""

    def __init__(self, size, bg):
        self.size = size
        self.canvas = Image.new("RGB", (size, size), bg)
        self.draw = ImageDraw.Draw(self.canvas)

    def circles(self, n, colors):
        for _ in range(n):
            r = random.randint(5, 25)
            x = random.randint(r, self.size-r)
            y = random.randint(r, self.size-r)
            self.draw.ellipse([x-r,y-r,x+r,y+r], fill=random.choice(colors))

    def lines(self, n, colors, width=2):
        for _ in range(n):
            x1,y1 = random.randint(0,self.size),random.randint(0,self.size)
            x2,y2 = random.randint(0,self.size),random.randint(0,self.size)
            self.draw.line([x1,y1,x2,y2], fill=random.choice(colors), width=width)

    def blobs(self, n, colors):
        arr = np.array(self.canvas, dtype=np.float32)
        Y,X = np.mgrid[:self.size,:self.size]
        for _ in range(n):
            cx,cy = random.randint(0,self.size),random.randint(0,self.size)
            r = random.randint(10,40)
            blob = np.exp(-((X-cx)**2 + (Y-cy)**2)/(2*r*r))
            col = np.array(random.choice(colors))
            for c in range(3):
                arr[:,:,c] += col[c]*blob
        self.canvas = Image.fromarray(np.clip(arr,0,255).astype(np.uint8))
        self.draw = ImageDraw.Draw(self.canvas)

    def get(self):
        return self.canvas.copy()


# ─────────────────────────────────────────────
# Post Processing
# ─────────────────────────────────────────────

class PostProcessor:

    @staticmethod
    def glow(img, r=3):
        blur = img.filter(ImageFilter.GaussianBlur(r))
        return blend_images(img, blur, 0.6)

    @staticmethod
    def vignette(img):
        size = img.size[0]
        Y,X = np.mgrid[:size,:size]
        cx,cy = size/2,size/2
        dist = np.sqrt((X-cx)**2+(Y-cy)**2)/(size/2)
        mask = np.clip(1-dist**1.5,0,1)
        arr = np.array(img,dtype=np.float32)
        arr *= mask[:,:,None]
        return Image.fromarray(arr.astype(np.uint8))


# ─────────────────────────────────────────────
# Modes
# ─────────────────────────────────────────────

PALETTES = {
    "aurora":[(0,255,180),(0,120,255),(180,0,255)],
    "nebula":[(255,60,120),(120,0,255),(0,200,255)],
    "glitch":[(255,0,255),(0,255,255),(255,255,0)],
}

BACKGROUNDS = {
    "aurora":(5,5,20),
    "nebula":(10,0,20),
    "glitch":(0,0,0),
}


def run_mode(name, size, seed):
    random.seed(seed)
    np.random.seed(seed)

    engine = QuantumGateEngine()
    pp = PostProcessor()
    painter = CanvasPainter(size, BACKGROUNDS[name])

    painter.blobs(8, PALETTES[name])
    painter.circles(6, PALETTES[name])
    painter.lines(10, PALETTES[name])

    img = painter.get()

    for i in range(4):
        if name == "aurora":
            img = engine.hadamard_spectral(img, 0.05+i*0.02)
        elif name == "nebula":
            img = engine.entangle(img, 0.05+i*0.02)
        elif name == "glitch":
            img = engine.rx_sweep(img, 0.1+i*0.05)
        img = clamp_image(img)

    img = pp.glow(img)
    img = pp.vignette(img)

    return img, engine.stats()


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def run_studio(mode="all", size=128, seed=42):
    ensure_output_dir()
    modes = list(PALETTES.keys()) if mode=="all" else [mode]
    total_stats = Counter()
    start = time.time()

    for m in modes:
        img, stats = run_mode(m, size, seed)
        img.save(os.path.join(OUTPUT_DIR, f"{m}.png"))
        total_stats.update(stats)

    elapsed = time.time()-start

    with open(os.path.join(OUTPUT_DIR,"quantum_report.txt"),"w") as f:
        f.write(f"Time: {elapsed:.2f}s\n")
        for k,v in total_stats.items():
            f.write(f"{k}: {v}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="all",
                        choices=["aurora","nebula","glitch","all"])
    parser.add_argument("--size", type=int, default=128)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    run_studio(args.mode, args.size, args.seed)
