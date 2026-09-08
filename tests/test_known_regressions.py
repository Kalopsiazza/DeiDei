"""Explicitly tracked legacy defect; do not hide new failures this way."""
from copy import deepcopy
import unittest

from deidei_env import Move, PlayerState, simulate_turn


class KnownRegressionTests(unittest.TestCase):
    @unittest.expectedFailure
    def test_simulation_does_not_mutate_input_bomb_lists(self):
        """Issue #1: remove expectedFailure when state copying is fixed."""
        p, c = PlayerState(dd=6), PlayerState()
        before = deepcopy((p, c))
        simulate_turn(p, c, Move.Bomb, Move.Charge)
        self.assertEqual((p, c), before)


if __name__ == "__main__":
    unittest.main()
