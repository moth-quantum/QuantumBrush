import QuantumCircuit from 'quantum-circuit';

let qc = new QuantumCircuit();
qc.addGate('h', 0, 0); // H on q0 at column 0
qc.addGate('x', 1, 0); // X on q1 at column 0
qc.run();
console.log(qc.stateAsString(true));

// Let's print out what qc.state looks like
console.log(qc.state);
