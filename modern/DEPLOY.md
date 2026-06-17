# Deploy Quantum Brush

## Vercel (frontend only)

Vercel hosts **static React UI**. Quantum Python brushes **cannot** run on Vercel serverless.

### 1. Deploy UI to Vercel

- **Root directory:** `modern`
- **Build command:** `npm run build`
- **Output:** `dist`
- `vercel.json` included (SPA rewrites)

### 2. Deploy Python API (required)

Use Render, Railway, Fly.io, or any VPS:

```bash
# From repo root — Docker build context is repo root
docker build -f modern/Dockerfile.api -t quantum-brush-api .
docker run -p 8787:8787 quantum-brush-api
```

Or on Render: Web Service, Docker, path `modern/Dockerfile.api`, port `8787`.

### 3. Connect frontend → API

In **Vercel → Settings → Environment Variables**:

```
VITE_API_URL=https://your-api.onrender.com
```

Redeploy Vercel after setting. No trailing slash.

### 4. Verify

- `https://your-api.onrender.com/api/health` → `{"ok":true}`
- Vercel site loads brushes in Control Panel dropdown

## Local dev

```bash
./scripts/setup-python.sh
export QUANTUMBRUSH_ROOT="$(pwd)"
cd modern && npm run dev:web
```

## Bugs fixed for production

- `VITE_API_URL` for cross-origin API
- `/api/health` endpoint
- Konva `Group` (was invalid HTML `<g>`)
- Canvas path race (`addPath` not stale closure)
- `ResizeObserver` for canvas sizing
- CORS on Python API (`*`)
