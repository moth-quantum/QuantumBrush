import QPIXL.helper as hlp
import numpy as np
from qiskit import QuantumCircuit


def cFRQI(a, compression):
    """Takes a standard image in a numpy array (so that the matrix looks like
    the image you want if you picture the pixels) and returns the QPIXL
    compressed FRQI circuit. The compression ratio determines
    how many gates will be filtered and then cancelled out. Made into code from this paper:
    https://www.nature.com/articles/s41598-022-11024-y

    Args:
        a (np.array): numpy array of image, must be flattened and padded with zeros up to a power of two
        compression (float): number between 0 an 100, where 0 is no compression and 100 is no image

    Returns:
        QuantumCircuit: qiskit circuit that prepared the encoded image
    """
    a = hlp.convertToAngles(a)  # convert grayscale to angles
    a = hlp.preprocess_image(a)  # need to flatten the transpose for easier decoding,
    # only really necessary if you want to recover an image.
    # for classification tasks etc. transpose isn't required.
    n = len(a)
    k = hlp.ilog2(n)

    a = 2 * a
    a = hlp.sfwht(a)
    a = hlp.grayPermutation(a)
    a_sort_ind = np.argsort(np.abs(a))

    # set smallest absolute values of a to zero according to compression param
    cutoff = int((compression / 100.0) * n)
    for it in a_sort_ind[:cutoff]:
        a[it] = 0
    # print(a)
    # Construct FRQI circuit
    circuit = QuantumCircuit(k + 1)
    # Hadamard register
    circuit.h(range(k))
    # Compressed uniformly controlled rotation register
    ctrl, pc, i = 0, 0, 0
    while i < (2**k):
        # Reset the parity check
        pc = int(0)

        # Add RY gate
        if a[i] != 0:
            circuit.ry(a[i], k)

        # Loop over sequence of consecutive zero angles to
        # cancel out CNOTS (or rather, to not include them)
        if i == ((2**k) - 1):
            ctrl = 0
        else:
            ctrl = hlp.grayCode(i) ^ hlp.grayCode(i + 1)
            ctrl = k - hlp.countr_zero(ctrl, n_bits=k + 1) - 1

        # Update parity check
        pc ^= 2**ctrl
        i += 1

        while i < (2**k) and a[i] == 0:
            # Compute control qubit
            if i == ((2**k) - 1):
                ctrl = 0
            else:
                ctrl = hlp.grayCode(i) ^ hlp.grayCode(i + 1)
                ctrl = k - hlp.countr_zero(ctrl, n_bits=k + 1) - 1

            # Update parity check
            pc ^= 2**ctrl
            i += 1

        for j in range(k):
            if (pc >> j) & 1:
                circuit.cx(j, k)

    return circuit.reverse_bits()