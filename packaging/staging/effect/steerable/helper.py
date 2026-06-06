'''
Author: Chih-Kang Huang && chih-kang.huang@hotmail.com
Date: 2025-11-13 08:14:18
LastEditors: Chih-Kang Huang && chih-kang.huang@hotmail.com
LastEditTime: 2025-11-17 00:46:59
FilePath: /effect/steerable/helper.py
Description: helper functions for steerable brush

'''
import jax
import jax.numpy as jnp
import jax.random as jr
import optax
import equinox as eqx
import pennylane as qml
from functools import partial
import matplotlib.pyplot as plt

#jax.config.update("jax_enable_x64", True)

### Auxilary functions (Fidelity, Hamiltonian builder)
def density_matrix(psi):
    """
    Convert a state vector to a density matrix

    Return:
        jnp.array
    """
    return jnp.outer(psi, jnp.conjugate(psi))

def quantum_fidelity(psi, rho):
    """
    Quantum fidelity between two quantum states psi and rho. 

    Return:
        jnp.array
    """
    psi = psi/jnp.linalg.norm(psi)
    rho = rho /jnp.linalg.norm(rho)
    return jnp.abs(jnp.vdot(psi, rho))**2

def build_hamiltonians(n_qubits): 
    """
    Construct a set of Hamiltonians for a chain of `n_qubits`.

    The base Hamiltonian is
        H₀ = Σ (Xₖ Xₖ₊₁ + Yₖ Yₖ₊₁ + Zₖ Zₖ₊₁).

    Additional single-qubit Hamiltonians are defined cyclically:
        Hₖ = Xₖ if k ≡ 1 (mod 3)
           = Yₖ if k ≡ 2 (mod 3)
           = Zₖ if k ≡ 0 (mod 3).

    Returns:
        list: A list of `qml.Hamiltonian` objects.
    """
    H0 = sum(qml.PauliX(i) @ qml.PauliX(i+1) for i in range(n_qubits-1))   
    H0 += sum(qml.PauliY(i) @ qml.PauliY(i+1) for i in range(n_qubits-1))  
    H0 += sum(qml.PauliZ(i) @ qml.PauliZ(i+1) for i in range(n_qubits-1))

    if n_qubits == 1: 
        H_list  = [
            qml.PauliZ(0),
            qml.PauliX(0)
        ]
    elif n_qubits == 2:
        H_list = [
            H0, 
            qml.PauliX(0) @ qml.Identity(1),
            qml.Identity(0) @ qml.PauliY(1),
        ]
    elif n_qubits == 3: 
        J = jnp.array([0.2, 0.13])
        H_list = [
            H0,
            qml.PauliX(0) @ qml.Identity(1) @ qml.Identity(2),
            qml.Identity(0) @ qml.PauliY(1) @ qml.Identity(2),
            qml.Identity(0) @ qml.Identity(1) @ qml.PauliX(2),
        ]
    elif n_qubits == 4: 
        H_list = [
            H0,
            qml.PauliX(0) @ qml.Identity(1) @ qml.Identity(2) @ qml.Identity(3),
            qml.Identity(0) @ qml.PauliY(1) @ qml.Identity(2) @ qml.Identity(3),
            qml.Identity(0) @ qml.Identity(1) @ qml.PauliZ(2) @ qml.Identity(3),
            qml.Identity(0) @ qml.Identity(1) @ qml.Identity(2) @ qml.PauliX(3),
        ]
    else:
        raise AssertionError("Not implemented yet")
        
    return H_list



### Circuit Builder 
"""Define Circuit with 2nd order trotterization"""
def splitting_circuit(model, initial_state, t, 
                      n_steps, 
                      H_list,
                      n_qubits,
                      n=1
    ):
    """
    Build and execute a Trotterized time-evolution circuit.

    Args:
        model: Neural-network control model providing time-dependent coefficients.
        initial_state: The initial quantum state to prepare.
        t (float): Final evolution time.
        n_steps (int): Number of discrete time steps.
        H_list (list): List of Hamiltonians used in the evolution.
        n (int): Trotterization order (default: 1).

    Returns:
        array: The quantum state at time t.
    """
    dt = t / n_steps
    H0 = H_list[0]
    qml.StatePrep(initial_state, wires=range(n_qubits))
    for k in range(n_steps):
        t_k = k * dt
        u_k = model(jnp.array(t_k))
        # Strang-splitting time step
        qml.ApproxTimeEvolution(H0, dt/2, n)
        for u, H in zip(list(u_k), H_list[1:]): 
            qml.ApproxTimeEvolution(u*H, dt/2, n)
        for u, H in (zip(reversed(list(u_k)), reversed(H_list[1:]))): 
            qml.ApproxTimeEvolution(u*H, dt/2, n)
        qml.ApproxTimeEvolution(H0, dt/2, n)
    return qml.state()


def build_circuit(backend, params, source, target, n_qubits):

    if source.shape != target.shape :
        raise ValueError(
            f"source and target must have the same size "
            f"(got source={len(source)}, target={len(target)})"
        )
    
    if len(source) != 2 ** n_qubits:
        raise ValueError(
            f"Number of parameters must be 2**{n_qubits} = {2**n_qubits}, "
            f"but got {len(source)}."
        )
    
    
    key = jr.PRNGKey(0)

    # Build Ansatz
    H_list = build_hamiltonians(n_qubits)

    # Souce and target state preparation
    initial_state = source 
    target_state = target
    initial_state /= jnp.linalg.norm(initial_state)
    target_state /= jnp.linalg.norm(target_state)

    n_epochs = params.get("n_epochs", 500)
    n_steps = params.get("timesteps", 25)
    T = params.get("max T", 1.0)
    lr = params.get("lr", 0.05)

    key, mlpkey = jax.random.split(key)

    model = eqx.nn.MLP(
        in_size='scalar', out_size=len(H_list)-1, depth=2, width_size=16, activation=jax.nn.tanh, key=mlpkey
    )
    optimizer = optax.adam(learning_rate=lr)
    opt_state = optimizer.init(eqx.filter(model, eqx.is_array))

    # Build circuit for training
    dev = qml.device("default.qubit", wires=n_qubits)
    circuit = eqx.filter_jit(qml.qnode(dev)(partial(splitting_circuit, H_list=H_list, n_qubits=n_qubits)))
    ### Loss function and NN training 
    def loss_fn(model, inital_state, target_state, T=1.0, n_steps=30, C=1e-5):
        psi = circuit(model, inital_state, T, n_steps)
        fidelity = quantum_fidelity(psi, target_state)
        ## 
        ts = jnp.linspace(0, T, n_steps)
        integral = jax.scipy.integrate.trapezoid(jax.vmap(lambda t : jnp.linalg.norm(model(t))**2)(ts), ts)
        return 1 - fidelity + C*integral

    @eqx.filter_jit
    def make_step(model, opt_state, initial_state, target_state, optimizer, T=1.0, n_steps=40):
        loss, grads = eqx.filter_value_and_grad(loss_fn)(model, initial_state, target_state, T, n_steps)
        updates, opt_state = optimizer.update(grads, opt_state)
        model = eqx.apply_updates(model, updates)
        return model, opt_state, loss

    # Training
    print(f"=== Start training ===")
    for step in range(n_epochs):
        model, opt_state, loss = make_step(
            model, opt_state, initial_state, target_state, 
            optimizer, T, n_steps
        )
        if step % (n_epochs // 10) == 0:
            print(f"Step {step:03d}: loss = {loss:.6f}")
    
    rho_f = circuit(model, initial_state, T, n_steps)
    print(f"Final fidelity: {quantum_fidelity(rho_f, target_state)}")

    print("=== Circuit built. ===")
    final_circuit = (qml.qnode(backend)(partial(splitting_circuit, model=model, H_list=H_list)))
    return final_circuit

### Visualization
def von_neumann_entropy(rho):
    """Von Neumann entropy in bits."""
    eigvals = jnp.real(jnp.linalg.eigvals(rho))
    eigvals = jnp.clip(eigvals, 1e-12, 1.0)
    return -jnp.sum(eigvals * jnp.log2(eigvals))

X = jnp.array(qml.matrix(qml.PauliX(0)))
Y = jnp.array(qml.matrix(qml.PauliY(0)))
Z = jnp.array(qml.matrix(qml.PauliZ(0)))
I = jnp.eye(2)

def bloch_vector(rho):
    """Compute Bloch vector for single-qubit density matrix."""
    return jnp.array([
        jnp.real(jnp.trace(rho @ X)),
        jnp.real(jnp.trace(rho @ Y)),
        jnp.real(jnp.trace(rho @ Z))
    ])

def partial_trace(psi, keep, n_qubits):
    """Partial trace over all qubits except those in 'keep' (list of indices)."""
    rho = jnp.outer(psi, jnp.conjugate(psi))
    dims = [2] * n_qubits
    rho = rho.reshape(dims + dims)

    # Trace out all qubits not in 'keep'
    for q in reversed(range(n_qubits)):
        if q not in keep:
            rho = jnp.trace(rho, axis1=q, axis2=q + n_qubits)
            n_qubits -= 1
    return rho

# ---------- Main visualization ----------

def visualize_bloch_trajectories(states, target_state, n_qubits, ent=False, savepath=None):
    """
    states: list/array of shape (T, 2**n)
    target_state: vector of shape (2**n,)
    n_qubits: int
    """

    # Compute single-qubit trajectories
    trajs = []
    targets = []
    for q in range(n_qubits):
        traj_q = jnp.array([
            bloch_vector(partial_trace(psi, [q], n_qubits)) for psi in states
        ])
        trajs.append(traj_q)
        targets.append(bloch_vector(partial_trace(target_state, [q], n_qubits)))


    # ---------- Visualization ----------
    fig = plt.figure(figsize=(5 * n_qubits, 5))
    n_fig = n_qubits +1 if ent else n_qubits
    # Each qubit's Bloch trajectory
    for q in range(n_qubits):
        ax = fig.add_subplot(1, n_fig, q + 1, projection='3d')
        traj = trajs[q]
        target = targets[q]
        ax.plot(traj[:,0], traj[:,1], traj[:,2], lw=2)
        ax.scatter(traj[0,0], traj[0,1], traj[0,2], color='green', label='start')
        ax.scatter(traj[-1,0], traj[-1,1], traj[-1,2], color='red', label='end')
        ax.scatter(target[0], target[1], target[2], color='blue', label='target')
        ax.set_xlabel('X'); ax.set_ylabel('Y'); ax.set_zlabel('Z')
        ax.set_title(f'Qubit {q} Bloch trajectory')
        ax.legend()
    # Entanglement entropy
    if ent:
        # Entanglement entropy between qubit 0 and the rest
        ent_entropy = jnp.array([
            von_neumann_entropy(partial_trace(psi, [0], n_qubits)) for psi in states
        ])
        ax_e = fig.add_subplot(1, n_fig, n_fig)
        ax_e.plot(jnp.linspace(0, 1.0, len(ent_entropy)), ent_entropy, color='purple', lw=2)
        ax_e.set_xlabel('Time t')
        ax_e.set_ylabel('Entanglement entropy S(t)')
        ax_e.set_title('Entanglement entropy (qubit 0 vs rest)')
        ax_e.grid(True)

    plt.tight_layout()
    if savepath: 
        plt.savefig(savepath)
    else:
        plt.show()

## Neural Networkd Model selection 
class FourierControl(eqx.Module):
    """Fourier-based control ansatz: u(t) = a0 + Σ [a_m cos + b_m sin]."""
    a0: jnp.ndarray
    a: jnp.ndarray
    b: jnp.ndarray
    T: float
    A_max: float

    def __init__(self, key, M=6, T=1.0, A_max=1.0, scale=1e-2):
        k1, k2, k3 = jax.random.split(key, 3)
        self.a0 = jax.random.normal(k1, ()) * scale
        self.a  = jax.random.normal(k2, (M,)) * scale / jnp.arange(1, M+1)
        self.b  = jax.random.normal(k3, (M,)) * scale / jnp.arange(1, M+1)
        self.T = T
        self.A_max = A_max

    def __call__(self, t):
        """Evaluate control amplitude at time t ∈ [0, T]."""
        t = jnp.atleast_1d(t)
        freqs = jnp.arange(1, self.a.size + 1)
        cos_terms = jnp.sum(self.a * jnp.cos(2*jnp.pi*freqs[None,:]*t[:,None]/self.T), axis=-1)
        sin_terms = jnp.sum(self.b * jnp.sin(2*jnp.pi*freqs[None,:]*t[:,None]/self.T), axis=-1)
        u = self.a0 + cos_terms + sin_terms
        ## optional amplitude bound
        #u = self.A_max * jnp.tanh(u / self.A_max)
        return u if u.size > 1 else u[0]


class PiecewiseConstantControl(eqx.Module):
    amplitudes: jnp.ndarray  # shape (n_segments,)
    t_final: float
    n_segments: int

    def __call__(self, t: float):
        """Return the control amplitude u(t) for given time t."""
        idx = jnp.clip(
            (t / self.t_final * self.n_segments).astype(int),
            0,
            self.n_segments - 1,
        )
        return self.amplitudes[idx]

    def values(self, times: jnp.ndarray):
        """Convenience method: return u(t) for an array of times."""
        return jax.vmap(self.__call__)(times)
