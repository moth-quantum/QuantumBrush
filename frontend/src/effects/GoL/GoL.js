import QuantumCircuit from 'quantum-circuit';
import * as utils from '../../utils/imageUtils.js';
import * as colors from '../../utils/colorUtils.js';

const MAPPING_TYPES = ['hsv', 'hvs', 'shv', 'svh', 'vhs', 'vsh'];

function hsv_to_statevector(hsv_arr, mapping) {
    let hsv = { h: hsv_arr[0], s: hsv_arr[1], v: hsv_arr[2] };
    let phi = hsv[mapping[0]] * 2 * Math.PI;
    let theta = hsv[mapping[1]] * Math.PI;

    let alpha = Math.cos(theta / 2);
    let beta_re = Math.cos(phi) * Math.sin(theta / 2);
    let beta_im = Math.sin(phi) * Math.sin(theta / 2);

    return [{ re: alpha, im: 0 }, { re: beta_re, im: beta_im }, hsv[mapping[2]]];
}

function statevector_to_hsv(state, semiclassical, mapping) {
    let alpha_re = state[0].re;
    let beta_re = state[1].re;
    let beta_im = state[1].im;

    let theta = 2 * Math.acos(Math.max(0, Math.min(1, Math.abs(alpha_re))));
    let phi = 0;
    if (Math.abs(beta_re) > 1e-9 || Math.abs(beta_im) > 1e-9) {
        phi = Math.atan2(beta_im, beta_re);
    }

    let h = phi / (2 * Math.PI);
    if (h < 0) h += 1;
    let v = theta / Math.PI;

    let res = [0, 0, 0];
    let mapIdx = { 'h': 0, 's': 1, 'v': 2 };
    res[mapIdx[mapping[0]]] = h;
    res[mapIdx[mapping[1]]] = Math.max(0, Math.min(1, v));
    res[mapIdx[mapping[2]]] = semiclassical;
    return res;
}

function find_closest_pure_state(rho00, rho11, rho01_re, rho01_im) {
    let a = rho00;
    let b = rho11;
    let c2 = rho01_re * rho01_re + rho01_im * rho01_im;
    let purity = a * a + b * b + 2 * c2;

    let trace = a + b;
    let det = a * b - c2;
    let discriminant = Math.max(0, trace * trace - 4 * det);
    let lambda = (trace + Math.sqrt(discriminant)) / 2;

    if (c2 < 1e-12) {
        if (a > b) return [[{ re: 1, im: 0 }, { re: 0, im: 0 }], purity];
        else return [[{ re: 0, im: 0 }, { re: 1, im: 0 }], purity];
    }

    let x_re = rho01_re, x_im = rho01_im;
    let y_re = lambda - a, y_im = 0;

    let norm = Math.sqrt(x_re * x_re + x_im * x_im + y_re * y_re + y_im * y_im);
    return [[{ re: x_re / norm, im: x_im / norm }, { re: y_re / norm, im: y_im / norm }], purity];
}

function liveliness(nhood_s) {
    let sum = 0;
    for (let i of [0, 1, 2, 3, 5, 6, 7, 8]) {
        sum += nhood_s[i][0];
    }
    return Math.abs(sum);
}

function SCGOL(nhood_s) {
    let a = liveliness(nhood_s);
    let value = nhood_s[4];
    let alive = [1.0, 0.0];
    let dead = [0.0, 1.0];

    let val_0 = value[0], val_1 = value[1];
    let sqrt2_1 = Math.SQRT2 + 1;

    let out_0, out_1;

    if (a <= 1) {
        out_0 = dead[0]; out_1 = dead[1];
    } else if (a > 1 && a <= 2) {
        let f1 = sqrt2_1 * 2 - sqrt2_1 * a;
        let f2 = a - 1;
        out_0 = f1 * dead[0] + f2 * val_0;
        out_1 = f1 * dead[1] + f2 * val_1;
    } else if (a > 2 && a <= 3) {
        let f1 = sqrt2_1 * 3 - sqrt2_1 * a;
        let f2 = a - 2;
        out_0 = f1 * val_0 + f2 * alive[0];
        out_1 = f1 * val_1 + f2 * alive[1];
    } else if (a > 3 && a < 4) {
        let f1 = sqrt2_1 * 4 - sqrt2_1 * a;
        let f2 = a - 3;
        out_0 = f1 * alive[0] + f2 * dead[0];
        out_1 = f1 * alive[1] + f2 * dead[1];
    } else {
        out_0 = dead[0]; out_1 = dead[1];
    }

    let norm = Math.sqrt(out_0 * out_0 + out_1 * out_1);
    if (norm > 0) { out_0 /= norm; out_1 /= norm; }
    return [out_0, out_1];
}

function game_of_life(nhood) {
    let qc = new QuantumCircuit(9);
    let col = 0;

    for (let i = 0; i < 9; i++) {
        let alpha_re = nhood[i][0].re;
        let beta_re = nhood[i][1].re;
        let beta_im = nhood[i][1].im;

        let theta = 2 * Math.acos(Math.max(0, Math.min(1, Math.abs(alpha_re))));
        let phi = 0;
        if (Math.abs(beta_re) > 1e-9 || Math.abs(beta_im) > 1e-9) {
            phi = Math.atan2(beta_im, beta_re);
        }

        qc.addGate("ry", col, i, { params: { theta: theta, phi: theta, lambda: theta } });
        qc.addGate("rz", col + 1, i, { params: { phi: phi, theta: phi, lambda: phi } });
    }
    col += 2;

    for (let q = 0; q < 9; q++) {
        if (q !== 4) {
            let a1 = Math.PI / 2;
            qc.addGate("crx", col++, [4, q], { params: { theta: a1, phi: a1, lambda: a1 } });
        }
        let a2 = 2 * Math.PI / (q + 1);
        qc.addGate("cry", col++, [q, (q + 1) % 9], { params: { theta: a2, phi: a2, lambda: a2 } });
        let a3 = 2 * Math.PI / (((q + 4) % 9) + 1);
        qc.addGate("crz", col++, [q, (q + 1) % 9], { params: { theta: a3, phi: a3, lambda: a3 } });
        if (q !== 4) {
            qc.addGate("cx", col++, [q, 4]);
        }
    }

    qc.run();
    let state = qc.state;

    let rho00 = 0, rho11 = 0, rho01_re = 0, rho01_im = 0;

    let psi_re = new Float64Array(512);
    let psi_im = new Float64Array(512);
    for (let k in state) {
        psi_re[k] = state[k].re;
        psi_im[k] = state[k].im;
    }

    for (let k = 0; k < 512; k++) {
        let p2 = psi_re[k] * psi_re[k] + psi_im[k] * psi_im[k];
        if ((k & 16) === 0) {
            rho00 += p2;
            let k_partner = k | 16;
            rho01_re += psi_re[k] * psi_re[k_partner] + psi_im[k] * psi_im[k_partner];
            rho01_im += psi_im[k] * psi_re[k_partner] - psi_re[k] * psi_im[k_partner];
        } else {
            rho11 += p2;
        }
    }

    return find_closest_pure_state(rho00, rho11, rho01_re, rho01_im);
}

export async function run(params, reportProgress) {
    console.log("[GoL] Entering GoL.run()");
    let image = params.stroke_input.image_rgba;
    let transparentLayer = {
        width: image.width,
        height: image.height,
        data: new Uint8ClampedArray(image.width * image.height * 4),
    };
    let map = MAPPING_TYPES[params.user_input.Mapping];
    let path = params.stroke_input.path;
    let radius = params.user_input.Radius;
    let iterations = params.user_input.Iterations;

    let height = image.height;
    let width = image.width;

    let copy_region;
    if (radius > 0) {
        copy_region = utils.pointsWithinRadius(path, radius, [height, width]);
    } else {
        copy_region = utils.pointsWithinLasso(path, [height, width]);
    }
    console.log(`[GoL] Extracted valid region. Total pixels to process per iteration: ${copy_region.length}. Total iterations: ${iterations}`);

    const extract_neighbourhoods = (y, x) => {
        let neighbours = [];
        for (let dx of [-1, 0, 1]) {
            for (let dy of [-1, 0, 1]) {
                let ny = (y + dy) % height; if (ny < 0) ny += height;
                let nx = (x + dx) % width; if (nx < 0) nx += width;
                neighbours.push([ny, nx]);
            }
        }
        return neighbours;
    };

    let image_hsv = new Float32Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
        let r = image.data[i * 4] / 255, g = image.data[i * 4 + 1] / 255, b = image.data[i * 4 + 2] / 255;
        let [h, s, v] = colors.rgbToHsv(r, g, b);
        image_hsv[i * 3] = h; image_hsv[i * 3 + 1] = s; image_hsv[i * 3 + 2] = v;
    }

    for (let it = 0; it < iterations; it++) {
        console.log(`[GoL] Starting Iteration ${it + 1} of ${iterations}`);
        let statevector_selection = new Map();
        let semiclassical = new Map();
        let after_iteration = new Map();

        console.time(`GoL-Iter-${it + 1}`);
        for (let i = 0; i < copy_region.length; i++) {
            if (i % 25 === 0 && i > 0) {
                console.log(`[GoL] Iteration ${it + 1}: Processed ${i} / ${copy_region.length} pixels...`);
                if (reportProgress) {
                    reportProgress((it + (i / copy_region.length)) / iterations);
                }
            }

            let y = copy_region[i][0], x = copy_region[i][1];
            let neighbourhood = extract_neighbourhoods(y, x);

            let nhood = [];
            let nhood_s = [];

            for (let n = 0; n < 9; n++) {
                let ny = neighbourhood[n][0], nx = neighbourhood[n][1];
                let key = `${ny},${nx}`;
                if (!statevector_selection.has(key)) {
                    let idx = (ny * width + nx) * 3;
                    let hsv_arr = [image_hsv[idx], image_hsv[idx + 1], image_hsv[idx + 2]];
                    let sv = hsv_to_statevector(hsv_arr, map);
                    statevector_selection.set(key, [sv[0], sv[1]]);
                    semiclassical.set(key, sv[2]);
                }
                nhood.push(statevector_selection.get(key));
                let sc = semiclassical.get(key);
                nhood_s.push([sc, 1 - sc]);
            }

            let [v, purity] = game_of_life(nhood);
            let new_sc = SCGOL(nhood_s)[0];
            let new_hsv = statevector_to_hsv(v, new_sc, map);
            after_iteration.set(`${y},${x}`, new_hsv);
        }

        for (let i = 0; i < copy_region.length; i++) {
            let y = copy_region[i][0], x = copy_region[i][1];
            let new_hsv = after_iteration.get(`${y},${x}`);
            let idx = (y * width + x) * 3;
            image_hsv[idx] = new_hsv[0]; image_hsv[idx + 1] = new_hsv[1]; image_hsv[idx + 2] = new_hsv[2];
        }

        console.timeEnd(`GoL-Iter-${it + 1}`);
        if (reportProgress) reportProgress((it + 1) / iterations);
    }

    for (let i = 0; i < copy_region.length; i++) {
        let y = copy_region[i][0], x = copy_region[i][1];
        let idx = (y * width + x) * 3;
        let [r, g, b] = colors.hsvToRgb(image_hsv[idx], image_hsv[idx + 1], image_hsv[idx + 2]);
        let data_idx = (y * width + x) * 4;
        transparentLayer.data[data_idx] = r * 255;
        transparentLayer.data[data_idx + 1] = g * 255;
        transparentLayer.data[data_idx + 2] = b * 255;
        transparentLayer.data[data_idx + 3] = 255;
    }
    return transparentLayer;
}
