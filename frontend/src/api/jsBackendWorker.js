import EFFECT_REGISTRY from '../effects/registry.js';
console.log("[jsBackendWorker] Worker script is executing! Registry loaded.");

// Polyfill window for quantum-circuit dependencies (like mathjs/seed-random)
// which incorrectly assume they are either in Node or a Browser window.
if (typeof window === 'undefined') {
    self.window = self;
}

self.onmessage = async (e) => {
    const { type, jobId, effectId, strokeInput, userInput, imageData, width, height } = e.data;
    console.log(`[jsBackendWorker] Received msg: ${type} for ${jobId}, effect: ${effectId}`);
    if (type === 'run') {
        try {
            console.log(`[jsBackendWorker] Starting to run ${effectId} (job: ${jobId})`);
            const effect = EFFECT_REGISTRY[effectId];
            if (!effect) throw new Error(`Effect ${effectId} not found`);

            const params = {
                stroke_input: {
                    ...strokeInput,
                    image_rgba: {
                        data: new Uint8ClampedArray(imageData),
                        width,
                        height
                    }
                },
                user_input: userInput,
                effect_id: effectId,
                jobId: jobId
            };

            console.log(`[jsBackendWorker] Running effect module run function...`);
            const loadedModule = await effect.importModule();
            const resultImage = await loadedModule.run(params, (progress) => {
                self.postMessage({ jobId, type: 'progress', payload: progress });
            });
            console.log(`[jsBackendWorker] Effect module returned!`);

            if (!resultImage) {
                throw new Error("Effect returned null");
            }

            self.postMessage({
                jobId,
                type: 'done',
                payload: {
                    data: resultImage.data.buffer,
                    width: resultImage.width,
                    height: resultImage.height
                }
            }, [resultImage.data.buffer]);

        } catch (err) {
            console.error(err);
            self.postMessage({ jobId, type: 'error', payload: err.toString() });
        }
    }
};
