import * as utils from '../../utils/imageUtils.js';
import { SVD } from 'ml-matrix';
import QuantumCircuit from 'quantum-circuit';
import * as quantum from '../../utils/quantumUtils.js';

function ua_cloning(initial_angles, s0 = 2 / 3) {
    let theta = initial_angles[0];
    let phi = initial_angles[1];

    let s1 = 0.5 * (Math.sqrt(-3 * s0 * s0 + 2 * s0 + 1) - s0 + 1);
    s1 = Math.max(0, Math.min(1, s1));
    let amps = [Math.sqrt((s0 + s1) / 2), Math.sqrt((1 - s0) / 2), 0, Math.sqrt((1 - s1) / 2)];
    let norm = Math.sqrt(amps[0] * amps[0] + amps[1] * amps[1] + amps[2] * amps[2] + amps[3] * amps[3]);
    for (let i = 0; i < 4; i++) amps[i] /= norm;

    let qc = new QuantumCircuit();
    let col = 0;

    qc.addGate("ry", col, 0, { params: { theta: theta } });
    qc.addGate("rz", col + 1, 0, { params: { phi: phi, theta: phi, lambda: phi } });
    col += 2;

    let theta_1 = 2 * Math.acos(amps[0]);
    let theta_2 = 2 * Math.atan2(amps[3], amps[1]);

    qc.addGate("ry", col, 2, { params: { theta: theta_1 } });
    qc.addGate("cry", col + 1, [2, 1], { params: { theta: theta_2, phi: theta_2, lambda: theta_2 } });
    col += 2;

    qc.addGate("cx", col++, [1, 0]);
    qc.addGate("cx", col++, [2, 0]);
    qc.addGate("cx", col++, [0, 1]);
    qc.addGate("cx", col++, [0, 2]);

    console.log("Quantum Circuit [clone]:\n" + qc.exportQASM(""));

    let ops = [];
    for (let i of [0, 2]) {
        for (let p of ['X', 'Y', 'Z']) {
            let opStr = 'I'.repeat(3 - i - 1) + p + 'I'.repeat(i);
            ops.push(opStr);
        }
    }

    let obs = quantum.run_estimator(qc, ops);
    return [obs.slice(0, 3), obs.slice(3, 6)];
}

export async function run(params, reportProgress) {
    let image = params.stroke_input.image_rgba;
    // DO NOT MUTATE THE BASE IMAGE. We want to return a transparent layer.
    let transparentLayer = {
        width: image.width,
        height: image.height,
        data: new Uint8ClampedArray(image.width * image.height * 4),
    };

    let height = image.height;
    let width = image.width;
    let clicks = params.stroke_input.clicks;

    let offset = [clicks[1][0] - clicks[0][0], clicks[1][1] - clicks[0][1]];
    let path = params.stroke_input.path;

    // Filter out the second stroke entirely, relying only on the first source lasso.
    // The DrawingLayer appends the duplicated translated path to act as visual confirmation, but we only care about the source selection for `path`. We split it by looking where the gap is.
    let split_idx = path.length;
    for (let i = 1; i < path.length; i++) {
        const dx = Math.abs(path[i][0] - path[i - 1][0]);
        const dy = Math.abs(path[i][1] - path[i - 1][1]);
        if (dx > 100 || dy > 100) {  // heuristic for a jump to the second paste path
            split_idx = i;
            break;
        }
    }
    path = path.slice(0, split_idx);

    let copy_region = utils.pointsWithinLasso(path, [height, width]);

    // get matrix of 3 channels [N, 3] from copy_region
    let copy_patch = utils.getPatch(image, copy_region); // len N*4
    let N = copy_region.length;
    let matrix_m = [];
    for (let i = 0; i < N; i++) {
        matrix_m.push([copy_patch[i * 4], copy_patch[i * 4 + 1], copy_patch[i * 4 + 2]]);
    }

    if (reportProgress) reportProgress(0.2);
    // SVD with ml-matrix.
    // Equivalent to svd(matrix, full_matrices=False)
    // ml-matrix SVD handles it automatically.
    const { SVD } = await import('ml-matrix');
    let svd = new SVD(matrix_m, { autoTranspose: true });

    let U = svd.leftSingularVectors; // [N, K]
    let V = svd.rightSingularVectors; // [3, K]
    let S_diag = svd.diagonal; // [K] (at most 3)

    let S_sorted = Array.from(S_diag).sort((a, b) => b - a);

    let x = Math.log(S_sorted[0] || Number.EPSILON);
    let y = Math.log(S_sorted[1] || Number.EPSILON);
    let z = Math.log(S_sorted[2] || Number.EPSILON);

    let mean_S = (S_sorted[0] + S_sorted[1] + (S_sorted[2] || 0)) / S_sorted.length;

    let phi = Math.atan2(y, x);
    let theta = Math.atan2(Math.sqrt(x * x + y * y), z);
    let r = Math.sqrt(x * x + y * y + z * z);

    let [copy_coord, paste_coord] = ua_cloning([theta, phi], params.user_input.Strength);
    if (reportProgress) reportProgress(0.4);

    let copy_r = Math.sqrt(copy_coord[0] * copy_coord[0] + copy_coord[1] * copy_coord[1] + copy_coord[2] * copy_coord[2]);
    let paste_r = Math.sqrt(paste_coord[0] * paste_coord[0] + paste_coord[1] * paste_coord[1] + paste_coord[2] * paste_coord[2]);

    if (copy_r < 1e-10) {
        copy_coord = [mean_S, mean_S, mean_S];
    } else {
        copy_coord = [
            copy_r * Math.exp(copy_coord[0] * r / copy_r) + (1 - copy_r) * mean_S,
            copy_r * Math.exp(copy_coord[1] * r / copy_r) + (1 - copy_r) * mean_S,
            copy_r * Math.exp(copy_coord[2] * r / copy_r) + (1 - copy_r) * mean_S,
        ];
    }

    if (paste_r < 1e-10) {
        paste_coord = [mean_S, mean_S, mean_S];
    } else {
        paste_coord = [
            paste_r * Math.exp(paste_coord[0] * r / paste_r) + (1 - paste_r) * mean_S,
            paste_r * Math.exp(paste_coord[1] * r / paste_r) + (1 - paste_r) * mean_S,
            paste_r * Math.exp(paste_coord[2] * r / paste_r) + (1 - paste_r) * mean_S,
        ];
    }

    if (reportProgress) reportProgress(0.6);
    // reconstruct U * diag(S) * Vt
    const { Matrix } = await import('ml-matrix');
    let Um = new Matrix(U);
    let Vm = new Matrix(V).transpose(); // Vt
    let Scopy = Matrix.diag(copy_coord);
    let Spaste = Matrix.diag(paste_coord);

    let copy_selectionM = Um.mmul(Scopy).mmul(Vm);
    let paste_selectionM = Um.mmul(Spaste).mmul(Vm);

    if (reportProgress) reportProgress(0.8);

    // put back to copy_patch
    for (let i = 0; i < N; i++) {
        if (reportProgress && i % 1000 === 0) reportProgress(0.8 + 0.1 * (i / N));
        copy_patch[i * 4] = Math.max(0, Math.min(1, copy_selectionM.get(i, 0)));
        copy_patch[i * 4 + 1] = Math.max(0, Math.min(1, copy_selectionM.get(i, 1)));
        copy_patch[i * 4 + 2] = Math.max(0, Math.min(1, copy_selectionM.get(i, 2)));
    }
    // DO NOT MUTATE THE BASE IMAGE! utils.setPatch(image, copy_region, copy_patch);

    let paste_path = path.map(p => [p[0] + offset[0], p[1] + offset[1]]);
    let paste_region = utils.pointsWithinLasso(paste_path, [height, width]);
    let paste_patch = utils.getPatch(image, paste_region);

    let limit = Math.min(N, paste_region.length);
    for (let i = 0; i < limit; i++) {
        if (reportProgress && i % 1000 === 0) reportProgress(0.9 + 0.1 * (i / limit));
        paste_patch[i * 4] = Math.max(0, Math.min(1, paste_selectionM.get(i, 0)));
        paste_patch[i * 4 + 1] = Math.max(0, Math.min(1, paste_selectionM.get(i, 1)));
        paste_patch[i * 4 + 2] = Math.max(0, Math.min(1, paste_selectionM.get(i, 2)));
        // preserve orig alpha or set to 1? usually preserve since getPatch gets it
    }

    // copy back to base image isn't needed; we are constructing a standalone transparent pane.
    // Instead of utils.setPatch(image, ...), we just set it into `transparentLayer`.
    utils.setPatch(transparentLayer, paste_region.slice(0, Math.min(N, limit)), paste_patch);

    if (reportProgress) reportProgress(1.0);
    return transparentLayer;
}
