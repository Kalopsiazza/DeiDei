"""Small checks for receipt trust boundary and independent clocks (stdlib only)."""
from copy import deepcopy
import unittest
from tests.rooms_endurance.candidate import FIXED, schema
from tests.rooms_endurance.run import SplitClock


class HarnessChecks(unittest.TestCase):
    def test_receipt_rejects_untrusted_execution_and_drift(self):
        receipt={**FIXED,'code_sha':'a'*40,'stage':'source_checked_pending_gui',
            'checks':dict(service='PASS',core='PASS',runtime='PASS',desktop='PASS',independent_socket='PASS',real_gui='NOT_RUN')}
        schema(receipt)
        for change in ({'command':'touch arbitrary'}, {'code_sha':'main'}, {'base_sha':'a'*40},
                       {'core_tree':'a'*40}, {'schema_version':True}, {'stage':'integrated_local_pass'}):
            with self.subTest(change=change),self.assertRaises(AssertionError):schema({**deepcopy(receipt),**change})

    def test_clock_has_independent_wall_and_monotonic_inputs(self):
        clock=SplitClock();start=clock.wall_ms();clock.offset=86400000
        self.assertEqual(clock.now_ms(),0);self.assertEqual(clock.wall_ms(),start+86400000)
        clock.advance_ms(1);self.assertEqual(clock.now_ms(),1);self.assertEqual(clock.wall_ms(),start+86400001)
        clock.offset=-86400000;self.assertEqual(clock.now_ms(),1)
