![Quantum Interference Logo](https://quantuminterference.netlify.app/interfence_logo_128.png)

# Quantum Interference ⚛️ — Project Submission
### Author
Luis J Camargo
### Live Demo  
[https://quantuminterference.netlify.app/](https://quantuminterference.netlify.app/)
### Repository  
[https://github.com/ljcamargo/quantum_interference](https://github.com/ljcamargo/quantum_interference)

**Quantum Interference** is a generative art experiment that artistically portrays the interference patterns of quantum mechanics from a quantum computing perspective. Built for the **#UnitaryDESIGN** hackathon for project **"QuantumBrush"**.

## 🚀 Overview
The application simulates a quantum system with $n$ qubits. Users can manipulate the state of the system by injecting quantum gates (H, X, S, T, CNOT, CCNOT) and observe the resulting probability amplitude field as a beautiful, evolving interference pattern.

## 📡 The Algorithm: StateVector to Image
The visualizer maps purely mathematical quantum states into a physical wave interference field:

1. **Source Mapping**: Each of the $2^n$ computational basis states ($|00...0\rangle$ to $|11...1\rangle$) is mapped to a spatial coordinate $\mathbf{r}_i$ arranged in a circular formation.
2. **Wave Emission**: Each state acts as a point source emitting a wave. The "strength" of the source is determined by its **Probability Amplitude** $c_i$:
   - **Amplitude magnitude ($|c_i|$)**: Controls the wave's peak intensity.
   - **Amplitude phase ($\phi_i$)**: Controls the wave's phase shift.
3. **Interference Calculation**: For every pixel $\mathbf{r}$ on the canvas, the total wave function $\Psi$ is the complex sum of all contributions:
   $$\Psi(\mathbf{r}, t) = \sum_{i} |c_i| e^{j(k|\mathbf{r} - \mathbf{r}_i| - \omega t - \phi_i)}$$
4. **Rendering**: The final pixel intensity is calculated as $I = |\Psi|^2$. This intensity is mapped to a matrix-inspired color gradient (Deep Dark to Neon Green) and rendered in real-time.

## 🎨 Controls
- **Qubits**: Scale the complexity of the Hilbert space.
- **Wave Dynamics**: Adjust the Wave Number ($k$) for spatial frequency and Frequency ($\omega$) for temporal speed.
- **Inject Gate**: Apply unitary transformations to perturb the field and create entanglement.
- **Download**: Capture the current interference pattern as a high-resolution PNG.

## 📚 References
This project takes ideas on how to render the interference pattern from the work of:

- Ruimy, R., Tziperman, O., Gorlach, A., Mølmer, K., & Kaminer, I. (2024). Many-body entanglement via ‘which-path’ information. *npj Quantum Information*, 10(1), 121. [https://doi.org/10.1038/s41534-024-00899-6](https://doi.org/10.1038/s41534-024-00899-6)
- SSS Quantum. (n.d.). *What is Quantum Interference?* Medium. [https://medium.com/sss-quantum/what-is-quantum-interference-52d1d7fa0517](https://medium.com/sss-quantum/what-is-quantum-interference-52d1d7fa0517)

## 📜 License
MIT

## ✒️​ Authorship
Created by **Luis J Camargo** for the **#UnitaryDESIGN** hackathon.
Copyleft 2026.

---
