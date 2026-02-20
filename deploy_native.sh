cd frontend
VITE_BACKEND=native bun run build
cd ..

# Bundle with resources included
# Note: Syntax for --add-data is "source:destination" (or "source;destination" on Windows)
pyinstaller main.py \
    --name "QuantumBrush" \
    --windowed \
    --onedir \
    --clean \
    --noconfirm \
    --icon "assets/icon.png" \
    --add-data "backend:backend" \
    --add-data "frontend/dist:frontend/dist" \
    --add-data "assets:assets"