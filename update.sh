#!/bin/bash

REPO_URL="https://github.com/moth-quantum/QuantumBrush.git"
REPO_BRANCH="dist"
TEMP_DIR="/tmp/quantum-brush-update"
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"

[ -t 1 ] && { R=$'\033[31m' G=$'\033[32m' Y=$'\033[33m' B=$'\033[34m' N=$'\033[0m'; }
: "${R:=}" "${G:=}" "${Y:=}" "${B:=}" "${N:=}"
ok()   { printf "${G}[OK]${N} %s\n" "$1"; }
warn() { printf "${Y}[WARN]${N} %s\n" "$1"; }
die()  { printf "${R}[ERROR]${N} %s\n" "$1"; exit 1; }

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   QuantumBrush Updater                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
printf "\nInstall dir: %s\n\n" "$INSTALL_DIR"

command -v git &>/dev/null || die "Git is not installed."

printf "Update to the latest version? (Y/n): "
read -r -n 1 REPLY; echo
[[ $REPLY =~ ^[Nn]$ ]] && { warn "Update cancelled."; exit 0; }

printf "${B}[INFO]${N} Downloading latest version...\n"
rm -rf "$TEMP_DIR"
git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$TEMP_DIR" 2>&1 \
    || die "Download failed."

printf "${B}[INFO]${N} Updating application files...\n"
rm -rf "$TEMP_DIR/.git"
cp -R "$TEMP_DIR"/. "$INSTALL_DIR/"
rm -rf "$TEMP_DIR"

chmod +x "$INSTALL_DIR/setup.sh" "$INSTALL_DIR/update.sh" \
         "$INSTALL_DIR/Setup.command" "$INSTALL_DIR/Update.command" 2>/dev/null

echo
ok "QuantumBrush updated!"
printf "${B}To run:${N} cd %s && java -jar QuantumBrush.jar\n\n" "$INSTALL_DIR"
