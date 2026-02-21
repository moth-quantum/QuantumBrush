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
    let mSin = sumSin / angles.length;
    let mCos = sumCos / angles.length;
    let mean = Math.atan2(mSin, mCos);
    return mean;
}

function meanList(arr) {
    if (arr.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
    }
    return sum / arr.length;
}

function drop(initial_angles, target_angle, strength) {
    let num_qubits = initial_angles.length;
    let target_phi = target_angle[0];
    let target_theta = target_angle[1];

    let qc = new QuantumCircuit();
    let col = 0;

    // qc.x(num_qubits)
    qc.addGate("x", col++, num_qubits);

    for (let i = 0; i < num_qubits; i++) {
        let phi = initial_angles[i][0];
        let theta = initial_angles[i][1];
        qc.addGate("ry", col, i, { params: { theta: theta } });
        // We use theta parameter for Phase/Rz mapping in quantum-circuit. For RZ it is either theta or phi. Most commonly 'theta' maps to the first angle parameter.
        qc.addGate("rz", col + 1, i, { params: { phi: phi, theta: phi, lambda: phi } });
    }
    col += 2;

    for (let i = 0; i < num_qubits; i++) {
        let phi = initial_angles[i][0];
        let theta = initial_angles[i][1];

        // qc.crz( - strength * phi,target_qubit = i,control_qubit  = num_qubits)
        let a1 = -strength * phi;
        qc.addGate("crz", col++, [num_qubits, i], { params: { theta: a1, phi: a1, lambda: a1 } });

        // qc.cry(strength * (target_theta-theta),target_qubit = i,control_qubit  = num_qubits)
        let a2 = strength * (target_theta - theta);
        qc.addGate("cry", col++, [num_qubits, i], { params: { theta: a2, phi: a2, lambda: a2 } });

        // qc.crz( strength * target_phi,target_qubit = i,control_qubit  = num_qubits)
        let a3 = strength * target_phi;
        qc.addGate("crz", col++, [num_qubits, i], { params: { theta: a3, phi: a3, lambda: a3 } });

        // qc.cry(np.pi/3, target_qubit = num_qubits, control_qubit= i,ctrl_state='0')
        qc.addGate("x", col++, i);
        let a4 = Math.PI / 3;
        qc.addGate("cry", col++, [i, num_qubits], { params: { theta: a4, phi: a4, lambda: a4 } });
        qc.addGate("x", col++, i);
    }

    let ops = [];
    for (let p of ['X', 'Y', 'Z']) {
        for (let i = 0; i < num_qubits; i++) {
            let opStr = "";
            for (let j = 0; j <= num_qubits; j++) {
                if (j === i) opStr += p;
                else opStr += 'I';
            }
            // in python it was: 'I'*(num_qubits-i) + p + 'I'*i
            // meaning index N-(num_qubits-i) ? Wait, if string length is (num_qubits+1),
            // and the 'p' is at index 'num_qubits-i', then:
            // let's exactly match Python's string building:
            let pyOpStr = 'I'.repeat(num_qubits - i) + p + 'I'.repeat(i);
            ops.push(pyOpStr);
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
    let transparentLayer = {
        width: image.width,
        height: image.height,
        data: new Uint8ClampedArray(image.width * image.height * 4),
    };
    let path = params.stroke_input.path;
    let n_drops = params.user_input['Number of Drops'];
    let radius = params.user_input.Radius;
    let target_color = params.user_input['Target Color'];
    let strength = params.user_input.Strength;

    let split_size = Math.max(1, Math.floor(path.length / n_drops));
    let split_paths = [];
    for (let i = 0; i < n_drops - 1; i++) {
        split_paths.push(path.slice(i * split_size, (i + 1) * split_size));
    }
    split_paths.push(path.slice((n_drops - 1) * split_size));

    let border = [image.height, image.width];

    let t_color;
    if (typeof target_color === 'string') {
        t_color = [parseInt(target_color.slice(1, 3), 16), parseInt(target_color.slice(3, 5), 16), parseInt(target_color.slice(5, 7), 16)];
    } else {
        t_color = target_color;
    }
    let [t_h, t_l, t_s] = colors.rgbToHls(t_color[0] / 255.0, t_color[1] / 255.0, t_color[2] / 255.0);
    let target_angle = [2 * Math.PI * t_h, Math.PI * t_l];

    let initial_angles = [];
    let pixels = [];

    for (let j = 0; j < split_paths.length; j++) {
        let lines = split_paths[j];
        if (reportProgress && j % 5 === 0) reportProgress(0.5 * (j / split_paths.length));
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

    let final_angles = drop(initial_angles, target_angle, strength);

    for (let i = 0; i < pixels.length; i++) {
        if (reportProgress && i % 5 === 0) reportProgress(0.5 + 0.5 * (i / pixels.length));
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
        utils.setPatch(transparentLayer, region, rgbArray);
    }

    if (reportProgress) reportProgress(1.0);
    return transparentLayer;
}
