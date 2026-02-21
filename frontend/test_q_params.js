const QuantumCircuit = require('quantum-circuit');
var qc = new QuantumCircuit();
qc.addGate("ry", 0, 0, { params: { theta: 1.5707 } });
qc.addGate("crz", 1, [0, 1], { params: { theta: 1.5707 } });
// ctrl state 0
qc.addGate("x", 2, 0);
qc.addGate("cry", 3, [0, 1], { params: { theta: 1.5707 } });
qc.addGate("x", 4, 0);
qc.run();
console.log(qc.stateAsString(true));
