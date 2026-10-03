"""Request contents remain in memory; only boolean comparisons are emitted."""
import copy
import unittest
from fault_proxy import retry_comparison


class RetryComparisonTests(unittest.TestCase):
    def test_original_and_each_single_field_mismatch(self) -> None:
        original = {'request_id': 'synthetic-id', 'command_seq': '4',
                    'payload': {'entry_id': 'Def'}}
        self.assertTrue(all(retry_comparison(original, original).values()))
        for key, changed in [('request_id', 'new-id'), ('command_seq', '5'),
                             ('payload', {'entry_id': 'Charge'})]:
            with self.subTest(key=key):
                retry = copy.deepcopy(original)
                retry[key] = changed
                result = retry_comparison(original, retry)
                self.assertFalse(all(result.values()))
                self.assertFalse(result[key + '_same'])
                self.assertTrue(all(isinstance(value, bool) for value in result.values()))


if __name__ == '__main__':
    unittest.main()
