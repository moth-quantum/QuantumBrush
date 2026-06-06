#!/bin/bash
set -euo pipefail
# QuantumBrush Installer
# Downloads and installs QuantumBrush, then runs setup for dependencies
# Distributed via GitHub Releases (not included in the repository)

TARBALL_URL="https://github.com/moth-quantum/QuantumBrush/archive/refs/heads/dist.tar.gz"
INSTALL_DIR="$HOME/QuantumBrush"
RELEASES_URL="https://github.com/moth-quantum/QuantumBrush/releases/latest"

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

handle_existing() {
    [ ! -d "$INSTALL_DIR" ] && return 0

    if find "$INSTALL_DIR" -maxdepth 1 -name "QuantumBrush*.jar" -type f 2>/dev/null | grep -q .; then
        warn "QuantumBrush is already installed at: $INSTALL_DIR"
        echo
        echo "  1) Update (preserves your projects and settings)"
        echo "  2) Install to a different directory"
        echo "  3) Cancel"
        echo
        read -p "Choose (1-3): " -n 1 -r || true; echo

        case "$REPLY" in
            1) info "Updating existing installation..." ;;
            2)
                read -rp "Enter new directory: " new_dir || true
                [ -z "$new_dir" ] && { err "No directory specified."; exit 1; }
                INSTALL_DIR="$new_dir"
                handle_existing
                ;;
            3) exit 0 ;;
            *) err "Invalid option."; exit 1 ;;
        esac
    else
        warn "Directory $INSTALL_DIR exists but doesn't contain QuantumBrush."
        read -p "Use this directory anyway? (y/N): " -n 1 -r || true; echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            read -rp "Enter a different directory: " new_dir || true
            [ -z "$new_dir" ] && { err "No directory specified."; exit 1; }
            INSTALL_DIR="$new_dir"
            handle_existing
        fi
    fi
}

do_install() {
    info "Downloading QuantumBrush..."
    mkdir -p "$INSTALL_DIR"
    curl -fsSL "$TARBALL_URL" | tar -xz --strip-components=1 -C "$INSTALL_DIR"
    chmod +x "$INSTALL_DIR/setup.sh" "$INSTALL_DIR/update.sh" \
             "$INSTALL_DIR/RunQuantumBrush.sh" "$INSTALL_DIR/RunQuantumBrush.command" \
             "$INSTALL_DIR/Setup.command" "$INSTALL_DIR/Update.command" 2>/dev/null || true
    success "QuantumBrush installed to $INSTALL_DIR"
}

main() {
    printf "\n"
    printf "╔══════════════════════════════════════════════════════════════╗\n"
    printf "║                  QuantumBrush Installer                      ║\n"
    printf "╚══════════════════════════════════════════════════════════════╝\n"
    printf "\n"
    warn "Prefer a native installer when available:"
    echo "  $RELEASES_URL"
    echo "  macOS: .dmg  |  Windows: .exe  |  Ubuntu: .deb or .iso"
    echo

    command -v curl &>/dev/null || { err "curl is required but not installed."; exit 1; }

    handle_existing
    do_install

    if [ -f "$INSTALL_DIR/setup.sh" ]; then
        echo
        read -p "Run setup now to install Java and Python dependencies? (Y/n): " -n 1 -r || true
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            cd "$INSTALL_DIR" && ./setup.sh
        else
            warn "Setup skipped. Run it later with:"
            echo "  cd $INSTALL_DIR && ./setup.sh"
        fi
    fi

    echo
    success "Done!"
    printf "%sTo run QuantumBrush:%s\n" "$BLUE" "$NORMAL"
    printf "  cd %s\n" "$INSTALL_DIR"
    printf "  ./RunQuantumBrush.sh\n\n" 
}

main "$@"
