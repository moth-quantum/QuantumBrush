#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${QUANTUMBRUSH_OUT_DIR:-${ROOT_DIR}/dist-installers}"
STAGE_DIR="${OUT_DIR}/stage"
export COPYFILE_DISABLE=1

APP_NAME="QuantumBrush"
VERSION="${QUANTUMBRUSH_VERSION:-local}"

rm -rf "$OUT_DIR"
mkdir -p "$STAGE_DIR"

copy_payload() {
  local dest="$1"
  mkdir -p "$dest"
  cp "$ROOT_DIR/QuantumBrush.jar" "$dest/"
  cp -R "$ROOT_DIR/QuantumBrush_lib" "$dest/"
  cp -R "$ROOT_DIR/effect" "$dest/"
  cp "$ROOT_DIR/setup.sh" "$ROOT_DIR/update.sh" "$ROOT_DIR/Setup.command" "$ROOT_DIR/Update.command" "$dest/"
  cp "$ROOT_DIR/README.md" "$ROOT_DIR/LICENSE-2.0.txt" "$dest/"
}

build_macos_app() {
  local app_dir="$STAGE_DIR/macos/${APP_NAME}.app"
  mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources"
  copy_payload "$app_dir/Contents/Resources/QuantumBrush"
  cp "$ROOT_DIR/packaging/macos/QuantumBrush" "$app_dir/Contents/MacOS/QuantumBrush"
  chmod +x "$app_dir/Contents/MacOS/QuantumBrush"
  cat > "$app_dir/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>QuantumBrush</string>
  <key>CFBundleIdentifier</key>
  <string>org.mothquantum.quantumbrush</string>
  <key>CFBundleName</key>
  <string>QuantumBrush</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
</dict>
</plist>
PLIST

  if [ -n "${MACOS_CODESIGN_IDENTITY:-}" ]; then
    codesign --force --deep --timestamp --options runtime --sign "$MACOS_CODESIGN_IDENTITY" "$app_dir"
  fi

  if command -v hdiutil >/dev/null 2>&1; then
    hdiutil create -volname "$APP_NAME" -srcfolder "$app_dir" -ov -format UDZO "$OUT_DIR/${APP_NAME}-${VERSION}-macos.dmg"
  else
    (cd "$STAGE_DIR/macos" && tar --no-xattrs -czf "$OUT_DIR/${APP_NAME}-${VERSION}-macos-app.tar.gz" "${APP_NAME}.app")
  fi
}

build_windows_zip() {
  local dest="$STAGE_DIR/windows/${APP_NAME}"
  copy_payload "$dest"
  cp "$ROOT_DIR/packaging/windows/QuantumBrush.bat" "$dest/"
  (cd "$STAGE_DIR/windows" && zip -qr "$OUT_DIR/${APP_NAME}-${VERSION}-windows-portable.zip" "$APP_NAME")
}

build_linux_tarball() {
  local dest="$STAGE_DIR/linux/${APP_NAME}"
  copy_payload "$dest"
  cp "$ROOT_DIR/packaging/linux/quantumbrush" "$dest/"
  chmod +x "$dest/quantumbrush" "$dest/setup.sh" "$dest/update.sh"
  (cd "$STAGE_DIR/linux" && tar --no-xattrs -czf "$OUT_DIR/${APP_NAME}-${VERSION}-linux.tar.gz" "$APP_NAME")
}

build_macos_app
build_windows_zip
build_linux_tarball

rm -rf "$STAGE_DIR"
find "$OUT_DIR" -name '._*' -type f -delete
find "$OUT_DIR" -maxdepth 1 -type f -print | sort
