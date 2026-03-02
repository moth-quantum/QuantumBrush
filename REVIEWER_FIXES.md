# Reviewer Feedback — Issues & Fixes

This document tracks the four issues raised during code review, their root causes, and the fixes applied.

---

## Issue 1: Window Resize Bug — Right Bar Disappears

**Reviewer feedback:** "Right bar disappears" on window resize.

**Root cause:** The Control Panel was conditionally rendered using `{controlPanelOpen && <ControlPanel />}`, which fully unmounted the component from the DOM when collapsed. This caused:
- Layout reflow when the panel was toggled (the canvas area had to recalculate its flex width)
- Loss of panel internal state (scroll position, selected effect) on each collapse/expand cycle
- On window resize, the canvas `flex-1` expansion could push the panel toggle button off-screen, making the panel unrecoverable

**Fix applied in:** `src/App.tsx`, `src/components/CanvasArea.tsx`

| Before | After |
|---|---|
| `{controlPanelOpen && <ControlPanel />}` — conditional mount/unmount | CSS-based collapse: `width: 18rem / 0` with `overflow-hidden` and `transition-[width]` |
| `window.addEventListener('resize', resize)` — only fires on window resize | `ResizeObserver` on canvas container — fires on any layout change including panel toggle |

**How to verify:**
1. Open the app and toggle the Control Panel open/closed — observe smooth slide animation
2. Resize the window to minimum width (900px) — the panel remains accessible via the toggle button
3. Collapse the panel, resize the window smaller, then re-open — the panel slides out correctly
4. Collapse/expand the panel rapidly — the canvas redraws without layout jumps

---

## Issue 2: Stroke Manager Lacks Core Abilities

**Reviewer feedback:** "Stroke manager lacks its several ability from the original purpose. Managing strokes, applying the effect later or now, compare the before/after, etc."

**Root cause:** The Stroke Manager UI had buttons for before/after comparison, but the comparison **did not actually work**:
- `StrokeManager.tsx` dispatched `qb:compare-start` and `qb:compare-end` custom events
- `CanvasArea.tsx` had **no listeners** for these events — the events went nowhere
- `StrokeRecord` did not store `beforeCanvasJson` (the canvas state before the effect was applied)
- `StrokeRecord` did not store `resultDataUrl` (the effect output for restoration)

**Fix applied in:** `src/types.ts`, `src/store.ts`, `src/components/CanvasArea.tsx`, `src/components/ControlPanel.tsx`

### Changes:
1. **`StrokeRecord` type** — Added two new optional fields:
   - `beforeCanvasJson?: string` — Canvas JSON snapshot taken before each effect
   - `resultDataUrl?: string` — The effect output data URL for re-display

2. **`ControlPanel.tsx`** — When applying an effect (both "Apply Now" and "Queue for Later"):
   - Captures `JSON.stringify(canvas.toJSON())` as `beforeCanvasJson` and stores it in the stroke record
   - On successful completion, stores `resultDataUrl` in the stroke record

3. **`store.ts` `reapplyStroke()`** — Also captures `beforeCanvasJson` before re-running effects

4. **`CanvasArea.tsx`** — Added `qb:compare-start` and `qb:compare-end` event listeners:
   - `compare-start`: Saves current canvas state to a ref, loads `beforeCanvasJson` from the stroke
   - `compare-end`: Restores the saved canvas state from the ref

**Where to find the before/after compare button:**
1. Open the **Stroke Manager** by clicking the **Layers icon** (stacked rectangles) in the **left sidebar**
2. The Stroke Manager panel appears at the **bottom of the canvas area**
3. Each completed stroke row has action buttons on the right side
4. The **eye icon** is the before/after compare toggle — it is the first button on completed strokes

**How to verify:**
1. Draw strokes on the canvas and apply an effect — stroke appears in Stroke Manager as "completed"
2. Open the Stroke Manager (Layers icon in the left sidebar)
3. On the completed stroke row, click the **eye icon** (leftmost action button) — canvas switches to show the "before" state, and a yellow ring highlights the stroke
4. The header shows "Comparing before/after" to confirm compare mode is active
5. Click the **eye icon** again — canvas returns to the current state with effect applied
6. Queue an effect for later (click "Queue for Later" in Control Panel) — stroke appears as "pending" with a play button
7. Click the **play icon** on a pending stroke — effect runs and status changes to "completed"
8. Click the **trash icon** on any stroke — it is removed from history

---

## Issue 3: Managing Python Packages Apart From the App Is Tricky

**Reviewer feedback:** "Managing needed Python packages apart from the app is tricky."

**Root cause:** The Control Panel had an "Install All Packages" button that called `window.ipcRenderer.installPackages(packages)`, but:
- The `installPackages` method was **not defined** in `electron/preload.ts` (no context bridge exposure)
- The `install-packages` IPC handler was **not registered** in `electron/main.ts` (no backend logic)
- Clicking the install button would throw a runtime error: `installPackages is not a function`
- Package detection only checked 5 hardcoded packages instead of reading from effect `_requirements.json` files

**Fix applied in:** `electron/main.ts`, `electron/preload.ts`, `src/vite-env.d.ts`

### Changes:
1. **`electron/main.ts`** — Added `install-packages` IPC handler:
   - Spawns `python3 -m pip install <packages>` as a child process
   - Maps import names to pip names where they differ (e.g., `PIL` -> `Pillow`, `qiskit_aer` -> `qiskit-aer`)
   - Returns success/failure with error output

2. **`electron/main.ts`** — Added `collectEffectDependencies()`:
   - Scans all `python/*/` directories for `*_requirements.json` files
   - Aggregates all `dependencies` keys into a unique set
   - Falls back to core packages (`numpy`, `PIL`, `qiskit`, `qiskit_aer`, `scipy`) as a baseline

3. **`electron/preload.ts`** — Exposed `installPackages` via context bridge:
   ```typescript
   installPackages: (packages: string[]) => ipcRenderer.invoke('install-packages', packages)
   ```

4. **`src/vite-env.d.ts`** — Added TypeScript declaration for `installPackages`

**How to verify:**
1. Uninstall a Python package (e.g., `pip uninstall numpy`) and restart the app
2. The Control Panel shows a red "Missing Python Packages" alert listing `numpy`
3. Click "Install All Packages" — the button shows "Installing..." with a spinner
4. After completion, a success notification appears and the alert disappears
5. Effects that depend on the package now work correctly

---

## Issue 4: Separating 'Dots' and Brush Is Unnatural

**Reviewer feedback:** "Separating 'dots' and brush is unnatural."

**Root cause:** The dots tool existed as a visually separate concept from the brush:
- In the sidebar, when the user pressed `D` for dots, the brush button lost its highlight (no tool appeared active)
- Users had to know that "dots" existed as a separate tool rather than a brush mode
- The Control Panel already had a Stroke/Dots toggle inside "Brush Settings", but the sidebar didn't reflect this

**Fix applied in:** `src/components/Sidebar.tsx`, `src/components/CanvasArea.tsx`

### Changes:
1. **Sidebar tool definitions** — Added `alsoActive` property to the brush tool:
   ```typescript
   { id: 'brush', icon: Brush, label: 'Brush (B) / Dots (D)', alsoActive: 'dot' }
   ```

2. **Sidebar button rendering** — Brush button now highlights when either `brush` or `dot` tool is active:
   ```typescript
   const isActive = currentTool === id || currentTool === alsoActive;
   ```

3. **Label update** — Brush button tooltip now reads "Brush (B) / Dots (D)" to indicate both modes

4. **Dot drag-to-place** — Dots mode now supports click-and-drag in addition to single clicks:
   - `mouse:down` places the first dot and begins a drag session
   - `mouse:move` places additional dots continuously while dragging
   - `mouse:up` ends the drag and saves a single undo state for the entire stroke
   - This makes placing multiple dots along a path natural and fast

**User experience after fix:**
- The sidebar brush button stays highlighted in both stroke and dot modes
- Switching between stroke (B) and dots (D) is done via:
  - Keyboard shortcuts `B` / `D`
  - The Stroke/Dots toggle inside the Control Panel's "Brush Settings" section
- The brush settings (width, color, opacity) apply to both modes
- The dots tool shares all brush properties — it's a brush sub-mode, not a separate tool
- In dots mode, dragging places dots continuously along the drag path (not just on click)

**How to verify:**
1. Press `B` — brush button in sidebar highlights, Control Panel shows "Brush Settings" with "Stroke" selected
2. Press `D` — brush button **stays highlighted**, Control Panel switches to "Dots" mode
3. Click the brush button in sidebar — switches to stroke mode
4. Use the Stroke/Dots toggle in Control Panel — switches brush sub-mode without changing sidebar state
5. In dots mode, click once — a single dot is placed
6. In dots mode, click and drag — dots are placed continuously along the drag path

---

## Summary of All Files Changed

| File | Changes |
|---|---|
| `src/App.tsx` | CSS-based panel collapse instead of conditional rendering |
| `src/types.ts` | Added `beforeCanvasJson` and `resultDataUrl` to `StrokeRecord` |
| `src/store.ts` | Store `beforeCanvasJson` on reapply; store `resultDataUrl` on completion |
| `src/vite-env.d.ts` | Added `installPackages` type declaration |
| `src/components/CanvasArea.tsx` | ResizeObserver; before/after comparison event listeners; dot drag-to-place |
| `src/components/ControlPanel.tsx` | Capture `beforeCanvasJson` and `resultDataUrl` during effect apply |
| `src/components/Sidebar.tsx` | Brush button highlights for both brush and dot tools |
| `electron/main.ts` | `install-packages` IPC handler; dynamic dependency aggregation from effects |
| `electron/preload.ts` | Exposed `installPackages` via context bridge |

## Build Verification

- TypeScript: `npx tsc --noEmit` — **0 errors**
- Vite build: `npx vite build` — **success** (renderer + main + preload)
