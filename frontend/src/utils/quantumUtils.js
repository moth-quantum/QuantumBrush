export function run_estimator(circuits, operators, reportProgress = null) {
    let isSingleCircuit = !Array.isArray(circuits);
    if (isSingleCircuit) circuits = [circuits];

    let isSingleOpArray = true;
    if (Array.isArray(operators) && Array.isArray(operators[0])) {
        isSingleOpArray = false;
    }

    let results = [];

    for (let c = 0; c < circuits.length; c++) {
        if (reportProgress) reportProgress((c + 1) / circuits.length);
        let qc = circuits[c];
        qc.run();
        let state = qc.state;

        let ops = isSingleOpArray ? operators : operators[c];
        if (!Array.isArray(ops)) ops = [ops];

        let numQubits = qc.numQubits;

        let psi = new Float64Array(1 << numQubits).fill(0);
        let psiIm = new Float64Array(1 << numQubits).fill(0);
        for (let k in state) {
            psi[k] = state[k].re;
            psiIm[k] = state[k].im;
        }

        let c_res = [];
        for (let op of ops) {
            let paulis = [];
            let coeffs = [];

            if (typeof op === 'string') {
                paulis = [op];
                coeffs = [1.0];
            } else if (op.paulis) {
                paulis = op.paulis;
                coeffs = op.coeffs || Array(op.paulis.length).fill(1.0);
            }

            let total_expect = 0;

            for (let i = 0; i < paulis.length; i++) {
                let opStr = paulis[i];
                let coeff = coeffs[i];
                let expect = 0;
                let opArr = opStr.split('').reverse();

                for (let k = 0; k < (1 << numQubits); k++) {
                    if (psi[k] === 0 && psiIm[k] === 0) continue;

                    let k_prime = k;
                    let phase_re = 1;
                    let phase_im = 0;

                    for (let q = 0; q < numQubits; q++) {
                        let p = opArr[q] || 'I';
                        let bit = (k >> q) & 1;
                        if (p === 'X') {
                            k_prime ^= (1 << q);
                        } else if (p === 'Y') {
                            k_prime ^= (1 << q);
                            let old_re = phase_re;
                            if (bit === 0) {
                                phase_re = -phase_im;
                                phase_im = old_re;
                            } else {
                                phase_re = phase_im;
                                phase_im = -old_re;
                            }
                        } else if (p === 'Z') {
                            if (bit === 1) {
                                phase_re = -phase_re;
                                phase_im = -phase_im;
                            }
                        }
                    }

                    let a_re = psi[k], a_im = -psiIm[k];
                    let b_re = phase_re, b_im = phase_im;
                    let c_re = psi[k_prime], c_im = psiIm[k_prime];

                    let ab_re = a_re * b_re - a_im * b_im;
                    let ab_im = a_re * b_im + a_im * b_re;

                    let val_re = ab_re * c_re - ab_im * c_im;
                    expect += val_re;
                }
                total_expect += expect * coeff;
            }
            c_res.push(total_expect);
        }

        results.push(isSingleOpArray && !Array.isArray(operators) ? c_res[0] : c_res);
    }

    if (isSingleCircuit) return results[0];
    return results;
}
