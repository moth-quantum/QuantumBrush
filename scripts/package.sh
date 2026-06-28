#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR"

BUILD_DIR=${BUILD_DIR:-build}
PACKAGE_ROOT="$BUILD_DIR/package"
PACKAGE_DIR="$PACKAGE_ROOT/quantumbrush-modern-workspace"

"$SCRIPT_DIR/test.sh"

rm -rf "$PACKAGE_DIR" "$BUILD_DIR/quantumbrush-modern-workspace.zip"
mkdir -p "$PACKAGE_DIR/app" "$PACKAGE_DIR/lib" "$PACKAGE_DIR/docs/assets"

cp "$BUILD_DIR/quantumbrush.jar" "$PACKAGE_DIR/app/quantumbrush.jar"
cp "lib/core-4.4.1.jar" "$PACKAGE_DIR/lib/core-4.4.1.jar"
cp "docs/modern-workspace-prototype.html" "$PACKAGE_DIR/docs/modern-workspace-prototype.html"
cp "docs/modern-workspace-prototype.md" "$PACKAGE_DIR/docs/modern-workspace-prototype.md"
cp -R "docs/assets/modern-workspace" "$PACKAGE_DIR/docs/assets/"

cat > "$PACKAGE_DIR/RUN.md" <<'RUN'
# Quantum Brush Modern Workspace Prototype Package

## Desktop App

Run the source-branch Java/Processing checkpoint:

```bash
java -jar app/quantumbrush.jar
```

The app opens a Processing canvas window and a Swing control panel. Python effect
execution still depends on the existing Quantum Brush Python/conda setup from
the project README; the workspace header and quick actions can be reviewed from
the Java app without packaging those Python environments into this artifact.

## Clickable Design Prototype

Open the static prototype in any browser:

```bash
open docs/modern-workspace-prototype.html
```

On Linux, use `xdg-open` instead of `open`. On Windows, double-click the HTML
file or open it from the browser.
RUN

if command -v zip >/dev/null 2>&1; then
  (cd "$PACKAGE_ROOT" && zip -qr "../quantumbrush-modern-workspace.zip" quantumbrush-modern-workspace)
  echo "Packaged $BUILD_DIR/quantumbrush-modern-workspace.zip"
else
  echo "Packaged $PACKAGE_DIR"
fi
