import QuantumCircuit from 'quantum-circuit';
import * as utils from '../../utils/imageUtils.js';

/**
 * Simplified Decoherence effect:
 * Computes a quantum decoherence factor for the average pixel of a patch
 * and applies that factor to the entire patch.
 */

const T1_VALUES = [
    0.0002517, // R
    0.0003629, // G
    0.0003598  // B
];

/**
 * Computes a retention factor for a color channel using a quantum circuit.
 * @param {number} val - Average color value [0, 1]
 * @param {number} intensity - User decoherence intensity
 * @param {number} channelIdx - R=0, G=1, B=2
 */
function getDecoherenceFactor(val, intensity, channelIdx) {
    if (val <= 0.001) return 1.0;

    // Use two qubits for Amplitude Damping (monotonic decay)
    const qc = new QuantumCircuit(2);

    // 1. Encode value into qubit 0 (System)
    const theta_in = 2 * Math.asin(Math.sqrt(val));
    qc.addGate("ry", 0, 0, { params: { theta: theta_in } });

    // 2. Amplitude Damping (Decoherence)
    if (intensity > 0) {
        // Calculate decay parameter gamma = 1 - exp(-t/T1)
        // Adjust scale factor to make the 1-20 slider range meaningful
        const t1 = T1_VALUES[channelIdx] || 0.0003;
        const scale = 0.00005;
        const gamma = 1.0 - Math.exp(-(intensity * scale) / t1);

        // theta_noise = 2 * arcsin(sqrt(gamma))
        const theta_noise = 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, gamma))));

        // Controlled RY from system (0) to ancilla (1)
        // Decomposition of CRY:
        qc.addGate("ry", 1, 1, { params: { theta: theta_noise / 2 } });
        qc.addGate("cx", 2, [0, 1]);
        qc.addGate("ry", 3, 1, { params: { theta: -theta_noise / 2 } });
        qc.addGate("cx", 4, [0, 1]);

        // CX from ancilla (1) back to system (0)
        qc.addGate("cx", 5, [1, 0]);
    }

    qc.run();

    // 3. Extract the probability of system qubit (q0) being in state |1>
    // In a 2-qubit system (q1, q0), state |1> corresponds to indices 1 (|01>) and 3 (|11>)
    let prob1 = 0;
    const s1 = qc.state[1];
    const s3 = qc.state[3];
    if (s1) prob1 += (s1.re * s1.re + s1.im * s1.im);
    if (s3) prob1 += (s3.re * s3.re + s3.im * s3.im);

    return Math.max(0, Math.min(1.0, prob1 / val));
}

export async function run(params, reportProgress) {
    const image = params.stroke_input.image_rgba;
    const transparentLayer = {
        width: image.width,
        height: image.height,
        data: new Uint8ClampedArray(image.width * image.height * 4),
    };
    const path = params.stroke_input.path;
    const radius = params.user_input.Radius;
    const intensity = params.user_input.Decoherence;

    const border = [image.height, image.width];
    const numSteps = path.length;

    if (reportProgress) reportProgress(0.1);

    for (let i = 0; i < numSteps; i++) {
        if (i % 5 === 0 && reportProgress) {
            reportProgress(0.1 + 0.9 * (i / numSteps));
        }

        const point = [path[i]];
        const region = utils.pointsWithinRadius(point, radius, border);
        if (region.length === 0) continue;

        const patch = utils.getPatch(image, region);

        // Calculate average color for the patch
        let sumR = 0, sumG = 0, sumB = 0;
        for (let k = 0; k < region.length; k++) {
            sumR += patch[k * 4];
            sumG += patch[k * 4 + 1];
            sumB += patch[k * 4 + 2];
        }
        const avgR = sumR / region.length;
        const avgG = sumG / region.length;
        const avgB = sumB / region.length;

        // Compute the quantum decoherence factor based on the average
        const factorR = getDecoherenceFactor(avgR, intensity, 0);
        const factorG = getDecoherenceFactor(avgG, intensity, 1);
        const factorB = getDecoherenceFactor(avgB, intensity, 2);

        const newPatch = new Float32Array(region.length * 4);
        for (let k = 0; k < region.length; k++) {
            newPatch[k * 4] = patch[k * 4] * factorR;
            newPatch[k * 4 + 1] = patch[k * 4 + 1] * factorG;
            newPatch[k * 4 + 2] = patch[k * 4 + 2] * factorB;
            newPatch[k * 4 + 3] = patch[k * 4 + 3]; // Preserve alpha
        }

        utils.setPatch(transparentLayer, region, newPatch);
    }

    if (reportProgress) reportProgress(1.0);
    return transparentLayer;
}
