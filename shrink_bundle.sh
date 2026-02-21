#!/usr/bin/env bash
set -e

APP_DIR="dist/QuantumBrush"

echo "==> Shrinking bundle at $APP_DIR"

# 1. Remove docs/man/icons (safe for most apps)
echo "-- removing docs/man/icons"
rm -rf "$APP_DIR/_internal/share/doc" 2>/dev/null || true
rm -rf "$APP_DIR/_internal/share/man" 2>/dev/null || true
rm -rf "$APP_DIR/_internal/share/icons" 2>/dev/null || true

# 2. Keep only English locale (edit if you need more)
echo "-- pruning locales (keeping en only)"
LOCALE_DIR="$APP_DIR/_internal/share/locale"
if [ -d "$LOCALE_DIR" ]; then
    find "$LOCALE_DIR" -mindepth 1 -maxdepth 1 ! -name "en" -exec rm -rf {} +
fi

# 3. Strip debug symbols from shared libraries
#echo "-- stripping .so debug symbols"
#find "$APP_DIR" -type f -name "*.so*" -exec strip --strip-unneeded {} 2>/dev/null || true

# 4. Strip the main executable if possible
#echo "-- stripping main binary"
#strip "$APP_DIR/QuantumBrush" 2>/dev/null || true

# 5. Show final size
echo "-- final bundle size:"
du -sh "$APP_DIR"

echo "==> Done."