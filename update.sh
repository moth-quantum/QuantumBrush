#!/bin/bash
set -euo pipefail

main() {

TARBALL_URL="https://github.com/moth-quantum/QuantumBrush/archive/refs/heads/dist.tar.gz"
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

[ -t 1 ] && { R=$'\033[31m' G=$'\033[32m' Y=$'\033[33m' B=$'\033[34m' N=$'\033[0m'; }
: "${R:=}" "${G:=}" "${Y:=}" "${B:=}" "${N:=}"
ok()   { printf "${G}[OK]${N} %s\n" "$1"; }
warn() { printf "${Y}[WARN]${N} %s\n" "$1"; }
die()  { printf "${R}[ERROR]${N} %s\n" "$1"; exit 1; }

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   QuantumBrush Update                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
printf "\nInstall dir: %s\n\n" "$INSTALL_DIR"

command -v curl &>/dev/null || die "curl is required but not installed."

printf "Update to the latest version? (Y/n): "
read -r -n 1 REPLY || true; echo
[[ $REPLY =~ ^[Nn]$ ]] && { warn "Update cancelled."; exit 0; }

printf "${B}[INFO]${N} Downloading latest version...\n"
curl -fsSL "$TARBALL_URL" | tar -xz --strip-components=1 -C "$TEMP_DIR"

printf "${B}[INFO]${N} Updating application files...\n"
cp -R "$TEMP_DIR"/. "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/setup.sh" "$INSTALL_DIR/update.sh" \
         "$INSTALL_DIR/RunQuantumBrush.sh" "$INSTALL_DIR/RunQuantumBrush.command" \
         "$INSTALL_DIR/RunQuantumBrush.bat" \
         "$INSTALL_DIR/Setup.command" "$INSTALL_DIR/Update.command" 2>/dev/null || true

echo
ok "Update is finished."

printf "Re-run setup to update Python dependencies? (Y/n): "
read -r -n 1 REPLY || true; echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    cd "$INSTALL_DIR" && ./setup.sh
else
    warn "Skipped. Run manually if brushes stop working:"
    printf "  cd %s && ./setup.sh\n\n" "$INSTALL_DIR"
fi

printf "${B}To run:${N} cd %s && ./RunQuantumBrush.sh\n\n" "$INSTALL_DIR"

}

main "$@"
