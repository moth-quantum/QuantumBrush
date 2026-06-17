#!/usr/bin/env bash
# Creates a project-local Python venv for Quantum Brush (deployable on any machine).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install Python 3.10+ first."
  exit 1
fi

PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
PY_MINOR="$(python3 -c 'import sys; print(sys.version_info.minor)')"
if [ "$PY_MINOR" -lt 10 ]; then
  echo "Python 3.10+ required (found $PY_VER)"
  exit 1
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "Python environment ready at $ROOT/.venv"
echo "Export for the desktop app:"
echo "  export QUANTUMBRUSH_ROOT=\"$ROOT\""
echo ""
echo "Then run the UI:"
echo "  cd modern && npm install && npm run tauri dev"
