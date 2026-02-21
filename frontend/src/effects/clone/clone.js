import * as utils from '../../utils/imageUtils.js';
import { SVD } from 'ml-matrix';

function evalPauli(p, i, num_qubits, psi_re, psi_im) {
    let expect = 0;
    for (let k = 0; k < 8; k++) {
        let k_prime = k;
        let phase_re = 1;
        let phase_im = 0;

        let bit = (k >> i) & 1;
        if (p === 'X') {
            k_prime ^= (1 << i);
        } else if (p === 'Y') {
            k_prime ^= (1 << i);
            if (bit === 0) {
                phase_re = 0; phase_im = 1;
            } else {
                phase_re = 0; phase_im = -1;
            }
        } else if (p === 'Z') {
            if (bit === 1) {
                phase_re = -1;
            }
        }

        let c_re = psi_re[k_prime];
        let c_im = psi_im[k_prime];
        let bcr = phase_re * c_re - phase_im * c_im;
        let bci = phase_re * c_im + phase_im * c_re;
        expect += psi_re[k] * bcr + psi_im[k] * bci;
    }
    return expect;
}

function ua_cloning(initial_angles, s0 = 2 / 3) {
    let theta = initial_angles[0];
    let phi = initial_angles[1];

    let s1 = 0.5 * (Math.sqrt(-3 * s0 * s0 + 2 * s0 + 1) - s0 + 1);
    s1 = Math.max(0, Math.min(1, s1));
    let amps = [Math.sqrt((s0 + s1) / 2), Math.sqrt((1 - s0) / 2), 0, Math.sqrt((1 - s1) / 2)];
    let norm = Math.sqrt(amps[0] * amps[0] + amps[1] * amps[1] + amps[2] * amps[2] + amps[3] * amps[3]);
    for (let i = 0; i < 4; i++) amps[i] /= norm;

    let alpha = Math.cos(theta / 2);
    let beta_re = Math.cos(phi) * Math.sin(theta / 2);
    let beta_im = Math.sin(phi) * Math.sin(theta / 2);

    let psi_re = new Float64Array(8).fill(0);
    let psi_im = new Float64Array(8).fill(0);

    for (let q2 = 0; q2 <= 1; q2++) {
        for (let q1 = 0; q1 <= 1; q1++) {
            for (let q0 = 0; q0 <= 1; q0++) {
                let idx = q2 * 4 + q1 * 2 + q0;
                let a = amps[q2 * 2 + q1];
                if (q0 === 0) {
                    psi_re[idx] = a * alpha;
                } else {
                    psi_re[idx] = a * beta_re;
                    psi_im[idx] = a * beta_im;
                }
            }
        }
    }

    let next_re = new Float64Array(8); let next_im = new Float64Array(8);
    // CNOT(1, 0)
    for (let k = 0; k < 8; k++) {
        let q1 = (k >> 1) & 1;
        let k_new = q1 ? k ^ 1 : k;
        next_re[k_new] = psi_re[k]; next_im[k_new] = psi_im[k];
    }
    psi_re.set(next_re); psi_im.set(next_im);

    // CNOT(2, 0)
    for (let k = 0; k < 8; k++) {
        let q2 = (k >> 2) & 1;
        let k_new = q2 ? k ^ 1 : k;
        next_re[k_new] = psi_re[k]; next_im[k_new] = psi_im[k];
    }
    psi_re.set(next_re); psi_im.set(next_im);

    // CNOT(0, 1)
    for (let k = 0; k < 8; k++) {
        let q0 = k & 1;
        let k_new = q0 ? k ^ 2 : k;
        next_re[k_new] = psi_re[k]; next_im[k_new] = psi_im[k];
    }
    psi_re.set(next_re); psi_im.set(next_im);

    // CNOT(0, 2)
    for (let k = 0; k < 8; k++) {
        let q0 = k & 1;
        let k_new = q0 ? k ^ 4 : k;
        next_re[k_new] = psi_re[k]; next_im[k_new] = psi_im[k];
    }
    psi_re.set(next_re); psi_im.set(next_im);

    let obs = [];
    for (let i of [0, 2]) {
        for (let p of ['X', 'Y', 'Z']) {
            obs.push(evalPauli(p, i, 3, psi_re, psi_im));
        }
    }
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
