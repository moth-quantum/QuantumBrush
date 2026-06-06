#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=packaging/common.sh
source "$ROOT/packaging/common.sh"

ARCH="${QB_ARCH:-$(uname -m)}"
case "$ARCH" in
    x86_64|amd64) DEB_ARCH=amd64 ;;
    aarch64|arm64) DEB_ARCH=arm64 ;;
    *) die "Unsupported Linux architecture: $ARCH" ;;
esac

require_cmd jpackage

clean_dirs
stage_app
build_launcher_jar
populate_input

info "Building Linux .deb with jpackage..."
jpackage \
    --name QuantumBrush \
    --app-version "$VERSION" \
    --vendor "MOTH Quantum" \
    --description "Creative image modification powered by quantum computing" \
    --copyright "Copyright 2025 MOTH Quantum" \
    --type deb \
    --dest "$OUT" \
    --input "$INPUT" \
    --main-jar launcher.jar \
    --main-class Launcher \
    --linux-package-name quantumbrush \
    --linux-deb-maintainer "quantumbrush@moth-quantum.github.io" \
    --linux-app-category Graphics \
    --linux-shortcut

DEB_FILE="$(find "$OUT" -maxdepth 1 -name 'quantumbrush_*_'$DEB_ARCH'.deb' -o -name 'QuantumBrush_*_'$DEB_ARCH'.deb' | head -n 1)"
[ -n "$DEB_FILE" ] || DEB_FILE="$(find "$OUT" -maxdepth 1 -name '*.deb' | head -n 1)"
[ -n "$DEB_FILE" ] || die "No .deb produced by jpackage."

FINAL_DEB="$OUT/QuantumBrush-${VERSION}-linux-${DEB_ARCH}.deb"
mv "$DEB_FILE" "$FINAL_DEB"
info "Built $FINAL_DEB"

info "Building Ubuntu install ISO..."
ISO_DIR="$OUT/iso-root"
ISO_STAGING="$OUT/iso-staging"
rm -rf "$ISO_DIR" "$ISO_STAGING"
mkdir -p "$ISO_DIR/packages"
cp "$FINAL_DEB" "$ISO_DIR/packages/"
cat > "$ISO_DIR/install-quantumbrush.sh" <<'EOF'
#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DEB="$(find "$DIR/packages" -name '*.deb' | head -n 1)"
[ -n "$DEB" ] || { echo "No .deb package found."; exit 1; }
echo "Installing QuantumBrush from $DEB"
sudo apt-get update
sudo apt-get install -y "$DEB"
echo "Launch QuantumBrush from your applications menu."
EOF
chmod +x "$ISO_DIR/install-quantumbrush.sh"
cat > "$ISO_DIR/README.txt" <<EOF
QuantumBrush ${VERSION} for Ubuntu/Debian (${DEB_ARCH})

1. Mount or extract this ISO.
2. Run: ./install-quantumbrush.sh
3. Launch QuantumBrush from your applications menu.

First launch configures Java and Python automatically.
EOF

if command -v xorriso &>/dev/null; then
    xorriso -as mkisofs \
        -r -V "QuantumBrush ${VERSION}" \
        -o "$OUT/QuantumBrush-${VERSION}-ubuntu-${DEB_ARCH}.iso" \
        -J -joliet-long "$ISO_DIR"
    info "Built $OUT/QuantumBrush-${VERSION}-ubuntu-${DEB_ARCH}.iso"
else
    warn "xorriso not installed; skipped ISO build. Install xorriso to produce .iso."
fi
info "Linux packaging complete."
