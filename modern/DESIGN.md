# Quantum Brush — Design & Technical Decisions

## Product identity

Quantum Brush is a **stroke-driven quantum image editor**: hand-drawn paths on a photo define where and how a quantum algorithm modifies pixels. It is not a general paint program or a circuit IDE.

**Unique vs other tools:** strokes on image → JSON → Python quantum brush → blended result; pluggable `effect/` modules; optional simulator/hardware backends.

---

## Visual design

### Layout

Single window with three columns (replaces three detached Swing frames):

- **Left:** brush picker + schema-driven parameters  
- **Center:** canvas (focusable — fixes stray-click bug from legacy app)  
- **Right:** stroke manager (list, run, apply, previews)

### Visual language

- Dark workspace (`#0c0c12`) — canvas is focal  
- Accent violet (`#8b5cf6`) — quantum brand without generic “AI gradient”  
- **Yellow anchor / red path** — preserved from README; teaches quantum input model  
- Status chips for stroke state (pending / running / completed / failed)

### Typography & components

- Inter / system-ui  
- Native-feeling controls (sliders, selects) generated from brush JSON — same extensibility as Java `UIManager.createGenericParameterPanel`

---

## Technical architecture

```
┌─────────────────────────────────────────┐
│  React UI (Konva canvas, brush panels)   │
└─────────────────┬───────────────────────┘
                  │ Tauri invoke
┌─────────────────▼───────────────────────┐
│  Rust: paths, projects, spawn Python     │
└─────────────────┬───────────────────────┘
                  │ subprocess
┌─────────────────▼───────────────────────┐
│  effect/apply_effect.py → {brush}.py     │
└─────────────────────────────────────────┘
```

### Why not Java/Swing/Processing?

Hackathon bounty = **modernized** UX and deployability. Java shell cannot deliver 2026 design quality or one-command setup without Eclipse/Processing friction.

### Why keep Python?

All quantum logic (Qiskit, PennyLane, etc.) lives in `effect/`. Rewriting brushes would break community contributions and the paper’s creative workflow.

### Deployability

1. `QUANTUMBRUSH_ROOT` or auto-detect parent containing `effect/apply_effect.py`  
2. `.venv` at repo root via `scripts/setup-python.sh`  
3. `requirements.txt` pinned  
4. Logs in `log/python_stderr.log`  
5. No secrets on disk (`IQM_TOKEN` env only)

---

## MVP scope

| In scope | Out of scope (v0.2) |
|----------|---------------------|
| New/open/delete project | Full IQM hardware tab UI |
| Import/export image | All 12+ brushes tested |
| Draw paths + create stroke | Debug log viewer |
| Run + apply one+ brushes | Mobile app |

---

## Figma / prototype (submission)

Recommended screens to design & record:

1. Empty → import image  
2. Canvas + Heisenbrush params  
3. Stroke manager with input/output preview  
4. Applied result on canvas  

Export PNGs + short screen recording of: draw → create → run → apply.
