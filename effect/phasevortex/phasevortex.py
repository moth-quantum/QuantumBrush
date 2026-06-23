import colorsys
import numpy as np


def _safe_path(path):
    path = np.asarray(path, dtype=float)
    if path.ndim != 2 or path.shape[1] != 2:
        return np.empty((0, 2), dtype=float)
    return path


def _rgb_to_hls(rgb):
    flat = rgb.reshape(-1, 3)
    converted = [colorsys.rgb_to_hls(float(r), float(g), float(b)) for r, g, b in flat]
    return np.asarray(converted, dtype=float).reshape(rgb.shape)


def _hls_to_rgb(hls):
    flat = hls.reshape(-1, 3)
    converted = [colorsys.hls_to_rgb(float(h), float(l), float(s)) for h, l, s in flat]
    return np.asarray(converted, dtype=float).reshape(hls.shape)


def _points_within_radius(points, radius, border):
    points = np.asarray(points, dtype=int)
    if len(points) == 0:
        return np.empty((0, 2), dtype=int)

    min_yx = np.maximum(points.min(axis=0) - radius - 1, [0, 0])
    max_yx = np.minimum(points.max(axis=0) + radius + 1, [border[0] - 1, border[1] - 1])
    yy, xx = np.mgrid[min_yx[0]:max_yx[0] + 1, min_yx[1]:max_yx[1] + 1]
    grid = np.stack([yy.ravel(), xx.ravel()], axis=1)

    mask = np.zeros(len(grid), dtype=bool)
    batch = 2048
    radius_sq = radius * radius
    for start in range(0, len(grid), batch):
        stop = start + batch
        delta = grid[start:stop, None, :] - points[None, :, :]
        mask[start:stop] = np.min(np.sum(delta * delta, axis=2), axis=1) <= radius_sq
    return grid[mask]


def _anchor_points(path, clicks):
    clicks = np.asarray(clicks, dtype=float)
    if clicks.ndim == 2 and clicks.shape[1] == 2 and len(clicks) > 0:
        return clicks
    if len(path) == 0:
        return np.empty((0, 2), dtype=float)
    return np.array([path[0], path[len(path) // 2], path[-1]], dtype=float)


def _nearest_path_distance(region, path, max_points=500):
    if len(path) == 0:
        return np.zeros(len(region), dtype=float)

    if len(path) > max_points:
        sample_idx = np.linspace(0, len(path) - 1, max_points).astype(int)
        path = path[sample_idx]

    # Batched squared distances keep the brush responsive on large strokes.
    distances = np.empty(len(region), dtype=float)
    batch = 2048
    for start in range(0, len(region), batch):
        stop = start + batch
        delta = region[start:stop, None, :] - path[None, :, :]
        distances[start:stop] = np.sqrt(np.min(np.sum(delta * delta, axis=2), axis=1))
    return distances


def _mach_zehnder_probability(phase, coherence):
    # A single photon entering a balanced Mach-Zehnder interferometer exits one
    # port with P = (1 + V cos(phi)) / 2. Coherence acts as fringe visibility.
    return 0.5 + 0.5 * np.clip(coherence, 0.0, 1.0) * np.cos(phase)


def _phase_field(region, path, anchors, radius, fringe_spacing, winding):
    center = anchors.mean(axis=0) if len(anchors) else path[len(path) // 2]
    rel = region.astype(float) - center
    angle = np.arctan2(rel[:, 0], rel[:, 1])
    radial = np.sqrt(np.sum(rel * rel, axis=1))
    path_dist = _nearest_path_distance(region, path)

    stroke_axis = path[-1] - path[0] if len(path) > 1 else np.array([1.0, 0.0])
    norm = np.linalg.norm(stroke_axis)
    if norm < 1e-6:
        stroke_axis = np.array([1.0, 0.0])
        norm = 1.0
    stroke_axis = stroke_axis / norm
    momentum = (region.astype(float) - center) @ stroke_axis / max(fringe_spacing, 1e-6)

    vortex = winding * angle
    ripples = 2 * np.pi * (path_dist / max(fringe_spacing, 1e-6))
    envelope = np.clip(1.0 - path_dist / max(radius, 1), 0.0, 1.0)
    radial_chirp = 0.35 * np.sqrt(radial / max(radius, 1))
    phase = ripples + vortex + momentum + radial_chirp
    return phase, envelope


def run(params):
    image = params["stroke_input"]["image_rgba"].copy()
    assert image.shape[-1] == 4, "Image must be RGBA format"

    path = _safe_path(params["stroke_input"].get("path", []))
    if len(path) == 0:
        return image

    radius = int(params["user_input"]["Radius"])
    fringe_spacing = float(params["user_input"]["Fringe Spacing"])
    winding = float(params["user_input"]["Winding"])
    strength = float(params["user_input"]["Strength"])
    hue_shift = float(params["user_input"]["Hue Shift"])
    coherence = float(params["user_input"]["Coherence"])

    height, width = image.shape[:2]
    region = _points_within_radius(path.astype(int), radius, border=(height, width))
    if len(region) == 0:
        return image

    # Clipping at the border can duplicate coordinates, so keep each pixel once.
    region = np.unique(region, axis=0)
    anchors = _anchor_points(path, params["stroke_input"].get("clicks", []))
    phase, envelope = _phase_field(region, path, anchors, radius, fringe_spacing, winding)
    probability = _mach_zehnder_probability(phase, coherence)

    selection = image[region[:, 0], region[:, 1]].astype(np.float32) / 255.0
    hls = _rgb_to_hls(selection[..., :3])

    signed_fringe = (probability - 0.5) * 2.0
    local_strength = strength * envelope
    hls[..., 0] = (hls[..., 0] + hue_shift * signed_fringe * local_strength) % 1.0
    hls[..., 1] = np.clip(
        hls[..., 1] + 0.28 * signed_fringe * local_strength,
        0.0,
        1.0,
    )
    hls[..., 2] = np.clip(
        hls[..., 2] * (1.0 + 0.22 * local_strength * np.abs(signed_fringe)),
        0.0,
        1.0,
    )

    rgb = (_hls_to_rgb(hls) * 255).astype(np.uint8)
    alpha = selection[..., 3:4]
    blended_rgb = (
        selection[..., :3] * (1.0 - local_strength[:, None] * alpha)
        + (rgb.astype(np.float32) / 255.0) * (local_strength[:, None] * alpha)
    )
    image[region[:, 0], region[:, 1], :3] = np.clip(blended_rgb * 255, 0, 255).astype(np.uint8)
    image[region[:, 0], region[:, 1], 3] = np.maximum(
        image[region[:, 0], region[:, 1], 3],
        (255 * np.clip(local_strength, 0.0, 1.0)).astype(np.uint8),
    )
    return image
