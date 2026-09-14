const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {NetworkRoomPort}=require('../online/network-room-port.cjs');
const {readMessage,validateCommand}=require('../online/wire.cjs');
const {FakeSocket,clock,hello,identity,snapshot}=require('./fake.cjs');
function room(phase='selecting'){
 const time=clock(),sockets=[];
 const port=new NetworkRoomPort({url:'ws://127.0.0.1:8765/rooms-v1',socketFactory:()=>{const s=new FakeSocket();sockets.push(s);return s;},...time,random:()=>0.5});
 port.openLobby({nickname:'测试',avatar_id:'leaf'});const s=sockets[0];s.message(hello());s.ack(s.sent[0],identity);
 port.create({password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});s.ack(s.sent.at(-1),{room_id:'room1',room_code:'ABCD2345'});s.message(snapshot(phase));
 return {port,s,time,sockets};
}
const ended=(extra={})=>({v:1,type:'membership.ended',event_id:randomUUID(),room_id:'room1',player_id:'p1',seq:'2',server_time_ms:100000,reason:'three_absences',...extra});
test('W09/W10 accept rooms-1.1 only, exact six time choices and new fields',()=>{
 const h=hello();assert.equal(readMessage(JSON.stringify(h)).policy_defaults.turn_ms,10000);
 assert.throws(()=>readMessage(JSON.stringify({...h,protocol:'rooms-1.0'})),/UNSUPPORTED_PROTOCOL/);
 for(const times of [[5000], [5000,8000,12000,20000,30000,30000]])assert.throws(()=>readMessage(JSON.stringify({...h,capabilities:{...h.capabilities,allowed_turn_ms:times}})));
 const s=snapshot();assert.equal(readMessage(JSON.stringify(s)).view.policy_revision,'1');
 for(const field of ['current_turn_ms','policy_revision','host_recovery','pending_close']){const bad=structuredClone(s);delete bad.view[field];assert.throws(()=>readMessage(JSON.stringify(bad)));}
 const paused=snapshot('selecting');paused.view.phase='paused';assert.throws(()=>readMessage(JSON.stringify(paused)));
});
test('W09 policy ack never overwrites snapshot or current deadline, failed change can be corrected',()=>{
 const {port,s,time}=room();time.advance(800);port.setTurnLimit({room_id:'room1',turn_ms:5000,expected_policy_revision:'1'});const request=s.sent.at(-1);
 assert.equal(request.op,'room.set_turn_limit');const next=snapshot('selecting','3');next.view.policy.turn_ms=30000;next.view.policy_revision='3';s.message(next);
 s.ack(request,{room_id:'room1',turn_ms:5000,policy_revision:'2',effective_from:'next_select'});
 assert.equal(port.read().snapshot.view.policy.turn_ms,30000);assert.equal(port.read().snapshot.view.current_turn_ms,10000);assert.equal(port.read().snapshot.view.timer.deadline_at_ms,110000);
 port.setTurnLimit({room_id:'room1',turn_ms:8000,expected_policy_revision:'2'});const failed=s.sent.at(-1);s.fail(failed,'POLICY_STALE');assert.equal(port.read().error.code,'POLICY_STALE');
 port.setTurnLimit({room_id:'room1',turn_ms:8000,expected_policy_revision:'3'});assert.notEqual(s.sent.at(-1).request_id,failed.request_id);assert.ok(BigInt(s.sent.at(-1).command_seq)>BigInt(failed.command_seq));
});
test('W09 host-only setting includes eliminated host; pending close blocks changes but not player submit',()=>{
 const c=room();const v=snapshot('selecting','2');v.view.members[0].participation='eliminated';v.view.self.options=[];c.s.message(v);
 c.port.setTurnLimit({room_id:'room1',turn_ms:8000,expected_policy_revision:'1'});c.s.ack(c.s.sent.at(-1),{room_id:'room1',turn_ms:8000,policy_revision:'2',effective_from:'next_select'});
 v.seq='3';v.view.host_id='p2';c.s.message(v);assert.throws(()=>c.port.setTurnLimit({room_id:'room1',turn_ms:8000,expected_policy_revision:'1'}),/NOT_HOST/);
 const closing=snapshot('selecting','4');closing.view.pending_close={reason:'HOST_LEFT',after:'current_turn',turn_id:'match1:g1:t6'};c.s.message(closing);
 assert.throws(()=>c.port.setTurnLimit({room_id:'room1',turn_ms:8000,expected_policy_revision:'1'}),/ROOM_CLOSING/);
 c.port.submit({room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',entry_id:'Charge'});assert.equal(c.s.sent.at(-1).op,'room.submit');
});
test('W10 independent grace timer does not freeze play or restart on duplicate snapshot',()=>{
 const c=room();const v=snapshot('selecting','2');v.view.members[0].connected=false;v.view.members[0].participation='eliminated';v.view.self.options=[];v.view.host_recovery={kind:'grace',deadline_at_ms:130000,remaining_ms:30000};c.s.message(v);
 c.time.advance(1000);assert.equal(c.port.read().host_remaining_ms,29000);assert.equal(c.port.read().remaining_ms,9000);
 c.s.message(v);assert.equal(c.port.read().host_remaining_ms,29000);assert.equal(c.port.read().remaining_ms,9000);
 const restored=snapshot('selecting','3');c.s.message(restored);assert.equal(c.port.read().host_remaining_ms,null);
});
test('W11 removal cancels only old intent, preserves session, deduplicates and permits new room',()=>{
 const c=room();c.port.submit({room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',entry_id:'Charge'});const old=c.s.sent.at(-1);const event=ended();c.s.message(event);
 assert.equal(c.port.read().snapshot,null);assert.equal(c.port.read().pending,false);assert.equal(c.port.read().membership_end.room_code,'ABCD2345');assert.equal(c.port.identity.session_id,identity.session_id);assert.equal(c.port.read().status,'connected');
 const revision=c.port.read().revision;c.s.message(event);assert.equal(c.port.read().revision,revision);
 c.port.create({password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});const create=c.s.sent.at(-1);
 c.s.message(ended());c.s.ack(old,{room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',accepted_entry_id:'Charge'});assert.equal(c.port.pending.request_id,create.request_id);
 const fresh=snapshot('lobby');fresh.room_id='room2';fresh.view.room_code='EFGH2345';c.s.message(fresh);
 c.s.message(snapshot('selecting','99')); // A late old-room frame must not displace the new room's pre-ack snapshot.
 c.s.ack(create,{room_id:'room2',room_code:'EFGH2345'});
 assert.equal(c.port.read().snapshot?.room_id,'room2');
 c.s.message(event);c.s.message(snapshot('selecting','99'));assert.equal(c.port.read().snapshot.room_id,'room2');assert.equal(c.port.read().confirmed,null);
});
test('W11 identity/room/seq checks reject unrelated receipt; resume receipt clears retained old command',()=>{
 const c=room();c.s.message(ended({player_id:'p2'}));c.s.message(ended({room_id:'other'}));const newer=snapshot('selecting','8');c.s.message(newer);c.s.message(ended({seq:'7'}));assert.equal(c.port.read().snapshot.seq,'8');
 c.port.submit({room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',entry_id:'Charge'});const old=c.s.sent.at(-1);c.s.emit('close',{code:1006});c.time.advance(1000);const s=c.sockets[1];s.message(hello());const {resume_token,...rest}=identity;s.ack(s.sent[0],{...rest,last_command_seq:'2'});
 s.message(ended({seq:'9',reason:'disconnect_grace_expired'}));assert.equal(c.port.read().snapshot,null);assert.equal(c.port.read().membership_end.reason,'disconnect_grace_expired');assert.equal(c.port.read().pending,false);
 s.ack(old,{room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',accepted_entry_id:'Charge'});assert.equal(c.port.read().snapshot,null);assert.equal(c.time.timers.size,0);
});
test('W12 null request ack is strictly checked and cannot complete pending command',()=>{
 const c=room();c.port.setTurnLimit({room_id:'room1',turn_ms:5000,expected_policy_revision:'1'});const request=c.port.pending;
 c.s.message({v:1,type:'ack',request_id:null,ok:false,error:{code:'INVALID_MESSAGE',field:null,retryable:false}});assert.equal(c.port.pending.request_id,request.request_id);assert.equal(c.port.read().status,'connected');
 assert.throws(()=>readMessage(JSON.stringify({...ended(),event_id:'not-a-uuid'})));
 const bad={v:1,type:'ack',request_id:null,ok:true,data:{}};assert.throws(()=>readMessage(JSON.stringify(bad)));
});
test('W13 Unicode profile boundary and password spaces remain strict',()=>{
 for(const nickname of ['   ','\u200b','坏\n名','\ud800'])assert.throws(()=>validateCommand('session.open',{profile:{nickname,avatar_id:'leaf'}}));
 for(const nickname of ['  中文名  ','🙂','叶'.repeat(20)])validateCommand('session.open',{profile:{nickname,avatar_id:'leaf'}});
 assert.throws(()=>validateCommand('session.open',{profile:{nickname:'🙂'.repeat(21),avatar_id:'leaf'}}));
 validateCommand('room.join',{room_code:'ABCD2345',password:'  ',role:'player'});
 for(const password of ['x'.repeat(33),'\u200b'])assert.throws(()=>validateCommand('room.join',{room_code:'ABCD2345',password,role:'player'}));
});
test('W14 real Room/core reveal and full result DTOs decode without dropping last_turn',()=>{
 const captured=require('./room-results-v11.json');
 assert.match(captured.source,/real Room/);
 for(const [name,frame] of Object.entries(captured.frames)){
  const decoded=readMessage(JSON.stringify(frame));
  assert.deepEqual(decoded,frame,name);
  const turn=decoded.view.match.last_turn;
  assert.ok(turn.core_resolution.ledger.actions.A,name);
  assert.equal(turn.effective_transition.to_game_id,turn.effective_state.game_id,name);
  if(name.endsWith('_next')&&!name.startsWith('ordinary'))assert.equal(decoded.view.phase,'result');
  const bad=structuredClone(frame);bad.view.match.last_turn.effective_transition.to_game_id=null;
  assert.throws(()=>readMessage(JSON.stringify(bad)),/INVALID_MESSAGE/,name);
  bad.view.match.last_turn.effective_transition.to_game_id='wrong-game';assert.throws(()=>readMessage(JSON.stringify(bad)),/INVALID_MESSAGE/);
  bad.view.match.last_turn.effective_transition.to_game_id=turn.effective_state.game_id;
  bad.view.match.last_turn.core_resolution.ledger.actions.A.choice_token=0;assert.throws(()=>readMessage(JSON.stringify(bad)),/INVALID_MESSAGE/);
 }
 for(const name of ['rules_winner','forfeit_winner'])assert.equal(captured.frames[name+'_next'].view.match.effective_outcome.kind,'sole_survivor');
 for(const name of ['rules_nobody','forfeit_nobody'])assert.equal(captured.frames[name+'_next'].view.match.effective_outcome.kind,'nobody_survives');
 assert.equal(captured.frames.forfeit_winner_next.view.match.effective_outcome.reason,'room_forfeit');
 assert.equal(captured.frames.forfeit_nobody_next.view.match.effective_outcome.reason,'room_forfeit');
});
