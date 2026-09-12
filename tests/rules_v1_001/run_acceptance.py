"""Run authored wire fixtures against an explicitly selected deidei_core.api."""
from __future__ import annotations

import argparse
from copy import deepcopy
import importlib
import itertools
import json
from pathlib import Path
import sys
from types import ModuleType
from typing import Any

try:
    from .validate_fixtures import (ACTUAL, ACTION_FIELDS, ENTRIES, ERRORS, EVENT_FIELDS,
        EVENT_KINDS, HERE, QUANTITIES, BOOLS, FixtureError, fields, ids, need, round_cases,
        uint, validate_action, validate_player, validate_resources, validate_state,
        load_fixtures, validate_suite)
except ImportError:
    from validate_fixtures import (ACTUAL, ACTION_FIELDS, ENTRIES, ERRORS, EVENT_FIELDS,
        EVENT_KINDS, HERE, QUANTITIES, BOOLS, FixtureError, fields, ids, need, round_cases,
        uint, validate_action, validate_player, validate_resources, validate_state,
        load_fixtures, validate_suite)


class EngineUnavailable(Exception):
    pass


def load_core(directory: Path) -> ModuleType:
    directory = directory.resolve()
    api_file = directory/'deidei_core'/'api.py'
    if not api_file.is_file():
        raise EngineUnavailable('Expected --core <directory>/deidei_core/api.py; no fallback engine is used')
    sys.path.insert(0,str(directory))
    importlib.invalidate_caches()
    module = importlib.import_module('deidei_core.api')
    need(Path(module.__file__).resolve()==api_file.resolve(),'Imported core differs from explicitly requested path')
    for name in ('new_match','list_options','resolve_round'):
        need(callable(getattr(module,name,None)),f'Core API missing {name}')
    return module


def subset(actual: Any, expected: Any, path: str = 'result') -> None:
    """Only event/action selectors are partial; full states have schema validation too."""
    need(type(actual) is type(expected),f'{path}: type {type(actual).__name__}, expected {type(expected).__name__}')
    if isinstance(expected,dict):
        for key,value in expected.items():
            need(key in actual,f'{path}: missing {key}')
            subset(actual[key],value,path+'.'+key)
    elif isinstance(expected,list):
        need(len(actual)==len(expected),f'{path}: length {len(actual)}, expected {len(expected)}')
        for i,(left,right) in enumerate(zip(actual,expected,strict=True)):
            subset(left,right,f'{path}[{i}]')
    else:
        need(actual==expected,f'{path}: {actual!r}, expected {expected!r}')


def matches(actual: dict, selector: dict) -> bool:
    try:
        subset(actual,selector)
        return True
    except FixtureError:
        return False


def normalized(value: Any, key: str = '') -> Any:
    if isinstance(value,dict):
        return {k:normalized(v,k) for k,v in value.items()}
    if isinstance(value,list):
        vals = [normalized(v) for v in value]
        return sorted(vals) if key in {'roster','active_ids','eligible_targets'} else vals
    return value


def mutable_ids(value: Any) -> set[int]:
    if isinstance(value,dict):
        return {id(value)} | set().union(*(mutable_ids(v) for v in value.values()))
    if isinstance(value,list):
        return {id(value)} | set().union(*(mutable_ids(v) for v in value))
    return set()


def separate_players(players: dict) -> None:
    seen = set()
    for pid,player in players.items():
        owned = mutable_ids(player)
        need(not owned & seen,f'{pid}: different players share mutable state')
        seen.update(owned)


def check_events(events: list, inp: dict) -> None:
    need(type(events) is list,'ledger.events must be a list')
    active = set(inp['state']['active_ids'])
    seen = {}
    sort_keys = []
    for e in events:
        fields(e,EVENT_FIELDS,'event')
        eid = e['event_id']
        need(type(eid) is str and bool(eid) and eid not in seen,'event_id must be nonempty and unique')
        need(e['phase'] in {'P1','P2','P3','P4'} and e['kind'] in EVENT_KINDS,'Invalid event phase/kind')
        need(e['actor_id'] is None or e['actor_id'] in active,'Unknown event actor')
        need(e['target_id'] is None or e['target_id'] in active,'Unknown event target')
        need(e['result'] in {'applied','blocked','suppressed'},'Unknown event result')
        for key in ('resource','source_event_id','reason_code'):
            need(e[key] is None or type(e[key]) is str,f'event.{key}: string or null required')
        if e['amount6'] is not None:
            uint(e['amount6'],'event.amount6')
        if e['resource_delta'] is not None:
            import re
            need(type(e['resource_delta']) is str and re.fullmatch(r'0|-?[1-9][0-9]*',e['resource_delta']),'Invalid signed resource_delta')
        need(type(e['rule_ids']) is list and bool(e['rule_ids']) and all(type(r) is str and r in {f'R{i:02}' for i in range(1,29)} for r in e['rule_ids']),'Invalid event rule_ids')
        if e['kind'] in {'attack','return'}:
            uint(e['amount6'],'attack/return amount6',positive=True)
            need(e['actor_id'] is not None and e['target_id'] is not None and e['actor_id']!=e['target_id'],'Numeric attack needs distinct participants')
            need(e['phase']==('P3' if e['kind']=='return' else 'P2'),'Attack/return in wrong phase')
        if e['kind'] in {'direct_elimination','self_elimination'}:
            need(e['amount6'] is None,'Direct/self elimination must not invent damage')
        seen[eid] = e
        sort_keys.append((e['phase'],e['actor_id'] or '',e['target_id'] or '',e['kind'],eid))
    need(sort_keys==sorted(sort_keys),'Events not in stable contract order')
    for e in events:
        source = e['source_event_id']
        if source is not None:
            need(source in seen and source!=e['event_id'],'Dangling/cyclic self event source')
        if e['kind']=='return':
            need(source is not None,'Return must link its original attack')
            original = seen[source]
            need(original['kind']=='attack' and original['phase']=='P2' and original['result']=='blocked','Return source is not a blocked original attack')
            need((original['actor_id'],original['target_id'],original['amount6'])==(e['target_id'],e['actor_id'],e['amount6']),'Return changed target or original amount')


def check_result(result: dict, expected: dict, inp: dict) -> None:
    need(type(result) is dict and type(result.get('ok')) is bool,'Resolution requires boolean ok')
    need(result['ok']==expected['ok'],f"ok={result['ok']}, expected {expected['ok']}")
    if not result['ok']:
        fields(result,{'ok','error'},'rejection')
        fields(result['error'],{'code','player_id','field'},'error')
        need(result['error']['code'] in ERRORS,'Unknown error code')
        need(result['error']['player_id'] is None or result['error']['player_id'] in inp['state']['roster'],'Invalid error player')
        need(result['error']['field'] is None or type(result['error']['field']) is str,'Invalid error field')
        subset(result['error'],expected['error'],'error')
        return
    fields(result,{'ok','ledger','next_state','transition'},'Resolution')
    ledger = result['ledger']
    fields(ledger,{'match_id','game_id','turn_index','actions','events','kills','eliminated_ids','post_turn_players'},'ledger')
    for key in ('match_id','game_id','turn_index'):
        need(ledger[key]==inp['state'][key],f'Ledger {key} changed')
    active = set(inp['state']['active_ids'])
    fields(ledger['actions'],active,'ledger.actions')
    for pid,action in ledger['actions'].items():
        validate_action(action,active,'ledger.actions.'+pid,actual=True)
    subset(normalized(ledger['actions']),normalized(expected['actions']),'actions')
    fields(ledger['post_turn_players'],active,'ledger.post_turn_players')
    for pid,player in ledger['post_turn_players'].items():
        validate_player(player,'ledger.post_turn_players.'+pid)
    subset(ledger['post_turn_players'],expected['post_turn_players'],'post_turn_players')
    separate_players(ledger['post_turn_players'])
    fields(ledger['kills'],active,'ledger.kills')
    for pid,targets in ledger['kills'].items():
        ids(targets,active-{pid},'kills.'+pid)
        need(targets==sorted(targets),'Kills not sorted')
    ids(ledger['eliminated_ids'],active,'eliminated_ids')
    subset(ledger['kills'],expected['kills'],'kills')
    subset(ledger['eliminated_ids'],expected['eliminated_ids'],'eliminated_ids')
    fields(result['transition'],{'kind','from_game_id','to_game_id','winner_id'},'transition')
    subset(result['transition'],expected['transition'],'transition')
    validate_state(result['next_state'],'next_state')
    separate_players(result['next_state']['players'])
    # CONTRACT §4 leaves inactive display state optional. Validate its full shape;
    # authoritative eliminated balances are compared above in the full ledger.
    next_view = deepcopy(result['next_state'])
    for pid in set(next_view['roster'])-set(next_view['active_ids']):
        next_view['players'][pid] = deepcopy(expected['next_state']['players'][pid])
    subset(normalized(next_view),normalized(expected['next_state']),'next_state')
    check_events(ledger['events'],inp)
    for assertion in expected['required_events']:
        count = sum(matches(e,assertion['match']) for e in ledger['events'])
        need(count==assertion['count'],f"Required event {assertion['match']}: count={count}, expected {assertion['count']}")
    for selector in expected['forbidden_events']:
        need(not any(matches(e,selector) for e in ledger['events']),f'Forbidden event present: {selector}')


def check_options(api: Any, inp: dict, expected: dict) -> None:
    for pid,selectors in expected['options'].items():
        state = deepcopy(inp['state'])
        before = deepcopy(state)
        result = api.list_options(state,pid)
        need(state==before,'list_options mutated its input')
        need(type(result) is list and len(result)==33,'list_options must return 33 entries')
        need(not mutable_ids(result)&mutable_ids(state),'list_options aliases input state')
        need([r.get('entry_id') for r in result]==ENTRIES,'Options not in entry-map order')
        for index,option in enumerate(result,1):
            fields(option,{'entry_id','doc_id','available','reason_code','required','spend','forced'},'Option')
            need(option['doc_id']==f'E{index:02}','Option doc_id mismatch')
            need(type(option['available']) is bool and type(option['forced']) is bool,'Option flags must be bool')
            need(option['reason_code'] is None if option['available'] else type(option['reason_code']) is str and bool(option['reason_code']),'Invalid option reason')
            validate_resources(option['required'],'Option.required')
            validate_resources(option['spend'],'Option.spend')
        by_entry = {r['entry_id']:r for r in result}
        for entry,selector in selectors.items():
            subset(by_entry[entry],selector,f'options.{pid}.{entry}')


def resolve_checked(api: Any, inp: dict, expected: dict) -> dict:
    before = deepcopy(inp)
    result = api.resolve_round(inp['state'],inp['submissions'],inp['choice_tokens'])
    need(inp==before,'resolve_round mutated state/submissions/tokens')
    need(not mutable_ids(result)&mutable_ids(inp),'resolve_round aliases mutable input')
    check_result(result,expected,inp)
    # The wire boundary must serialize without an engine-specific encoder.
    need(json.loads(json.dumps(result,allow_nan=False))==result,'Result is not JSON round-trip stable')
    return result


def properties(api: Any, inp: dict, expected: dict, baseline: dict) -> int:
    requested = set(expected.get('properties',[]))
    calls = 0
    if 'repeat' in requested:
        repeat = resolve_checked(api,deepcopy(inp),expected)
        need(normalized(repeat)==normalized(baseline),'Pure retry changed result/events')
        need(not mutable_ids(repeat)&mutable_ids(baseline),'Repeated calls share mutable output')
        calls += 1
    if 'json_roundtrip' in requested:
        result = resolve_checked(api,json.loads(json.dumps(inp)),expected)
        need(normalized(result)==normalized(baseline),'JSON roundtrip changed result')
        calls += 1
    if 'permutation' in requested:
        # ponytail: exhaustive at 2-5 seats; at six seats use reverse and rotations.
        # Expand to all 720 only if a six-seat ordering defect warrants the cost.
        roster = inp['state']['roster']
        orders = itertools.permutations(roster) if len(roster)<=5 else [tuple(reversed(roster))]+[tuple(roster[i:]+roster[:i]) for i in range(1,6)]
        for order in orders:
            if list(order)==roster:
                continue
            shuffled = deepcopy(inp)
            shuffled['state']['roster'] = list(order)
            shuffled['state']['active_ids'] = [pid for pid in order if pid in inp['state']['active_ids']]
            for key in ('players',):
                shuffled['state'][key] = {pid:shuffled['state'][key][pid] for pid in order}
            for key in ('submissions','choice_tokens'):
                shuffled[key] = {pid:shuffled[key][pid] for pid in order if pid in shuffled[key]}
            result = resolve_checked(api,shuffled,expected)
            need(normalized(result)==normalized(baseline),'Seat permutation changed result or stable event IDs')
            calls += 1
    if 'return_domain' in requested:
        allowed = {'Bi','Xiao','Pragon','Three','Volvo','NieXiang','RotateThree','FlipVolvo'}
        for e in baseline['ledger']['events']:
            if e['kind']=='return':
                target = baseline['ledger']['actions'][e['target_id']]
                need(target['actual_move'] in allowed,'P3 reached an independent defense action')
                need(target['defense_return']['kind']=='finite' and target['defense_return']['sixths']=='0','P3 collision defense remained active')
    if 'token_independence' in requested:
        for changed in inp['choice_tokens']:
            altered = deepcopy(inp)
            altered['choice_tokens'][changed] = 1-altered['choice_tokens'][changed]
            before = deepcopy(altered)
            result = api.resolve_round(altered['state'],altered['submissions'],altered['choice_tokens'])
            need(altered==before,'Token probe mutated input')
            need(result.get('ok') is True,'Token probe was rejected')
            for pid in set(inp['choice_tokens'])-{changed}:
                need(result['ledger']['actions'][pid]['branch']==baseline['ledger']['actions'][pid]['branch'],
                     f'Changing {changed} token changed independent chooser {pid}')
            calls += 1
    if 'fresh_reset' in requested:
        nxt = baseline['next_state']
        for pid in nxt['active_ids']:
            player = nxt['players'][pid]
            need(all(player[k]=='0' for k in QUANTITIES) and not any(player[k] for k in BOOLS),'New game failed to reset quantities/uses')
            need(player['pending_bombs']==[] and player['last_actual_move'] is None and player['latest_copyable_move'] is None and player['zeng_state']=='unused','New game failed to reset histories/progress')
    return calls


def run_fixture(api: Any, f: dict) -> dict:
    if f['scope']=='session':
        return {'status':'SESSION_NOT_AVAILABLE','resolve_calls':0}
    calls = 0
    current = deepcopy(f['input']['state'])
    if f['scope']=='sequence' and 'new_match' in f['input']:
        args = deepcopy(f['input']['new_match'])
        before = deepcopy(args)
        current = api.new_match(**args)
        need(args==before,'new_match mutated player IDs')
        validate_state(current)
        subset(normalized(current),normalized(f['expected']['initial_state']),'new_match')
        separate_players(current['players'])
    for authored_input,expected in round_cases(f):
        inp = deepcopy(authored_input)
        if f['scope']=='sequence':
            inp['state'] = current
        check_options(api,inp,expected)
        result = resolve_checked(api,inp,expected)
        calls += 1 + properties(api,inp,expected,result)
        if f['scope']=='sequence' and result['ok']:
            current = result['next_state']
    return {'status':'PASS','resolve_calls':calls}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--core',type=Path,required=True,help='Explicit directory containing deidei_core/api.py')
    parser.add_argument('--fixtures',type=Path,default=HERE/'fixtures')
    parser.add_argument('--case',action='append',default=[],help='Case ID or case_id/variant; repeat to select several')
    args = parser.parse_args()
    try:
        fixtures = load_fixtures(args.fixtures)
        validate_suite(fixtures)
        if args.case:
            selected = [f for f in fixtures if f['case_id'] in args.case or f"{f['case_id']}/{f['variant']}" in args.case]
            need(bool(selected),'No fixtures match --case')
            fixtures = selected
    except (ValueError,TypeError,KeyError,OSError) as exc:
        print(json.dumps({'status':'INVALID_FIXTURES','error':str(exc),'engine_passed':0},ensure_ascii=False))
        return 1
    pending = [f"{f['case_id']}/{f['variant']}" for f in fixtures if f['scope']=='session']
    if len(pending)==len(fixtures):
        print(json.dumps({'status':'SESSION_NOT_AVAILABLE','session_not_run':pending,'engine_passed':0}))
        return 3
    try:
        api = load_core(args.core)
    except EngineUnavailable as exc:
        print(json.dumps({'status':'ENGINE_NOT_AVAILABLE','engine_run':'NOT_RUN','engine_passed':0,'reason':str(exc),'session_not_run':pending}))
        return 2
    except Exception as exc:
        print(json.dumps({'status':'ENGINE_IMPORT_ERROR','engine_run':'NOT_RUN','engine_passed':0,'error':f'{type(exc).__name__}: {exc}'}))
        return 1
    failures,passed,calls = [],0,0
    for f in fixtures:
        if f['scope']=='session':
            continue
        try:
            outcome = run_fixture(api,f)
            calls += outcome['resolve_calls']
            passed += 1
        except Exception as exc:
            failures.append({'fixture':f"{f['case_id']}/{f['variant']}",'error':f'{type(exc).__name__}: {exc}'})
    print(json.dumps({'status':'FAIL' if failures else ('CORE_CHECKS_PASS_SESSION_NOT_RUN' if pending else 'CORE_CHECKS_PASS'),
                      'engine_run':'RUN','engine_passed':passed,'engine_failed':len(failures),
                      'resolve_calls_for_passed_fixtures':calls,'session_not_run':pending,'failures':failures},ensure_ascii=False,sort_keys=True))
    return 1 if failures else 0


if __name__=='__main__':
    raise SystemExit(main())
