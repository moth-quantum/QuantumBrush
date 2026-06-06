#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=packaging/common.sh
source "$ROOT/packaging/common.sh"

ARCH="${QB_ARCH:-$(uname -m)}"
case "$ARCH" in
    arm64)  LABEL=apple-silicon ;;
    x86_64) LABEL=intel ;;
    *) die "Unsupported macOS architecture: $ARCH" ;;
esac

require_cmd jpackage
prepare_build
set_jpackage_args

info "Building macOS .dmg for $LABEL ($ARCH)..."
MAC_ARGS=(--type dmg
    --mac-package-name "org.mothquantum.quantumbrush"
    --mac-app-category public.app-category.graphics-design)
ICON="$PACKAGING/icons/QuantumBrush.icns"
if [ -f "$ICON" ]; then
    jpackage "${JPARGS[@]}" "${MAC_ARGS[@]}" --mac-app-icon "$ICON"
else
    jpackage "${JPARGS[@]}" "${MAC_ARGS[@]}"
fi

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
