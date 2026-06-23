# Quantum Carpet

Quantum Carpet paints the interference pattern of a quantum particle confined
to a one-dimensional box. The transverse direction across the brush is the
particle's position, while progress along the stroke acts as time.

![Quantum Carpet before and after](https://github.com/user-attachments/assets/c95217d1-f798-4782-99e9-222d39506cf5)

## Quantum background

A particle in a box has stationary wave functions
`sin(n * pi * x)` and energy levels proportional to `n^2`. Quantum Carpet
starts with a localized wave packet made from several of these eigenstates.
As the stroke advances, every mode accumulates phase at its own `n^2` rate.
Their constructive and destructive interference produces the bright bands,
dark canals, and partial revivals known as a quantum carpet.

This is a deterministic wave simulation rather than a random texture. Drawing
the same path with the same settings reproduces the same interference pattern.

## Controls

- **Radius** sets the width of the particle-in-a-box ribbon.
- **Modes** sets how many energy eigenstates form the wave packet. More modes
  create finer interference structure.
- **Evolution** sets how quickly phase evolves along the stroke.
- **Strength** controls the blend between the canvas and the interference.
- **Color** selects the color revealed by high probability density.

Long, gently curving strokes show the revival structure most clearly. A higher
Evolution value fits more quantum evolution into the same physical stroke.

## Validation

From the repository root:

```bash
python -m unittest effect.quantumcarpet.test_quantumcarpet
python -m effect.quantumcarpet.generate_examples
```

The implementation depends only on NumPy. AI assistance was used for repository
navigation, implementation drafting, and test review; the result was manually
reviewed and locally verified.
