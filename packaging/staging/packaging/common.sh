#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGING="$ROOT/packaging"
STAGING="$PACKAGING/staging"
INPUT="$PACKAGING/input"
RESOURCES="$PACKAGING/resources"
OUT="$PACKAGING/out"
VERSION="${QB_VERSION:-0.7.0}"
TARBALL_URL="${QB_TARBALL_URL:-https://github.com/moth-quantum/QuantumBrush/archive/refs/heads/dist.tar.gz}"

info() { printf '[INFO] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
die()  { printf '[ERROR] %s\n' "$1" >&2; exit 1; }

require_cmd() {
    command -v "$1" &>/dev/null || die "'$1' is required but not installed."
}

clean_dirs() {
    rm -rf "$INPUT" "$RESOURCES" "$OUT"
    mkdir -p "$INPUT" "$RESOURCES" "$OUT"
}

stage_app() {
    info "Staging QuantumBrush application files..."
    rm -rf "$STAGING"
    mkdir -p "$STAGING"

    if [ -f "$ROOT/QuantumBrush.jar" ]; then
        rsync -a \
            --exclude '.git/' \
            --exclude 'packaging/out/' \
            --exclude 'packaging/staging/' \
            --exclude 'packaging/input/' \
            --exclude 'packaging/resources/' \
            --exclude 'packaging/launcher/build/' \
            "$ROOT/" "$STAGING/"
    else
        info "QuantumBrush.jar not found locally; downloading dist tarball..."
        require_cmd curl
        require_cmd tar
        curl -fsSL "$TARBALL_URL" | tar -xz --strip-components=1 -C "$STAGING"
    fi

    [ -f "$STAGING/QuantumBrush.jar" ] || die "QuantumBrush.jar missing from staged app."
}

build_launcher_jar() {
    info "Building launcher.jar..."
    require_cmd javac
    require_cmd jar
    local build_dir="$PACKAGING/launcher/build"
    rm -rf "$build_dir"
    mkdir -p "$build_dir"
    javac "$PACKAGING/launcher/Launcher.java" -d "$build_dir"
    jar --create --file "$INPUT/launcher.jar" --main-class Launcher -C "$build_dir" .
}

populate_input() {
    cp "$STAGING/QuantumBrush.jar" "$STAGING/setup.sh" "$STAGING/update.sh" "$INPUT/"
    cp "$STAGING/Setup.command" "$STAGING/Update.command" "$INPUT/" 2>/dev/null || true
    cp -a "$STAGING/effect" "$INPUT/"
    if [ -d "$STAGING/QuantumBrush_lib" ]; then
        cp -a "$STAGING/QuantumBrush_lib" "$INPUT/"
    fi
    cp "$STAGING/README.md" "$STAGING/LICENSE-2.0.txt" "$INPUT/" 2>/dev/null || true
}

sign_macos() {
    local target="$1"
    [ -n "${APPLE_SIGNING_IDENTITY:-}" ] || return 0
    require_cmd codesign
    info "Signing macOS artifact with $APPLE_SIGNING_IDENTITY"
    codesign --force --deep --options runtime --sign "$APPLE_SIGNING_IDENTITY" "$target"
}

notarize_macos() {
    local target="$1"
    [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_APP_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ] || return 0
    require_cmd xcrun
    info "Notarizing $target..."
    xcrun notarytool submit "$target" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait
    xcrun stapler staple "$target"
}

sign_windows() {
    local target="$1"
    [ -n "${WINDOWS_SIGNING_CERT:-}" ] && [ -n "${WINDOWS_SIGNING_PASSWORD:-}" ] || return 0
    require_cmd signtool
    info "Signing Windows artifact..."
    signtool sign //fd SHA256 //f "$WINDOWS_SIGNING_CERT" //p "$WINDOWS_SIGNING_PASSWORD" "$target"
}
