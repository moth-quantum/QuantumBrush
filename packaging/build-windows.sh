#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=packaging/common.sh
source "$ROOT/packaging/common.sh"

require_cmd jpackage
prepare_build
set_jpackage_args

info "Building Windows .exe installer..."
jpackage "${JPARGS[@]}" \
    --type exe \
    --win-dir-chooser \
    --win-menu \
    --win-shortcut \
    --win-shortcut-prompt

EXE_FILE="$(find "$OUT" -maxdepth 1 -name 'QuantumBrush*.exe' | head -n 1)"
[ -n "$EXE_FILE" ] || die "No .exe produced by jpackage."

FINAL_EXE="$OUT/QuantumBrush-${VERSION}-windows-x64.exe"
mv "$EXE_FILE" "$FINAL_EXE"
sign_windows "$FINAL_EXE"

info "Built $FINAL_EXE"
info "Windows packaging complete."
