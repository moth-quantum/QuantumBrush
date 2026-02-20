#!/bin/bash

echo "🚀 Starting QuantumBrush installation..."

# 1. Python dependencies
echo "📦 Installing Python dependencies..."
if [[ -f "requirements.txt" ]]; then
    pip install -r requirements.txt
fi

if [[ -f "requirements-effects.txt" ]]; then
    pip install -r requirements-effects.txt
fi

# 2. Frontend dependencies (optional, for development)
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

echo "✅ Installation complete!"
echo "   Run './run_native.sh' for development or './deploy_native.sh' to build a standalone bundle."
