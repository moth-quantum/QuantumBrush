const { QuantumCircuit } = require('quantum-circuit');
var circuit = new QuantumCircuit();
circuit.addGate("h", 0, 0);
circuit.addGate("x", 1, 1);
circuit.run();
console.log(circuit.stateAsArray());
