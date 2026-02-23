# config.py
"""
Global configuration for Quantum Canvas Studio
---------------------------------------------
Contains:
- Brand colour palettes
- Background settings
- Core rendering constants
"""

# ======== BRAND PALETTE ========
# Primary colours (~70% usage target)
PRIMARY_PALETTE = {
    "cyan_light": "#A3E0FF",
    "cyan_mid": "#65C3FF",
    "cyan_soft": "#C8ECFD",
    "magenta_light": "#FFB5F1",
    "magenta_mid": "#FF87EB",
    "magenta_deep": "#C756B2",
    "yellow_light": "#FFEEBF",
    "yellow_mid": "#FFE096",
    "yellow_deep": "#FFD36A"
}

# Secondary colours (~30% usage target)
SECONDARY_PALETTE = {
    "lavender_soft": "#EEE0FE",
    "mint_soft": "#E8FEEF",
    "coral_soft": "#FEE0CF",
    "pink_soft": "#FEE1ED",
    "green_soft": "#EDF3CC",
    "ice_soft": "#D8F8F6",
    "neutral_soft": "#F0EEEF",
    "neutral_mid": "#DAD8B8"
}

BACKGROUND_COLOR = "#FFFFFF"  # Must stay white per visual rule

# ======== RENDER SETTINGS ========
DEFAULT_SIZE = 128
DEFAULT_STEPS = 4

# ======== OUTPUT ========
OUTPUT_DIR = "quantum_studio_output
