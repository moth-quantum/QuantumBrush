from flask import Flask, jsonify
import numpy as np
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit import transpile

app = Flask(__name__)

# Word banks
NATURE = ["river", "wind", "stone", "moon", "forest", "shadow"]
TIME = ["dawn", "twilight", "echo", "memory", "midnight", "silence"]
EMOTION = ["longing", "stillness", "joy", "sorrow", "wonder", "fear"]

simulator = AerSimulator()

def quantum_random_bits():
    qc = QuantumCircuit(3, 3)

    # Create superposition
    qc.h([0, 1, 2])

    # Entanglement
    qc.cx(0, 1)
    qc.ry(np.pi / 3, 2)

    qc.measure([0,1,2], [0,1,2])

    compiled = transpile(qc, simulator)
    job = simulator.run(compiled, shots=1)
    result = job.result()
    counts = result.get_counts()

    bitstring = list(counts.keys())[0]
    return bitstring[::-1]  # Reverse for intuitive ordering

def generate_haiku():
    bits = quantum_random_bits()

    n_word = NATURE[int(bits[0]) * 3 + int(bits[1]) % len(NATURE)]
    t_word = TIME[int(bits[1]) * 3 + int(bits[2]) % len(TIME)]
    e_word = EMOTION[int(bits[2]) * 3 + int(bits[0]) % len(EMOTION)]

    return [
        f"{n_word} in the {t_word}",
        f"drifting through {e_word}",
        f"where qubits softly fall"
    ]

@app.route("/generate")
def generate():
    return jsonify(generate_haiku())

if __name__ == "__main__":
    app.run(debug=True)
