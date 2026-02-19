/**
 * Mock backend — simulates pywebview API responses for browser dev.
 * Returns realistic fake data so the UI can be developed without Python running.
 */

// Sample transparent 1x1 PNG (base64) for placeholder result
const TRANSPARENT_1PX =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// A colored 400x400 transparent-bg PNG blob as fake effect output
function makeFakeEffectResult(w = 400, h = 400) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    // draw a semi-transparent purple blob
    ctx.beginPath()
    const cx = w / 2 + (Math.random() - 0.5) * 80
    const cy = h / 2 + (Math.random() - 0.5) * 80
    ctx.arc(cx, cy, w * 0.18 + Math.random() * 40, 0, Math.PI * 2)
    ctx.fillStyle = `hsla(${260 + Math.random() * 80}, 80%, 65%, 0.55)`
    ctx.fill()
    // glow ring
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.22 + Math.random() * 40, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(280, 90%, 70%, 0.3)`
    ctx.lineWidth = 12
    ctx.stroke()
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
}

const MOCK_EFFECTS = [
    {
        id: 'acrylic',
        name: 'Basic',
        author: 'MOTH',
        version: '1.0.0',
        description: 'The Basic brush paints a consistent, uniform color across the canvas.',
        user_input: {
            Radius: { type: 'int', min: 0, max: 100, default: 20 },
            Alpha: { type: 'float', min: 0.0, max: 1.0, default: 1.0 },
            Color: { type: 'color', default: '#FF0000' },
            'Blur Edges': { type: 'bool', default: true },
        },
    },
    {
        id: 'heisenbrush',
        name: 'Heisenbrush',
        author: 'Arianna',
        version: '1.0.0',
        description:
            'Simulates color shifts through the Heisenberg spin model. Each stroke evolves a quantum state that transforms Hue, Lightness, and Saturation.',
        user_input: {
            Radius: { type: 'int', min: 1, max: 100, default: 5 },
            Strength: { type: 'float', min: 0.0, max: 1.0, default: 0.5 },
            Color: { type: 'color', default: '#FF0000' },
        },
    },
    {
        id: 'qdrop',
        name: 'Q-Drop',
        author: 'QuantumBrush Team',
        version: '1.0.0',
        description: 'Creates quantum interference droplets along the stroke path.',
        user_input: {
            Size: { type: 'int', min: 2, max: 80, default: 15 },
            Density: { type: 'float', min: 0.1, max: 1.0, default: 0.4 },
            Color: { type: 'color', default: '#00CCFF' },
            Glow: { type: 'bool', default: false },
        },
    },
    {
        id: 'damping',
        name: 'Quantum Damping',
        author: 'QuantumBrush Team',
        version: '1.0.0',
        description: 'Applies a damping quantum field effect along the stroke.',
        user_input: {
            Radius: { type: 'int', min: 1, max: 60, default: 10 },
            Decay: { type: 'float', min: 0.0, max: 1.0, default: 0.6 },
            Color: { type: 'color', default: '#44FF88' },
        },
    },
]

// Persistent job state
const jobs = {}
let jobCounter = 0

export async function list_effects() {
    await delay(80)
    return MOCK_EFFECTS
}

export async function open_image_dialog() {
    // In browser, we can't open a native dialog, so we return null
    // The UI handles the null case gracefully and falls back to the drag-drop
    return null
}

export async function run_effect(effectId, strokeInput, userInput) {
    await delay(60)
    const jobId = `job_${++jobCounter}`
    jobs[jobId] = { status: 'running', progress: 0, result: null }

    // Simulate processing time: 3–5 seconds
    const duration = 3000 + Math.random() * 2000
    const start = Date.now()

    const tick = setInterval(() => {
        const elapsed = Date.now() - start
        const pct = Math.min(elapsed / duration, 0.99)
        if (jobs[jobId]) jobs[jobId].progress = pct
    }, 200)

    setTimeout(() => {
        clearInterval(tick)
        if (jobs[jobId] && jobs[jobId].status === 'running') {
            jobs[jobId].status = 'done'
            jobs[jobId].progress = 1
            jobs[jobId].result = makeFakeEffectResult()
        }
    }, duration)

    return { job_id: jobId }
}

export async function get_job_status(jobId) {
    await delay(30)
    const job = jobs[jobId]
    if (!job) return { status: 'error', progress: 0, result: null }
    return { status: job.status, progress: job.progress, result: job.result }
}

export async function abort_job(jobId) {
    await delay(30)
    if (jobs[jobId]) {
        jobs[jobId].status = 'aborted'
    }
    return { ok: true }
}

export async function export_image(mergedBase64) {
    await delay(50)
    // In browser, trigger a download
    const link = document.createElement('a')
    link.href = `data:image/png;base64,${mergedBase64}`
    link.download = `quantumbrush_export_${Date.now()}.png`
    link.click()
    return { ok: true }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
