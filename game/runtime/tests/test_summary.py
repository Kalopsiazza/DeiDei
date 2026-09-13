"""R02-T04-b: format real core ledgers without changing any rule result."""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path
import unittest

from deidei_core.api import new_match, resolve_round
from deidei_runtime.view import ledger_summary

FIXTURES = Path(__file__).resolve().parents[3] / 'tests/rules_v1_001/fixtures'


class SummaryTests(unittest.TestCase):
    def summary(self, resolution: dict) -> list[str]:
        self.assertTrue(resolution['ok'])
        original = deepcopy(resolution)
        encoded = json.dumps(resolution, sort_keys=True, ensure_ascii=False).encode()
        profiles = {pid: {'nickname': f'玩家{pid}'} for pid in resolution['ledger']['actions']}
        result = ledger_summary(resolution, profiles)
        self.assertEqual(resolution, original)
        self.assertEqual(sha256(encoded).hexdigest(), sha256(
            json.dumps(resolution, sort_keys=True, ensure_ascii=False).encode()).hexdigest())
        self.assertNotRegex('\n'.join(result), r'六分之一单位|resource_gain|resource_spend|resource_clear|bomb_mature|reward_granted|pending_bombs|bomb_placement_count|enhanced_xiao')
        return result

    def round(self, moves: dict, updates: dict | None = None) -> dict:
        state = new_match(list(moves), 'summary-test')
        for pid, values in (updates or {}).items():
            state['players'][pid].update(values)
        return resolve_round(state, moves, {})

    def test_cancelled_charge_cloud_and_absorb(self):
        for opponent in ('Cloud', 'Absorb'):
            with self.subTest(opponent=opponent):
                resolution = self.round({'A': 'Charge', 'B': opponent}, {'B': {'dd6': '6'}})
                lines = self.summary(resolution)
                self.assertIn('玩家A：本次攒未生效，DD没有增加。', lines)
                self.assertFalse(any(line.startswith('玩家A：获得') for line in lines))
                self.assertEqual(resolution['ledger']['post_turn_players']['A']['dd6'], '0')
                if opponent == 'Absorb':
                    self.assertIn('玩家B：获得 +1 DD。', lines)
                    self.assertIn('玩家B：消耗 -1 DD。', lines)

    def test_charge_and_xiao_exact_signed_player_units(self):
        self.assertIn('玩家A：获得 +1 DD。', self.summary(self.round({'A': 'Charge', 'B': 'Charge'})))
        self.assertIn('玩家A：消耗 -1/3 DD。', self.summary(self.round(
            {'A': 'Xiao', 'B': 'Def'}, {'A': {'dd6': '2'}})))

    def test_bomb_exchange_absorb_has_no_dd_gain(self):
        lines = self.summary(self.round({'A': 'BombPragon', 'B': 'Absorb'},
                                       {'A': {'mature_bombs': '1'}, 'B': {'dd6': '6'}}))
        self.assertFalse(any('获得' in line and 'DD' in line for line in lines))
        self.assertIn('玩家A：消耗 -1 成熟层。', lines)
        self.assertIn('玩家B：消耗 -1 DD。', lines)

    def test_tian_clear_keeps_gain_then_clear_and_zero_is_not_a_gain(self):
        lines = self.summary(self.round({'A': 'Charge', 'B': 'TianLiJun'}, {'A': {'dd6': '7'}}))
        self.assertLess(lines.index('玩家A：获得 +1 DD。'), lines.index('玩家A：清空 -2又1/6 DD。'))
        repeated = self.summary(self.round({'A': 'Charge', 'B': 'TianLiJun', 'C': 'TianLiJun'}))
        self.assertEqual(sum('清空' in line for line in repeated), 1)
        self.assertFalse(any('+0' in line or '-0' in line for line in repeated))

    def test_half_and_large_clear_never_use_float_or_decimal_rounding(self):
        for amount, expected in [('3', '1/2'), ('6' + '0' * 4998 + '3', '1' + '0' * 4999 + '又1/2')]:
            with self.subTest(digits=len(amount)):
                lines = self.summary(self.round({'A': 'ZengYi', 'B': 'Def'}, {'A': {'dd6': amount}}))
                self.assertIn(f'玩家A：清空 -{expected} DD。', lines)

    def test_non_dd_resources_maturity_and_reward_have_chinese_names(self):
        bomb = self.summary(self.round({'A': 'Bomb', 'B': 'Def'}, {'A': {'dd6': '6'}}))
        self.assertIn('玩家A：获得 +1 待成熟炸药。', bomb)
        cleared = self.summary(self.round({'A': 'ZengYi', 'B': 'Def'},
            {'A': {'enhanced_xiao': True, 'bomb_placement_count': '2'}}))
        for line in ('玩家A：清空 -1 强化削。', '玩家A：清空 -2 炸药放置次数。'):
            self.assertIn(line, cleared)
        case = json.loads((FIXTURES / 'C065.json').read_text())[0]
        state = new_match(**case['input']['new_match'])
        for step in case['input']['steps'][:5]:
            resolution = resolve_round(state, **step)
            state = resolution['next_state']
        self.assertIn('玩家A：奖励发放 +1 奖励。', self.summary(resolution))

    def test_restart_uses_pre_reset_ledger_then_explains_reset(self):
        case = json.loads((FIXTURES / 'C074.json').read_text())[0]
        resolution = resolve_round(**case['input'])
        self.assertEqual(resolution['transition']['kind'], 'restart_survivors')
        lines = self.summary(resolution)
        self.assertTrue(any('炸药成熟 +1 成熟层' in line for line in lines))
        self.assertTrue(any('消耗 -3 DD' in line for line in lines))
        self.assertEqual(lines[-1], '存活者进入新局，资源归零。')

    def test_other_unapplied_event_is_not_reported_as_a_gain(self):
        # Formatter-only defensive case; the real core output remains untouched.
        resolution = deepcopy(self.round({'A': 'Charge', 'B': 'Cloud'}))
        event = next(e for e in resolution['ledger']['events'] if e['result'] == 'suppressed')
        event['reason_code'] = None
        lines = self.summary(resolution)
        self.assertIn('玩家A：本次资源变动未生效。', lines)
        self.assertFalse(any(line.startswith('玩家A：获得') for line in lines))


if __name__ == '__main__':
    unittest.main()
