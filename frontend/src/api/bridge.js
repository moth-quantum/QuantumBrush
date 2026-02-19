/**
 * API bridge — detects whether running inside pywebview or in a plain browser.
 * In browser dev mode, automatically uses the mock backend.
 */

import * as mock from './mockBridge.js'

// State for pywebview readiness
let isPywebviewReady = false;
let pendingCalls = [];

window.addEventListener('pywebviewready', function () {
    console.log("readyyyyy")
    testApiConnection();
})

export const isPywebview = () => {
    // Check for pywebview global object (not window.pywebview as per docs)
    return true
};

async function testApiConnection() {
    console.log('Testing API connection...');

    if (!isPywebview()) {
        console.log('✗ Not in pywebview environment');
        return false;
    }

    if (!isPywebviewReady) {
        console.log('⏳ pywebview not ready yet');
        return false;
    }

    console.log('✓ pywebview object exists');
    console.log('pywebview keys:', Object.keys(pywebview));

    if (pywebview.api) {
        console.log('✓ api object exists');
        console.log('Available methods:', Object.keys(pywebview.api));

        try {
            const effects = await pywebview.api.list_effects();
            console.log('✓ list_effects returned:', effects);
            return true;
        } catch (err) {
            console.error('✗ list_effects failed:', err);
            return false;
        }
    } else {
        console.log('✗ api object is undefined');
        return false;
    }
}

async function callApi(method, ...args) {
    // If not in pywebview, use mock immediately
    if (!isPywebview()) {
        console.log(`[mock] ${method}`, args);
        return await mock[method](...args);
    }

    // In pywebview but not ready yet - queue the call
    if (!isPywebviewReady) {
        console.log(`⏳ Queueing ${method} until pywebview is ready`);
        return new Promise((resolve, reject) => {
            pendingCalls.push({ method, args, resolve, reject });
        });
    }

    // Pywebview is ready - call directly
    console.log(`[pywebview] ${method}`, args);
    try {
        const result = await pywebview.api[method](...args);
        console.log(`✓ ${method} result:`, result);
        return result;
    } catch (err) {
        console.error(`✗ ${method} failed:`, err);
        throw err;
    }
}

export const api = {
    listEffects: () => callApi('list_effects'),
    openImageDialog: () => callApi('open_image_dialog'),
    runEffect: (effectId, strokeInput, userInput) =>
        callApi('run_effect', effectId, strokeInput, userInput),
    getJobStatus: (jobId) => callApi('get_job_status', jobId),
    abortJob: (jobId) => callApi('abort_job', jobId),
    exportImage: (mergedBase64) => callApi('export_image', mergedBase64),
};

window.addEventListener('pywebviewready', function () {
    console.log('✓ pywebviewready event fired!');
    console.log('pywebview object:', pywebview);
    console.log('API methods:', Object.keys(pywebview.api));

    testApiConnection();

    isPywebviewReady = true;

    // CONSUMER: Process all pending calls
    console.log(`Processing ${pendingCalls.length} pending calls...`);
    pendingCalls.forEach(({ method, args, resolve, reject }) => {
        pywebview.api[method](...args)
            .then(result => {
                console.log(`✓ Queued call ${method} succeeded:`, result);
                resolve(result);
            })
            .catch(err => {
                console.error(`✗ Queued call ${method} failed:`, err);
                reject(err);
            });
    });
    pendingCalls = []; // Clear the queue
});