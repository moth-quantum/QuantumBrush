#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ -f "$ROOT/packaging/launcher/build/launcher.jar" ]; then
    exec java -jar "$ROOT/packaging/launcher/build/launcher.jar" "$@"
fi

if command -v javac >/dev/null && command -v jar >/dev/null; then
    BUILD_DIR="$ROOT/packaging/launcher/build"
    mkdir -p "$BUILD_DIR"
    javac "$ROOT/packaging/launcher/Launcher.java" -d "$BUILD_DIR"
    jar --create --file "$BUILD_DIR/launcher.jar" --main-class Launcher -C "$BUILD_DIR" .
    exec java -jar "$BUILD_DIR/launcher.jar" "$@"
fi

if [ ! -f "$HOME/.quantumbrush/config/python_path.txt" ] || [ ! -d "$HOME/.quantumbrush/env" ]; then
    ./setup.sh --yes
fi

exec java -jar "$ROOT/QuantumBrush.jar" "$@"
