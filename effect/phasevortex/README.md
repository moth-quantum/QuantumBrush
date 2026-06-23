# Phase Vortex Brush

Phase Vortex is a stroke-following interference brush for Quantum Brush. It treats the user's stroke as a phase object inside a balanced Mach-Zehnder interferometer: every affected pixel receives a relative phase, and the output intensity follows the single-photon interference probability `P = (1 + V cos(phi)) / 2`.

The result is a set of coherent color and brightness fringes that bend around the stroke. The `Winding` control adds an orbital-angular-momentum-like phase term, turning straight fringes into vortex patterns around the clicked or drawn region.

## Parameters

- `Radius`: width of the affected region around the stroke.
- `Fringe Spacing`: distance between interference bands.
- `Winding`: angular phase circulation; positive and negative values swirl in opposite directions.
- `Strength`: how strongly the computed interference pattern is blended into the image.
- `Hue Shift`: how much the bright and dark ports push hue in opposite directions.
- `Coherence`: fringe visibility. Lower values mimic decoherence by flattening the pattern.

## Quantum Background

A balanced Mach-Zehnder interferometer splits a quantum amplitude into two paths and recombines it. A relative phase `phi` between the paths changes the probability of detecting the particle at either output port. This brush maps path distance, stroke direction, and angular winding into that phase, then uses the resulting probability field as a visual transformation.

High coherence gives sharp interference fringes. Low coherence washes them out, similar to losing phase information through environmental noise.

## Creative Use

Phase Vortex works well on long curved strokes, spirals, and circular gestures. It can create water-like caustics, energy halos, or orbital ripples while preserving the original image texture underneath. For subtle effects, lower `Strength` and `Hue Shift`; for a visible quantum-poster look, increase `Winding` and `Coherence`.

## Files

- `phasevortex.py`: brush implementation.
- `phasevortex_requirements.json`: Quantum Brush parameter metadata.
- `docs/before.png` and `docs/after.png`: generated example images.
