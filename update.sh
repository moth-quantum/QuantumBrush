#!/bin/bash
# QuantumBrush Update Script
# Updates application files while preserving user data
# User data (project/, config/, metadata/, log/) is not in the repo, so a
# simple cp -R from a fresh clone will never overwrite it.

REPO_URL="https://github.com/moth-quantum/QuantumBrush.git"
REPO_BRANCH="dist"
TEMP_DIR="/tmp/quantum-brush-update"

# ── Color / output helpers ───────────────────────────────────────────
if [ -t 1 ] && command -v tput > /dev/null; then
    ncolors=$(tput colors 2>/dev/null)
    if [ -n "$ncolors" ] && [ "$ncolors" -ge 8 ]; then
        BOLD="$(tput bold)" NORMAL="$(tput sgr0)"
        RED="$(tput setaf 1)" GREEN="$(tput setaf 2)"
        YELLOW="$(tput setaf 3)" BLUE="$(tput setaf 4)"
    fi
fi
: "${RED:=}" "${GREEN:=}" "${YELLOW:=}" "${BLUE:=}" "${BOLD:=}" "${NORMAL:=}"

info()    { printf "${BLUE}[INFO]${NORMAL} %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NORMAL} %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARNING]${NORMAL} %s\n" "$1"; }
err()     { printf "${RED}[ERROR]${NORMAL} %s\n" "$1"; }

# ── Main ─────────────────────────────────────────────────────────────
main() {
    # Figure out where this script lives (= the install dir)
    INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"

    printf "\n"
    printf "╔══════════════════════════════════════════════════════════════╗\n"
    printf "║                   QuantumBrush Updater                       ║\n"
    printf "╚══════════════════════════════════════════════════════════════╝\n"
    printf "\n"
    printf "${BLUE}Installation:${NORMAL} %s\n\n" "$INSTALL_DIR"

    if ! command -v git &> /dev/null; then
        err "Git is not installed. Please install Git first."
        exit 1
    fi

    read -p "Update QuantumBrush to the latest version? (Y/n): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Nn]$ ]] && { warn "Update cancelled."; exit 0; }

    # Download latest version
    info "Downloading latest version..."
    rm -rf "$TEMP_DIR"
    if ! git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$TEMP_DIR" 2>&1; then
        err "Download failed."
        exit 1
    fi

    # Copy application files (user data dirs aren't in the repo)
    info "Updating application files..."
    rm -rf "$TEMP_DIR/.git"
    cp -R "$TEMP_DIR"/* "$INSTALL_DIR/"
    cp "$TEMP_DIR"/.gitignore "$INSTALL_DIR/" 2>/dev/null

    # Make scripts executable
    chmod +x "$INSTALL_DIR/setup.sh" "$INSTALL_DIR/update.sh" 2>/dev/null

    # Clean up
    rm -rf "$TEMP_DIR"

    echo
    success "QuantumBrush has been updated!"
    printf "${BLUE}To run:${NORMAL} cd %s && java -jar QuantumBrush.jar\n\n" "$INSTALL_DIR"
}

main "$@"
