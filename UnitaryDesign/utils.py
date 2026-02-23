# utils.py

import numpy as np
from PIL import Image
import os
from datetime import datetime

def ensure_output_dir(path):
    os.makedirs(path, exist_ok=True)

def clamp_image(img):
    arr = np.array(img, dtype=np.float32)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def blend_images(img_a, img_b, alpha=0.5):
    ...
