// Exact public DTOs only. Unknown fields never reach the isolated renderer.
const catalog = require('../catalog.json');
const entries = catalog.entries.map(e => e.entry_id);
const fail = () => { throw new Error('INVALID_MESSAGE'); };
const check = (ok) => { if (!ok) fail(); };
const text = v => check(typeof v === 'string');
const id = v => check(typeof v === 'string' && /^[A-Za-z0-9_:-]{1,96}$/.test(v));
const decimal = v => check(typeof v === 'string' && /^(0|[1-9][0-9]*)$/.test(v));
const positive = v => { decimal(v); check(v !== '0'); };
const ms = v => check(Number.isSafeInteger(v) && v >= 0);
const bool = v => check(typeof v === 'boolean');
const one = (...values) => v => check(values.includes(v));
const nullable = schema => v => { if (v !== null) validate(schema, v); };
const array = (schema, max = 100000) => v => { check(Array.isArray(v) && v.length <= max); v.forEach(x => validate(schema, x)); };
const map = schema => v => { check(v && typeof v === 'object' && !Array.isArray(v)); for (const [k,x] of Object.entries(v)) { id(k); validate(schema,x); } };
function validate(schema, value) {
  if (typeof schema === 'function') return schema(value);
  check(value && typeof value === 'object' && !Array.isArray(value));
  check(Object.keys(value).sort().join() === Object.keys(schema).sort().join());
  for (const [key, test] of Object.entries(schema)) validate(test, value[key]);
}
const nickname = v => check(typeof v === 'string' && v.trim().length > 0 && [...v].length <= 20 && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(v));
const avatar = one('leaf','sun','moon','star');
const role = one('player','spectator');
const roomCode = v => check(typeof v === 'string' && /^[A-Z0-9]{8}$/.test(v));
const password = nullable(v => check(typeof v === 'string' && [...v].length <= 32 && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(v)));
const seat = nullable(v => check(Number.isInteger(v) && v >= 0 && v < 6));
const resources = Object.fromEntries(['dd6','lightning','nx_charge','mature_bombs','reward_stock'].map(k=>[k,decimal]));
const option = {entry_id:one(...entries),doc_id:text,available:bool,reason_code:nullable(text),required:resources,spend:resources,forced:bool};
const player = {
  ...Object.fromEntries(['dd6','lightning','nx_charge','mature_bombs','bomb_placement_count','cloud_uses','tian_uses'].map(k=>[k,decimal])),
  zhang_used:bool,liq_used:bool,enhanced_xiao:bool,
  pending_bombs:array({game_id:id,placed_turn:positive,mature_at_turn_end:positive}),
  last_actual_move:nullable(one(...entries)),latest_copyable_move:nullable(one(...entries)),
  zeng_state:one('unused','recovery','waiting','ready','spent'),reward_due_turn:nullable(positive)
};
const state = {schema_version:one(1),rules_version:one('classic-1.0.1'),match_id:id,game_id:id,game_index:positive,turn_index:positive,roster:array(id,6),active_ids:array(id,6),status:one('playing','finished'),winner_id:nullable(id),players:map(player)};
const transition = {kind:one('continue_game','restart_survivors','sole_survivor','nobody_survives'),from_game_id:id,to_game_id:id,winner_id:nullable(id)};
const defense = v => validate(v?.kind === 'finite' ? {kind:one('finite'),sixths:decimal,comparison:one('le','eq'),match_rule:text} : {kind:one('unbounded'),match_rule:text},v);
const action = {entry_id:one(...entries),actual_move:one(...entries),origin:one('normal','zhang','bomb','lightning','zeng_reward'),is_recovery:bool,spend:resources,branch:nullable(one(...entries)),condition:nullable(one('success','failure')),eligible_targets:array(id,6),enhanced_xiao:bool,attack6:decimal,defense_primary:defense,defense_return:nullable(defense)};
const signed = v => check(typeof v === 'string' && /^-?(0|[1-9][0-9]*)$/.test(v));
const event = {event_id:text,phase:text,kind:text,actor_id:nullable(id),target_id:nullable(id),amount6:nullable(decimal),resource:nullable(text),resource_delta:nullable(signed),source_event_id:nullable(text),rule_ids:array(text,28),result:text,reason_code:nullable(text)};
const resolution = {ok:one(true),ledger:{match_id:id,game_id:id,turn_index:positive,actions:map(action),events:array(event),kills:map(array(id,6)),eliminated_ids:array(id,6),post_turn_players:map(player)},next_state:state,transition};
const turn = {turn_id:id,core_resolution:resolution,room_forfeits:array({player_id:id,reason:one('voluntary_leave','three_absences')},6),effective_transition:transition,effective_state:state,action_sources:map(one('human','timeout_auto','forced'))};
const profile = {player_id:id,nickname,avatar_id:avatar,seat};
const policy = {turn_ms:one(5000,8000,12000,20000,30000),early_reveal:bool,spectator_cap:v=>check(Number.isInteger(v)&&v>=0&&v<=12),host_disconnect_grace_ms:one(0,15000,30000,60000),reveal_ms:ms,min_select_ms:ms};
const closeReason = one('HOST_LEFT','HOST_TIMEOUT','HOST_ABSENT','SERVER_RESTART','ROOM_IDLE','INTERNAL_ERROR','ROOM_STATE_TOO_LARGE');
const roomView = {source:one('online'),room_code:roomCode,host_id:id,phase:one('lobby','selecting','revealing','result','paused','closed'),has_password:bool,policy,
  members:array({...profile,role,connected:bool,ready:bool,participation:one('lobby','active','eliminated','departing','spectating'),submission_state:one('none','thinking','submitted','forced','out'),absence_count:v=>check(Number.isInteger(v)&&v>=0&&v<=3)},18),
  match:nullable({match_id:id,mode_at_start:one('duel','multiplayer'),turn_id:id,public_state:state,roster_profiles:array(profile,6),last_turn:nullable(turn),effective_outcome:nullable({kind:one('sole_survivor','nobody_survives'),winner_id:nullable(id),reason:one('rules','room_forfeit')})}),
  self:{player_id:id,role,seat,options:array(option,33),accepted_entry_id:nullable(one(...entries))},
  timer:{kind:one('none','select','reveal','host_grace'),deadline_at_ms:nullable(ms),remaining_ms:nullable(ms)},
  pause:nullable({reason:one('HOST_DISCONNECTED'),resume_phase:one('lobby','selecting','revealing','result'),phase_remaining_ms:nullable(ms)}),close_reason:nullable(closeReason)
};
const hello = {v:one(1),type:one('hello'),boot_id:id,connection_id:id,protocol:one('rooms-1.0'),rules_version:one('classic-1.0.1'),server_time_ms:ms,policy_defaults:policy,capabilities:{max_players:one(6),allowed_turn_ms:array(one(5000,8000,12000,20000,30000),5),spectator_max:policy.spectator_cap}};
const snapshot = {v:one(1),type:one('snapshot'),room_id:id,seq:positive,server_time_ms:ms,view:roomView};
const errors = 'INVALID_MESSAGE UNSUPPORTED_PROTOCOL UNAUTHENTICATED ALREADY_AUTHENTICATED SESSION_EXPIRED SESSION_REPLACED ALREADY_IN_ROOM ROOM_ACCESS_DENIED ROOM_FULL SPECTATORS_FULL SPECTATORS_DISABLED MATCH_IN_PROGRESS ROOM_GONE ROOM_NOT_MEMBER NOT_HOST WRONG_PHASE NOT_READY NOT_ACTIVE FORCED_RECOVERY UNAVAILABLE_MOVE ALREADY_SUBMITTED STALE_TURN TURN_CLOSED REQUEST_CONFLICT HOST_RECONNECTING RATE_LIMITED SERVER_BUSY STALE_COMMAND ROOM_STATE_TOO_LARGE INTERNAL_ERROR'.split(' ');
const error = {code:one(...errors),field:nullable(text),retryable:bool};
const commandPayloads = {
  'session.open':{profile:{nickname,avatar_id:avatar}},'session.resume':{session_id:id,resume_token:text},
  'room.create':{password,options:{turn_ms:policy.turn_ms,early_reveal:bool,spectator_cap:policy.spectator_cap}},
  'room.join':{room_code:roomCode,password,role},'room.ready':{room_id:id,ready:bool},'room.role':{room_id:id,role},
  'room.start':{room_id:id},'room.submit':{room_id:id,match_id:id,turn_id:id,entry_id:one(...entries)},
  'room.sync':{room_id:id},'room.return_lobby':{room_id:id},'room.leave':{room_id:id}
};
const seq = v => {decimal(v);check(BigInt(v)<=18446744073709551615n);};
const ackData = {
  'session.open':{session_id:id,player_id:id,resume_token:v=>check(typeof v==='string'&&v.length>=32&&v.length<=256),boot_id:id,last_command_seq:seq},
  'session.resume':{session_id:id,player_id:id,boot_id:id,last_command_seq:seq},
  'room.create':{room_id:id,room_code:roomCode},'room.join':{room_id:id,room_code:roomCode,role},
  'room.ready':{room_id:id,ready:bool},'room.role':{room_id:id,role},'room.start':{room_id:id,match_id:id},
  'room.submit':{room_id:id,match_id:id,turn_id:id,accepted_entry_id:one(...entries)},
  'room.sync':{room_id:id},'room.return_lobby':{room_id:id},'room.leave':{room_id:id,left:one(true)}
};
function parse(raw) {
  check(typeof raw === 'string' && Buffer.byteLength(raw) <= 1048576);
  // JSON.parse keeps the last duplicate key; reject duplicates before parsing.
  const stack = [];
  const tokens = /"(?:\\.|[^"\\])*"|[{}\[\]]/g;
  for (const token of raw.matchAll(tokens)) {
    const t=token[0];
    if(t==='{'||t==='['){stack.push(t==='{'?new Set():null);check(stack.length<=24);}
    else if(t==='}'||t===']')stack.pop();
    else if(/^\s*:/.test(raw.slice(token.index+t.length))) {const key=JSON.parse(t), keys=stack.at(-1);check(keys instanceof Set && !keys.has(key));keys.add(key);}
  }
  try { return JSON.parse(raw); } catch { fail(); }
}
function readMessage(raw, op) {
  const m = parse(raw);
  if (m?.type === 'hello') validate(hello,m);
  else if (m?.type === 'snapshot') {
    validate(snapshot,m);
    const v=m.view, me=v.members.find(p=>p.player_id===v.self.player_id);
    check(new Set(v.members.map(p=>p.player_id)).size===v.members.length);
    const seats=v.members.filter(p=>p.seat!==null).map(p=>p.seat);
    check(new Set(seats).size===seats.length);
    check(v.members.every(p=>(p.role==='player')===(p.seat!==null)));
    check(v.phase==='closed'||(me&&me.role===v.self.role&&me.seat===v.self.seat));
    check(v.self.options.length===0||v.self.options.length===33);
    check(v.self.options.every(o=>o.doc_id===catalog.entries.find(e=>e.entry_id===o.entry_id).doc_id));
    if(v.match) {
      const m=v.match,s=m.public_state;
      check(m.match_id===s.match_id && m.turn_id===`${s.game_id}:t${s.turn_index}`);
      check(new Set(s.roster).size===s.roster.length && new Set(s.active_ids).size===s.active_ids.length);
      check(s.roster.slice().sort().join()===Object.keys(s.players).sort().join());
      check(s.active_ids.every(p=>s.roster.includes(p)));
      check(m.roster_profiles.map(p=>p.player_id).sort().join()===s.roster.slice().sort().join());
    }
    if(['selecting','revealing','result'].includes(v.phase))check(v.match!==null);
    check(new Set(v.self.options.map(o=>o.entry_id)).size===v.self.options.length);
    if(v.phase!=='selecting'||me?.participation!=='active'||v.self.role!=='player')check(v.self.options.length===0);
    if(v.self.role==='spectator')check(v.self.accepted_entry_id===null);
    check(v.timer.kind==='none' ? v.timer.deadline_at_ms===null&&v.timer.remaining_ms===null : v.timer.deadline_at_ms!==null&&v.timer.remaining_ms!==null);
    check(v.phase==='paused' ? v.pause!==null&&v.timer.kind==='host_grace' : v.pause===null);
  } else if (m?.type==='ack') {
    // Uncorrelated acks are discarded without exposing even their error text.
    if(!op)return null;
    validate(m.ok===true?{v:one(1),type:one('ack'),request_id:id,ok:one(true),data:ackData[op]}:{v:one(1),type:one('ack'),request_id:id,ok:one(false),error},m);
  } else fail();
  return m;
}
function validateCommand(op,payload) {check(Object.hasOwn(commandPayloads,op));validate(commandPayloads[op],payload);}
function endpoint(value) {
  if(!value)throw new Error('SERVICE_NOT_CONFIGURED');
  let url;try{url=new URL(value);}catch{throw new Error('INVALID_ENDPOINT');}
  if(url.protocol!=='ws:'||!['127.0.0.1','[::1]'].includes(url.hostname)||!url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/rooms-v1')throw new Error('INVALID_ENDPOINT');
  return url.href;
}
module.exports = {readMessage,validateCommand,endpoint,parse};
