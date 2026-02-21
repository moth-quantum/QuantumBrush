import QuantumCircuit from 'quantum-circuit';
import * as utils from '../../utils/imageUtils.js';
import * as colors from '../../utils/colorUtils.js';
import * as quantum from '../../utils/quantumUtils.js';

function circmean(angles) {
    if (angles.length === 0) return 0;
    let sumSin = 0;
    let sumCos = 0;
    for (let i = 0; i < angles.length; i++) {
        sumSin += Math.sin(angles[i]);
        sumCos += Math.cos(angles[i]);
    }
    return Math.atan2(sumSin / angles.length, sumCos / angles.length);
}

function meanList(arr) {
    if (arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) { sum += arr[i]; }
    return sum / arr.length;
}

function damping(initial_angles, strength, invert) {
    let num_qubits = initial_angles.length;
    let qc = new QuantumCircuit();
    let col = 0;
    let rotation = 2 * Math.acos(1 - strength);

    for (let i = 0; i < num_qubits; i++) {
        let phi = initial_angles[i][0];
        let theta = initial_angles[i][1];

        qc.addGate("ry", col, i, { params: { theta: theta } });
        qc.addGate("rz", col + 1, i, { params: { phi: phi, theta: phi, lambda: phi } });

        let c = col + 2;
        if (invert) {
            qc.addGate("x", c++, i);
        }

        qc.addGate("cry", c++, [i, num_qubits], { params: { theta: rotation, phi: rotation, lambda: rotation } });
        qc.addGate("cx", c++, [num_qubits, i]);

        if (invert) {
            qc.addGate("x", c++, i);
        }
        col = c;
    }

    let ops = [];
    for (let p of ['X', 'Y', 'Z']) {
        for (let i = 0; i < num_qubits; i++) {
            ops.push('I'.repeat(num_qubits - i) + p + 'I'.repeat(i));
        }
    }

    let obs = quantum.run_estimator(qc, ops);

    let x_expectations = obs.slice(0, num_qubits);
    let y_expectations = obs.slice(num_qubits, 2 * num_qubits);
    let z_expectations = obs.slice(2 * num_qubits, 3 * num_qubits);

    let final_angles = [];
    for (let i = 0; i < num_qubits; i++) {
        let x = x_expectations[i];
        let y = y_expectations[i];
        let z = z_expectations[i];
        let phi_e = (Math.atan2(y, x) % (2 * Math.PI));
        if (phi_e < 0) phi_e += 2 * Math.PI;

        let theta_e = Math.atan2(Math.sqrt(x * x + y * y), z);
        final_angles.push([phi_e, theta_e]);
    }
    return final_angles;
}

export async function run(params, reportProgress) {
    let image = params.stroke_input.image_rgba;
    let path = params.stroke_input.path;
    let clicks = params.stroke_input.clicks;

    let split_paths = [];
    let click_indices = [];
    let c = 0;

    const arraysEqual = (a, b) => a[0] === b[0] && a[1] === b[1];

    for (let i = 0; i < path.length; i++) {
        if (c < clicks.length && arraysEqual(path[i], clicks[c])) {
            click_indices.push(i);
            c++;
        }
    }

    for (let idx = 0; idx < click_indices.length; idx++) {
        let start = click_indices[idx];
        let end = (idx + 1 < click_indices.length) ? click_indices[idx + 1] : path.length;
        let p = path.slice(start, end);
        let interpPath = utils.interpolatePixels(p);
        split_paths.push(interpPath);
    }

    let radius = params.user_input.Radius;
    let invert = params.user_input['Invert Luminosity'];
    let strength = params.user_input.Strength;
    let border = [image.height, image.width];

    let initial_angles = [];
    let pixels = [];

    for (let j = 0; j < split_paths.length; j++) {
        let lines = split_paths[j];
        if (reportProgress && j % 10 === 0) reportProgress(0.5 * (j / split_paths.length));
        let region = utils.pointsWithinRadius(lines, radius, border);
        let patch = utils.getPatch(image, region);
        let hlsArray = colors.rgbToHlsArray(patch);

        let phiSums = [];
        let thetaSums = [];
        for (let i = 0; i < hlsArray.length; i += 4) {
            phiSums.push(2 * Math.PI * hlsArray[i]);
            thetaSums.push(Math.PI * hlsArray[i + 1]);
        }

        let phi = circmean(phiSums);
        let theta = meanList(thetaSums);
        initial_angles.push([phi, theta]);
        pixels.push([region, hlsArray]);
    }

    if (reportProgress) reportProgress(0.5);

    let final_angles = damping(initial_angles, strength, invert);

    for (let i = 0; i < pixels.length; i++) {
        if (reportProgress && i % 10 === 0) reportProgress(0.5 + 0.5 * (i / pixels.length));
        let region = pixels[i][0];
        let hlsArray = pixels[i][1];
        let new_phi = final_angles[i][0], new_theta = final_angles[i][1];
        let old_phi = initial_angles[i][0], old_theta = initial_angles[i][1];

        let offset_h = (new_phi - old_phi) / (2 * Math.PI);
        let offset_l = (new_theta - old_theta) / Math.PI;

        for (let k = 0; k < hlsArray.length; k += 4) {
            hlsArray[k] = (hlsArray[k] + offset_h) % 1.0;
            if (hlsArray[k] < 0) hlsArray[k] += 1.0;
            hlsArray[k + 1] += offset_l;
            hlsArray[k + 1] = Math.max(0, Math.min(1, hlsArray[k + 1]));
        }

        let rgbArray = colors.hlsToRgbArray(hlsArray);
        utils.setPatch(image, region, rgbArray);
    }

    if (reportProgress) reportProgress(1.0);
    return image;
}
