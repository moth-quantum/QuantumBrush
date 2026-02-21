import EFFECT_REGISTRY from '../effects/registry.js';

const jobs = {};
let jobCounter = 0;

const worker = new Worker(new URL('./jsBackendWorker.js', import.meta.url), { type: 'module' });

worker.onerror = (err) => {
    console.error("Worker error:", err);
};

worker.onmessage = (e) => {
    const { jobId, type, payload } = e.data;
    console.log(`[jsBridge] Received from worker for ${jobId}: ${type}`);
    if (jobs[jobId]) {
        if (type === 'progress') jobs[jobId].progress = payload;
        if (type === 'done') {
            const canvas = document.createElement('canvas');
            canvas.width = payload.width;
            canvas.height = payload.height;
            const ctx = canvas.getContext('2d');
            const newImgData = new ImageData(new Uint8ClampedArray(payload.data), payload.width, payload.height);
            ctx.putImageData(newImgData, 0, 0);
            const b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

            jobs[jobId].status = 'done';
            jobs[jobId].progress = 1;
            jobs[jobId].result = b64;
        }
        if (type === 'error') {
            jobs[jobId].status = 'error';
            jobs[jobId].result = payload;
        }
    }
};

export async function list_effects() {
    return Object.values(EFFECT_REGISTRY).map(e => e.config);
}

export async function open_image_dialog() {
    return null;
}

export async function run_effect(effectId, strokeInput, userInput) {
    const jobId = `job_${++jobCounter}`;
    jobs[jobId] = { status: 'running', progress: 0, result: null };

    // Decode image_b64
    const img = new Image();
    img.src = `data:image/png;base64,${strokeInput.image_b64}`;
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);

    console.log(`[jsBridge] Sending job ${jobId} to worker with effect ${effectId}`);
    // Send to worker
    worker.postMessage({
        type: 'run',
        jobId,
        effectId,
        strokeInput: { ...strokeInput, image_b64: null, width: img.width, height: img.height },
        userInput,
        imageData: imgData.data.buffer,
        width: img.width,
        height: img.height
    });

    return { job_id: jobId };
}

export async function get_job_status(jobId) {
    const job = jobs[jobId];
    if (!job) return { status: 'error', progress: 0, result: null };
    return { status: job.status, progress: job.progress, result: job.result };
}

export async function abort_job(jobId) {
    if (jobs[jobId]) jobs[jobId].status = 'aborted';
    worker.postMessage({ type: 'abort', jobId });
    return { ok: true };
}

export async function export_image(mergedBase64) {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${mergedBase64}`;
    link.download = `quantumbrush_export_${Date.now()}.png`;
    link.click();
    return { ok: true };
}
