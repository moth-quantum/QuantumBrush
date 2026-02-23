# quantum/gate_engine.py
"""
Quantum Gate Engine
-------------------
Core quantum evolution layer.
- FRQI-inspired rotations
- Superposition generation
- Interference dynamics
- Iterative unitary evolution.
"""

import numpy as np
from PIL import Image
import quantumblur as qb


class QuantumGateEngine:
    """
    Handles quantum image evolution using amplitude rotations
    and unitary-like transformations.
    """

    def __init__(self, seed=None):
        self.rng = np.random.default_rng(seed)

    
    #  Spectral Superposition (FRQI-inspired rotation)
    
    def spectral_superposition(self, image, theta_scale=1.0):
        """
        Applies amplitude-style rotations that mimic FRQI encoding:
        |I(theta)> = (1/2^n) Σ (cos(theta_i)|0> + sin(theta_i)|1>)|i>
        """
        img_arr = np.array(image, dtype=np.float32) / 255.0

        # encode intensity as theta
        theta = img_arr * np.pi * theta_scale

        rotated = np.cos(theta) * img_arr + np.sin(theta) * (1 - img_arr)

        rotated = np.clip(rotated, 0, 1)
        return Image.fromarray((rotated * 255).astype(np.uint8))

    
    # Quantum Interference Patterning
    
    def interference(self, image, frequency=6.0):
        """
        Generates Moiré-style constructive/destructive interference
        inspired by H and Rz gate stacks.
        """
        img_arr = np.array(image, dtype=np.float32)

        h, w = img_arr.shape[:2]

        x = np.linspace(0, frequency * np.pi, w)
        y = np.linspace(0, frequency * np.pi, h)

        X, Y = np.meshgrid(x, y)

        wave = np.sin(X) * np.cos(Y)

        if img_arr.ndim == 3:
            wave = np.repeat(wave[:, :, None], 3, axis=2)

        interfered = img_arr * (0.8 + 0.2 * wave)

        interfered = np.clip(interfered, 0, 255)

        return Image.fromarray(interfered.astype(np.uint8))

    
    # Iterative Unitary Evolution
    
    def iterative_unitary(self, image, steps=3):
        """
        Applies iterative pseudo-unitary transformations:
            ψ_{n+1} = U ψ_n
        where U is modeled as layered CR_y-like modulation.
        """
        img = image

        for _ in range(steps):
            img = self.spectral_superposition(
                img,
                theta_scale=self.rng.uniform(0.5, 1.5)
            )
            img = self.interference(
                img,
                frequency=self.rng.uniform(3.0, 8.0)
            )

        return img

    
    #  Controlled Decoherence
    
    def decoherence(self, image, strength=0.1):
        """
        Simulates controlled entropy injection inspired by Lindblad dynamics.
        """
        arr = np.array(image, dtype=np.float32)

        noise = self.rng.normal(0, 255 * strength, arr.shape)

        mixed = arr + noise
        mixed = np.clip(mixed, 0, 255)

        return Image.fromarray(mixed.astype(np.uint8))
