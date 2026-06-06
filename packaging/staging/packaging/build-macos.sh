#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=packaging/common.sh
source "$ROOT/packaging/common.sh"

ARCH="${QB_ARCH:-$(uname -m)}"
case "$ARCH" in
    arm64)  MAC_ARCH=aarch64; LABEL=apple-silicon ;;
    x86_64) MAC_ARCH=x86_64;  LABEL=intel ;;
    *) die "Unsupported macOS architecture: $ARCH" ;;
esac

require_cmd jpackage

clean_dirs
stage_app
build_launcher_jar
populate_input

info "Building macOS .dmg for $LABEL ($MAC_ARCH)..."
jpackage \
    --name QuantumBrush \
    --app-version "$VERSION" \
    --vendor "MOTH Quantum" \
    --description "Creative image modification powered by quantum computing" \
    --copyright "Copyright 2025 MOTH Quantum" \
    --type dmg \
    --dest "$OUT" \
    --input "$INPUT" \
    --main-jar launcher.jar \
    --main-class Launcher \
    --mac-package-name "org.mothquantum.quantumbrush" \
    --mac-app-category public.app-category.graphics-design \
    --mac-app-icon "$PACKAGING/icons/QuantumBrush.icns" 2>/dev/null || \
jpackage \
    --name QuantumBrush \
    --app-version "$VERSION" \
    --vendor "MOTH Quantum" \
    --description "Creative image modification powered by quantum computing" \
    --copyright "Copyright 2025 MOTH Quantum" \
    --type dmg \
    --dest "$OUT" \
    --input "$INPUT" \
    --main-jar launcher.jar \
    --main-class Launcher \
    --mac-package-name "org.mothquantum.quantumbrush" \
    --mac-app-category public.app-category.graphics-design

DMG_FILE="$(find "$OUT" -maxdepth 1 -name 'QuantumBrush-*.dmg' | head -n 1)"
[ -n "$DMG_FILE" ] || die "No .dmg produced by jpackage."

APP_BUNDLE="$(find "$OUT" -maxdepth 1 -name 'QuantumBrush.app' -type d | head -n 1)"
if [ -n "$APP_BUNDLE" ]; then
    sign_macos "$APP_BUNDLE"
fi

FINAL_DMG="$OUT/QuantumBrush-${VERSION}-macos-${LABEL}.dmg"
mv "$DMG_FILE" "$FINAL_DMG"
sign_macos "$FINAL_DMG"
notarize_macos "$FINAL_DMG"

info "Built $FINAL_DMG"
info "macOS packaging complete."
