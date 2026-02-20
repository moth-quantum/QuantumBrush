#!/bin/bash
# Rebuild frontend and run with the native backend in development mode

echo "Building frontend..."
cd frontend
VITE_BACKEND=native bun run build
cd ..

echo "Starting QuantumBrush (Native Backend)..."
QB_DEBUG=false python3 main.py