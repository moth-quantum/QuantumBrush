# Modern Workspace Prototype

This note records the first source-branch prototype for the UnitaryHACK design request in issue #51. It keeps the existing Java, Processing, and Swing stack and improves the current control panel instead of replacing the app with a separate desktop framework.

## Current Workflow

The active source branch already has the main workflow split across the app:

- `QuantumBrush.java`: canvas and control windows, project actions, image import/export, undo/redo, zoom, and pan.
- `UIManager.java`: effect selection, parameter controls, hardware configuration, and the stroke manager entry point.
- `CanvasManager.java`: path, dot, and constrained-line drawing behavior.
- `FileManager.java`: project metadata, image data, stroke data, save, and export.

## Prototype Change

The control panel now starts with a compact workspace header:

```text
Quantum Brush workspace
Follow the core flow: Project -> Canvas -> Effect -> Stroke -> Export

[1 Project] [2 Canvas] [3 Effect] [4 Stroke] [5 Export]
```

This gives first-time users a clear project-to-export mental model before they choose effects or hardware options. The change is intentionally small so it can be reviewed against the existing app structure and expanded later into a full prototype or visual design file.

## Follow-Up Prototype Areas

- Replace the workflow labels with clickable navigation when the control panel and canvas are combined.
- Add project status text after creating or opening a project.
- Add a preview/status strip near the stroke manager entry point.
- Prepare screenshot and recording assets once the maintainer confirms this incremental direction is useful.

## Validation

Compile and run the focused helper test:

```bash
javac -cp lib/core-4.4.1.jar:src -d /tmp/quantumbrush-test src/*.java test/ModernWorkspacePanelTest.java
java -cp /tmp/quantumbrush-test:lib/core-4.4.1.jar ModernWorkspacePanelTest
```

Compile the app source:

```bash
javac -cp lib/core-4.4.1.jar -d /tmp/quantumbrush-compile-check src/*.java
```
