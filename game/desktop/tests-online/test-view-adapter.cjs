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
 assert.equal(result.participants.find(player=>player.player_id==='p2').alive,false);
 assert.equal(result.options.length,0);

 assert.equal(onlineBattleView(state('lobby'),manual,null),null);
});
