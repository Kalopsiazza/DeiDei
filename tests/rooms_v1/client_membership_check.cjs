// Real candidate NetworkRoomPort with a scripted transport. No Electron/window claim.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const path = require('node:path');
const {NetworkRoomPort} = require(path.resolve(process.argv[2]));
class Socket {
  constructor() {this.listeners = new Map(); this.sent = [];}
  addEventListener(name, callback) {this.listeners.set(name, callback);}
  send(text) {this.sent.push(JSON.parse(text));}
  close() {}
  message(frame) {this.listeners.get('message')({data: JSON.stringify(frame)});}
  ack(command, data) {this.message({v:1, type:'ack', request_id:command.request_id, ok:true, data});}
}
let input = '';
process.stdin.on('data', chunk => {input += chunk;});
process.stdin.on('end', () => {
  const {hello, snapshot, event} = JSON.parse(input);
  const socket = new Socket();
  const port = new NetworkRoomPort({url:'ws://127.0.0.1:1/rooms-v1', socketFactory:()=>socket,
    now:()=>0, schedule:()=>1, cancel:()=>{}});
  port.openLobby({nickname:'测试玩家', avatar_id:'leaf'});
  socket.message(hello);
  const identity = {session_id:randomUUID(), player_id:snapshot.view.self.player_id,
    resume_token:'A'.repeat(43), boot_id:hello.boot_id, last_command_seq:'0'};
  socket.ack(socket.sent.at(-1), identity);
  const options = Object.fromEntries(['turn_ms','early_reveal','spectator_cap'].map(k=>[k, snapshot.view.policy[k]]));
  port.join({room_code:snapshot.view.room_code, password:null, role:'player'});
  socket.ack(socket.sent.at(-1), {room_id:snapshot.room_id, room_code:snapshot.view.room_code, role:'player'});
  socket.message(snapshot);
  port.submit({room_id:snapshot.room_id, match_id:snapshot.view.match.match_id,
    turn_id:snapshot.view.match.turn_id, entry_id:'Charge'});
  const oldSubmit = socket.sent.at(-1);
  socket.message({v:1, type:'ack', request_id:null, ok:false,
    error:{code:'INVALID_MESSAGE', field:null, retryable:false}});
  // An uncorrelated bad-frame error must never complete this legitimate intent.
  assert.equal(port.read().pending, true);
  socket.message(event);
  assert.equal(port.read().snapshot, null);
  assert.equal(port.read().pending, false);
  assert.equal(port.read().confirmed, null);
  assert.equal(port.identity.player_id, identity.player_id);
  socket.message(event); // duplicate receipt is idempotent
  port.create({password:null, options});
  const fresh = structuredClone(snapshot);
  fresh.room_id = randomUUID(); fresh.seq = '1';
  fresh.view.room_code = 'ABCDEFGH'; fresh.view.phase = 'lobby'; fresh.view.match = null;
  fresh.view.host_id = identity.player_id; fresh.view.policy_revision = '1';
  fresh.view.current_turn_ms = null; fresh.view.host_recovery = null; fresh.view.pending_close = null;
  fresh.view.pause = null; fresh.view.close_reason = null;
  fresh.view.timer = {kind:'none', deadline_at_ms:null, remaining_ms:null};
  fresh.view.members = [{player_id:identity.player_id, nickname:'测试玩家', avatar_id:'leaf',
    role:'player', seat:0, connected:true, ready:false, participation:'lobby', submission_state:'none', absence_count:0}];
  fresh.view.self = {player_id:identity.player_id, role:'player', seat:0, options:[], accepted_entry_id:null};
  socket.ack(socket.sent.at(-1), {room_id:fresh.room_id, room_code:fresh.view.room_code});
  socket.message(fresh);
  port.ready({room_id:fresh.room_id, ready:true});
  const count = socket.sent.length;
  socket.message(event);
  socket.ack(oldSubmit, {room_id:snapshot.room_id, match_id:snapshot.view.match.match_id,
    turn_id:snapshot.view.match.turn_id, accepted_entry_id:'Charge'});
  socket.message(snapshot);
  assert.equal(port.read().snapshot.room_id, fresh.room_id);
  assert.equal(port.read().pending, true);
  assert.equal(port.read().confirmed, null);
  assert.equal(socket.sent.length, count);
  assert.ok(!JSON.stringify(port.read()).includes(identity.resume_token));
  port.close();
  console.log(JSON.stringify({status:'PASS', scope:'real NetworkRoomPort + scripted transport', checks:8}));
});
