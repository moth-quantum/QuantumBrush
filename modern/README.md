# Quantum Brush — Modern Desktop App

Modernized Quantum Brush: **Tauri 2 + React 19 + TypeScript** shell, **unchanged Python** quantum backend.

## Why this stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Shell | Tauri 2 | Native windows, small binary, cross-platform (Win/Mac/Linux) |
| UI | React + TypeScript | Modern design system, schema-driven brush controls |
| Canvas | Konva | Zoom/pan, yellow anchor + red path (quantum input contract) |
| Backend | Python `effect/apply_effect.py` | Qiskit brushes stay intact; JSON stroke protocol unchanged |

**Not Java/Swing/Processing** — legacy stack on `source` branch only. This folder is the hackathon modernization target.

## Unique Quantum Brush features preserved

1. **Stroke semantics** — click (yellow) + drag (red); Shift = axis lock  
2. **JSON-driven brushes** — params from `effect/*/_requirements.json`  
3. **Stroke pipeline** — Create → Run (Python) → Apply to canvas  
4. **Project layout** — `metadata/`, `project/{id}/`, `stroke/` (compatible with original app)

## Quick start (any machine)

```bash
# From repository root
chmod +x scripts/setup-python.sh
./scripts/setup-python.sh

export QUANTUMBRUSH_ROOT="$(pwd)"   # required if app cannot auto-detect root

cd modern
npm install
npm run tauri dev
```

### Linux: Tauri won't build (glib < 2.70)?

Use **browser dev mode** instead — same features, Python API backend:

```bash
export QUANTUMBRUSH_ROOT="$(pwd)"   # from repo root
cd modern
npm run dev:web
```

Open http://localhost:1420 — **not** `npm run tauri dev` alone.

`npm run dev:web` starts:
1. Python dev API on port 8787
2. Vite on port 1420 (proxies `/api` and `/media`)

### Linux prerequisites (Tauri only)

```bash
# Ubuntu/Debian — see https://tauri.app/start/prerequisites/
sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `QUANTUMBRUSH_ROOT` | Path to repo root (must contain `effect/apply_effect.py`) |
| `IQM_TOKEN` | Optional real-hardware token (never stored on disk) |

## Deployability fixes (vs mentor feedback)

- No hardcoded user paths — root discovery + `QUANTUMBRUSH_ROOT`
- Project-local `.venv` via `scripts/setup-python.sh`
- Pinned `requirements.txt` at repo root
- Python subprocess `cwd` = repo root (same as Java app)
- Status bar shows resolved root + python path

## Demo workflow

1. **New project** → pick PNG/JPG  
2. Draw stroke on canvas  
3. Select **Basic (acrylic)** for minimal deps, or **Heisenbrush** for quantum demo  
4. **Create stroke** → **Run** → **Apply to canvas**  
5. **Export** PNG  

## Build release

```bash
cd modern && npm run tauri build
```

## Design doc

See [DESIGN.md](./DESIGN.md) for visual + technical decisions (submit with hackathon).

## Production deploy

See [DEPLOY.md](./DEPLOY.md) for Vercel (UI) + hosted Python API (`VITE_API_URL`, Docker).

## PR checklist

- [ ] `./scripts/setup-python.sh` from repo root
- [ ] `export QUANTUMBRUSH_ROOT="$(pwd)"`
- [ ] `cd modern && npm run dev:web` — new project, draw, create/run/apply stroke, export
- [ ] `cd modern && npm run build` passes
- [ ] `./scripts/smoke-test.sh` passes (optional, validates Python brushes)
- [ ] Vercel: root `modern`, env `VITE_API_URL` → hosted API

### What this PR delivers

| Area | Change |
|------|--------|
| UI | Tauri 2 + React 19 three-panel layout (Control Panel · Canvas · Stroke Manager) |
| Canvas | Konva zoom/pan, yellow anchor + red path, shift axis lock |
| Backend | Unchanged `effect/apply_effect.py`; Rust commands or Python `dev-api` |
| Deploy | `QUANTUMBRUSH_ROOT`, `dev:web`, `VITE_API_URL`, `Dockerfile.api`, health endpoint |
