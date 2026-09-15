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

    def test_rate_windows_accept_only_causal_connection_changes(self):
        from tests.rooms_endurance.faults import check_rate_state
        before = dict(room_id='room', seq='5', view=dict(self={}, members=[dict(player_id='member', connected=True)],
            match=dict(turn='1', dd6='0'), policy_revision='1', policy=dict(turn_ms=10000),
            timer=dict(deadline_at_ms=10000, remaining_ms=10000)))
        after = deepcopy(before)
        check_rate_state(before, after, 'member')
        disconnected = deepcopy(before); disconnected['seq'] = '9'
        disconnected['view']['members'][0]['connected'] = False
        check_rate_state(before, disconnected, 'member', False)
        resumed = deepcopy(before); resumed['seq'] = '12'
        check_rate_state(disconnected, resumed, 'member', True)
        check_rate_state(resumed, deepcopy(resumed), 'member')
        for label in ('seq', 'match', 'policy', 'deadline', 'connected', 'room'):
            bad = deepcopy(after)
            if label == 'seq': bad['seq'] = '6'
            elif label == 'match': bad['view']['match']['dd6'] = '6'
            elif label == 'policy': bad['view']['policy']['turn_ms'] = 5000
            elif label == 'deadline': bad['view']['timer']['deadline_at_ms'] += 1
            elif label == 'room': bad['room_id'] = 'other'
            else: bad['view']['members'][0]['connected'] = False
            with self.subTest(label=label), self.assertRaises(AssertionError):
                check_rate_state(before, bad, 'member')
        with self.assertRaises(AssertionError): check_rate_state(before, resumed, 'member', True)
        disconnected['seq'] = '4'
        with self.assertRaises(AssertionError): check_rate_state(before, disconnected, 'member', False)
