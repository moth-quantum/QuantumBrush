import { EFFECT_REGISTRY } from './src/effects/registry.js';
async function test() {
    console.log("Loading modules...");
    let ac = await EFFECT_REGISTRY.acrylic.importModule();
    console.log(Object.keys(ac));
}
test().catch(console.error);
