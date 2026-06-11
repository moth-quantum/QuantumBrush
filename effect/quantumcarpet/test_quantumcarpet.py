import unittest

import numpy as np

from effect.quantumcarpet.quantumcarpet import quantum_carpet_density, run


class QuantumCarpetTest(unittest.TestCase):
    def test_density_is_finite_and_zero_at_box_boundaries(self):
        position = np.array([0.0, 0.25, 0.5, 0.75, 1.0])
        density = quantum_carpet_density(position, np.full(5, 0.4), 6, 1.25)

        self.assertTrue(np.all(np.isfinite(density)))
        self.assertTrue(np.all(density >= 0))
        self.assertAlmostEqual(float(density[0]), 0.0, places=12)
        self.assertAlmostEqual(float(density[-1]), 0.0, places=12)

    def test_run_changes_ribbon_and_preserves_alpha_and_input(self):
        image = np.full((48, 64, 4), (24, 32, 48, 177), dtype=np.uint8)
        original = image.copy()
        path = np.column_stack((np.full(40, 24), np.arange(12, 52)))
        params = {
            "stroke_input": {"image_rgba": image, "path": path, "clicks": path[[0]]},
            "user_input": {
                "Radius": 8,
                "Modes": 7,
                "Evolution": 1.25,
                "Strength": 0.9,
                "Color": np.array([67, 217, 255]),
            },
        }

        output = run(params)

        np.testing.assert_array_equal(image, original)
        np.testing.assert_array_equal(output[..., 3], original[..., 3])
        self.assertGreater(np.count_nonzero(output[..., :3] != original[..., :3]), 0)
        np.testing.assert_array_equal(output[0, 0], original[0, 0])

    def test_run_is_deterministic(self):
        image = np.full((32, 32, 4), 255, dtype=np.uint8)
        path = np.column_stack((np.arange(6, 26), np.arange(6, 26)))
        params = {
            "stroke_input": {"image_rgba": image, "path": path, "clicks": path[[0]]},
            "user_input": {
                "Radius": 5,
                "Modes": 5,
                "Evolution": 0.75,
                "Strength": 1.0,
                "Color": np.array([20, 100, 240]),
            },
        }

        np.testing.assert_array_equal(run(params), run(params))


if __name__ == "__main__":
    unittest.main()
