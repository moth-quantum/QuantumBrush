# Quantum Walk brush

Spreads paint along your stroke the way a quantum particle spreads on a line.
A continuous-time quantum walk sends two bright lobes racing out to the ends of
the stroke with interference fringes rippling between them. Turn the coherence
down and the same brush collapses to ordinary diffusion, so you can watch the
quantum behaviour appear and disappear on one canvas.

![before and after](screenshots/coherence_strip.png)

Left to right: coherence 0.0, 0.5 and 1.0 for the same stroke, time and colour.
The left panel is a single smooth blob (classical heat spreading). The right
panel is the quantum walk: a light-cone with two fast lobes and fringes in
between.

## What it does

Pick a stroke, a colour and a spreading time. The brush samples points along the
stroke into a line graph, places a walker in the middle, and evolves it. Each
site then deposits the target colour with an opacity equal to the walker's
probability of being there. High probability means strong colour, low
probability means faint colour.

The `Coherence` parameter is the heart of the brush. `H` is the graph Laplacian
`L = D - A` of the line (`A` is the adjacency, `D` the diagonal of site degrees),
and both walks run on that same `H`:

- `Coherence = 1.0` is the continuous-time quantum walk. The walker amplitude
  evolves as `e^{-iHt}` and the site probability is `|e^{-iHt}|^2`. It spreads
  ballistically (the front moves at a constant speed) and shows interference
  fringes.
- `Coherence = 0.0` is the classical continuous-time random walk. The site
  probability evolves as `e^{-Ht}`, the heat kernel of the same Laplacian. Since
  `L` annihilates the all-ones vector, `e^{-Ht}` is a stochastic matrix, so this
  is read straight off as a probability (never squared) and conserves
  probability exactly. The paint just diffuses outward from the centre, no
  fringes.
- Values in between are the convex blend `(1 - c) * e^{-Ht} + c * |e^{-iHt}|^2`
  of the two distributions, so the result stays a valid probability distribution
  and you can dial in exactly how "quantum" the stroke looks.

## Parameters

- **Radius**: how wide the paint is around each point on the stroke.
- **Time**: how long the walk runs. Longer time spreads the colour farther.
- **Coherence**: 1.0 is a quantum walk, 0.0 is classical diffusion, in between
  blends them.
- **Steps**: Trotter steps for the quantum-circuit evolution. More steps means a
  more accurate circuit.
- **Target Color**: the colour the walk paints with.

## The quantum part

A continuous-time quantum walk is the quantum analogue of a classical random
walk. On a graph with Laplacian `H = L = D - A`, a classical walker's
probability vector evolves under the heat equation `dp/dt = -H p`, so
`p(t) = e^{-Ht} p(0)`. A quantum walker's amplitude vector evolves under the
Schrodinger equation `e^{-iHt}` on the same `H`, and the probability is the
squared amplitude.

That single `i` changes everything. The classical walk reaches a distance that
grows like `sqrt(t)`. The quantum walk reaches a distance that grows like `t`,
so it spreads quadratically faster, and because amplitudes can interfere the
distribution develops the fringed, double-peaked light-cone you see on the
right above. This faster spreading is the property quantum-walk search
algorithms exploit, and here it is the thing you paint with.

The quantum walk is built and run as a real quantum circuit. The line-graph
Laplacian is turned into a `SparsePauliOp`, evolved with a Trotterised
`PauliEvolutionGate` on a qubit register, and read out as a statevector. The
brush also computes the same walk by direct matrix exponential and uses that as
a reference, so the circuit result is checked against exact physics every time
it runs at full coherence. A 32-site stroke runs on a 5-qubit register.

## Creative intent

Most digital brushes blur or smudge, which is diffusion. This brush gives you a
spreading behaviour that diffusion cannot produce: paint that travels outward in
a sharp front and leaves a regular ripple of lighter and darker bands behind it.
It is most striking on dark backgrounds with a bright colour, where the fringes
read as a row of glowing beads. Because the coherence dial crosses smoothly from
classical to quantum, a single stroke can be used to show, literally, what makes
a quantum walk different from a classical one.

## Implementation notes

- Pure Python in `qwalk.py`. The `run(params)` entry point follows the same
  contract as the other brushes and returns a uint8 RGBA image the host app
  composites onto the canvas.
- Dependencies: `numpy`, `qiskit` and `scipy` (see `qwalk_requirements.json`).
  These are the same libraries the existing quantum brushes already pull in.
- At full coherence the brush runs the walk as a Trotterised quantum circuit and
  checks it against the exact matrix-exponential result, so the circuit output is
  validated against the physics on every run.
