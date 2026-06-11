"""Paint particle-in-a-box interference patterns along a stroke."""

import numpy as np


def quantum_carpet_density(position, time, modes, evolution):
    """Return normalized particle-in-a-box probability densities.

    ``position`` and ``time`` are arrays in the interval [0, 1].  The brush
    starts from a localized wave packet represented by a weighted sum of box
    eigenstates, then evolves each mode with its characteristic n-squared
    phase.
    """

    position = np.asarray(position, dtype=np.float64)
    time = np.asarray(time, dtype=np.float64)
    mode_numbers = np.arange(1, modes + 1, dtype=np.float64)
    weights = np.exp(-0.32 * (mode_numbers - 1))

    spatial_modes = np.sin(np.pi * position[..., None] * mode_numbers)
    phases = np.exp(
        -2j
        * np.pi
        * evolution
        * time[..., None]
        * mode_numbers**2
    )
    amplitude = np.sum(weights * spatial_modes * phases, axis=-1)
    density = np.abs(amplitude) ** 2
    return density / np.sum(weights) ** 2


def _deduplicate_path(path):
    path = np.asarray(path, dtype=np.int64)
    if path.ndim != 2 or path.shape[1] != 2 or len(path) == 0:
        raise ValueError("Stroke path must be a non-empty array of (y, x) points")
    if len(path) == 1:
        return path
    keep = np.concatenate(([True], np.any(path[1:] != path[:-1], axis=1)))
    return path[keep]


def _stroke_region(path, radius, image_shape, chunk_size=4096):
    """Map pixels near a stroke to signed transverse position and path time."""

    height, width = image_shape
    minimum = np.maximum(path.min(axis=0) - radius, (0, 0))
    maximum = np.minimum(path.max(axis=0) + radius, (height - 1, width - 1))

    ys = np.arange(minimum[0], maximum[0] + 1)
    xs = np.arange(minimum[1], maximum[1] + 1)
    grid_y, grid_x = np.meshgrid(ys, xs, indexing="ij")
    candidates = np.column_stack((grid_y.ravel(), grid_x.ravel()))

    tangents = np.empty_like(path, dtype=np.float64)
    if len(path) == 1:
        tangents[0] = (0.0, 1.0)
    else:
        tangents[0] = path[1] - path[0]
        tangents[-1] = path[-1] - path[-2]
        if len(path) > 2:
            tangents[1:-1] = path[2:] - path[:-2]
    lengths = np.linalg.norm(tangents, axis=1, keepdims=True)
    tangents = tangents / np.maximum(lengths, 1.0)
    normals = np.column_stack((-tangents[:, 1], tangents[:, 0]))

    selected = []
    transverse = []
    times = []
    for start in range(0, len(candidates), chunk_size):
        points = candidates[start : start + chunk_size]
        offsets = points[:, None, :] - path[None, :, :]
        squared_distances = np.sum(offsets**2, axis=2)
        nearest = np.argmin(squared_distances, axis=1)
        nearest_distance = np.sqrt(squared_distances[np.arange(len(points)), nearest])
        inside = nearest_distance <= radius
        if not np.any(inside):
            continue

        inside_points = points[inside]
        inside_nearest = nearest[inside]
        inside_offsets = inside_points - path[inside_nearest]
        signed_distance = np.sum(inside_offsets * normals[inside_nearest], axis=1)

        selected.append(inside_points)
        transverse.append(np.clip(0.5 + signed_distance / (2 * radius), 0.0, 1.0))
        times.append(inside_nearest / max(len(path) - 1, 1))

    if not selected:
        return (
            np.empty((0, 2), dtype=np.int64),
            np.empty(0, dtype=np.float64),
            np.empty(0, dtype=np.float64),
        )
    return np.vstack(selected), np.concatenate(transverse), np.concatenate(times)


def run(params):
    """Apply the Quantum Carpet effect and return an RGBA uint8 image."""

    image = np.asarray(params["stroke_input"]["image_rgba"])
    if image.ndim != 3 or image.shape[-1] != 4:
        raise ValueError("Image must be RGBA format")
    if image.dtype != np.uint8:
        raise ValueError("Image must use uint8 channels")

    radius = int(params["user_input"]["Radius"])
    modes = int(params["user_input"]["Modes"])
    evolution = float(params["user_input"]["Evolution"])
    strength = float(params["user_input"]["Strength"])
    color = np.asarray(params["user_input"]["Color"], dtype=np.float64)

    if radius <= 0:
        raise ValueError("Radius must be greater than zero")
    if not 2 <= modes <= 16:
        raise ValueError("Modes must be between 2 and 16")
    if evolution <= 0:
        raise ValueError("Evolution must be greater than zero")
    if not 0 <= strength <= 1:
        raise ValueError("Strength must be between zero and one")
    if color.shape != (3,) or np.any((color < 0) | (color > 255)):
        raise ValueError("Color must contain three channels between 0 and 255")

    path = _deduplicate_path(params["stroke_input"]["path"])
    coordinates, position, time = _stroke_region(path, radius, image.shape[:2])
    output = image.copy()
    if len(coordinates) == 0:
        return output

    density = quantum_carpet_density(position, time, modes, evolution)
    density /= max(float(np.max(density)), np.finfo(np.float64).eps)
    blend = (strength * np.sqrt(density))[..., None]

    y, x = coordinates.T
    original = output[y, x, :3].astype(np.float64)
    output[y, x, :3] = np.clip(
        original * (1.0 - blend) + color * blend,
        0,
        255,
    ).astype(np.uint8)
    return output
