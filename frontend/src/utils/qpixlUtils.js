import QuantumCircuit from 'quantum-circuit';

/**
 * Fast Walsh-Hadamard Transform (SF-WHT variant with scaling) 
 * Ports from helper.py
 */
export function sfwht(a) {
    const n = a.length;
    let j = 1;
    while (j < n) {
        for (let i = 0; i < n; i++) {
            if ((i & j) === 0) {
                let j1 = i + j;
                let x = a[i];
                let y = a[j1];
                a[i] = (x + y) / 2;
                a[j1] = (x - y) / 2;
            }
        }
        j *= 2;
    }
    return a;
}

export function grayCode(x) {
    return x ^ (x >> 1);
}

export function grayPermutation(a) {
    const n = a.length;
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        b[i] = a[grayCode(i)];
    }
    return b;
}

export function countrZero(n, nBits = 8) {
    if (n === 0) return nBits;
    let count = 0;
    while (n > 0 && (n & 1) === 0) {
        count++;
        n >>= 1;
    }
    return count;
}

export function nextpow2(x) {
    if (x <= 1) return 1;
    let p = 1;
    while (p < x) p <<= 1;
    return p;
}

export function ilog2(x) {
    return Math.log2(x) | 0;
}

/**
 * Convert grayscale [0, 1] to angles [0, PI/2]
 */
export function convertToAngles(a) {
    // helper.py: scal = pi / (a.max() * 2)
    const scal = Math.PI / 2;
    const res = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
        res[i] = a[i] * scal;
    }
    return res;
}

/**
 * cFRQI Encoding
 * Ports EXACTLY from qpixl.py
 */
export function cFRQI(pixels, compression = 0) {
    let a = convertToAngles(pixels);

    const nOrig = a.length;
    const n = nextpow2(nOrig);
    const k = ilog2(n);

    let aPadded = new Float32Array(n);
    aPadded.set(a);

    // Transformation
    let angles = new Float32Array(n);
    for (let i = 0; i < n; i++) angles[i] = 2 * aPadded[i];

    angles = sfwht(angles);
    angles = grayPermutation(angles);

    if (compression > 0) {
        let indexed = Array.from(angles).map((val, idx) => ({ val: Math.abs(val), idx }));
        indexed.sort((a, b) => a.val - b.val);
        const cutoff = Math.floor((compression / 100) * n);
        for (let i = 0; i < cutoff; i++) {
            angles[indexed[i].idx] = 0;
        }
    }

    // MATCH PYTHON ORDERING: Position=0..k-1, Color=k
    const circuit = new QuantumCircuit(k + 1);
    const colorQubit = k;

    // Hadamard position qubits
    for (let i = 0; i < k; i++) {
        circuit.addGate("h", 0, i);
    }

    let ctrl, pc, i = 0;
    let col = 1;
    while (i < n) {
        pc = 0;
        if (angles[i] !== 0) {
            circuit.addGate("ry", col++, colorQubit, { params: { theta: angles[i] } });
        }
        if (i === n - 1) {
            ctrl = 0;
        } else {
            // Python: ctrl = k - countr_zero(grayCode(i) ^ grayCode(i+1), k+1) - 1
            // Our countrZero is internal bits 0..k-1
            let bitIdx = countrZero(grayCode(i) ^ grayCode(i + 1), k);
            ctrl = k - bitIdx - 1;
        }

        pc ^= (1 << ctrl);
        i++;

        while (i < n && angles[i] === 0) {
            if (i === n - 1) {
                ctrl = 0;
            } else {
                let bitIdx = countrZero(grayCode(i) ^ grayCode(i + 1), k);
                ctrl = k - bitIdx - 1;
            }
            pc ^= (1 << ctrl);
            i++;
        }

        for (let j = 0; j < k; j++) {
            if ((pc >> j) & 1) {
                // j is the qubit index in 0..k-1
                circuit.addGate("cx", col++, [j, colorQubit]);
            }
        }
    }
    // Python returns circuit.reverse_bits(), but we'll stick to non-reversed 
    // and adjust decodeQPIXL to skip one reversal level.
    return circuit;
}

/**
 * decodeQPIXL
 * Adjust for Color as MSB (qubit k)
 */
export function decodeQPIXL(state, numQubits) {
    const k = numQubits - 1;
    const n = 1 << k;
    const pv = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        // If Color is MSB (qubit k), then:
        // Color 0 is at index i
        // Color 1 is at index i + n
        let s0 = state[i];
        let s1 = state[i + n];

        let re0 = s0 ? (s0.re || 0) : 0;
        let re1 = s1 ? (s1.re || 0) : 0;

        pv[i] = Math.atan2(re1, re0);
    }

    const scal = 2 / Math.PI;
    for (let i = 0; i < n; i++) {
        pv[i] = pv[i] * scal;
    }
    return pv;
}

export function reconstructImg(picVec, shape) {
    const rows = shape[0];
    const cols = shape[1];
    const holder = new Float32Array(rows * cols);
    const ldm = rows;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            holder[row * cols + col] = picVec[row + col * ldm];
        }
    }
    return holder;
}
