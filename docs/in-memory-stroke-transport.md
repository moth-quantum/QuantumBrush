# In-memory stroke transport

This change removes the per-stroke image files from the Java/Python effect path.
Instead of saving a stroke input PNG and later reading a stroke output PNG, Java
sends the canvas image to Python through stdin and receives the processed result
through stdout.

The transport is a small length-prefixed binary protocol:

```text
Java -> Python stdin:
[4-byte JSON length][JSON instructions][4-byte PNG length][PNG bytes]

Python -> Java stdout:
[4-byte JSON length][JSON response][4-byte PNG length][PNG bytes]
```

`stdout` is reserved for the binary response. Logs and debug output are routed to
`stderr`, so debug prints cannot corrupt the image response.

```mermaid
flowchart LR
    A["Java canvas PImage"] --> B["Encode PNG bytes in memory"]
    B --> C["stdin: JSON instructions + PNG bytes"]
    C --> D["Python apply_effect.py --stdio"]
    D --> E["Run brush/effect in memory"]
    E --> F["stdout: response JSON + result PNG bytes"]
    F --> G["Java decodes result into PImage"]
    G --> H["Apply result to canvas"]
```

The persistent stroke JSON stays lightweight and still stores the brush, user
parameters, and path data. Legacy file-based stroke outputs remain supported as a
fallback for older projects.
