"""Authored expectations, not a second adjudicator. Never import a game engine.

Helpers only expand wire fields, arithmetic units and explicitly selected outcomes.
Every kill, survivor, branch, balance and changed counter is specified below.
The runner reads the checked-in JSON, never this authoring module.
"""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
VERSION = "classic-1.0.1"
ENTRIES = "Charge Bi Def Three ThreeDef BigBi Reflect SelfBi Cloud Bomb Xiao Pragon PragonDef Volvo VolvoDef RotateThree XiaoBei FlipVolvo Shell Absorb NieXiang NieXiangDef JuYan TianLiJun ZhangXinWei LiQiang BombPragon BombVolvo BombFlipVolvo FreeThree FreeRotateThree ZengYi ZengRewardBigBi".split()
RESOURCE_KEYS = "dd6 lightning nx_charge mature_bombs reward_stock".split()
CASES: list[dict] = []
RULES = {
 1:[1,12,26],2:[2,9],3:[6,9],4:[4,6],5:[8,20],6:[16,20,24],7:[4,8,20],
 8:[7,8],9:[8],10:[8,9,20],11:[8,9],12:[7,21],13:[21],14:[2,7],15:[7,20],
 16:[4,7,19],17:[12,26],18:[12],19:[12],20:[4,13,26],21:[12],22:[9,12],
 23:[9,12,13],24:[7,11,12],25:[4,14,17,26],26:[4,11,14],27:[5,14],28:[14,26],
 29:[15,16],30:[7,15],31:[4,15,26],32:[4,15,26],33:[10,15],34:[15,16,18,26],
 35:[15,16],36:[15,16,18],37:[16,17,18],38:[9,17,20],39:[12,16,17],40:[2,17],
 41:[16,17],42:[4,11,24],43:[4,12,22,26],44:[4,5,14,22],45:[22,24],46:[9,22],
 47:[4,23,26],48:[5,23],49:[4,23],50:[4,12,23],51:[8,22,23],52:[4,10,13,20],
 53:[6,11,20],54:[9,19],55:[7,8,19],56:[5,19],57:[2,9,19],58:[9,12,18,26],
 59:[9,16,18],60:[4,12,18,26],61:[14,18],62:[9,18],63:[12,18,26],64:[17,21,25],
 65:[9,17,20,25],66:[15,25,26],67:[15,25,26],68:[25,26],69:[15,16,26],
 70:[9,15,16,25],71:[25],72:[2,9,17,25],73:[2,3,4,18],74:[1,26,28],
 75:[8,9,10,11,28],76:[16,17],77:[2,9,20],78:[5,20,24],79:[2,9,13],
 80:[9,10,14,18],81:[2,25,26],82:[4,20,25,26],
}


def resources(dd6: int = 0, **values: int) -> dict:
    return {k: str(dd6 if k == 'dd6' else values.get(k, 0)) for k in RESOURCE_KEYS}


def p(dd6: int = 60, last: str | None = None, copy: str | None = None, **values: object) -> dict:
    result = dict(dd6=str(dd6), lightning='0', nx_charge='0', mature_bombs='0',
                  pending_bombs=[], bomb_placement_count='0', cloud_uses='0', tian_uses='0',
                  zhang_used=False, liq_used=False, enhanced_xiao=False,
                  last_actual_move=last, latest_copyable_move=copy,
                  zeng_state='unused', reward_due_turn=None)
    result.update({k: str(v) if type(v) is int else deepcopy(v) for k,v in values.items()})
    return result


def state(players: dict, turn: int = 6, game: int = 1, game_id: str = 'game-1',
          roster: list | None = None, active: list | None = None) -> dict:
    return dict(schema_version=1, rules_version=VERSION, match_id='fixture', game_id=game_id,
                game_index=str(game), turn_index=str(turn), roster=list(roster or players),
                active_ids=list(active or players), status='playing', winner_id=None,
                players=deepcopy(players))


def bomb(placed: int, game_id: str = 'game-1') -> dict:
    return dict(game_id=game_id, placed_turn=str(placed), mature_at_turn_end=str(placed+1))


def defense(value: int | str, comparison: str = 'le') -> dict:
    return {'kind':'unbounded'} if value == 'inf' else dict(kind='finite',sixths=str(value),comparison=comparison)


def a(entry: str, attack: int = 0, shield: int | str = 0, fee: int = 0, *,
      actual: str | None = None, origin: str = 'normal', branch: str | None = None,
      condition: str | None = None, targets: list | None = None,
      recovery: bool = False, enhanced: bool = False, comparison: str = 'le',
      returning: int | str | None = None, **spend: int) -> dict:
    result = dict(entry_id=entry, actual_move=actual or entry, origin=origin, branch=branch,
                  condition=condition, is_recovery=recovery, enhanced_xiao=enhanced,
                  attack6=str(attack), defense_primary=defense(shield,comparison),
                  defense_return=None if returning is None else defense(returning), spend=resources(fee,**spend))
    # Only conditional target sets have normative semantics in the contract.
    if targets is not None:
        result['eligible_targets'] = targets
    return result


def attack(entry: str, strength: int, fee: int = 0, **kw) -> dict:
    return a(entry,strength,strength,fee,returning=0,**kw)


def conditional(entry: str, success: bool, targets: list, *, liq: bool = False, **kw) -> dict:
    shield = 59994 if liq else 'inf'
    return a(entry,60000 if success else 0,shield if success else 0,
             condition='success' if success else 'failure',targets=targets,
             returning=shield if success else 0,**kw)


def event(kind: str, actor: str | None, target: str | None, *, phase: str = 'P2',
          amount: int | None = None, result: str = 'applied', **fields: object) -> dict:
    return dict(kind=kind,phase=phase,actor_id=actor,target_id=target,
                amount6=None if amount is None else str(amount),result=result,**fields)


def counted(match: dict, count: int = 1) -> dict:
    return dict(match=match,count=count)


def resolution(before: dict, actions: dict, posts: dict, kind: str = 'continue_game',
               survivors: str | list | None = None, kills: dict | None = None,
               required: list | None = None, forbidden: list | None = None) -> dict:
    ids = before['active_ids']
    alive = list(ids if survivors is None else survivors)
    eliminated = sorted(set(ids)-set(alive))
    winner = alive[0] if kind == 'sole_survivor' else None
    nxt = deepcopy(before)
    nxt['players'].update(deepcopy(posts))
    nxt.update(active_ids=alive,winner_id=winner)
    if kind == 'continue_game':
        nxt['turn_index'] = str(int(before['turn_index'])+1)
    elif kind == 'restart_survivors':
        nxt.update(game_index=str(int(before['game_index'])+1),turn_index='1',
                   game_id=f"{before['match_id']}:g{int(before['game_index'])+1}")
        for pid in alive:
            nxt['players'][pid] = p(0)
    else:
        nxt['status'] = 'finished'
    return dict(ok=True,eliminated_ids=eliminated,kills={pid:sorted((kills or {}).get(pid,[])) for pid in ids},
                transition=dict(kind=kind,from_game_id=before['game_id'],to_game_id=nxt['game_id'],winner_id=winner),
                actions=actions,post_turn_players=posts,next_state=nxt,
                required_events=required or [],forbidden_events=forbidden or [])


def options(actions: dict) -> dict:
    result = {}
    for pid, action in actions.items():
        required = deepcopy(action['spend'])
        if action['enhanced_xiao']:
            required['dd6'] = '2'
        result[pid] = {action['entry_id']:dict(available=True,reason_code=None,forced=False,
                                             required=required,spend=action['spend'])}
        if action['is_recovery']:
            result[pid] = {entry:dict(available=False,reason_code='FORCED_RECOVERY',forced=True)
                           for entry in ENTRIES}
    return result


def add(case: int, variant: str, actions: dict, posts: dict, *, before: dict | None = None,
        inputs: dict | None = None, tokens: dict | None = None, note: str = '',
        scope: str = 'core', properties: list | None = None, **outcome) -> dict:
    before = before or state({pid:p() for pid in actions})
    if inputs is None:
        inputs = {pid:v['entry_id'] for pid,v in actions.items() if not v['is_recovery']}
    if tokens is None:
        tokens = {pid:0 for pid,v in actions.items() if v['actual_move'] in ('RotateThree','FlipVolvo')}
    expected = resolution(before,actions,posts,**outcome)
    expected['options'] = options(actions)
    if properties:
        expected['properties'] = properties
    f = dict(case_id=f'C{case:03}',variant=variant,rules_version=VERSION,scope=scope,
             input=dict(state=before,submissions=inputs,choice_tokens=tokens),expected=expected,
             rule_ids=[f'R{r:02}' for r in RULES[case]],
             source_notes=f"CASES.md#C{case:03}; RULEBOOK 1.0.1; authored balances in sixths. {note}".strip())
    CASES.append(f)
    return f


def reject(case: int, variant: str, entry: str, player: dict, reason: str,
           required: dict, spend: dict, *, other: str = 'Charge', before: dict | None = None) -> dict:
    before = before or state({'A':player,'B':p()})
    f = dict(case_id=f'C{case:03}',variant=variant,rules_version=VERSION,scope='core',
             input=dict(state=before,submissions={'A':entry,'B':other},choice_tokens={}),
             expected=dict(ok=False,error={'code':'UNAVAILABLE_MOVE','player_id':'A'},input_unchanged=True,
                           options={'A':{entry:dict(available=False,reason_code=reason,forced=False,
                                                   required=required,spend=spend)}}),
             rule_ids=[f'R{r:02}' for r in RULES[case]],source_notes=f'CASES.md#C{case:03}; whole round rejected before any expenditure.')
    if entry in ('RotateThree','FlipVolvo','FreeRotateThree','BombFlipVolvo'):
        f['input']['choice_tokens'] = {'A':0}
    CASES.append(f)
    return f


def authored() -> None:
    add(1,'both_charge',{'A':a('Charge'),'B':a('Charge')},{'A':p(66,'Charge'),'B':p(66,'Charge')},
        forbidden=[{'kind':'attack'}])
    reject(2,'zero_dd','Bi',p(0),'INSUFFICIENT_DD',resources(6),resources(6))
    add(3,'equal_bi',{'A':attack('Bi',6,6),'B':attack('Bi',6,6)}, {'A':p(54,'Bi'),'B':p(54,'Bi')})
    add(4,'weaker_still_kills',{'A':attack('Three',18,18),'B':attack('Pragon',12,12),'C':attack('Bi',6,6)},
        {'A':p(42,'Three','Three'),'B':p(48,'Pragon','Pragon'),'C':p(54,'Bi')},
        kind='sole_survivor',survivors='A',kills={'A':['B','C'],'B':['C']},
        required=[counted(event('attack','B','C',amount=12))])
    for cid,entry,strength,fee in [(5,'Bi',6,6),(6,'BigBi',30,30),(7,'Pragon',12,12)]:
        add(cid,'def_vs_'+entry,{'A':a('Def',shield=6),'B':attack(entry,strength,fee)},
            {'A':p(60,'Def',nx_charge=1 if cid==7 else 2),
             'B':p(60-fee,entry,entry if strength>=12 else None)},
            kind='sole_survivor' if cid==7 else 'continue_game',survivors='B' if cid==7 else 'AB',
            kills={'B':['A']} if cid==7 else {})
    defenders = [('ThreeDef',18,'Three',18,0),('PragonDef',12,'Pragon',12,0),
                 ('VolvoDef',24,'Volvo',24,0),('NieXiangDef',21,'NieXiang',0,4)]
    for d,s,m,fee,charge in defenders:
        da = a(d,shield=s,comparison='eq')
        add(8,d,{'A':da,'B':attack('Xiao',2,2)},{'A':p(60,d),'B':p(58,'Xiao')})
        add(9,d,{'A':da,'B':attack('Bi',6,6)},{'A':p(60,d),'B':p(54,'Bi')},
            kind='sole_survivor',survivors='B',kills={'B':['A']})
        add(10,d,{'A':da,'B':attack(m,s,fee,nx_charge=charge)},
            {'A':p(60,d),'B':p(60-fee,m,m)},before=state({'A':p(),'B':p(nx_charge=charge)}))
    add(11,'normal_and_bomb',{'A':a('VolvoDef',shield=24,comparison='eq'),'B':attack('Volvo',24,24),
        'C':attack('BombVolvo',24,actual='Volvo',origin='bomb',mature_bombs=2)},
        {'A':p(60,'VolvoDef'),'B':p(36,'Volvo','Volvo'),'C':p(60,'Volvo','Volvo')},
        before=state({'A':p(),'B':p(),'C':p(mature_bombs=2)}))
    for variant,entry,enh in [('plain_xiao','Xiao',False),('enhanced_xiao','Xiao',True),('bi','Bi',False)]:
        add(12,variant,{'A':a('JuYan',shield=2),'B':attack(entry,6 if entry=='Bi' else 2,0 if enh else (6 if entry=='Bi' else 2),enhanced=enh)},
            {'A':p(60,'JuYan',enhanced_xiao=True),'B':p(60 if enh else (54 if entry=='Bi' else 58),entry)},
            before=state({'A':p(),'B':p(enhanced_xiao=enh)}),
            kind='sole_survivor' if entry=='Bi' else 'continue_game',survivors='B' if entry=='Bi' else 'AB',
            kills={'B':['A']} if entry=='Bi' else {})
    add(13,'buff_not_stacked',{'A':a('JuYan',shield=2),'B':a('Charge')},
        {'A':p(60,'JuYan',enhanced_xiao=True),'B':p(66,'Charge')},before=state({'A':p(enhanced_xiao=True),'B':p()}))
    reject(14,'buff_needs_balance','Xiao',p(0,enhanced_xiao=True),'INSUFFICIENT_DD',resources(2),resources())
    add(15,'free_xiao_pierces_def',{'A':attack('Xiao',2,enhanced=True),'B':a('Def',shield=6)},
        {'A':p(2,'Xiao'),'B':p(60,'Def',nx_charge=1)},before=state({'A':p(2,enhanced_xiao=True),'B':p()}),
        kind='sole_survivor',survivors='A',kills={'A':['B']})
    for prior,shield in [(0,2),(1,6),(2,12),(3,18),(8,18)]:
        add(16,f'prior_{prior}',{'A':attack('Xiao',2,enhanced=True),'B':a('Bomb',shield=shield,fee=6)},
            {'A':p(60,'Xiao'),'B':p(54,'Bomb',bomb_placement_count=prior+1,pending_bombs=[bomb(6)])},
            before=state({'A':p(enhanced_xiao=True),'B':p(bomb_placement_count=prior)}),
            kind='sole_survivor',survivors='A',kills={'A':['B']})
    add(17,'sum_before_restart',{'A':attack('Three',18,18),'B':attack('Pragon',12,12),'C':a('Absorb',shield=600,fee=6)},
        {'A':p(42,'Three','Three'),'B':p(48,'Pragon','Pragon'),'C':p(84,'Absorb')},
        kind='restart_survivors',survivors='AC',kills={'A':['B']})
    add(18,'two_absorbers',{'A':attack('Three',18,18),'B':a('Absorb',shield=600,fee=6),'C':a('Absorb',shield=600,fee=6)},
        {'A':p(42,'Three','Three'),'B':p(72,'Absorb'),'C':p(72,'Absorb')})
    add(19,'two_chargers',{'A':a('Charge'),'B':a('Charge'),'C':a('Absorb',shield=600,fee=6),'D':a('Absorb',shield=600,fee=6)},
        {'A':p(60,'Charge'),'B':p(60,'Charge'),'C':p(66,'Absorb'),'D':p(66,'Absorb')})
    add(20,'cloud_does_not_shield_others',{'A':a('Cloud',shield=600),'B':a('Charge'),'C':a('Charge'),'D':attack('Three',18,18)},
        {'A':p(60,'Cloud',lightning=1,cloud_uses=1),'B':p(60,'Charge'),'C':p(60,'Charge'),'D':p(42,'Three','Three')},
        kind='restart_survivors',survivors='AD',kills={'D':['B','C']})
    add(21,'normal_volvo',{'A':attack('Volvo',24,24),'B':a('Absorb',shield=600,fee=6)},
        {'A':p(36,'Volvo','Volvo'),'B':p(78,'Absorb')})
    add(22,'bomb_zero_gain',{'A':attack('BombVolvo',24,actual='Volvo',origin='bomb',mature_bombs=2),'B':a('Absorb',shield=600,fee=6)},
        {'A':p(60,'Volvo','Volvo'),'B':p(54,'Absorb')},before=state({'A':p(mature_bombs=2),'B':p()}),
        forbidden=[{'kind':'resource_gain','actor_id':'B','resource':'dd6'}])
    add(23,'lightning_full_gain',{'A':attack('FreeThree',18,actual='Three',origin='lightning',lightning=3),'B':a('Absorb',shield=600,fee=6)},
        {'A':p(0,'Three','Three'),'B':p(72,'Absorb')},before=state({'A':p(0,lightning=3),'B':p()}))
    for target in ['Absorb','Reflect']:
        add(24,target,{'A':attack('Xiao',2,enhanced=True),'B':a(target,shield=600,fee=6)},
            {'A':p(60,'Xiao'),'B':p(54,target)},before=state({'A':p(enhanced_xiao=True),'B':p()}),
            kind='sole_survivor' if target=='Reflect' else 'continue_game',survivors='B' if target=='Reflect' else 'AB',
            kills={'B':['A']} if target=='Reflect' else {},
            required=[counted(event('return','B','A',phase='P3',amount=2))] if target=='Reflect' else [],
            forbidden=[{'kind':'resource_gain','actor_id':'B','resource':'dd6'}])
    add(25,'selfbi_preserves_old_copy',{'A':conditional('SelfBi',True,['B']),'B':a('Absorb',shield=600,fee=6),'C':attack('Three',18,18)},
        {'A':p(60,'SelfBi','Three'),'B':p(72,'Absorb'),'C':p(42,'Three','Three')},
        before=state({'A':p(copy='Three'),'B':p(),'C':p()}),kind='restart_survivors',survivors='AC',kills={'A':['B']},
        forbidden=[{'kind':'attack','actor_id':'A','target_id':'C'}])
    add(26,'dead_reflector_returns',{'A':conditional('SelfBi',True,['B']),'B':a('Reflect',shield=600,fee=6),'C':attack('Pragon',12,12)},
        {'A':p(60,'SelfBi'),'B':p(54,'Reflect'),'C':p(48,'Pragon','Pragon')},kind='sole_survivor',survivors='A',kills={'A':['B'],'B':['C']},
        required=[counted(event('return','B','C',phase='P3',amount=12))],forbidden=[{'kind':'return','target_id':'A'}])
    add(27,'failed_selfbi',{'A':conditional('SelfBi',False,[]),'B':a('Charge')},
        {'A':p(60,'SelfBi'),'B':p(66,'Charge')},kind='sole_survivor',survivors='B',
        required=[counted(event('self_elimination','A','A'))],forbidden=[{'kind':'attack','actor_id':'A'}])
    add(28,'both_selfbi_fail',{'A':conditional('SelfBi',False,[]),'B':conditional('SelfBi',False,[])},
        {'A':p(60,'SelfBi'),'B':p(60,'SelfBi')},kind='nobody_survives',survivors=[],forbidden=[{'kind':'attack'}])
    add(29,'failed_liq_charges',{'A':conditional('LiQiang',False,[],liq=True),'B':a('Charge')},
        {'A':p(6,'LiQiang',liq_used=True),'B':p(66,'Charge')},before=state({'A':p(0),'B':p()}))
    add(30,'failed_liq_no_shield',{'A':conditional('LiQiang',False,[],liq=True),'B':attack('Xiao',2,2)},
        {'A':p(6,'LiQiang',liq_used=True),'B':p(58,'Xiao')},before=state({'A':p(6),'B':p()}),
        kind='sole_survivor',survivors='B',kills={'B':['A']})
    add(31,'only_repeater',{'A':conditional('LiQiang',True,['B'],liq=True),'B':attack('Bi',6,6),'C':attack('Pragon',12,12)},
        {'A':p(60,'LiQiang',liq_used=True),'B':p(54,'Bi'),'C':p(48,'Pragon','Pragon')},
        before=state({'A':p(),'B':p(last='Bi'),'C':p(last='Charge')}),kind='restart_survivors',survivors='AC',kills={'A':['B'],'C':['B']},
        forbidden=[{'kind':'attack','actor_id':'A','target_id':'C'}])
    add(32,'joint_liq_kills',{'A':conditional('LiQiang',True,['C'],liq=True),'B':conditional('LiQiang',True,['C'],liq=True),'C':attack('Bi',6,6)},
        {'A':p(60,'LiQiang',liq_used=True),'B':p(60,'LiQiang',liq_used=True),'C':p(54,'Bi')},
        before=state({'A':p(),'B':p(),'C':p(last='Bi')}),kind='restart_survivors',survivors='AB',kills={'A':['C'],'B':['C']})
    for target in ['Reflect','Absorb']:
        add(33,target,{'A':conditional('LiQiang',True,['B'],liq=True),'B':a(target,shield=600,fee=6)},
            {'A':p(60,'LiQiang',liq_used=True),'B':p(54,target)},before=state({'A':p(),'B':p(last=target)}),
            kind='sole_survivor',survivors='A',kills={'A':['B']},forbidden=[{'kind':'return'},{'kind':'resource_gain','actor_id':'B','resource':'dd6'}])
    for cid,entry,fee,origin,dd,used in [(34,'RotateThree',36,'normal',60,False),(37,'ZhangXinWei',0,'zhang',0,True)]:
        add(cid,'compound_selfbi',{'A':conditional(entry,True,['C'],fee=fee,actual='RotateThree',origin=origin,branch='SelfBi'),
            'B':conditional('LiQiang',True,['A'],liq=True),'C':a('Reflect',shield=600,fee=6)},
            {'A':p(dd-fee,'RotateThree','RotateThree',zhang_used=used),'B':p(60,'LiQiang',liq_used=True),'C':p(54,'Reflect')},
            before=state({'A':p(dd,last='RotateThree',copy='RotateThree' if used else None),'B':p(),'C':p()}),
            kind='restart_survivors',survivors='AB',kills={'A':['C']},
            required=[counted(event('attack','B','A',amount=60000,result='blocked'))])
    add(35,'lightning_is_same_move',{'A':attack('FreeThree',18,actual='Three',origin='lightning',lightning=3),'B':conditional('LiQiang',True,['A'],liq=True)},
        {'A':p(60,'Three','Three'),'B':p(60,'LiQiang',liq_used=True)},before=state({'A':p(last='Three',lightning=3),'B':p()}),
        kind='sole_survivor',survivors='B',kills={'B':['A']})
    add(36,'branch_not_full_identity',{'A':attack('RotateThree',18,36,branch='Three'),'B':conditional('LiQiang',False,[],liq=True)},
        {'A':p(24,'RotateThree','RotateThree'),'B':p(6,'LiQiang',liq_used=True)},before=state({'A':p(last='Three'),'B':p(6)}),
        kind='sole_survivor',survivors='A',kills={'A':['B']})
    add(38,'copy_niexiang_zero_charge',{'A':attack('ZhangXinWei',21,actual='NieXiang',origin='zhang'),'B':a('NieXiangDef',shield=21,comparison='eq')},
        {'A':p(0,'NieXiang','NieXiang',zhang_used=True),'B':p(60,'NieXiangDef')},before=state({'A':p(0,copy='NieXiang'),'B':p()}))
    add(39,'fresh_zhang_origin',{'A':attack('ZhangXinWei',12,actual='Pragon',origin='zhang'),'B':a('Absorb',shield=600,fee=6)},
        {'A':p(60,'Pragon','Pragon',zhang_used=True),'B':p(66,'Absorb')},before=state({'A':p(copy='Pragon'),'B':p()}),
        note='Prior bomb origin is provenance only; MatchState stores the complete move Pragon, no origin chain.')
    reject(40,'no_record','ZhangXinWei',p(),'NO_COPY_RECORD',resources(),resources())
    reject(40,'used','ZhangXinWei',p(copy='Three',zhang_used=True),'ALREADY_USED',resources(),resources())
    add(41,'bi_preserves_three',{'A':attack('Bi',6,6),'B':attack('Bi',6,6)},
        {'A':p(54,'Bi','Three'),'B':p(54,'Bi')},before=state({'A':p(copy='Three'),'B':p()}))
    add(42,'bigbi_and_return',{'A':a('Reflect',shield=600,fee=6),'B':attack('BigBi',30,30),'C':attack('Pragon',12,12)},
        {'A':p(54,'Reflect'),'B':p(30,'BigBi','BigBi'),'C':p(48,'Pragon','Pragon')},kind='sole_survivor',survivors='B',
        kills={'A':['C'],'B':['A','C']},required=[counted(event('return','A','C',phase='P3',amount=12))],
        forbidden=[{'kind':'return','target_id':'B'}])
    add(43,'dead_tian_clears',{'A':a('TianLiJun',shield=54),'B':a('Absorb',shield=600,fee=6),'C':a('Charge')},
        {'A':p(60,'TianLiJun',tian_uses=1),'B':p(60,'Absorb'),'C':p(0,'Charge')},before=state({'A':p(),'B':p(),'C':p(12)}),
        kind='restart_survivors',survivors='BC',kills={'B':['A']},required=[counted(event('direct_elimination','B','A'))])
    add(44,'tian_reflect_selfbi',{'A':a('TianLiJun',shield=54),'B':a('Reflect',shield=600,fee=6),'C':conditional('SelfBi',True,['B'])},
        {'A':p(60,'TianLiJun',tian_uses=1),'B':p(54,'Reflect'),'C':p(60,'SelfBi')},kind='sole_survivor',survivors='C',
        kills={'B':['A'],'C':['B']},required=[counted(event('direct_elimination','B','A'))],forbidden=[{'kind':'return'}])
    add(45,'tian_blocks_bigbi',{'A':a('TianLiJun',shield=54),'B':attack('BigBi',30,30)},
        {'A':p(60,'TianLiJun',tian_uses=1),'B':p(30,'BigBi','BigBi')})
    add(46,'second_tian',{'A':a('TianLiJun',shield=54,fee=3),'B':a('Charge')},
        {'A':p(0,'TianLiJun',tian_uses=2),'B':p(0,'Charge')},before=state({'A':p(3,tian_uses=1),'B':p(12)}))
    add(47,'shells_joint_kill',{'A':attack('XiaoBei',42,42),'B':attack('Shell',60,60),'C':a('Absorb',shield=600,fee=6)},
        {'A':p(18,'XiaoBei','XiaoBei'),'B':p(0,'Shell','Shell'),'C':p(54,'Absorb')},kind='restart_survivors',survivors='AB',kills={'A':['C'],'B':['C']},
        required=[counted(event('attack','A','B',amount=42,result='suppressed')),counted(event('attack','B','A',amount=60,result='suppressed'))],
        forbidden=[{'kind':'resource_gain','actor_id':'C','resource':'dd6'}])
    add(48,'charge_kills_xiaobei',{'A':attack('XiaoBei',42,42),'B':a('Charge')},
        {'A':p(18,'XiaoBei','XiaoBei'),'B':p(66,'Charge')},kind='sole_survivor',survivors='B',kills={'B':['A']},
        required=[counted(event('direct_elimination','B','A')),counted(event('attack','A','B',amount=42,result='suppressed'))])
    add(49,'dead_charge_still_kills',{'A':attack('XiaoBei',42,42),'B':a('Charge'),'C':attack('Shell',60,60)},
        {'A':p(18,'XiaoBei','XiaoBei'),'B':p(66,'Charge'),'C':p(0,'Shell','Shell')},kind='sole_survivor',survivors='C',kills={'B':['A'],'C':['B']})
    add(50,'cancelled_charge_still_kills',{'A':attack('XiaoBei',42,42),'B':a('Charge'),'C':a('Absorb',shield=600,fee=6)},
        {'A':p(18,'XiaoBei','XiaoBei'),'B':p(60,'Charge'),'C':p(60,'Absorb')},kind='sole_survivor',survivors='B',kills={'B':['A'],'A':['C']})
    for entry,strength,fee in [('XiaoBei',42,42),('Shell',60,60)]:
        add(51,entry,{'A':attack(entry,strength,fee),'B':a('TianLiJun',shield=54)},
            {'A':p(60-fee,entry,entry),'B':p(60,'TianLiJun',tian_uses=1)},kind='sole_survivor',survivors='A',kills={'A':['B']})
    for entry in ['Absorb','Cloud']:
        add(52,entry,{'A':attack('NieXiang',21,nx_charge=4),'B':a(entry,shield=600,fee=6 if entry=='Absorb' else 0)},
            {'A':p(0,'NieXiang','NieXiang',nx_charge=2),'B':p(54,entry) if entry=='Absorb' else p(60,entry,cloud_uses=1,lightning=1)},
            before=state({'A':p(0,nx_charge=6),'B':p()}),kind='sole_survivor',survivors='A',kills={'A':['B']},
            forbidden=[{'kind':'resource_gain','actor_id':'B','resource':'dd6'}])
    add(53,'original_21_return',{'A':attack('NieXiang',21,nx_charge=4),'B':a('Reflect',shield=600,fee=6)},
        {'A':p(60,'NieXiang','NieXiang'),'B':p(54,'Reflect')},before=state({'A':p(nx_charge=4),'B':p()}),
        kind='sole_survivor',survivors='B',kills={'B':['A']},required=[counted(event('return','B','A',phase='P3',amount=21))])
    # Sequences explicitly carry the previous result. These steps never reseed a live run.
    s = state({'A':p(6),'B':p(0)},turn=1)
    steps = []
    steps.append(step(54,s,{'A':a('Bomb',shield=2,fee=6),'B':a('Charge')},
                      {'A':p(0,'Bomb',bomb_placement_count=1,pending_bombs=[bomb(1)]),'B':p(6,'Charge')}))
    s = steps[-1]['expected']['next_state']
    steps.append(step(54,s,{'A':a('Charge'),'B':a('Charge')},
                      {'A':p(6,'Charge',bomb_placement_count=1,mature_bombs=1),'B':p(12,'Charge')},
                      required=[counted({'kind':'bomb_mature','phase':'P4'})]))
    s = steps[-1]['expected']['next_state']
    steps.append(step(54,s,{'A':attack('BombPragon',12,actual='Pragon',origin='bomb',mature_bombs=1),'B':a('PragonDef',shield=12,comparison='eq')},
                      {'A':p(6,'Pragon','Pragon',bomb_placement_count=1),'B':p(12,'PragonDef')}))
    sequence(54,'placement_to_redemption',steps,note='Synthetic initial DD=1/0 at turn 1, then three genuinely linked turns.')
    for prior,entry,strength,fee in [(0,'Xiao',2,2),(1,'Bi',6,6),(2,'Pragon',12,12),(3,'Three',18,18),(7,'Three',18,18)]:
        add(55,f'placement_{prior+1}',{'A':a('Bomb',shield=strength,fee=6),'B':attack(entry,strength,fee)},
            {'A':p(54,'Bomb',bomb_placement_count=prior+1,pending_bombs=[bomb(6)]),'B':p(60-fee,entry,entry if strength>=12 else None)},
            before=state({'A':p(bomb_placement_count=prior),'B':p()}))
    add(56,'independent_blocks',{'A':a('Bomb',shield=6,fee=6),'B':attack('Bi',6,6),'C':attack('Bi',6,6)},
        {'A':p(54,'Bomb',bomb_placement_count=2,pending_bombs=[bomb(6)]),'B':p(54,'Bi'),'C':p(54,'Bi')},
        before=state({'A':p(bomb_placement_count=1),'B':p(),'C':p()}))
    for entry,field,need,have in [('BombPragon','mature_bombs',1,0),('BombVolvo','mature_bombs',2,1),
                                ('BombFlipVolvo','mature_bombs',4,3),('FreeThree','lightning',3,2),('FreeRotateThree','lightning',6,5)]:
        kw = {field:have}
        if entry=='BombPragon':
            kw.update(pending_bombs=[bomb(5)],bomb_placement_count=1)
        reject(57,entry,entry,p(**kw),'INSUFFICIENT_BOMBS' if field=='mature_bombs' else 'INSUFFICIENT_LIGHTNING',
               resources(**{field:need}),resources(**{field:need}))
    add(58,'bomb_flip_volvo',{'A':attack('BombFlipVolvo',24,actual='FlipVolvo',origin='bomb',branch='Volvo',mature_bombs=4),
        'B':a('Absorb',shield=600,fee=6),'C':a('Charge'),'D':a('Charge')},
        {'A':p(60,'FlipVolvo','FlipVolvo'),'B':p(66,'Absorb'),'C':p(60,'Charge'),'D':p(60,'Charge')},
        before=state({'A':p(mature_bombs=4),'B':p(),'C':p(),'D':p()}),kind='restart_survivors',survivors='AB',kills={'A':['C','D']})
    add(59,'free_rotate_three',{'A':attack('FreeRotateThree',18,actual='RotateThree',origin='lightning',branch='Three',lightning=6),
        'B':a('ThreeDef',shield=18,comparison='eq')},{'A':p(0,'RotateThree','RotateThree'),'B':p(60,'ThreeDef')},
        before=state({'A':p(0,lightning=6),'B':p()}))
    add(60,'local_choice_global_risk',{'A':attack('RotateThree',18,36,branch='Three'),'B':attack('FlipVolvo',24,48,branch='Volvo'),
        'C':a('Absorb',shield=600,fee=6),'D':a('Charge'),'E':a('Charge')},
        {'A':p(24,'RotateThree','RotateThree'),'B':p(12,'FlipVolvo','FlipVolvo'),'C':p(108,'Absorb'),'D':p(60,'Charge'),'E':p(60,'Charge')},
        kind='restart_survivors',survivors='BC',kills={'A':['D','E'],'B':['A','D','E']})
    add(61,'only_choosers',{'A':attack('RotateThree',18,36,branch='Three'),'B':attack('RotateThree',18,36,branch='Three')},
        {'A':p(24,'RotateThree','RotateThree'),'B':p(24,'RotateThree','RotateThree')})
    for token in [0,1]:
        aa = attack('RotateThree',18,36,branch='Three') if token==0 else conditional('RotateThree',False,[],branch='SelfBi',fee=36)
        add(62,f'token_{token}',{'A':aa,'B':attack('Shell',60,60)},
            {'A':p(24,'RotateThree','RotateThree' if token==0 else None),'B':p(0,'Shell','Shell')},
            tokens={'A':token},kind='sole_survivor',survivors='B',kills={'B':['A']},
            required=[counted(event('attack','B','A',amount=60))])
        aa = attack('RotateThree',18,36,branch='Three') if token==0 else conditional('RotateThree',True,['B'],branch='SelfBi',fee=36)
        add(63,f'token_{token}',{'A':aa,'B':a('Absorb',shield=600,fee=6),'C':a('Charge')},
            {'A':p(24,'RotateThree','RotateThree'),'B':p(78 if token==0 else 60,'Absorb'),'C':p(60,'Charge')},
            tokens={'A':token},kind='restart_survivors',survivors='AB' if token==0 else 'AC',kills={'A':['C' if token==0 else 'B']})
    before = state({'A':p(30,copy='Three',lightning=3,nx_charge=4,mature_bombs=2,pending_bombs=[bomb(5)],
                            bomb_placement_count=3,enhanced_xiao=True,cloud_uses=1,tian_uses=1,zhang_used=True,liq_used=True),'B':p()})
    preserved = dict(cloud_uses=1,tian_uses=1,zhang_used=True,liq_used=True)
    first = step(64,before,{'A':a('ZengYi',shield='inf',returning='inf'),'B':a('Charge')},
                 {'A':p(0,'ZengYi',zeng_state='recovery',**preserved),'B':p(66,'Charge')})
    second = step(64,first['expected']['next_state'],{'A':a('ZengYi',shield='inf',returning='inf',recovery=True),'B':a('Charge')},
                  {'A':p(0,'ZengYi',zeng_state='waiting',reward_due_turn=10,**preserved),'B':p(72,'Charge')})
    sequence(64,'two_clears_keep_use_records',[first,second],note='T=6 active, T+1=7 recovery, reward due at turn 10; due is null in recovery.')
    # C065 is fully natural from new_match, not seven independent snapshots.
    s = state({'A':p(0),'B':p(0)},turn=1,game_id='fixture:g1')
    steps = []
    steps.append(step(65,s,{'A':a('ZengYi',shield='inf',returning='inf'),'B':a('Charge')},
                      {'A':p(0,'ZengYi',zeng_state='recovery'),'B':p(6,'Charge')}))
    steps.append(step(65,steps[-1]['expected']['next_state'],{'A':a('ZengYi',shield='inf',returning='inf',recovery=True),'B':a('Charge')},
                      {'A':p(0,'ZengYi',zeng_state='waiting',reward_due_turn=5),'B':p(12,'Charge')}))
    for turn in [3,4,5]:
        st = step(65,steps[-1]['expected']['next_state'],{'A':a('Charge'),'B':a('Charge')},
                  {'A':p((turn-2)*6,'Charge',zeng_state='ready' if turn==5 else 'waiting',reward_due_turn=None if turn==5 else 5),
                   'B':p(turn*6,'Charge')},
                  required=[counted({'kind':'reward_granted','phase':'P4'})] if turn==5 else [],
                  forbidden=[] if turn==5 else [{'kind':'reward_granted'}])
        st['expected']['options']['A']['ZengRewardBigBi'] = dict(available=False,reason_code='NO_REWARD',forced=False,required=resources(reward_stock=1),spend=resources(reward_stock=1))
        steps.append(st)
    steps.append(step(65,steps[-1]['expected']['next_state'],{'A':attack('ZengRewardBigBi',30,actual='BigBi',origin='zeng_reward',reward_stock=1),'B':a('Def',shield=6)},
                      {'A':p(18,'BigBi','BigBi',zeng_state='spent'),'B':p(30,'Def',nx_charge=2)},forbidden=[{'kind':'reward_granted'}]))
    steps.append(step(65,steps[-1]['expected']['next_state'],{'A':attack('ZhangXinWei',30,actual='BigBi',origin='zhang'),'B':a('Def',shield=6)},
                      {'A':p(18,'BigBi','BigBi',zeng_state='spent',zhang_used=True),'B':p(30,'Def',nx_charge=4)},forbidden=[{'kind':'reward_granted'}]))
    sequence(65,'natural_reward_then_copy',steps,new=True)
    for cid,repeat in [(66,False),(67,True)]:
        add(cid,'recovery_exempt',{'A':a('ZengYi',shield='inf',returning='inf',recovery=True),'B':conditional('LiQiang',repeat,['C'] if repeat else [],liq=True),'C':attack('Bi',6,6)},
            {'A':p(0,'ZengYi',zeng_state='waiting',reward_due_turn=9),'B':p(60 if repeat else 6,'LiQiang',liq_used=True),'C':p(54,'Bi')},
            before=state({'A':p(last='ZengYi',zeng_state='recovery'),'B':p(60 if repeat else 6),'C':p(last='Bi' if repeat else 'Charge')}),
            kind='restart_survivors',survivors='AB' if repeat else 'AC',kills={'B':['C']} if repeat else {'C':['B']},
            forbidden=[{'kind':'attack','actor_id':'B','target_id':'A'}])
    for progress in ['waiting','ready','recovery']:
        recovery = progress=='recovery'
        add(68,progress,{'A':a('ZengYi',shield='inf',returning='inf',recovery=True) if recovery else a('Def',shield=6),
            'B':attack('BigBi',30,30),'C':a('Charge')},
            {'A':p(0,'ZengYi',zeng_state='waiting',reward_due_turn=9) if recovery else p(60,'Def',nx_charge=2,zeng_state=progress,reward_due_turn=8 if progress=='waiting' else None),
             'B':p(30,'BigBi','BigBi'),'C':p(66,'Charge')},
            before=state({'A':p(last='ZengYi' if recovery else None,zeng_state=progress,reward_due_turn=8 if progress=='waiting' else None),'B':p(),'C':p()}),
            kind='restart_survivors',survivors='AB',kills={'B':['C']})
    # Establish a real transition, then use the live returned state for the next round.
    s = state({'A':p(copy='Three',liq_used=True),'B':p(copy='Three',liq_used=True),'C':p()})
    first = step(69,s,{'A':attack('Three',18,18),'B':attack('Three',18,18),'C':attack('Bi',6,6)},
                 {'A':p(42,'Three','Three',liq_used=True),'B':p(42,'Three','Three',liq_used=True),'C':p(54,'Bi')},
                 kind='restart_survivors',survivors='AB',kills={'A':['C'],'B':['C']})
    second = step(69,first['expected']['next_state'],{'A':conditional('LiQiang',False,[],liq=True),'B':conditional('LiQiang',False,[],liq=True)},
                  {'A':p(6,'LiQiang',liq_used=True),'B':p(6,'LiQiang',liq_used=True)})
    sequence(69,'restart_then_liq',[first,second])
    add(70,'reward_repeats_bigbi',{'A':attack('ZengRewardBigBi',30,actual='BigBi',origin='zeng_reward',reward_stock=1),'B':conditional('LiQiang',True,['A'],liq=True)},
        {'A':p(60,'BigBi','BigBi',zeng_state='spent'),'B':p(60,'LiQiang',liq_used=True)},
        before=state({'A':p(last='BigBi',zeng_state='ready'),'B':p()}),kind='sole_survivor',survivors='B',kills={'B':['A']})
    add(71,'waiting_has_no_shield',{'A':a('Charge'),'B':attack('Bi',6,6)},
        {'A':p(66,'Charge',zeng_state='waiting',reward_due_turn=8),'B':p(54,'Bi')},
        before=state({'A':p(zeng_state='waiting',reward_due_turn=8),'B':p()}),kind='sole_survivor',survivors='B',kills={'B':['A']})
    for entry,player in [('ZhangXinWei',p(copy='Three',zhang_used=True)),('LiQiang',p(liq_used=True)),('ZengYi',p(zeng_state='spent'))]:
        reject(72,entry,entry,player,'ALREADY_USED',resources(),resources())
    for cid,variant in [(17,'sum_before_restart'),(26,'dead_reflector_returns'),(60,'local_choice_global_risk'),(63,'token_0'),(63,'token_1')]:
        clone(73,f'C{cid:03}_{variant}',cid,variant,properties=['repeat','permutation','json_roundtrip','no_aliases'])
    for ta,tb in [(0,0),(0,1),(1,0),(1,1)]:
        actions = {pid:(attack('RotateThree',18,36,branch='Three') if token==0 else
                        conditional('RotateThree',True,['C'],fee=36,branch='SelfBi'))
                   for pid,token in [('A',ta),('B',tb)]}
        actions.update(C=a('Absorb',shield=600,fee=6),D=a('Charge'))
        add(73,f'tokens_A{ta}_B{tb}',actions,
            {'A':p(24,'RotateThree','RotateThree'),'B':p(24,'RotateThree','RotateThree'),
             'C':p(96 if (ta,tb)==(0,0) else (60 if (ta,tb)==(1,1) else 78),'Absorb'),'D':p(60,'Charge')},
            tokens={'A':ta,'B':tb},kind='restart_survivors',
            survivors='ABC' if (ta,tb)==(0,0) else ('ABD' if (ta,tb)==(1,1) else 'AB'),
            kills={'A':['D' if ta==0 else 'C'],'B':['D' if tb==0 else 'C']},
            scope='property',properties=['repeat','permutation','token_independence'])
    add(73,'six_players',{'A':attack('Three',18,18),'B':attack('Three',18,18),'C':attack('Three',18,18),
        'D':attack('Bi',6,6),'E':attack('Bi',6,6),'F':a('Def',shield=6)},
        {'A':p(42,'Three','Three'),'B':p(42,'Three','Three'),'C':p(42,'Three','Three'),
         'D':p(54,'Bi'),'E':p(54,'Bi'),'F':p(60,'Def',nx_charge=3)},
        kind='restart_survivors',survivors='ABC',kills={'A':['D','E','F'],'B':['D','E','F'],'C':['D','E','F']},
        scope='property',properties=['repeat','permutation','json_roundtrip','no_aliases'])
    dirty = dict(lightning=7,nx_charge=8,mature_bombs=4,pending_bombs=[bomb(5)],bomb_placement_count=8,
                 cloud_uses=2,tian_uses=3,zhang_used=True,liq_used=True,enhanced_xiao=True,zeng_state='ready')
    add(74,'core_full_reset',{'A':attack('Three',18,18),'B':attack('Three',18,18),'C':attack('Bi',6,6),'D':a('Def',shield=6)},
        {'A':p(42,'Three','Three',**dict(dirty,pending_bombs=[],mature_bombs=5)),
         'B':p(42,'Three','Three',**dict(dirty,pending_bombs=[],mature_bombs=5)), 'C':p(54,'Bi'),'D':p(60,'Def',nx_charge=2)},
        before=state({'A':p(last='Three',copy='Volvo',**dirty),'B':p(last='Three',copy='Volvo',**dirty),'C':p(),'D':p()}),
        kind='restart_survivors',survivors='AB',kills={'A':['C','D'],'B':['C','D']},scope='property',properties=['fresh_reset'])
    session(74,'room_state_preserved',{'room_kind':'multiplayer','initial_count':4,'absence_counts':{'A':2}},
            ['Apply C074/core_full_reset through a room/session adapter.',
             'Require room_kind multiplayer and A absence count 2 after restart.'],
            {'room_kind':'multiplayer','initial_count':4,'absence_counts':{'A':2}},'Room state is not a MatchState field; no room API is authorized in T02.')
    reflection_domain()
    for label,cid,variant in [('Pragon',10,'PragonDef'),('Bi',41,'bi_preserves_three'),
                              ('SelfBi',25,'selfbi_preserves_old_copy'),('RotateThree',34,'compound_selfbi')]:
        clone(76,label,cid,variant,properties=['copy_record'])
    add(76,'LiQiang',{'A':conditional('LiQiang',True,['B'],liq=True),'B':a('Reflect',shield=600,fee=6)},
        {'A':p(60,'LiQiang','Volvo',liq_used=True),'B':p(54,'Reflect')},
        before=state({'A':p(copy='Volvo'),'B':p(last='Reflect')}),kind='sole_survivor',survivors='A',kills={'A':['B']},
        scope='property',properties=['copy_record'])
    add(76,'Reflect',{'A':a('Reflect',shield=600,fee=6),'B':attack('Three',18,18)},
        {'A':p(54,'Reflect','Volvo'),'B':p(42,'Three','Three')},before=state({'A':p(copy='Volvo'),'B':p()}),
        kind='sole_survivor',survivors='A',kills={'A':['B']},scope='property',properties=['copy_record'],
        required=[counted(event('return','A','B',phase='P3',amount=18))])
    reject(77,'three_charge_not_enough','NieXiang',p(nx_charge=3),'INSUFFICIENT_CHARGE',resources(nx_charge=4),resources(nx_charge=4),other='Def')
    add(78,'two_bigbi_extra_charge',{'A':a('Def',shield=6),'B':attack('BigBi',30,30),'C':attack('BigBi',30,30)},
        {'A':p(60,'Def',nx_charge=3),'B':p(30,'BigBi','BigBi'),'C':p(30,'BigBi','BigBi')})
    first = step(79,state({'A':p(0),'B':p(0)},turn=1,game_id='fixture:g1'),{'A':a('Cloud',shield=600),'B':a('Charge')},
                 {'A':p(0,'Cloud',cloud_uses=1,lightning=1),'B':p(0,'Charge')})
    rf = reject(79,'temporary','Cloud',first['expected']['next_state']['players']['A'],'INSUFFICIENT_DD',resources(6),resources(6),before=first['expected']['next_state'])
    CASES.pop()
    failed = {'input':rf['input'],'expected':rf['expected']}
    second = step(79,first['expected']['next_state'],{'A':a('Charge'),'B':a('Charge')},
                  {'A':p(6,'Charge',cloud_uses=1,lightning=1),'B':p(6,'Charge')})
    third = step(79,second['expected']['next_state'],{'A':a('Cloud',shield=600,fee=6),'B':a('Charge')},
                 {'A':p(0,'Cloud',cloud_uses=2,lightning=2),'B':p(6,'Charge')})
    sequence(79,'natural_cloud_with_rejection',[first,failed,second,third],new=True)
    for entry,actual,origin,fee,stock in [('RotateThree','RotateThree','normal',36,{}),('FlipVolvo','FlipVolvo','normal',48,{}),
                                       ('BombFlipVolvo','FlipVolvo','bomb',0,{'mature_bombs':4}),('FreeRotateThree','RotateThree','lightning',0,{'lightning':6})]:
        add(80,entry,{'A':conditional(entry,True,['B'],fee=fee,actual=actual,origin=origin,branch='SelfBi',**stock),'B':a('Absorb',shield=600,fee=6)},
            {'A':p(60-fee,actual,actual),'B':p(54,'Absorb')},before=state({'A':p(**stock),'B':p()}),
            kind='sole_survivor',survivors='A',kills={'A':['B']},forbidden=[{'kind':'resource_gain','actor_id':'B','resource':'dd6'}])
    fifth = deepcopy(steps[4])  # The authored C065 sequence, no engine outputs.
    f = dict(case_id='C081',variant='pure_due_retry',rules_version=VERSION,scope='property',
             input=fifth['input'],expected=fifth['expected'],rule_ids=['R02','R25','R26'],
             source_notes='Exact C065 r5 start: A DD=12 sixths, B DD=24 sixths, due=5. Pure computation only.')
    f['expected']['properties'] = ['repeat','permutation','json_roundtrip','no_aliases']
    CASES.append(f)
    session(81,'session_request_replay',fifth['input'],
            ['Apply C081/pure_due_retry as request_id due-5; save its response and the live state.',
             'Retry identical due-5; return cached response, do not apply again.',
             'Apply C065 r6 reward spend; A is spent with DD=18 sixths.',
             'Replay due-5 with cache retained; response may be the old response, live state must stay spent at turn 7.',
             'Replay due-5 after response eviction; return STALE_TURN, live state unchanged.',
             'Reuse due-5 with changed payload; return REQUEST_CONFLICT, live state unchanged.'],
            {'after_due':{'dd6':'18','zeng_state':'ready','reward_due_turn':None,'grant_count':1},
             'after_spend_and_old_request':{'dd6':'18','zeng_state':'spent','reward_due_turn':None,'turn_index':'7'},
             'uncached_error':'STALE_TURN','conflicting_error':'REQUEST_CONFLICT'},
            'CONTRACT-R02/ARC-R02 D05 defines behavior, but no session callable is issued; integration must bind a real adapter.')
    add(82,'grant_then_restart',{'A':a('Def',shield=6),'B':attack('BigBi',30,30),'C':a('Charge')},
        {'A':p(0,'Def',nx_charge=2,zeng_state='ready'),'B':p(0,'BigBi','BigBi'),'C':p(6,'Charge')},
        before=state({'A':p(0,zeng_state='waiting',reward_due_turn=6),'B':p(30),'C':p(0)}),
        kind='restart_survivors',survivors='AB',kills={'B':['C']},required=[counted({'kind':'reward_granted','phase':'P4'})])


def step(case: int, before: dict, actions: dict, posts: dict, **kw) -> dict:
    f = add(case,'temporary',actions,posts,before=before,**kw)
    CASES.pop()
    return {'input':f['input'],'expected':f['expected']}


def sequence(case: int, variant: str, steps: list, *, new: bool = False, note: str = '') -> None:
    initial = steps[0]['input']['state']
    inputs = dict(state=initial,steps=[{k:v for k,v in s['input'].items() if k!='state'} for s in steps])
    if new:
        inputs['new_match'] = {'player_ids':initial['roster'],'match_id':initial['match_id']}
    CASES.append(dict(case_id=f'C{case:03}',variant=variant,rules_version=VERSION,scope='sequence',input=inputs,
                      expected={'initial_state':initial,'steps':[s['expected'] for s in steps]},
                      rule_ids=[f'R{r:02}' for r in RULES[case]],source_notes=f'CASES.md#C{case:03}; linked steps. {note}'.strip()))


def clone(case: int, variant: str, original: int, original_variant: str, *, properties: list) -> None:
    f = deepcopy(next(f for f in CASES if f['case_id']==f'C{original:03}' and f['variant']==original_variant))
    f.update(case_id=f'C{case:03}',variant=variant,scope='property',rule_ids=[f'R{r:02}' for r in RULES[case]],
             source_notes=f'CASES.md#C{case:03}; public-API probe using authored C{original:03}/{original_variant}. No private action injection.')
    f['expected']['properties'] = properties
    CASES.append(f)


def session(case: int, variant: str, initial: dict, steps: list, expected: dict, note: str) -> None:
    CASES.append(dict(case_id=f'C{case:03}',variant=variant,rules_version=VERSION,scope='session',
                      input={'initial':deepcopy(initial),'operations':steps},expected={'status':'NOT_RUN','assertions':expected},
                      rule_ids=[f'R{r:02}' for r in RULES[case]],source_notes=note))


def reflection_domain() -> None:
    """Finite representative domain: all entries, all valid copy identities, both branch tokens.

    This is an explicit table of examples, not a universal reachability proof.
    Reflect forces the successful SelfBi branch for compounds; a second table
    supplies their ordinary/failed branches against Shell under the two tied tokens.
    """
    rows = [
        # entry, prepared expectation, start A, post A, survivor set, kills
        ('Charge',a('Charge'),p(0),p(6,'Charge'),'AB',{}),
        ('Bi',attack('Bi',6,6),p(6),p(0,'Bi'),'B',{'B':['A']}),
        ('Def',a('Def',shield=6),p(0),p(0,'Def',nx_charge=1),'AB',{}),
        ('Three',attack('Three',18,18),p(18),p(0,'Three','Three'),'B',{'B':['A']}),
        ('ThreeDef',a('ThreeDef',shield=18,comparison='eq'),p(0),p(0,'ThreeDef'),'AB',{}),
        ('BigBi',attack('BigBi',30,30),p(30),p(0,'BigBi','BigBi'),'A',{'A':['B']}),
        ('Reflect',a('Reflect',shield=600,fee=6),p(6),p(0,'Reflect'),'AB',{}),
        ('SelfBi',conditional('SelfBi',True,['B']),p(0),p(0,'SelfBi'),'A',{'A':['B']}),
        ('Cloud',a('Cloud',shield=600),p(0),p(0,'Cloud',cloud_uses=1,lightning=1),'AB',{}),
        ('Bomb',a('Bomb',shield=2,fee=6),p(6),p(0,'Bomb',bomb_placement_count=1,pending_bombs=[bomb(6)]),'AB',{}),
        ('Xiao',attack('Xiao',2,2),p(2),p(0,'Xiao'),'B',{'B':['A']}),
        ('Pragon',attack('Pragon',12,12),p(12),p(0,'Pragon','Pragon'),'B',{'B':['A']}),
        ('PragonDef',a('PragonDef',shield=12,comparison='eq'),p(0),p(0,'PragonDef'),'AB',{}),
        ('Volvo',attack('Volvo',24,24),p(24),p(0,'Volvo','Volvo'),'B',{'B':['A']}),
        ('VolvoDef',a('VolvoDef',shield=24,comparison='eq'),p(0),p(0,'VolvoDef'),'AB',{}),
        ('RotateThree',conditional('RotateThree',True,['B'],branch='SelfBi',fee=36),p(36),p(0,'RotateThree','RotateThree'),'A',{'A':['B']}),
        ('XiaoBei',attack('XiaoBei',42,42),p(42),p(0,'XiaoBei','XiaoBei'),'A',{'A':['B']}),
        ('FlipVolvo',conditional('FlipVolvo',True,['B'],branch='SelfBi',fee=48),p(48),p(0,'FlipVolvo','FlipVolvo'),'A',{'A':['B']}),
        ('Shell',attack('Shell',60,60),p(60),p(0,'Shell','Shell'),'A',{'A':['B']}),
        ('Absorb',a('Absorb',shield=600,fee=6),p(6),p(0,'Absorb'),'AB',{}),
        ('NieXiang',attack('NieXiang',21,nx_charge=4),p(0,nx_charge=4),p(0,'NieXiang','NieXiang'),'B',{'B':['A']}),
        ('NieXiangDef',a('NieXiangDef',shield=21,comparison='eq'),p(0),p(0,'NieXiangDef'),'AB',{}),
        ('JuYan',a('JuYan',shield=2),p(0),p(0,'JuYan',enhanced_xiao=True),'AB',{}),
        ('TianLiJun',a('TianLiJun',shield=54),p(0),p(0,'TianLiJun',tian_uses=1),'B',{'B':['A']}),
        ('LiQiang',conditional('LiQiang',True,['B'],liq=True),p(0),p(0,'LiQiang',liq_used=True),'A',{'A':['B']}),
        ('BombPragon',attack('BombPragon',12,actual='Pragon',origin='bomb',mature_bombs=1),p(0,mature_bombs=1),p(0,'Pragon','Pragon'),'B',{'B':['A']}),
        ('BombVolvo',attack('BombVolvo',24,actual='Volvo',origin='bomb',mature_bombs=2),p(0,mature_bombs=2),p(0,'Volvo','Volvo'),'B',{'B':['A']}),
        ('BombFlipVolvo',conditional('BombFlipVolvo',True,['B'],actual='FlipVolvo',origin='bomb',branch='SelfBi',mature_bombs=4),p(0,mature_bombs=4),p(0,'FlipVolvo','FlipVolvo'),'A',{'A':['B']}),
        ('FreeThree',attack('FreeThree',18,actual='Three',origin='lightning',lightning=3),p(0,lightning=3),p(0,'Three','Three'),'B',{'B':['A']}),
        ('FreeRotateThree',conditional('FreeRotateThree',True,['B'],actual='RotateThree',origin='lightning',branch='SelfBi',lightning=6),p(0,lightning=6),p(0,'RotateThree','RotateThree'),'A',{'A':['B']}),
        ('ZengYi',a('ZengYi',shield='inf',returning='inf'),p(0),p(0,'ZengYi',zeng_state='recovery'),'AB',{}),
        ('ZengRewardBigBi',attack('ZengRewardBigBi',30,actual='BigBi',origin='zeng_reward',reward_stock=1),p(0,zeng_state='ready'),p(0,'BigBi','BigBi',zeng_state='spent'),'A',{'A':['B']}),
        ('Xiao_enhanced',attack('Xiao',2,enhanced=True),p(2,enhanced_xiao=True),p(2,'Xiao'),'B',{'B':['A']}),
    ]
    for move,strength in [('Three',18),('BigBi',30),('Pragon',12),('Volvo',24),('RotateThree',60000),
                          ('XiaoBei',42),('FlipVolvo',60000),('Shell',60),('NieXiang',21)]:
        compound = move in ('RotateThree','FlipVolvo')
        returns = move in ('Three','Pragon','Volvo','NieXiang')
        action = conditional('ZhangXinWei',True,['B'],actual=move,origin='zhang',branch='SelfBi') if compound else attack('ZhangXinWei',strength,actual=move,origin='zhang')
        rows.append(('ZhangXinWei_'+move,action,p(0,copy=move),p(0,move,move,zhang_used=True),'B' if returns else 'A',{'B':['A']} if returns else {'A':['B']}))
    for name,aa,start,post,survivors,kills in rows:
        compound = aa['actual_move'] in ('RotateThree','FlipVolvo')
        for token in ([0,1] if compound else [None]):
            variant = name+'_vs_Reflect'+('' if token is None else f'_token_{token}')
            reflect = p(last='Reflect') if name=='LiQiang' else p()
            is_return = survivors=='B' and name!='TianLiJun'
            add(75,variant,{'A':aa,'B':a('Reflect',shield=600,fee=6)},{'A':post,'B':p(54,'Reflect')},
                before=state({'A':start,'B':reflect}),tokens={} if token is None else {'A':token},
                kind='continue_game' if survivors=='AB' else 'sole_survivor',survivors=survivors,kills=kills,
                required=[counted(event('return','B','A',phase='P3',amount=int(aa['attack6'])))] if is_return else [],
                forbidden=[] if is_return else [{'kind':'return'}],scope='property',properties=['return_domain'],
                note='Finite public-API reachability probe; no prepared-action injection and no claim over arbitrary numeric states.')
        if compound:
            for token in [0,1]:
                branch = 'Three' if aa['actual_move']=='RotateThree' else 'Volvo'
                strength = 18 if branch=='Three' else 24
                common = dict(actual=aa['actual_move'],origin=aa['origin'],fee=int(aa['spend']['dd6']),
                              **{k:int(v) for k,v in aa['spend'].items() if k!='dd6'})
                ca = attack(aa['entry_id'],strength,branch=branch,**common) if token==0 else conditional(aa['entry_id'],False,[],branch='SelfBi',**common)
                cp = deepcopy(post)
                cp['latest_copyable_move'] = aa['actual_move'] if token==0 else start['latest_copyable_move']
                add(75,name+f'_vs_Shell_token_{token}',{'A':ca,'B':attack('Shell',60,60)},{'A':cp,'B':p(0,'Shell','Shell')},
                    before=state({'A':start,'B':p()}),tokens={'A':token},kind='sole_survivor',survivors='B',kills={'B':['A']},
                    forbidden=[{'kind':'return'}],scope='property',properties=['return_domain'])


def main() -> None:
    authored()
    HERE.joinpath('fixtures').mkdir(exist_ok=True)
    for case in range(1,83):
        rows = [f for f in CASES if f['case_id']==f'C{case:03}']
        if not rows:
            raise ValueError(f'Missing authored C{case:03}')
        HERE.joinpath('fixtures',f'C{case:03}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Authored {len(CASES)} fixtures across 82 case IDs; engine imports/calls: 0')


if __name__=='__main__':
    main()
