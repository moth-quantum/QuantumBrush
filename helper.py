# qip/helper.py

import numpy as np
from qiskit.quantum_info import partial_trace


def convertForProcessing(a):
    """
    Convert to avoid integer overflow
    """
    return a.astype(np.float32)


def sfwht(a):
    """Fast walsh hadamard transform with scaling

    Args:
        a (flat array): array with values to be transformed

    Returns:
        input array: array of same type as input, inplace transform
    """
    n = len(a)
    j = 1
    while j < n:
        for i in range(n):
            if i & j == 0:
                j1 = i + j
                x = a[i]
                y = a[j1]
                a[i], a[j1] = (x + y) / 2, (x - y) / 2
        j *= 2
    return a


def isfwht(a):
    """Inverse of the walsh hadamard transform

    Args:
        a (array): array of values

    Returns:
        array: array with inverse transformed applied, inplace
    """
    n = len(a)
    j = 1
    while j < n:
        for i in range(n):
            if (i & j) == 0:
                j1 = i + j
                x = a[i]
                y = a[j1]
                a[i], a[j1] = (x + y), (x - y)
        j *= 2
    return a


def ispow2(x):
    """am I a power of two

    Args:
        x (int): number

    Returns:
        Bool: is it a power of two? The answer
    """
    return not (x & x - 1)


def nextpow2(x):
    """Returns next power of two, or identity if x is a power of two

    Args:
        x (int): number to check

    Returns:
        int: next power of two (or x if x is a power of two)
    """
    x -= 1
    x |= x >> 1
    x |= x >> 2
    x |= x >> 4
    x |= x >> 8
    x |= x >> 16
    x |= x >> 32
    x += 1
    return x


def ilog2(x):
    """Integer log 2"""
    return int(np.log2(x))


def grayCode(x):
    """Gray code permutation of x, to change indices"""
    return x ^ (x >> 1)


def grayPermutation(a):
    """Gray permutes an array"""
    b = np.zeros(len(a))
    for i in range(len(a)):
        b[i] = a[grayCode(i)]
    return b


def invGrayPermutation(a):
    """inverse gray permutes an array"""
    b = np.zeros(len(a))
    for i in range(len(a)):
        b[grayCode(i)] = a[i]
    return b


def convertToAngles(a):
    """Converts image to angles"""
    scal = np.pi / (a.max() * 2)
    a = a * scal
    return a


def convertFromAngles(a, maxval=1, minval=0):
    """Converts image from angles"""
    scal = np.pi / (maxval * 2)
    a = a / scal
    return a


def convertToGrayscaleOld(arr, maxval=1, minval=0):
    """Converts encoded postprocessed statevector back to grayscale, normalized to maxval"""
    scal = 2 * (maxval) / np.pi
    arr = arr * scal
    # arr = ((arr - arr.min()+minval) * (1/(arr.max() - arr.min()) * maxval))
    return arr


def convertToGrayscale(arr, maxval=1, minval=0):
    """
    Scales an array so that its minimum and maximum values lie between new_min and new_max.

    Args:
        arr (numpy.ndarray): Input array to be scaled.
        new_min (float): The desired minimum value of the scaled array.
        new_max (float): The desired maximum value of the scaled array.

    Returns:
        numpy.ndarray: Scaled array with values between new_min and new_max.
    """
    old_min = np.min(arr)
    old_max = np.max(arr)
    scaled_arr = (arr - old_min) / (old_max - old_min) * (maxval - minval) + minval
    return scaled_arr


def countr_zero(n, n_bits=8):
    """Returns the number of consecutive 0 bits
    in the value of x, starting from the
    least significant bit ("right")."""
    if n == 0:
        return n_bits
    count = 0
    while n & 1 == 0:
        count += 1
        n >>= 1
    return count


def preprocess_image(img):
    """Program requires flattened transpose of image array, this returns exactly that"""
    return img.T.flatten()


def readpgm(name):
    """Reads pgm P2 files"""
    with open(name) as f:
        lines = f.readlines()
    # This ignores commented lines
    for line in list(lines):
        if line[0] == "#":
            lines.remove(line)
    # here,it makes sure it is ASCII format (P2)
    assert lines[0].strip() == "P2"
    # Converts data to a list of integers
    data = []
    for line in lines[1:]:
        data.extend([int(c) for c in line.split()])

    return (np.array(data[3:]), (data[1], data[0]), data[2])


def is_power_of_two(x):
    x = np.asarray(x)
    return (x > 0) & ((x & (x - 1)) == 0)

def pad_0(img, val=0, size_pow2=0):
    """Pads array with 0s to next power of two

    Args:
        img (numpy array): image, can be wide. Needs to be transposed prior to padding.
        val (int): the values with which to pad the img
        size_pow2 (int): The result size, which needs to be a power of two. 
                        -Defaults to nextpow2(len(img))

    Returns:
        padded image: flattened image with appropiate padding for quantum algorithm
    """
    img = np.array(img)
    img = img.flatten()
    if size_pow2 == 0:
        size_pow2 = nextpow2(len(img))
    if not is_power_of_two(size_pow2):
        raise ValueError(f"The size_pow2 arg must be a power of 2. Got {size_pow2}")
    return np.pad(img, (0, size_pow2 - len(img)), constant_values=val)


def decodeQPIXL(
    state,
    min_pixel_val=0,
    max_pixel_val=255,
    state_to_prob=np.abs,
    scaling=convertToGrayscale,
):
    """Automatically decodes qpixl output statevector

    Args:
        state (statevector array): statevector from simulator - beware of bit ordering
        max_pixel_val (int, optional): normalization value. Defaults to 255.
        state_to_prob (function): If you made some transforms, your image
                                    may be complex, how would you
                                    like to make the vector real?
    Returns:
        np.array: your image, flat
    """
    state_to_prob(state)
    pv = np.zeros(len(state) // 2)
    for i in range(0, len(state), 2):
        pv[i // 2] = np.arctan2(state[i + 1], state[i])
    return scaling(pv, max_pixel_val, min_pixel_val)


def permute_bits(b, bitlength=8, shift=1):
    """cyclic permutation of bits

    Args:
        b (integer): integer to be converted
        bitlength (int, optional): how many bits do you want to permute in. Defaults to 8.
        shift (int, optional): how many bits to shift. Defaults to 1.

    Returns:
        int: integer representation of bits
    """
    b = bin(b)
    b = b[2:].zfill(bitlength)
    b = [b[(i + shift) % len(b)] for i in range(len(b))]
    return int("".join(b), 2)


def decodeParallelQPIXL(state, qc, length, normalization_values=None):
    """Automatically decodes qpixl output statevector

    Args:
        state (statevector array): statevector from simulator - beware of bit ordering
        qc (qiskit circuit): the circuit used for the state generation
        max_pixel_val (list of tuples of ints [(min,max)], optional): normalization values, must be of same length as length. Defaults to [(0,255)]*length.
    Returns:
        np.array: your images, flat
    """
    if normalization_values is None:
        normalization_values = [(0, 255) for i in range(length)]
    decoded_data = []
    for datum in range(length):
        to_trace = list(range(length))
        _ = to_trace.pop(length - datum - 1)
        to_trace = [qc.qubits[qub] for qub in to_trace]
        traced_over_qubits = [qc.qubits.index(qubit) for qubit in to_trace]
        density_matrix = partial_trace(state, traced_over_qubits)
        probs = density_matrix.probabilities()
        test = decodeQPIXL(probs)
        ordered = [
            test[permute_bits(i, len(qc.qubits) - length, datum)]
            for i in range(len(test))
        ]
        decoded_data.append(
            convertToGrayscale(
                np.array(ordered),
                normalization_values[datum][1],
                normalization_values[datum][0],
            )
        )
    return decoded_data


def reconstruct_img(pic_vec, shape: tuple):
    """reconstruct image from decoded statevector

    Args:
        pic_vec (np.array): your decoded statevector
        shape (tuple): shape that you want the image back in

    Returns:
        np.array: array of correct image size, ready to show! May need to be transposed.
    """
    ldm = shape[0]
    holder = np.zeros(shape)
    for row in range(shape[0]):
        for col in range(shape[1]):
            holder[row, col] = pic_vec[row + col * ldm]
    return holder


class examples:
    def __init__(self) -> None:
        """Simple holder class with some example images"""
        self.space = np.array(
            [
                [0, 0, 0, 0, 1, 1, 1, 0],
                [0, 0, 0, 1, 1, 0, 0, 0],
                [1, 0, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 0, 1, 1, 0, 1],
                [0, 0, 1, 1, 1, 1, 0, 1],
                [0, 0, 1, 1, 1, 1, 0, 0],
                [0, 0, 1, 1, 1, 1, 0, 1],
                [0, 1, 1, 0, 1, 1, 0, 1],
                [1, 0, 1, 1, 1, 1, 1, 0],
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        )
        self.invader = np.array(
            [
                [0, 0, 0, 0, 1, 1, 1, 1],
                [0, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 0, 0, 1, 1, 1, 1],
                [0, 1, 0, 1, 1, 1, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 0, 0],
                [1, 1, 0, 0, 1, 1, 1, 1],
                [0, 1, 0, 1, 1, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 1],
                [0, 1, 1, 1, 1, 1, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        )