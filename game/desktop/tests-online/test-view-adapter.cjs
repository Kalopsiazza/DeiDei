const {test}=require('node:test');
const assert=require('node:assert/strict');
const {onlineBattleView}=require('../build/online-model.cjs');
const manual=require('../catalog.json');
const {snapshot}=require('./fake.cjs');

const state=(phase='selecting')=>({
 source:'online',status:'connected',hello:null,membership_end:null,host_remaining_ms:null,
 snapshot:snapshot(phase),pending:false,error:null,confirmed:null,remaining_ms:phase==='revealing'?5000:10000,revision:1,
});

test('online battle view exposes only the current player selection data in seat order',()=>{
 const current=state();
 current.snapshot.view.members.reverse();
 current.resume_token='private-token';
 current.snapshot.view.password='private-password';
 current.snapshot.view.members[0].private_entry_id='OPPONENT_SECRET_ENTRY';
 const view=onlineBattleView(current,manual,9000);
 assert.deepEqual(view.participants.map(player=>player.player_id),['p1','p2','p3','p4','p5','p6']);
 assert.equal(view.source,'online');
 assert.equal(view.phase,'selecting');
 assert.equal(view.self_id,'p1');
 assert.equal(view.options.length,33);
 assert.deepEqual(view.timer,{mode:'preview',remaining_ms:9000,total_ms:10000});
 assert.deepEqual(view.participants[0].resources,{dd6:'36',lightning:'3',nx_charge:'4',mature_bombs:'2',reward_stock:'1',enhanced_xiao:true,cloud_uses:'1',tian_uses:'1',bomb_placement_count:'3'});
 const serialized=JSON.stringify(view);
 assert.doesNotMatch(serialized,/private-token|private-password|OPPONENT_SECRET_ENTRY/);

 current.snapshot.view.self.accepted_entry_id='Charge';
 const submitted=onlineBattleView(current,manual,8000);
 assert.equal(submitted.phase,'submitting');
 assert.equal(submitted.selected_entry_id,'Charge');
 assert.equal(submitted.submitted,true);
 current.snapshot.view.self.role='spectator';
 assert.equal(onlineBattleView(current,manual,8000).options.length,0);
 current.snapshot.view.self.role='player';
 current.snapshot.view.members.find(member=>member.player_id==='p1').participation='eliminated';
 assert.equal(onlineBattleView(current,manual,8000).options.length,0);
});

test('online battle view reads revealed ledger and public outcome but no lobby match',()=>{
 const revealed=state('revealing');
 const revealView=onlineBattleView(revealed,manual,4200);
 assert.equal(revealView.phase,'revealed');
 assert.deepEqual(revealView.timer,{mode:'reveal',remaining_ms:4200,total_ms:5000});
 assert.equal(revealView.options.length,0);
 assert.match(revealView.summary.join('\n'),/本机验收：攒／DeiDei/);

 revealed.snapshot.view.phase='result';
 revealed.snapshot.view.match.effective_outcome={kind:'sole_survivor',winner_id:'p1',reason:'rules'};
 revealed.snapshot.view.match.public_state.active_ids=['p1'];
 const result=onlineBattleView(revealed,manual,null);
 assert.equal(result.phase,'result');
 assert.deepEqual(result.outcome,{winner_id:'p1',reason:'rules'});
 assert.equal(result.participants.find(player=>player.player_id==='p2').alive,true); // Effective result state owns alive; public_state is the previous turn.
 revealed.snapshot.view.match.last_turn.effective_state.active_ids=['p1'];
 assert.equal(onlineBattleView(revealed,manual,null).participants.find(player=>player.player_id==='p2').alive,false);
 assert.equal(result.options.length,0);

 assert.equal(onlineBattleView(state('lobby'),manual,null),null);
});


const {emptyHistory,recordPublicRound,historyGaps}=require('../build/view-loop.cjs');
const ids=['ThreeDef','PragonDef','VolvoDef','NieXiangDef','BombPragon','BombVolvo','BombFlipVolvo','ZengRewardBigBi'];
const roundView=(turn='1',game='match1:g1')=>{
 const view=onlineBattleView(state('revealing'),manual,4000);
 view.game_id=game;view.turn_index=turn;
 view.public_round={match_id:view.match_id,game_id:game,turn_index:turn,turn_id:`${game}:t${turn}`,next_game_id:game,next_turn_index:String(BigInt(turn)+1n),actions:{p1:{entry_id:'Charge',actual_move:'Charge',branch:null,is_recovery:false},p2:{entry_id:'Def',actual_move:'Def',branch:null,is_recovery:false}}};
 return view;
};
test('revealed public identity comes from the ledger, not the next state; select/submit are private',()=>{
 const samples=require('./room-results-v11.json').frames;
 const snapshot=samples.ordinary_reveal;
 const current={...state(),snapshot};
 const view=onlineBattleView(current,manual,4000),last=snapshot.view.match.last_turn,ledger=last.core_resolution.ledger;
 assert.equal(view.game_id,ledger.game_id);assert.equal(view.turn_index,ledger.turn_index);
 assert.equal(view.public_round.turn_id,last.turn_id);
 assert.notEqual(view.turn_index,last.effective_state.turn_index);
 assert.deepEqual(Object.keys(view.public_round).sort(),['actions','game_id','match_id','next_game_id','next_turn_index','turn_id','turn_index']);
 last.core_resolution.ledger.actions[Object.keys(ledger.actions)[0]].secret_token='PRIVATE_CHOICE';
 assert.doesNotMatch(JSON.stringify(onlineBattleView(current,manual,4000)),/PRIVATE_CHOICE|choice_tokens|resume_token/);
 const selecting=state();selecting.snapshot.view.match.last_turn=last;
 assert.equal(onlineBattleView(selecting,manual,8000).public_round,null);
 selecting.snapshot.view.self.accepted_entry_id='Charge';
 assert.equal(onlineBattleView(selecting,manual,7000).public_round,null);
});
test('all eight formerly ambiguous icons, same nicknames, recovery and copy branches use player/entry IDs',()=>{
 for(const entry_id of ids){
  const view=roundView();view.participants[0].nickname=view.participants[1].nickname='同名';view.summary=['同名：炸药（错误文案不得用于取图）。'];
  view.public_round.actions.p1={entry_id,actual_move:'Volvo',branch:'FlipVolvo',is_recovery:false};
  view.public_round.actions.p2={entry_id:'ZhangXinWei',actual_move:'RotateThree',branch:'Three',is_recovery:false};
  const history=recordPublicRound(emptyHistory,view,manual);
  assert.equal(history.moves.p1[0].entryId,entry_id);
  assert.equal(history.moves.p2[0].entryId,'ZhangXinWei');
  assert.equal(history.moves.p1[0].name,manual.entries.find(entry=>entry.entry_id===entry_id).name);
  assert.deepEqual([history.moves.p2[0].actualMove,history.moves.p2[0].branch],['RotateThree','Three']);
 }
 const recovery=roundView();recovery.public_round.actions.p1={entry_id:'ZengYi',actual_move:'ZengYi',branch:null,is_recovery:true};
 const move=recordPublicRound(emptyHistory,recovery,manual).moves.p1[0];
 assert.equal(move.entryId,'ZengYi');assert.equal(move.name,'曾义休整');assert.equal(move.isRecovery,true);
});
test('history captures ten received rounds without duplicates and reports first/reconnect/cross-game gaps',()=>{
 let history=emptyHistory;
 for(let turn=1;turn<=10;turn++){const view=roundView(String(turn));history=recordPublicRound(history,view,manual);assert.equal(recordPublicRound(history,structuredClone(view),manual),history);}
 assert.equal(history.moves.p1.length,10);assert.equal(history.turns.length,10);assert.deepEqual(historyGaps(history,roundView('10')),[]);
 const restart=roundView('11');restart.public_round.next_game_id='match1:g2';restart.public_round.next_turn_index='1';
 history=recordPublicRound(history,restart,manual);
 assert.equal(history.game_id,'match1:g1');assert.equal(history.moves.p1.length,11);
 const next={...restart,game_index:'2',game_id:'match1:g2',turn_index:'1',phase:'selecting',public_round:null};
 history=recordPublicRound(history,next,manual);
 assert.equal(history.game_id,'match1:g2');assert.deepEqual(history.moves,{});assert.deepEqual(historyGaps(history,next),[]);
 const missed=recordPublicRound(emptyHistory,roundView('4'),manual);
 assert.deepEqual(historyGaps(missed,roundView('4')),['第 1—3 拍记录未收到。']);
 const reconnected=recordPublicRound(missed,roundView('7'),manual);
 assert.deepEqual(historyGaps(reconnected,roundView('7')),['第 1—3 拍记录未收到。','第 5—6 拍记录未收到。']);
 assert.deepEqual(historyGaps(recordPublicRound(emptyHistory,next,manual),next),['上一局结束记录未收到，无法补全。']);
 const lostRestart=recordPublicRound(reconnected,{...next,turn_index:'3'},manual);
 assert.deepEqual(historyGaps(lostRestart,{...next,turn_index:'3'}),['上一局结束记录未收到，无法补全。','第 1—2 拍记录未收到。']);
});
test('mode and role stay explicit for alive reveal, spectator and eliminated terminal views',()=>{
 const current=state('revealing');let view=onlineBattleView(current,manual,4000);
 assert.deepEqual([view.mode,view.self_role,view.self_participation,view.options.length],['multiplayer','player','active',0]);
 current.snapshot.view.self.role='spectator';view=onlineBattleView(current,manual,4000);
 assert.deepEqual([view.self_role,view.self_participation,view.self_id],['spectator','spectating',null]);
 current.snapshot.view.self.role='player';current.snapshot.view.phase='result';current.snapshot.view.match.last_turn.effective_state.active_ids=['p2'];
 view=onlineBattleView(current,manual,null);
 assert.deepEqual([view.self_role,view.self_participation,view.self_id],['player','eliminated','p1']);
 current.snapshot.view.match.public_state.players.p1.dd6='0';current.snapshot.view.match.last_turn.core_resolution.ledger.post_turn_players.p1.dd6='99';
 assert.equal(onlineBattleView(current,manual,null).participants[0].resources.dd6,'99');
});
