#!/bin/bash

ENV_NAME="quantumbrush"

echo "🚀 Starting QuantumBrush Conda installation..."

# Check if conda is installed
if ! command -v conda &> /dev/null; then
    echo "❌ Conda could not be found. Please install Miniconda or Anaconda first."
    exit 1
fi

echo "🐍 Creating Conda environment '$ENV_NAME' with Python 3.10..."
conda create -y -n "$ENV_NAME" python=3.10

echo "🔄 Activating environment '$ENV_NAME'..."
# Initialize conda for the script
eval "$(conda shell.bash hook)"
conda activate "$ENV_NAME"

# 1. Python dependencies
echo "📦 Installing Python dependencies..."
if [[ -f "requirements.txt" ]]; then
    pip install -r requirements.txt
fi

if [[ -f "requirements-effects.txt" ]]; then
    pip install -r requirements-effects.txt
fi

# 2. Frontend dependencies
if command -v bun &> /dev/null; then
    echo "💡 Bun detected. Installing frontend dependencies..."
    cd frontend && bun install && cd ..
elif command -v npm &> /dev/null; then
    echo "💡 Node.js detected. Installing frontend dependencies..."
    cd frontend && npm install && cd ..
else
    echo "⚠️  Neither bun nor npm found. Skipping frontend dependency installation."
    echo "   (Only needed if you plan to build the frontend from source)"
fi

echo "✅ Conda installation complete!"
echo "   Before running manually, remember to activate the environment: conda activate $ENV_NAME"
echo "   Or simply run './run_native_conda.sh' to automatically launch the application."
