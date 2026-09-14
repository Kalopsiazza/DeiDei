const {test}=require('node:test');
const assert=require('node:assert/strict');
const {optionsFor,publicPlayers,remainingAt,canSelect,startReason,turnSummary}=require('../build/online-model.cjs');
const manual=require('../catalog.json');
const {snapshot}=require('./fake.cjs');
test('public amounts use ledger at reveal and new state only in next selecting phase',()=>{
 const s=snapshot('revealing');s.view.match.public_state.players.p1.dd6='0';
 s.view.match.last_turn.core_resolution.ledger.post_turn_players.p1.dd6='900719925474099300000';
 assert.equal(publicPlayers(s).p1.dd6,'900719925474099300000');
 s.view.phase='paused';s.view.pause={resume_phase:'revealing'};assert.equal(publicPlayers(s).p1.dd6,'900719925474099300000');
 s.view.phase='selecting';s.view.pause=null;assert.equal(publicPlayers(s).p1.dd6,'0');
});
test('33 option costs are live server values, big DD stays rational and catalog supplies only text',()=>{
 const s=snapshot('selecting');const x=s.view.self.options.find(o=>o.entry_id==='Xiao');x.spend.dd6='0';x.required.dd6='2';
 const o=optionsFor(s,manual).find(o=>o.entry_id==='Xiao');assert.equal(o.cost_text,'0 DD');assert.equal(o.requirement_text,'持有 1/3 DD');assert.equal(optionsFor(s,manual).length,33);
 x.required.dd6='900719925474099300001';assert.match(optionsFor(s,manual).find(o=>o.entry_id==='Xiao').requirement_text,/150119987579016550000又1\/6/);
});
test('spectator, eliminated, forced, disconnected, paused, pending and accepted never become editable',()=>{
 const s={status:'connected',snapshot:snapshot('selecting'),pending:false,confirmed:null,remaining_ms:12000};assert.ok(canSelect(s,12000));
 for(const patch of [{pending:true},{status:'reconnecting'},{confirmed:{entry_id:'Charge'}}])assert.equal(canSelect({...s,...patch},12000),false);
 for(const modify of [v=>v.self.role='spectator',v=>v.members[0].participation='eliminated',v=>v.phase='paused',v=>v.self.accepted_entry_id='Charge']){const copy=structuredClone(s);modify(copy.snapshot.view);assert.equal(canSelect(copy,12000),false);}
 assert.equal(canSelect(s,0),false);assert.equal(remainingAt(s,100,500),11600);assert.equal(remainingAt(s,100,100000),0);
});
test('start requires two ready connected players and summary reports actual source, gains and outcomes',()=>{
 const s=snapshot();assert.equal(startReason(s),'有人未准备');s.view.members[0].ready=true;assert.equal(startReason(s),'');s.view.members[2].connected=false;assert.equal(startReason(s),'有人掉线');s.view.members=s.view.members.slice(0,1);assert.equal(startReason(s),'至少两位玩家');
 const r=snapshot('revealing');r.view.match.last_turn.action_sources.p2='timeout_auto';r.view.match.last_turn.room_forfeits=[{player_id:'p3',reason:'three_absences'}];
 const summary=turnSummary(r,manual).join('\n');assert.match(summary,/超时代理/);assert.match(summary,/\+1 DD/);assert.match(summary,/连续三拍缺席/);assert.match(summary,/继续下一拍/);
});
