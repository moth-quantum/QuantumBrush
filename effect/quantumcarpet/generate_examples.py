"""Generate the README example images using the actual brush implementation."""

from pathlib import Path

import numpy as np
from PIL import Image

from effect.quantumcarpet.quantumcarpet import run


def main():
    height, width = 220, 420
    y, x = np.mgrid[:height, :width]
    background = np.empty((height, width, 4), dtype=np.uint8)
    background[..., 0] = 18 + (44 * x / width).astype(np.uint8)
    background[..., 1] = 20 + (30 * y / height).astype(np.uint8)
    background[..., 2] = 42 + (58 * x / width).astype(np.uint8)
    background[..., 3] = 255

    path_x = np.arange(35, width - 35)
    path_y = (height / 2 + 40 * np.sin(path_x / 58)).astype(np.int64)
    path = np.column_stack((path_y, path_x))
    params = {
        "stroke_input": {
            "image_rgba": background,
            "path": path,
            "clicks": path[[0]],
        },
        "user_input": {
            "Radius": 42,
            "Modes": 8,
            "Evolution": 1.45,
            "Strength": 0.95,
            "Color": np.array([67, 217, 255]),
        },
    }

    output_dir = Path(__file__).parent
    Image.fromarray(background).save(output_dir / "example_before.png")
    Image.fromarray(run(params)).save(output_dir / "example_after.png")


if __name__ == "__main__":
    main()
