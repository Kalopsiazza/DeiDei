"""Validate independent fixtures without importing or running a rule engine."""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
from typing import Any, Iterator

HERE = Path(__file__).resolve().parent
VERSION = 'classic-1.0.1'
ENTRIES = 'Charge Bi Def Three ThreeDef BigBi Reflect SelfBi Cloud Bomb Xiao Pragon PragonDef Volvo VolvoDef RotateThree XiaoBei FlipVolvo Shell Absorb NieXiang NieXiangDef JuYan TianLiJun ZhangXinWei LiQiang BombPragon BombVolvo BombFlipVolvo FreeThree FreeRotateThree ZengYi ZengRewardBigBi'.split()
ACTUAL = set(ENTRIES) - {'ZhangXinWei','BombPragon','BombVolvo','BombFlipVolvo','FreeThree','FreeRotateThree','ZengRewardBigBi'}
COPYABLE = {'Three','BigBi','Pragon','Volvo','RotateThree','XiaoBei','FlipVolvo','Shell','NieXiang'}
ORIGINS = {'normal','bomb','lightning','zhang','zeng_reward'}
RESOURCES = {'dd6','lightning','nx_charge','mature_bombs','reward_stock'}
QUANTITIES = {'dd6','lightning','nx_charge','mature_bombs','bomb_placement_count','cloud_uses','tian_uses'}
BOOLS = {'zhang_used','liq_used','enhanced_xiao'}
PLAYER_FIELDS = QUANTITIES | BOOLS | {'pending_bombs','last_actual_move','latest_copyable_move','zeng_state','reward_due_turn'}
STATE_FIELDS = {'schema_version','rules_version','match_id','game_id','game_index','turn_index','roster','active_ids','status','winner_id','players'}
ACTION_FIELDS = {'entry_id','actual_move','origin','branch','condition','eligible_targets','is_recovery','enhanced_xiao','attack6','defense_primary','defense_return','spend'}
EVENT_FIELDS = {'event_id','phase','kind','actor_id','target_id','amount6','resource','resource_delta','source_event_id','rule_ids','result','reason_code'}
EVENT_KINDS = {'attack','return','direct_elimination','self_elimination','resource_gain','resource_spend','resource_clear','bomb_mature','reward_granted','history_updated'}
ERRORS = {'INVALID_STATE','INVALID_SUBMISSION','UNAVAILABLE_MOVE','MISSING_CHOICE_TOKEN','INVALID_CHOICE_TOKEN','MATCH_FINISHED','UNSUPPORTED_RULES_VERSION'}
PROPERTY_NAMES = {'repeat','permutation','json_roundtrip','no_aliases','fresh_reset','return_domain','copy_record','token_independence'}
REQUIRED_VARIANTS = {
    8:set('ThreeDef PragonDef VolvoDef NieXiangDef'.split()),
    9:set('ThreeDef PragonDef VolvoDef NieXiangDef'.split()),
    10:set('ThreeDef PragonDef VolvoDef NieXiangDef'.split()),
    12:{'plain_xiao','enhanced_xiao','bi'},13:{'buff_not_stacked'},
    16:{f'prior_{n}' for n in (0,1,2,3,8)},24:{'Absorb','Reflect'},33:{'Absorb','Reflect'},
    40:{'no_record','used'},51:{'XiaoBei','Shell'},52:{'Absorb','Cloud'},
    55:{f'placement_{n}' for n in (1,2,3,4,8)},
    57:set('BombPragon BombVolvo BombFlipVolvo FreeThree FreeRotateThree'.split()),
    62:{'token_0','token_1'},63:{'token_0','token_1'},68:{'waiting','ready','recovery'},
    72:{'ZhangXinWei','LiQiang','ZengYi'},
    73:{'C017_sum_before_restart','C026_dead_reflector_returns','C060_local_choice_global_risk','C063_token_0','C063_token_1',
        'tokens_A0_B0','tokens_A0_B1','tokens_A1_B0','tokens_A1_B1','six_players'},
    74:{'core_full_reset','room_state_preserved'},
    76:{'Pragon','Bi','SelfBi','LiQiang','Reflect','RotateThree'},
    80:{'RotateThree','FlipVolvo','BombFlipVolvo','FreeRotateThree'},
    81:{'pure_due_retry','session_request_replay'},82:{'grant_then_restart'},
}
SEQUENCE_LENGTHS = {54:3,64:2,65:7,69:2,79:4}


class FixtureError(ValueError):
    """Bad fixture data, distinct from a failed game expectation."""


def need(ok: bool, message: str) -> None:
    if not ok:
        raise FixtureError(message)


def fields(value: dict, required: set, path: str, *, exact: bool = True) -> None:
    need(type(value) is dict, f'{path}: object required')
    missing = required - value.keys()
    need(not missing, f'INCOMPLETE_EXPECTATION {path}: missing {sorted(missing)}')
    if exact:
        need(set(value)==required,f'{path}: unknown fields {sorted(value.keys()-required)}')


def uint(value: Any, path: str, *, positive: bool = False) -> None:
    need(type(value) is str and re.fullmatch(r'0|[1-9][0-9]*',value) is not None,f'{path}: canonical unsigned decimal string required')
    if positive:
        need(value!='0',f'{path}: positive value required')


def ids(value: Any, allowed: set | None, path: str) -> None:
    need(type(value) is list and all(type(v) is str for v in value),f'{path}: ID array required')
    need(len(value)==len(set(value)),f'{path}: duplicate IDs')
    need(all(re.fullmatch(r'[A-Za-z0-9_-]{1,64}',v) for v in value),f'{path}: invalid player ID')
    if allowed is not None:
        need(set(value)<=allowed,f'{path}: unknown player ID')


def validate_player(player: dict, path: str) -> None:
    fields(player,PLAYER_FIELDS,path)
    for key in QUANTITIES:
        uint(player[key],path+'.'+key)
    for key in BOOLS:
        need(type(player[key]) is bool,f'{path}.{key}: boolean required')
    need(player['last_actual_move'] is None or player['last_actual_move'] in ACTUAL,f'{path}: invalid complete move history')
    need(player['latest_copyable_move'] is None or player['latest_copyable_move'] in COPYABLE,f'{path}: invalid copy record')
    progress = player['zeng_state']
    need(progress in {'unused','recovery','waiting','ready','spent'},f'{path}: invalid zeng_state')
    if progress=='waiting':
        uint(player['reward_due_turn'],path+'.reward_due_turn',positive=True)
    else:
        need(player['reward_due_turn'] is None,f'{path}: due must be null outside waiting')
    need(type(player['pending_bombs']) is list,f'{path}: pending_bombs must be an array')
    for pending in player['pending_bombs']:
        fields(pending,{'game_id','placed_turn','mature_at_turn_end'},path+'.pending_bombs')
        need(type(pending['game_id']) is str and bool(pending['game_id']),f'{path}: bomb game required')
        uint(pending['placed_turn'],path+'.placed_turn',positive=True)
        uint(pending['mature_at_turn_end'],path+'.mature_at_turn_end',positive=True)
        need(int(pending['mature_at_turn_end'])==int(pending['placed_turn'])+1,f'{path}: bomb matures at placed+1')


def validate_state(s: dict, path: str = 'state', *, timing: bool = True) -> None:
    fields(s,STATE_FIELDS,path)
    need(type(s['schema_version']) is int and s['schema_version']==1,f'{path}: schema_version=1 required')
    need(s['rules_version']==VERSION,f'{path}: unsupported rules version')
    for key in ('match_id','game_id'):
        need(type(s[key]) is str and bool(s[key]),f'{path}.{key}: nonempty string required')
    for key in ('game_index','turn_index'):
        uint(s[key],path+'.'+key,positive=True)
    ids(s['roster'],None,path+'.roster')
    need(2<=len(s['roster'])<=6,f'{path}: roster must contain 2-6 players')
    ids(s['active_ids'],set(s['roster']),path+'.active_ids')
    need(s['status'] in {'playing','finished'},f'{path}: invalid status')
    if s['status']=='playing':
        need(len(s['active_ids'])>=2 and s['winner_id'] is None,f'{path}: playing requires 2+ active IDs and no winner')
    else:
        need(len(s['active_ids'])<=1,f'{path}: finished with 2+ players')
        need(s['winner_id']==(s['active_ids'][0] if s['active_ids'] else None),f'{path}: incorrect winner')
    fields(s['players'],set(s['roster']),path+'.players')
    for pid,player in s['players'].items():
        validate_player(player,path+'.players.'+pid)
        if not timing or s['status']=='finished' or pid not in s['active_ids']:
            continue
        turn = int(s['turn_index'])
        for pending in player['pending_bombs']:
            need(pending['game_id']==s['game_id'],f'{path}: bomb belongs to a different game')
            need(int(pending['placed_turn'])<turn<=int(pending['mature_at_turn_end']),f'{path}: stale/future pending bomb')
        if player['zeng_state']=='waiting':
            need(int(player['reward_due_turn'])>=turn,f'{path}: reward overdue')
        if player['zeng_state']=='recovery':
            need(turn>=2 and player['last_actual_move']=='ZengYi',f'{path}: recovery needs preceding ZengYi')


def validate_resources(value: dict, path: str) -> None:
    fields(value,RESOURCES,path)
    for key,v in value.items():
        uint(v,path+'.'+key)


def validate_defense(value: dict | None, path: str, *, actual: bool = False) -> None:
    if value is None:
        return
    need(type(value) is dict and value.get('kind') in {'finite','unbounded'},f'{path}: invalid Defense')
    required = {'kind'} if value['kind']=='unbounded' else {'kind','sixths','comparison'}
    if actual:
        required.add('match_rule')
    fields(value,required,path)
    if actual:
        need(type(value['match_rule']) is str and re.fullmatch(r'R(0[1-9]|1[0-9]|2[0-8])',value['match_rule']),f'{path}: invalid match_rule')
    if value['kind']=='finite':
        uint(value['sixths'],path+'.sixths')
        need(value['comparison'] in {'le','eq'},f'{path}: invalid comparison')


def validate_action(value: dict, active: set, path: str, *, actual: bool = False) -> None:
    required = ACTION_FIELDS if actual else ACTION_FIELDS-{'eligible_targets'}
    fields(value,required,path,exact=False)
    need(set(value)<=ACTION_FIELDS,f'{path}: unknown action fields')
    need(value['entry_id'] in ENTRIES and value['actual_move'] in ACTUAL,f'{path}: invalid entry or actual move')
    need(value['origin'] in ORIGINS,f'{path}: invalid origin')
    need(value['branch'] in {None,'Three','Volvo','SelfBi'},f'{path}: invalid branch')
    need(value['condition'] in {None,'success','failure'},f'{path}: invalid condition')
    for key in ('is_recovery','enhanced_xiao'):
        need(type(value[key]) is bool,f'{path}.{key}: boolean required')
    if value['condition'] is not None:
        need('eligible_targets' in value,f'INCOMPLETE_EXPECTATION {path}: conditional targets missing')
    if 'eligible_targets' in value:
        ids(value['eligible_targets'],active,path+'.eligible_targets')
    uint(value['attack6'],path+'.attack6')
    need(value['defense_primary'] is not None,f'{path}: defense_primary cannot be null')
    validate_defense(value['defense_primary'],path+'.defense_primary',actual=actual)
    validate_defense(value['defense_return'],path+'.defense_return',actual=actual)
    validate_resources(value['spend'],path+'.spend')


def validate_input(inp: dict, path: str) -> None:
    fields(inp,{'state','submissions','choice_tokens'},path)
    validate_state(inp['state'],path+'.state')
    active = set(inp['state']['active_ids'])
    fields(inp['submissions'],{pid for pid in active if inp['state']['players'][pid]['zeng_state']!='recovery'},path+'.submissions')
    need(all(e in ENTRIES for e in inp['submissions'].values()),f'{path}: unknown submitted entry')
    need(type(inp['choice_tokens']) is dict,f'{path}: choice_tokens must be object')
    choosers = {pid for pid,e in inp['submissions'].items() if e in {'RotateThree','FlipVolvo','BombFlipVolvo','FreeRotateThree'} or
                (e=='ZhangXinWei' and inp['state']['players'][pid]['latest_copyable_move'] in {'RotateThree','FlipVolvo'})}
    fields(inp['choice_tokens'],choosers,path+'.choice_tokens')
    need(all(type(t) is int and t in (0,1) for t in inp['choice_tokens'].values()),f'{path}: tokens must be integer 0/1, never bool')


def validate_options(options: dict, inp: dict, path: str) -> None:
    need(type(options) is dict and bool(options),f'INCOMPLETE_EXPECTATION {path}: options missing')
    for pid,rows in options.items():
        need(pid in inp['state']['active_ids'] and type(rows) is dict and bool(rows),f'{path}: invalid option owner')
        for entry,option in rows.items():
            need(entry in ENTRIES,f'{path}: invalid option entry')
            fields(option,{'available','reason_code','forced'},path,exact=False)
            need(type(option['available']) is bool and type(option['forced']) is bool,f'{path}: option flags must be bool')
            need(option['reason_code'] is None if option['available'] else type(option['reason_code']) is str and bool(option['reason_code']),f'{path}: reason/availability mismatch')
            if not option['forced']:
                fields(option,{'available','reason_code','forced','required','spend'},path)
                validate_resources(option['required'],path+'.required')
                validate_resources(option['spend'],path+'.spend')
    for pid,entry in inp['submissions'].items():
        # Rejected fixtures only need the offending player's explicit option expectation.
        if pid in options:
            need(entry in options[pid],f'INCOMPLETE_EXPECTATION {path}: selected entry not covered')


def validate_expected(expected: dict, inp: dict, path: str) -> None:
    need(type(expected) is dict and type(expected.get('ok')) is bool,f'INCOMPLETE_EXPECTATION {path}: ok missing')
    if not expected['ok']:
        fields(expected,{'ok','error','input_unchanged','options'},path)
        fields(expected['error'],{'code','player_id'},path+'.error',exact=False)
        need(expected['error']['code'] in ERRORS and expected['input_unchanged'] is True,f'{path}: invalid rejection expectation')
        validate_options(expected['options'],inp,path+'.options')
        return
    required = {'ok','eliminated_ids','kills','transition','actions','post_turn_players','next_state','required_events','forbidden_events','options'}
    fields(expected,required,path,exact=False)
    need(set(expected)<=required|{'properties'},f'{path}: unknown expected fields')
    active = set(inp['state']['active_ids'])
    ids(expected['eliminated_ids'],active,path+'.eliminated_ids')
    fields(expected['kills'],active,path+'.kills')
    for pid,targets in expected['kills'].items():
        ids(targets,active-{pid},path+'.kills.'+pid)
        need(set(targets)<=set(expected['eliminated_ids']),f'{path}: kill without elimination')
    fields(expected['actions'],active,path+'.actions')
    for pid,action in expected['actions'].items():
        validate_action(action,active,path+'.actions.'+pid)
        need(action['entry_id']==inp['submissions'].get(pid,'ZengYi'),f'{path}: action does not correspond to submission')
    fields(expected['post_turn_players'],active,path+'.post_turn_players')
    for pid,player in expected['post_turn_players'].items():
        validate_player(player,path+'.post_turn_players.'+pid)
    validate_state(expected['next_state'],path+'.next_state',timing=False)
    before,nxt = inp['state'],expected['next_state']
    transition = expected['transition']
    fields(transition,{'kind','from_game_id','to_game_id','winner_id'},path+'.transition')
    survivors = active-set(expected['eliminated_ids'])
    need(set(nxt['active_ids'])==survivors,f'{path}: next active IDs differ from elimination set')
    kind = transition['kind']
    want_kind = 'continue_game' if not expected['eliminated_ids'] else ('restart_survivors' if len(survivors)>=2 else ('sole_survivor' if survivors else 'nobody_survives'))
    need(kind==want_kind,f'{path}: inconsistent transition')
    need(transition['from_game_id']==before['game_id'] and transition['to_game_id']==nxt['game_id'],f'{path}: wrong game transition IDs')
    need(transition['winner_id']==nxt['winner_id'],f'{path}: inconsistent winner')
    need(before['roster']==nxt['roster'] and before['match_id']==nxt['match_id'],f'{path}: roster/match identity changed')
    if kind=='continue_game':
        need(nxt['game_id']==before['game_id'] and nxt['game_index']==before['game_index'] and int(nxt['turn_index'])==int(before['turn_index'])+1,f'{path}: wrong continue timing')
    elif kind=='restart_survivors':
        need(int(nxt['game_index'])==int(before['game_index'])+1 and nxt['turn_index']=='1' and nxt['game_id']==f"{before['match_id']}:g{nxt['game_index']}",f'{path}: wrong restart timing')
        for pid in survivors:
            player = nxt['players'][pid]
            need(all(player[k]=='0' for k in QUANTITIES) and not any(player[k] for k in BOOLS),f'{path}: restart resources/uses not reset')
            need(player['pending_bombs']==[] and player['last_actual_move'] is None and player['latest_copyable_move'] is None and player['zeng_state']=='unused' and player['reward_due_turn'] is None,f'{path}: restart history/progress not reset')
    else:
        need(nxt['status']=='finished' and all(nxt[k]==before[k] for k in ('game_id','game_index','turn_index')),f'{path}: finished must retain this turn')
    if kind!='restart_survivors':
        for pid in active:
            need(nxt['players'][pid]==expected['post_turn_players'][pid],f'{path}: next state lost post-turn balances')
    for field in ('required_events','forbidden_events'):
        need(type(expected[field]) is list,f'{path}.{field}: list required')
        for item in expected[field]:
            if field=='required_events':
                fields(item,{'match','count'},path+'.required_events')
                need(type(item['count']) is int and item['count']>0,f'{path}: positive event count required')
                item = item['match']
            need(type(item) is dict and bool(item) and set(item)<=EVENT_FIELDS,f'{path}: invalid event selector')
    if 'properties' in expected:
        need(type(expected['properties']) is list and set(expected['properties'])<=PROPERTY_NAMES and bool(expected['properties']),f'{path}: invalid properties')
    validate_options(expected['options'],inp,path+'.options')
    need(set(expected['options'])==active,f'INCOMPLETE_EXPECTATION {path}: every actor needs option expectations')


def reject_duplicate_keys(pairs: list) -> dict:
    result = {}
    for key,value in pairs:
        need(key not in result,f'duplicate JSON object key: {key}')
        result[key] = value
    return result


def load_fixtures(directory: Path = HERE/'fixtures') -> list[dict]:
    files = sorted(directory.glob('C*.json'))
    need(bool(files),'No fixture files')
    fixtures = []
    for path in files:
        rows = json.loads(path.read_text(encoding='utf-8'),object_pairs_hook=reject_duplicate_keys)
        need(type(rows) is list and bool(rows),f'{path.name}: nonempty array required')
        need(all(type(f) is dict and f.get('case_id')==path.stem for f in rows),f'{path.name}: case/file ID mismatch')
        fixtures.extend(rows)
    return fixtures


def round_cases(f: dict) -> Iterator[tuple[dict, dict]]:
    if f['scope']=='session':
        return
    if f['scope']=='sequence':
        current = f['input']['state']
        for inp,expected in zip(f['input']['steps'],f['expected']['steps'],strict=True):
            yield dict(state=current,**inp),expected
            if expected['ok']:
                current = expected['next_state']
    else:
        yield f['input'],f['expected']


def validate_suite(fixtures: list[dict]) -> dict:
    keys,groups,entries,scopes = set(),{},set(),Counter()
    rounds = 0
    for f in fixtures:
        fields(f,{'case_id','variant','rules_version','scope','input','expected','rule_ids','source_notes'},'fixture')
        cid,variant = f['case_id'],f['variant']
        need(type(cid) is str and re.fullmatch(r'C(0[0-7][0-9]|080|081|082)',cid) and cid!='C000','Invalid case ID')
        need(type(variant) is str and re.fullmatch(r'[A-Za-z0-9_-]+',variant),'Invalid variant')
        need((cid,variant) not in keys,f'Duplicate {cid}/{variant}')
        keys.add((cid,variant))
        groups.setdefault(int(cid[1:]),set()).add(variant)
        need(f['rules_version']==VERSION,f'{cid}: wrong rule version')
        need(f['scope'] in {'core','sequence','property','session'},f'{cid}: invalid scope')
        scopes[f['scope']] += 1
        need(type(f['source_notes']) is str and bool(f['source_notes'].strip()),f'{cid}: source notes missing')
        need(type(f['rule_ids']) is list and bool(f['rule_ids']) and all(type(r) is str and re.fullmatch(r'R(0[1-9]|1[0-9]|2[0-8])',r) for r in f['rule_ids']),f'{cid}: rule traceability missing')
        if f['scope']=='session':
            fields(f['input'],{'initial','operations'},cid+'.input')
            fields(f['expected'],{'status','assertions'},cid+'.expected')
            need(f['expected']['status']=='NOT_RUN' and bool(f['expected']['assertions']) and bool(f['input']['operations']),f'{cid}: session must have pending assertions, never PASS')
            continue
        if f['scope']=='sequence':
            fields(f['input'],{'state','steps'},cid+'.input',exact=False)
            need(set(f['input'])<={'state','steps','new_match'},f'{cid}: unknown sequence input')
            fields(f['expected'],{'initial_state','steps'},cid+'.expected')
            need(f['expected']['initial_state']==f['input']['state'],f'{cid}: inconsistent initial snapshot')
            need(len(f['input']['steps'])==len(f['expected']['steps'])==SEQUENCE_LENGTHS.get(int(cid[1:])),f'{cid}: sequence steps missing')
            if 'new_match' in f['input']:
                fields(f['input']['new_match'],{'player_ids','match_id'},cid+'.new_match')
                need(f['input']['new_match']['player_ids']==f['input']['state']['roster'] and f['input']['new_match']['match_id']==f['input']['state']['match_id'],f'{cid}: new_match arguments mismatch')
        for i,(inp,expected) in enumerate(round_cases(f)):
            path = f'{cid}/{variant}/round-{i+1}'
            validate_input(inp,path+'.input')
            validate_expected(expected,inp,path+'.expected')
            for pid,rows in expected['options'].items():
                for entry,option in rows.items():
                    if not option['forced'] and (inp['submissions'].get(pid)==entry or entry=='ZengRewardBigBi'):
                        entries.add(entry)
            rounds += 1
    need(set(groups)==set(range(1,83)),f'Missing case IDs: {sorted(set(range(1,83))-groups.keys())}')
    for cid,required in REQUIRED_VARIANTS.items():
        need(required<=groups[cid],f'C{cid:03}: missing parameter variants {sorted(required-groups[cid])}')
    need(entries==set(ENTRIES),f'Missing substantive entry checks: {sorted(set(ENTRIES)-entries)}')
    probes = [f for f in fixtures if f['case_id']=='C075']
    covered = {f['input']['submissions']['A'] for f in probes}
    copies = {f['input']['state']['players']['A']['latest_copyable_move'] for f in probes if f['input']['submissions']['A']=='ZhangXinWei'}
    need(covered==set(ENTRIES) and copies==COPYABLE,'C075: incomplete entry/copy identity domain')
    compounds = {'RotateThree','FlipVolvo','BombFlipVolvo','FreeRotateThree','ZhangXinWei_RotateThree','ZhangXinWei_FlipVolvo'}
    required_probes = {f'{name}_vs_{opponent}_token_{t}' for name in compounds for opponent in ('Reflect','Shell') for t in (0,1)}
    need(required_probes<=groups[75],f'C075: missing branch/token probes {sorted(required_probes-groups[75])}')
    return dict(status='FIXTURES_VALID',case_groups=len(groups),fixtures=len(fixtures),round_expectations=rounds,
                entries=len(entries),scopes=dict(sorted(scopes.items())),engine_run='NOT_RUN',engine_passed=0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixtures',type=Path,default=HERE/'fixtures')
    args = parser.parse_args()
    try:
        summary = validate_suite(load_fixtures(args.fixtures))
    except (ValueError,TypeError,KeyError,OSError) as exc:
        print(json.dumps({'status':'INVALID_FIXTURES','error':str(exc)},ensure_ascii=False))
        return 1
    print(json.dumps(summary,ensure_ascii=False,sort_keys=True))
    return 0


if __name__=='__main__':
    raise SystemExit(main())
