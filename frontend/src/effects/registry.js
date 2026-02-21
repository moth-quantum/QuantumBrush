import acrylicConfig from './acrylic/acrylic_requirements.json';
import heisenbrushConfig from './heisenbrush/heisenbrush_requirements.json';
import heisenbrush2Config from './heisenbrush2/heisenbrush2_requirements.json';
import qdropConfig from './qdrop/qdrop_requirements.json';
import dampingConfig from './damping/damping_requirements.json';
import cloneConfig from './clone/clone_requirements.json';
import GoLConfig from './GoL/GoL_requirements.json';

export const EFFECT_REGISTRY = {
    acrylic: { config: acrylicConfig, importModule: () => import('./acrylic/acrylic.js') },
    heisenbrush: { config: heisenbrushConfig, importModule: () => import('./heisenbrush/heisenbrush.js') },
    heisenbrush2: { config: heisenbrush2Config, importModule: () => import('./heisenbrush2/heisenbrush2.js') },
    qdrop: { config: qdropConfig, importModule: () => import('./qdrop/qdrop.js') },
    damping: { config: dampingConfig, importModule: () => import('./damping/damping.js') },
    clone: { config: cloneConfig, importModule: () => import('./clone/clone.js') },
    GoL: { config: GoLConfig, importModule: () => import('./GoL/GoL.js') }
};
export default EFFECT_REGISTRY;
