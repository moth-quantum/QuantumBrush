# Decoherence Effect

The **Decoherence** brush calculates the visual impact of a heavy quantum decoherence process (specifically, amplitude damping) acting upon the color values of an image.

### Theoretical Background

From a quantum computing perspective, *decoherence* and *relaxation* are undesired processes where qubits lose their delicate state information as they interact with the environment over time. During relaxation (characterized by the $T_1$ time constant), a qubit gradually loses energy, causing an excited state of $|1\rangle$ to decay back to the ground state $|0\rangle$. 

Because ideal quantum simulators (like base Qiskit and the JavaScript fallback) do not inherently simulate noise, we must artificially construct a noise model to simulate this "erasure" effect. To achieve this, the algorithm applies $RY$ (rotation) and $CRY$ (controlled-rotation) gates to model the decay proportional to specific $T_1$ constants assigned to each color channel (Red, Green, Blue). 

Crucially, to ensure a physically realistic asymptotic decay (and avoid "artificial recoherence" where the state might over-rotate and flip back past $|0\rangle$), an **ancilla qubit** is used to represent the environment. If the ancilla is flipped (indicating an energy loss event), a CNOT gate resets the system qubit to $|0\rangle$. This correctly models the irreversible nature of amplitude damping.

### Implementation Details

Initially, attempts were made to transform the entire image bitmap into a quantum state using the QPIXL encoding, as suggested by [*Quantum pixel representations and compression for N-dimensional images*](https://arxiv.org/abs/2110.04405) (Mercy A et al., 2021). However, simulating full decoherence on a rigorous per-pixel quantum representation proved to be highly computationally expensive (taking hours per stroke). 

To optimize performance while preserving the visual and scientific integrity of the algorithm, the implementation was optimized:
1. It calculates the average color values for a localized patch of the brush stroke.
2. It embeds these average values as probabilities on the system qubit.
3. It applies the amplitude damping simulation to derive an average **decoherence factor** for each color channel.
4. It multiplies these factors back onto each individual pixel within the original patch.

### Visual Result

Since amplitude damping naturally drives states towards $|0\rangle$ (which corresponds to 0 intensity in color channels), the visual result is a progressively dimmed stroke. As the user increases the Decoherence intensity slider, the probabilities decay faster, resulting in darker, "fading" traces along the brush path—a visual representation of quantum information loss.
