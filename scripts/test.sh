#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR"

BUILD_DIR=${BUILD_DIR:-build}
TEST_CLASS_DIR="$BUILD_DIR/test-classes"

git diff --check
"$SCRIPT_DIR/build.sh"

rm -rf "$TEST_CLASS_DIR"
mkdir -p "$TEST_CLASS_DIR"

javac -encoding UTF-8 \
  -cp "lib/core-4.4.1.jar:$BUILD_DIR/classes:src" \
  -d "$TEST_CLASS_DIR" \
  test/ModernWorkspacePanelTest.java

java -Djava.awt.headless=true \
  -cp "$TEST_CLASS_DIR:$BUILD_DIR/classes:lib/core-4.4.1.jar" \
  ModernWorkspacePanelTest

echo "Modern workspace compile and helper test passed"
