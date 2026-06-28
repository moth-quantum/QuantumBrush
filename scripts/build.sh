#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR"

BUILD_DIR=${BUILD_DIR:-build}
CLASS_DIR="$BUILD_DIR/classes"

rm -rf "$CLASS_DIR" "$BUILD_DIR/manifest.mf" "$BUILD_DIR/quantumbrush.jar"
mkdir -p "$CLASS_DIR"

javac -encoding UTF-8 -cp "lib/core-4.4.1.jar" -d "$CLASS_DIR" src/*.java

cat > "$BUILD_DIR/manifest.mf" <<'MANIFEST'
Manifest-Version: 1.0
Main-Class: QuantumBrush
Class-Path: ../lib/core-4.4.1.jar

MANIFEST

jar cfm "$BUILD_DIR/quantumbrush.jar" "$BUILD_DIR/manifest.mf" -C "$CLASS_DIR" .

echo "Built $BUILD_DIR/quantumbrush.jar"
