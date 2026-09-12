"""Harness self-checks only. Test doubles below provide no game-engine evidence."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

try:
    from . import author_fixtures as author
    from .mutation_check import apply_patch_copy
    from .run_acceptance import check_events, check_result, run_fixture
    from .validate_fixtures import HERE, ENTRIES, FixtureError, load_fixtures, validate_suite, validate_expected, reject_duplicate_keys
except ImportError:
    import author_fixtures as author
    from mutation_check import apply_patch_copy
    from run_acceptance import check_events, check_result, run_fixture
    from validate_fixtures import HERE, ENTRIES, FixtureError, load_fixtures, validate_suite, validate_expected, reject_duplicate_keys


class ChargeTransportDouble:
    """One canned response for harness transport tests; does not calculate any move."""
    def __init__(self, fixture: dict):
        self.fixture = fixture
        e = fixture['expected']
        actions = deepcopy(e['actions'])
        for action in actions.values():
            action.setdefault('eligible_targets',[])
            action['defense_primary']['match_rule'] = 'R12'
        inp = fixture['input']['state']
        self.result = dict(ok=True,ledger=dict(match_id=inp['match_id'],game_id=inp['game_id'],turn_index=inp['turn_index'],
                           actions=actions,events=[],kills=deepcopy(e['kills']),eliminated_ids=[],post_turn_players=deepcopy(e['post_turn_players'])),
                           next_state=deepcopy(e['next_state']),transition=deepcopy(e['transition']))

    def list_options(self, state: dict, player_id: str) -> list:
        zero = {k:'0' for k in ('dd6','lightning','nx_charge','mature_bombs','reward_stock')}
        return [dict(entry_id=entry,doc_id=f'E{i:02}',available=True,reason_code=None,forced=False,
                     required=deepcopy(zero),spend=deepcopy(zero)) for i,entry in enumerate(ENTRIES,1)]

    def resolve_round(self, state: dict, submissions: dict, choice_tokens: dict) -> dict:
        return deepcopy(self.result)


class HarnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = load_fixtures()

    def fixture(self, case: str, variant: str | None = None) -> dict:
        return deepcopy(next(f for f in self.fixtures if f['case_id']==case and (variant is None or f['variant']==variant)))

    def test_complete_authored_suite_and_reproducibility(self):
        summary = validate_suite(self.fixtures)
        self.assertEqual((summary['case_groups'],summary['entries'],summary['engine_passed']),(82,33,0))
        self.assertEqual(summary['scopes']['session'],2)
        author.CASES.clear()
        author.authored()
        keyed = lambda fixtures: {(f['case_id'],f['variant']):f for f in fixtures}
        self.assertEqual(keyed(author.CASES),keyed(self.fixtures))

    def test_corrupt_fixtures_are_rejected(self):
        def damage(case,fn):
            suite = deepcopy(self.fixtures)
            target = next(f for f in suite if f['case_id']==case)
            fn(target)
            return suite
        mutations = [
            ('C001',lambda f:f['expected'].pop('post_turn_players')),
            ('C001',lambda f:f['expected']['post_turn_players']['A'].pop('cloud_uses')),
            ('C001',lambda f:f['expected'].pop('required_events')),
            ('C001',lambda f:f['expected']['next_state']['players']['A'].update(dd6='01')),
            ('C001',lambda f:f['input']['state']['players']['A'].update(dd6=True)),
            ('C001',lambda f:f.update(rule_ids=[])),
            ('C026',lambda f:f['expected']['actions']['A'].pop('eligible_targets')),
            ('C057',lambda f:f['input']['state']['players']['A']['pending_bombs'][0].update(game_id='old-game')),
            ('C066',lambda f:f['input']['state']['players']['A'].update(last_actual_move=None)),
            ('C071',lambda f:f['input']['state']['players']['A'].update(reward_due_turn=None)),
            ('C062',lambda f:f['input']['choice_tokens'].update(A=True)),
            ('C081',lambda f:f['expected']['required_events'][0].update(count=0)),
            ('C082',lambda f:f['expected']['next_state']['players']['A'].update(zeng_state='ready')),
        ]
        for case,fn in mutations:
            with self.subTest(case=case,mutation=fn):
                with self.assertRaises(FixtureError):
                    validate_suite(damage(case,fn))
        for case,variant in [('C001',None),('C008','PragonDef'),('C063','token_1'),('C075','ZhangXinWei_NieXiang_vs_Reflect'),('C073','tokens_A0_B1')]:
            with self.subTest(missing=(case,variant)):
                suite = [f for f in self.fixtures if not (f['case_id']==case and (variant is None or f['variant']==variant))]
                with self.assertRaises(FixtureError):
                    validate_suite(suite)
        with self.assertRaises(FixtureError):
            json.loads('{"A":1,"A":2}',object_pairs_hook=reject_duplicate_keys)

    def test_transport_double_passes_only_harness_and_missing_outputs_fail(self):
        fixture = self.fixture('C001')
        api = ChargeTransportDouble(fixture)
        self.assertEqual(run_fixture(api,fixture)['status'],'PASS')
        for field in ('actions','events','kills','post_turn_players'):
            broken = ChargeTransportDouble(fixture)
            broken.result['ledger'].pop(field)
            with self.subTest(field=field),self.assertRaises(FixtureError):
                run_fixture(broken,fixture)
        broken = ChargeTransportDouble(fixture)
        broken.result['ledger']['post_turn_players']['A']['dd6'] = '60'
        with self.assertRaises(FixtureError):
            run_fixture(broken,fixture)

    def test_input_mutation_and_cross_player_aliases_fail(self):
        fixture = self.fixture('C001')
        class Mutating(ChargeTransportDouble):
            def resolve_round(self,state,submissions,choice_tokens):
                state['players']['A']['dd6'] = '999'
                return super().resolve_round(state,submissions,choice_tokens)
        with self.assertRaisesRegex(FixtureError,'mutated'):
            run_fixture(Mutating(fixture),fixture)
        api = ChargeTransportDouble(fixture)
        api.result['ledger']['post_turn_players']['B']['pending_bombs'] = api.result['ledger']['post_turn_players']['A']['pending_bombs']
        with self.assertRaisesRegex(FixtureError,'share mutable'):
            run_fixture(api,fixture)

    def test_event_counts_and_false_success_are_rejected(self):
        fixture = self.fixture('C001')
        api = ChargeTransportDouble(fixture)
        fixture['expected']['required_events'] = [{'match':{'kind':'reward_granted'},'count':1}]
        with self.assertRaisesRegex(FixtureError,'Required event'):
            run_fixture(api,fixture)
        rejected = self.fixture('C002')
        with self.assertRaises(FixtureError):
            check_result({'ok':True},rejected['expected'],rejected['input'])
        check_result({'ok':False,'error':{'code':'UNAVAILABLE_MOVE','player_id':'A','field':'submissions'}},rejected['expected'],rejected['input'])

    def test_return_links_and_duplicate_reward_events(self):
        fixture = self.fixture('C053')
        original = dict(event_id='original',phase='P2',kind='attack',actor_id='A',target_id='B',
                        amount6='21',resource=None,resource_delta=None,source_event_id=None,
                        rule_ids=['R11','R20'],result='blocked',reason_code=None)
        returned = dict(original,event_id='return',phase='P3',kind='return',actor_id='B',target_id='A',
                        source_event_id='original',result='applied')
        check_events([original,returned],fixture['input'])
        for changes in [{'amount6':'60000'},{'source_event_id':None},{'source_event_id':'missing'},{'phase':'P2'}]:
            with self.subTest(changes=changes),self.assertRaises(FixtureError):
                check_events([original,dict(returned,**changes)],fixture['input'])
        charge = self.fixture('C001')
        api = ChargeTransportDouble(charge)
        charge['expected']['required_events'] = [{'match':{'kind':'reward_granted'},'count':1}]
        reward = dict(original,event_id='grant1',phase='P4',kind='reward_granted',amount6=None,
                      resource='reward_stock',resource_delta='1',rule_ids=['R25'],result='applied')
        api.result['ledger']['events'] = [reward]
        run_fixture(api,charge)  # Event transport only; this is not a rule fixture.
        api.result['ledger']['events'].append(dict(reward,event_id='grant2'))
        with self.assertRaisesRegex(FixtureError,'Required event'):
            run_fixture(api,charge)

    def test_missing_broken_and_session_paths_do_not_claim_pass(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            cmd = [sys.executable,str(HERE/'run_acceptance.py'),'--core',str(root)]
            result = subprocess.run(cmd,capture_output=True,text=True)
            self.assertEqual(result.returncode,2)
            self.assertEqual(json.loads(result.stdout)['engine_passed'],0)
            self.assertEqual(json.loads(result.stdout)['status'],'ENGINE_NOT_AVAILABLE')
            result = subprocess.run(cmd+['--case','C081/session_request_replay'],capture_output=True,text=True)
            self.assertEqual(result.returncode,3)
            self.assertEqual(json.loads(result.stdout)['status'],'SESSION_NOT_AVAILABLE')
            (root/'deidei_core').mkdir()
            (root/'deidei_core'/'api.py').write_text('raise RuntimeError("broken import")\n')
            result = subprocess.run(cmd,capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            self.assertEqual(json.loads(result.stdout)['status'],'ENGINE_IMPORT_ERROR')

    def test_mutations_use_exact_context_and_stay_inside_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root/'api.py').write_text('answer = 1\n')
            apply_patch_copy(root,{'path':'api.py','find':'answer = 1','replace':'answer = 2'})
            self.assertEqual((root/'api.py').read_text(),'answer = 2\n')
            for patch in [
                {'path':'../outside.py','find':'x','replace':'y'},
                {'path':'api.py','find':'answer = 1','replace':'answer = 2'},
                {'path':'api.py','find':'answer = 2','replace':'answer = 2'},
            ]:
                with self.subTest(patch=patch),self.assertRaises(ValueError):
                    apply_patch_copy(root,patch)
        result = subprocess.run([sys.executable,str(HERE/'mutation_check.py')],capture_output=True,text=True)
        self.assertEqual(result.returncode,2)
        self.assertEqual(json.loads(result.stdout)['mutations_killed'],0)


if __name__=='__main__':
    unittest.main(verbosity=2)
