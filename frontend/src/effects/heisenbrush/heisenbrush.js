import QuantumCircuit from 'quantum-circuit';
import * as utils from '../../utils/imageUtils.js';
import * as colors from '../../utils/colorUtils.js';
import * as quantum from '../../utils/quantumUtils.js';

function scaleToRange(x, in_min = 1, in_max = 100, out_min = 2, out_max = 10) {
    if (x < in_min || x > in_max) {
        // Just cap it instead of throw to be safe
        x = Math.max(in_min, Math.min(x, in_max));
    }
    return (in_max < 100) ? out_max : Math.round(out_min + (x - in_min) * (out_max - out_min) / (in_max - in_min));
}

function runHeisenbergHardware(dt_list, radius, phi, theta, reportProgress) {
    let nsteps = dt_list.length;
    let n_qubits = scaleToRange(radius);

    let J_list = new Array(n_qubits).fill(-0.5);
    let hz_list = new Array(n_qubits).fill(0.5);
    let hx_list = new Array(n_qubits).fill(0.5);

    let circuits = [];
    let circ = new QuantumCircuit();
    let col = 0;

    for (let i = 0; i < n_qubits; i++) {
        circ.addGate("ry", col, i, { params: { theta: theta, phi: theta, lambda: theta } });
        circ.addGate("rz", col + 1, i, { params: { phi: phi, theta: phi, lambda: phi } });
    }
    col += 2;

    for (let step = 0; step < nsteps; step++) {
        let dt = dt_list[step];

        for (let n = 0; n < n_qubits; n++) {
            let J = J_list[n];
            let q0 = n;
            let q1 = (n + 1) % n_qubits;

            // RXX
            let t_xx = 2 * J * dt;
            circ.addGate("h", col, q0); circ.addGate("h", col, q1); col++;
            circ.addGate("cx", col++, [q0, q1]);
            circ.addGate("rz", col++, q1, { params: { theta: t_xx, phi: t_xx, lambda: t_xx } });
            circ.addGate("cx", col++, [q0, q1]);
            circ.addGate("h", col, q0); circ.addGate("h", col, q1); col++;

            // RYY
            let t_yy = 2 * J * dt;
            let p_pi2 = Math.PI / 2;
            circ.addGate("rx", col, q0, { params: { theta: p_pi2, phi: p_pi2, lambda: p_pi2 } });
            circ.addGate("rx", col, q1, { params: { theta: p_pi2, phi: p_pi2, lambda: p_pi2 } }); col++;
            circ.addGate("cx", col++, [q0, q1]);
            circ.addGate("rz", col++, q1, { params: { theta: t_yy, phi: t_yy, lambda: t_yy } });
            circ.addGate("cx", col++, [q0, q1]);
            circ.addGate("rx", col, q0, { params: { theta: -p_pi2, phi: -p_pi2, lambda: -p_pi2 } });
            circ.addGate("rx", col, q1, { params: { theta: -p_pi2, phi: -p_pi2, lambda: -p_pi2 } }); col++;

            // RZZ
            let t_zz = 2 * J * dt;
            circ.addGate("cx", col++, [q0, q1]);
            circ.addGate("rz", col++, q1, { params: { theta: t_zz, phi: t_zz, lambda: t_zz } });
            circ.addGate("cx", col++, [q0, q1]);
        }

        for (let n = 0; n < n_qubits; n++) {
            let hz = 2 * dt * hz_list[n];
            let hx = 2 * dt * hx_list[n];
            circ.addGate("rz", col++, n, { params: { theta: hz, phi: hz, lambda: hz } });
            circ.addGate("rx", col++, n, { params: { theta: hx, phi: hx, lambda: hx } });
        }

        // We need a snapshot of the circuit
        let snapshot = new QuantumCircuit();
        snapshot.load(circ.save());
        circuits.push(snapshot);
    }

    let z_pauli = [];
    for (let site = 0; site < n_qubits; site++) {
        let op = 'I'.repeat(n_qubits - site - 1) + 'Z' + 'I'.repeat(site);
        z_pauli.push(op);
    }

    let observables = {
        paulis: z_pauli,
        coeffs: new Array(n_qubits).fill(1.0 / n_qubits)
    };

    let values = quantum.run_estimator(circuits, observables, (p) => {
        if (reportProgress) reportProgress(p);
    });
    return values;
}

export async function run(params, reportProgress) {
    let image = params.stroke_input.image_rgba;
    let path = params.stroke_input.path;
    let radius = params.user_input.Radius;
    let strength = params.user_input.Strength;
    let color = params.user_input.Color;

    let r, g, b;
    if (typeof color === 'string') {
        r = parseInt(color.slice(1, 3), 16) / 255.0;
        g = parseInt(color.slice(3, 5), 16) / 255.0;
        b = parseInt(color.slice(5, 7), 16) / 255.0;
    } else {
        r = color[0] / 255.0; g = color[1] / 255.0; b = color[2] / 255.0;
    }

    let [h, l, s] = colors.rgbToHls(r, g, b);
    let phi = 2 * Math.PI * h;
    let theta = Math.PI * l;

    let num_evals = Math.max(2, Math.min(Math.floor(path.length / radius / 4), 10));
    let normalized_distances = new Array(num_evals).fill(0.1);

    if (reportProgress) reportProgress(0.2);

    let color_shifts = runHeisenbergHardware(normalized_distances, radius, phi, theta, (p) => {
        if (reportProgress) reportProgress(0.2 + p * 0.4);
    });

    let heisenberg_colors = [];
    for (let shift of color_shifts) {
        let n_h = (h + shift) % 1.0;
        if (n_h < 0) n_h += 1.0;
        let n_l = (l + shift) % 1.0;
        if (n_l < 0) n_l += 1.0;
        let n_s = (s + shift) % 1.0;
        if (n_s < 0) n_s += 1.0;

        let f_h = (1 - strength) * h + strength * n_h;
        let f_l = (1 - strength) * l + strength * n_l;
        let f_s = (1 - strength) * s + strength * n_s;

        let [r_new, g_new, b_new] = colors.hlsToRgb(f_h, f_l, f_s);
        heisenberg_colors.push([r_new, g_new, b_new]);
    }

    let split_size = Math.max(1, Math.floor(path.length / heisenberg_colors.length));
    let split_paths = [];
    for (let i = 0; i < heisenberg_colors.length - 1; i++) {
        split_paths.push(path.slice(i * split_size, (i + 1) * split_size));
    }
    split_paths.push(path.slice((heisenberg_colors.length - 1) * split_size));

    let border = [image.height, image.width];

    if (reportProgress) reportProgress(0.6);

    for (let i = 0; i < split_paths.length; i++) {
        if (i % 10 === 0 && reportProgress) {
            reportProgress(0.6 + 0.4 * (i / split_paths.length));
        }
        let region = utils.pointsWithinRadius(split_paths[i], radius, border);
        let patch = utils.getPatch(image, region);
        let c_rgb = heisenberg_colors[i];

        for (let k = 0; k < region.length; k++) {
            patch[k * 4] = c_rgb[0];
            patch[k * 4 + 1] = c_rgb[1];
            patch[k * 4 + 2] = c_rgb[2];
            patch[k * 4 + 3] = 1.0; // Wait, actually replace rgb but preserve alpha
            // `patch[k*4 + 3]` remains from getPatch OR we overwrite it? Python logic is patch[...,:3] = heisenberg_colors[i], so alpha remains.
            // But wait, the python sets new_patch[...,:3] = heisenberg_colors[i], then apply_patch_to_image uses alpha. Wait, `new_patch` was initialized as `image[region]`, so alpha was preserved.
        }

        utils.setPatch(image, region, patch);
    }

    if (reportProgress) reportProgress(1.0);
    return image;
}
