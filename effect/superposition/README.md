# Superposition Brush

## Background and Motivation
In quantum mechanics, a system can exist in a linear combination of multiple distinct states simultaneously. This phenomenon is known as **Quantum Superposition**. A famous macroscopic illustration of this is Schrödinger's cat, which is both alive and dead until an observation collapses the wavefunction. 

The *Superposition Brush* seeks to capture this fundamental quantum characteristic visually in the context of digital painting. When you draw a stroke, instead of a definitive, single path, the stroke is probabilistically dispersed into multiple potential paths.

## How it works
Under the hood, this brush utilizes an `AerSimulator` from `qiskit_aer` to evaluate a pure superposition quantum circuit constructed using Hadamard (`H`) gates. By measuring this quantum state into classical bitstrings, the algorithm maps the measurements to a physical 2D scatter pattern around the primary stroke, simulating positional uncertainty. 

The brush renders a primary solid stroke and a number of 'ghost' strokes. The offsets of these 'ghost' segments actively demonstrate the resulting probability distribution. 

## Screenshots
*(Provide your own screenshots showcasing the superposition ghost strokes trailing your main path!)*

## Usage
- **Radius**: Modifies the base width of your stroke and the proportional size of your ghost strokes.
- **Strength**: Increases the opacity of the main color and the probabilistic ghosts.
- **Spread**: Represents the variance (analogous to the width of the wave packet). A wider spread will push the superposition ghosts further apart.
- **Color**: Select the fundamental color eigenvalue for this stroke.
