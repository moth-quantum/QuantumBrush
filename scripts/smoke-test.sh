#!/usr/bin/env bash
# End-to-end smoke test: create minimal stroke JSON and run apply_effect.py (acrylic).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d ".venv" ]; then
  echo "Run ./scripts/setup-python.sh first"
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

PROJECT_ID="smoke_$(date +%s)"
STROKE_ID="stroke_${PROJECT_ID}"
mkdir -p "project/$PROJECT_ID/stroke" metadata

# 1x1 white PNG via Python
python3 -c "
from PIL import Image
import os
p='project/$PROJECT_ID'
os.makedirs(p, exist_ok=True)
Image.new('RGBA',(64,64),(240,240,240,255)).save(f'{p}/current.png')
Image.new('RGBA',(64,64),(240,240,240,255)).save(f'{p}/original.png')
"

cat > "project/$PROJECT_ID/stroke/${STROKE_ID}_instructions.json" <<EOF
{
  "stroke_id": "$STROKE_ID",
  "project_id": "$PROJECT_ID",
  "effect_id": "acrylic",
  "user_input": {
    "Radius": 10,
    "Alpha": 0.8,
    "Color": "#FF0000",
    "Blur Edges": true
  },
  "stroke_input": {
    "real_hardware": false,
    "path": [[10,10],[30,30],[50,50]],
    "clicks": [[10,10]],
    "input_location": "project/$PROJECT_ID/stroke/${STROKE_ID}_input.png",
    "output_location": "project/$PROJECT_ID/stroke/${STROKE_ID}_output.png"
  },
  "processing_status": "pending"
}
EOF

cp "project/$PROJECT_ID/current.png" "project/$PROJECT_ID/stroke/${STROKE_ID}_input.png"

python3 effect/apply_effect.py "project/$PROJECT_ID/stroke/${STROKE_ID}_instructions.json"

OUT="project/$PROJECT_ID/stroke/${STROKE_ID}_output.png"
if [ -f "$OUT" ]; then
  echo "OK: smoke test passed — output at $OUT"
  rm -rf "project/$PROJECT_ID"
else
  echo "FAIL: no output image"
  exit 1
fi
