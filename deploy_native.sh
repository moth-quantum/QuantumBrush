#!/bin/bash

# 1. Build Frontend
cd frontend
VITE_BACKEND=native bun run build
cd ..

# 2. Dynamically collect dependencies from effects
echo "Collecting dependencies from effects..."
EXTRA_FLAGS=$(python3 scripts/collect_deps.py --flags)

# 3. Bundle with PyInstaller
echo "Running PyInstaller with detected dependencies..."
pyinstaller main.py \
    --name "QuantumBrush" \
    --windowed \
    --onedir \
    --clean \
    --noconfirm \
    --icon "assets/icon.png" \
    --add-data "backend:backend" \
    --add-data "frontend/dist:frontend/dist" \
    --add-data "assets:assets" \
    --exclude-module PyQt6 \
    --exclude-module PySide2 \
    --exclude-module PySide6 \
    $EXTRA_FLAGS

# 1. Build Frontend
# cd frontend
# VITE_BACKEND=native bun run build
# cd ..

# # 2. Build using spec
# echo "Running PyInstaller..."
# pyinstaller QuantumBrush.spec --clean --noconfirm