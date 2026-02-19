/**
 * API bridge — detects whether running inside pywebview or in a plain browser.
 * In browser dev mode, automatically uses the mock backend.
 */

import * as mock from './mockBridge.js'

function isPywebview() {
    return typeof window !== 'undefined' && window.pywebview !== undefined
}

async function callApi(method, ...args) {
    if (isPywebview()) {
        return await window.pywebview.api[method](...args)
    }
    return await mock[method](...args)
}

export const api = {
    listEffects: () => callApi('list_effects'),
    openImageDialog: () => callApi('open_image_dialog'),
    runEffect: (effectId, strokeInput, userInput) =>
        callApi('run_effect', effectId, strokeInput, userInput),
    getJobStatus: (jobId) => callApi('get_job_status', jobId),
    abortJob: (jobId) => callApi('abort_job', jobId),
    exportImage: (mergedBase64) => callApi('export_image', mergedBase64),
}
