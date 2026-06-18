# Modern Workspace Prototype

This note records the source-branch prototype for the UnitaryHACK design request in issue #51. It keeps the existing Java, Processing, and Swing app as a runnable implementation checkpoint while using the HTML prototype and screenshots to show the target modern workspace direction.

This is not a claim that Swing is the final modernization stack. The code change is intentionally source-grounded so reviewers can compare it against the current working app and verify that the core Quantum Brush workflow still exists.

## Current Workflow

The active source branch already has the main workflow split across the app:

- `QuantumBrush.java`: canvas and control windows, project actions, image import/export, undo/redo, zoom, and pan.
- `UIManager.java`: effect selection, parameter controls, hardware configuration, and the stroke manager entry point.
- `CanvasManager.java`: path, dot, and constrained-line drawing behavior.
- `FileManager.java`: project metadata, image data, stroke data, save, and export.

## Prototype Change

The control panel now starts with a compact workspace header and a quick-action strip:

```text
Quantum Brush workspace
Follow the core flow: Project -> Canvas -> Effect -> Stroke -> Export

[1 Project] [2 Canvas] [3 Effect] [4 Stroke] [5 Export]
[New Project] [Open Project] [Stroke Manager] [Export]
```

This gives first-time users a clear project-to-export mental model before they choose effects or hardware options. The quick actions call the existing Java handlers for new project/image import, project open, stroke manager, and export.

## Key Quantum Brush Features Preserved

Quantum Brush is not just a generic drawing canvas. The prototype keeps these source-specific features visible:

- Project-first workflow: create/open a project before collecting canvas, image, and stroke state.
- Image-backed canvas: import an image, then draw over it instead of starting from a blank artboard only.
- Dot and line drawing: preserve path, dot, and constrained-line behavior from `CanvasManager`.
- Effect pipeline: keep effect selection and parameter controls from `UIManager` and the Python effect backend.
- Stroke review: keep the stroke manager as a first-class step before sending or exporting work.
- Hardware-aware path: keep the hardware configuration tab rather than hiding the quantum/hardware direction behind a generic paint UI.
- Save/export path: preserve project metadata, saved images, stroke files, and export behavior from `FileManager`.

These are the features that make the app different from a normal sketching tool or generic image editor. The design makes them visible as a workflow: Project -> Canvas -> Effect -> Stroke -> Export.

## Visual Design Choice

The visual direction is a restrained desktop workspace rather than a decorative landing page:

- Clear left-to-right workflow chips communicate where users are in the Quantum Brush process.
- Quick actions expose the four repeated commands a reviewer needs for the bounty: create/import, open, review strokes, and export.
- The palette uses neutral surfaces with blue and teal accents so the canvas remains the focus.
- Controls are compact because the app needs to support repeated editing and review, not one-time marketing browsing.
- The clickable HTML prototype shows the fuller modern direction: sidebar project context, central canvas, workflow steps, and a right-side inspector for effect/stroke state.

## Technical Design Choice

The source-branch implementation stays in Java/Processing/Swing for this PR because:

- The current working app is already Java/Processing with Swing control windows and a Python effect backend.
- A small source-branch checkpoint is easier to review against the current code than a full framework rewrite.
- The maintainer warned that previous full-stack translations lost the app purpose or did not run well. This PR avoids that failure mode by preserving the existing workflow and only adding a thin workspace layer.
- The prototype is compatible with a later modern stack. If the project chooses a full rewrite, the same workflow can be ported to Tauri/React, JavaFX, Electron, or another desktop shell after the maintainers approve the feature map.

So the split is deliberate:

- HTML/screenshots/recording: target modern interaction design.
- Java/Processing/Swing patch: runnable source-grounded checkpoint that proves the workflow can be added without losing current behavior.

## Deployability Review

The previous PR description only listed raw `javac` commands. This branch now adds scripts so a reviewer can validate from a clean checkout without Eclipse:

```bash
./scripts/test.sh
```

This runs whitespace checks, compiles all source files into `build/classes`, builds `build/quantumbrush.jar`, compiles the focused helper test, and runs it in headless mode.

Create a reviewable package:

```bash
./scripts/package.sh
```

This creates:

- `build/quantumbrush.jar`
- `build/package/quantumbrush-modern-workspace/`
- `build/quantumbrush-modern-workspace.zip` when `zip` is available

Run the packaged desktop checkpoint:

```bash
cd build/package/quantumbrush-modern-workspace
java -jar app/quantumbrush.jar
```

Open the packaged design prototype:

```bash
open docs/modern-workspace-prototype.html
```

On Linux, use `xdg-open`; on Windows, open the HTML file from the browser. The Java desktop app needs a graphical desktop session. The compile/helper test path is the non-GUI verification path for CI or headless review.

## Design and Prototype Artifacts

Open the clickable HTML prototype directly:

- [`modern-workspace-prototype.html`](./modern-workspace-prototype.html)

Generated design screenshots:

- [Project setup](./assets/modern-workspace/01-project-setup.png)
- [Canvas drawing](./assets/modern-workspace/02-canvas-drawing.png)
- [Stroke review](./assets/modern-workspace/03-stroke-review.png)
- [Export status](./assets/modern-workspace/04-export-status.png)

Screen recording of the executing prototype:

- [Modern workspace prototype recording](./assets/modern-workspace/modern-workspace-prototype.mp4)

## Follow-Up Prototype Areas

- Replace the workflow labels with clickable navigation when the control panel and canvas are combined.
- Add project status text after creating or opening a project.
- Add a preview/status strip near the stroke manager entry point.
- If maintainers prefer a full modernization stack, port the approved workflow into the selected desktop shell instead of expanding Swing further.

## Validation

Compile and run the focused helper test:

```bash
./scripts/test.sh
```

Package the review artifact:

```bash
./scripts/package.sh
```
