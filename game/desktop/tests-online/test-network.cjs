const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NetworkRoomPort}=require('../online/network-room-port.cjs');
const {readMessage,endpoint}=require('../online/wire.cjs');
const {FakeSocket,clock,hello,identity,snapshot}=require('./fake.cjs');
function client(){
 const time=clock(),sockets=[];
 const port=new NetworkRoomPort({url:'ws://127.0.0.1:8765/rooms-v1',socketFactory:()=>{const s=new FakeSocket();sockets.push(s);return s;},...time,random:()=>0.5});
 const emitted=[];port.onChange(s=>emitted.push(s));
 port.openLobby({nickname:'测试',avatar_id:'leaf',local_id:'private-local-id'});
 const socket=sockets[0];socket.message(hello());socket.ack(socket.sent[0],identity);
 return {port,time,sockets,socket,emitted};
}
function inRoom(phase='lobby'){
 const c=client();c.port.create({password:null,options:hello().policy_defaults && {turn_ms:12000,early_reveal:true,spectator_cap:6}});
 c.socket.ack(c.socket.sent.at(-1),{room_id:'room1',room_code:'ABCD2345'});c.socket.message(snapshot(phase));return c;
}
test('endpoint accepts loopback ws and valid wss; rejects remote plaintext and URL credentials',()=>{
 for(const url of ['ws://127.0.0.1:8765/rooms-v1','ws://[::1]:8765/rooms-v1','wss://example.com/rooms-v1'])assert.equal(endpoint(url),url);
 for(const url of ['ws://example.com:8765/rooms-v1','ws://localhost:1/rooms-v1','ws://127.0.0.1/rooms-v1','ws://u:p@127.0.0.1:1/rooms-v1','ws://127.0.0.1:1/rooms-v1?q=x','ws://127.0.0.1:1/rooms-v1#x'])assert.throws(()=>endpoint(url));
 assert.throws(()=>endpoint(''),/SERVICE_NOT_CONFIGURED/);
});
test('credentials and local_id never enter any renderer state or broadcast',()=>{
 const c=inRoom('selecting');c.port.submit({room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',entry_id:'Charge'});
 assert.ok(c.socket.sent.every(m=>!JSON.stringify(m).includes('private-local-id')));
 assert.ok(!JSON.stringify(c.emitted).includes(identity.resume_token));assert.ok(!JSON.stringify(c.port.read()).includes('resume_token'));
 const bad=snapshot();bad.view.members[1].resume_token='another-member-secret';c.socket.message(bad);
 assert.equal(c.port.read().status,'unavailable');assert.ok(!JSON.stringify(c.emitted).includes('another-member-secret'));
});
test('hello defaults drive client data, commands serialize, extra fields rejected',()=>{
 const c=client();assert.deepEqual(c.port.read().hello.policy_defaults,hello().policy_defaults);
 assert.throws(()=>c.port.create({password:null,options:{turn_ms:12000,early_reveal:true,spectator_cap:6},local_id:'x'}));
 c.port.join({room_code:'ABCD2345',password:'  keep  ',role:'player'});assert.equal(c.socket.sent.at(-1).payload.password,'  keep  ');
 assert.throws(()=>c.port.join({room_code:'ABCD2345',password:null,role:'spectator'}),/COMMAND_PENDING/);
 c.socket.fail(c.socket.sent.at(-1),'ROOM_FULL');assert.equal(c.port.read().pending,false);assert.equal(c.port.read().error.code,'ROOM_FULL');
 c.port.join({room_code:'ABCD2345',password:null,role:'spectator'});assert.equal(c.socket.sent.at(-1).command_seq,'2');
});
test('snapshot before create ack buffered, old sequence and unrelated room ignored',()=>{
 const c=client();c.port.create({password:null,options:{turn_ms:12000,early_reveal:true,spectator_cap:6}});
 c.socket.message(snapshot('lobby','9007199254740994'));assert.equal(c.port.read().snapshot,null);
 c.socket.ack(c.socket.sent.at(-1),{room_id:'room1',room_code:'ABCD2345'});assert.equal(c.port.read().snapshot.seq,'9007199254740994');
 c.socket.message(snapshot('selecting','9007199254740993'));assert.equal(c.port.read().snapshot.view.phase,'lobby');
 const foreign=snapshot('selecting','9007199254740999');foreign.room_id='old-room';c.socket.message(foreign);assert.equal(c.port.read().snapshot.room_id,'room1');
});
test('late submit ack does not restore an old turn; same turn ack confirms only own entry',()=>{
 const c=inRoom('selecting');c.port.submit({room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',entry_id:'Charge'});const cmd=c.socket.sent.at(-1);
 c.socket.message(snapshot('revealing','2'));c.socket.ack(cmd,{room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',accepted_entry_id:'Charge'});
 assert.equal(c.port.read().snapshot.view.phase,'revealing');assert.equal(c.port.read().confirmed,null);
 const d=inRoom('selecting');d.port.submit(cmd.payload);d.socket.ack(d.socket.sent.at(-1),{room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',accepted_entry_id:'Charge'});
 assert.equal(d.port.read().confirmed.entry_id,'Charge');assert.throws(()=>d.port.submit(cmd.payload),/ALREADY_SUBMITTED/);
});
test('disconnect retries exact pending intent after resume and ignores the old generation',()=>{
 const c=inRoom();c.port.ready({room_id:'room1',ready:true});const command=c.socket.sent.at(-1);
 c.socket.emit('close',{code:1006});assert.equal(c.port.read().status,'reconnecting');c.time.advance(1000);
 const socket=c.sockets[1];socket.message(hello());const resume=socket.sent[0];assert.equal(resume.op,'session.resume');
 const {resume_token,...data}=identity;socket.ack(resume,{...data,last_command_seq:'8'});assert.deepEqual(socket.sent.at(-1),command);
 c.socket.fail(command,'NOT_HOST');c.socket.message(snapshot('selecting','999'));c.socket.emit('close',{code:1006});assert.equal(c.port.read().status,'connected');assert.equal(c.port.read().snapshot.seq,'1');
 socket.ack(command,{room_id:'room1',ready:true});c.port.ready({room_id:'room1',ready:false});assert.equal(socket.sent.at(-1).command_seq,'9');
});
test('ack timeout reconnects; sync serializes after resume and failed commands never auto retry',()=>{
 const c=inRoom();c.port.ready({room_id:'room1',ready:true});c.socket.fail(c.socket.sent.at(-1),'SERVER_BUSY');const count=c.socket.sent.length;
 c.time.advance(5000);assert.equal(c.socket.sent.length,count);
 c.socket.emit('close',{code:1006});c.time.advance(1000);const s=c.sockets[1];s.message(hello());const {resume_token,...data}=identity;s.ack(s.sent.at(-1),{...data,last_command_seq:'2'});
 assert.equal(s.sent.at(-1).op,'room.sync');assert.throws(()=>c.port.ready({room_id:'room1',ready:true}),/COMMAND_PENDING/);
 c.time.advance(5000);assert.equal(c.port.read().status,'reconnecting');
});
test('explicit disconnected leave cancels pending, timers and late snapshots',()=>{
 const c=inRoom();c.port.ready({room_id:'room1',ready:true});c.socket.emit('close',{code:1006});c.port.leave();c.time.advance(10000);
 c.socket.message(snapshot('selecting','99'));assert.equal(c.sockets.length,1);assert.equal(c.port.read().snapshot,null);assert.equal(c.time.timers.size,0);
});
test('room leave ack revokes receiving old room; session replacement and server reboot terminate',()=>{
 const c=inRoom();c.port.leave();c.socket.ack(c.socket.sent.at(-1),{room_id:'room1',left:true});c.socket.message(snapshot('selecting','99'));assert.equal(c.port.read().snapshot,null);
 const d=inRoom();d.socket.emit('close',{code:1006});d.time.advance(1000);d.sockets[1].message({...hello(),boot_id:'boot2'});assert.equal(d.port.read().error.code,'SERVER_RESTART');assert.equal(d.port.identity,null);
 const e=inRoom();e.socket.emit('close',{code:1006});e.time.advance(1000);const s=e.sockets[1];s.message(hello());s.fail(s.sent[0],'SESSION_REPLACED');assert.equal(e.port.read().status,'unavailable');
});
test('monotonic estimate continues during host absence and cutoff blocks clicks',()=>{
 const c=inRoom('selecting');c.time.advance(1200);assert.equal(c.port.remaining(),8800);
 const p=snapshot('selecting','2');p.view.host_id='p2';p.view.members[1].connected=false;p.view.members[1].absence_count=1;p.view.host_recovery={kind:'rounds',missing_count:1,close_at_count:4};c.socket.message(p);c.time.advance(1000);
 assert.equal(c.port.remaining(),9000);assert.equal(c.port.read().snapshot.view.pause,null);
 c.time.advance(9000);assert.throws(()=>c.port.submit({room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',entry_id:'Charge'}),/TURN_CLOSED/);
});
test('schema rejects unknown private nested fields, binary, duplicate keys and spectator options',()=>{
 for(const phase of ['lobby','selecting','revealing'])assert.equal(readMessage(JSON.stringify(snapshot(phase))).view.phase,phase);
 assert.throws(()=>readMessage(Buffer.from('{}')));assert.throws(()=>readMessage('{"type":"hello","type":"snapshot"}'));
 const cases=[s=>s.view.self.password='secret',s=>s.view.match.public_state.players.p1.token='secret',s=>s.view.match.last_turn.core_resolution.ledger.actions.p1.choice_token=0,s=>s.view.policy.turn_ms=NaN];
 for(const mutate of cases){const s=snapshot('revealing');mutate(s);assert.throws(()=>readMessage(JSON.stringify(s)));}
 const s=snapshot('selecting');s.view.members[0].role=s.view.self.role='spectator';s.view.members[0].seat=s.view.self.seat=null;assert.throws(()=>readMessage(JSON.stringify(s)));
});
test('other session snapshot cannot replace private self, recovery cannot manually submit',()=>{
 const c=inRoom('selecting');const other=snapshot('selecting','10','p2');c.socket.message(other);assert.equal(c.port.read().snapshot.seq,'1');
 const recovery=snapshot('selecting','2');recovery.view.self.options.forEach(o=>{o.forced=true;o.available=false;});c.socket.message(recovery);
 assert.throws(()=>c.port.submit({room_id:'room1',match_id:'match1',turn_id:'match1:g1:t6',entry_id:'Charge'}),/UNAVAILABLE_MOVE/);
});
test('new session clears terminated room; invalid hello defaults never reach page',()=>{
 const c=inRoom();const h=hello();h.policy_defaults.turn_ms=999;c.socket.message(h);assert.equal(c.port.read().status,'unavailable');
 c.port.openLobby({nickname:'新会话',avatar_id:'sun'});assert.equal(c.port.read().snapshot,null);
 const socket=c.sockets.at(-1);socket.message(hello());socket.ack(socket.sent[0],identity);assert.equal(c.port.read().status,'connected');
});
