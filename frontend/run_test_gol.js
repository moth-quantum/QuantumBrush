import { EFFECT_REGISTRY } from './src/effects/registry.js';
async function test() {
    let module = await EFFECT_REGISTRY.GoL.importModule();
    console.log("Loaded GoL");
}
test();
