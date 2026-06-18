import json
import numpy as np
import os
from PIL import Image

mock_data = {
    "project_id": "test_proj",
    "stroke_id": "test_stroke",
    "effect_id": "wheelers_eraser",
    "stroke_input": {
        "path": [[50, 20], [50, 50], [50, 80]],
        "image_rgba": [[[255, 255, 255, 255] for _ in range(100)] for _ in range(100)]
    },
    "user_input": {
        "Radius": 10,
        "Strength": 0.8,
        "Color": "#FF0000",
        "Measurement": "interference",
        "Slit Count": 3,
        "Coherence": 1.0
    },
    "hardware_config": {
        "provider": "IQM",
        "device": "garnet",
        "shots": 512,
        "optimization_level": 2,
        "max_qpu_seconds": 10,
        "token": ""
    }
}

with open('mock_stroke.json', 'w') as f:
    json.dump(mock_data, f)
