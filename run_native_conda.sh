#!/bin/bash

ENV_NAME="quantumbrush"

# Initialize conda for the script
if ! command -v conda &> /dev/null; then
    echo "❌ Conda could not be found. Please make sure Conda is installed and added to your PATH."
    exit 1
fi

eval "$(conda shell.bash hook)"

# Check if environment exists
if ! conda info --envs | grep -q "^$ENV_NAME "; then
    echo "❌ Conda environment '$ENV_NAME' not found. Please run './install_conda.sh' first."
    exit 1
fi

conda activate "$ENV_NAME"

echo "Building frontend..."
cd frontend
if command -v bun &> /dev/null; then
    VITE_BACKEND=native bun run build
elif command -v npm &> /dev/null; then
    VITE_BACKEND=native npm run build
else
    echo "⚠️ Neither bun nor npm found. Ensure the frontend is built or install a package manager."
fi
cd ..

echo "Starting QuantumBrush (Native Backend) via Conda..."
QB_DEBUG=false python3 main.py
