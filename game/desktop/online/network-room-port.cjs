const { randomUUID } = require('node:crypto');
const { readMessage, validateCommand, endpoint, parse } = require('./wire.cjs');

class NetworkRoomPort {
  constructor({url, socketFactory=typeof WebSocket==='function'?(address,protocol)=>new WebSocket(address,protocol):null, now=()=>performance.now(), schedule=setTimeout, cancel=clearTimeout, random=Math.random, source='online'}={}) {
    this.url=url;this.socketFactory=socketFactory;this.now=now;this.schedule=schedule;this.cancel=cancel;this.random=random;
    this.source=source;this.listeners=new Set();this.generation=0;this.running=false;
    this.status='idle';this.room=null;this.snapshot=null;this.hello=null;this.identity=null;
    this.pending=null;this.handshake=null;this.commandSeq=0n;this.error=null;this.confirmed=null;this.retry=0;
  }
  read() {
    return structuredClone({source:this.source,status:this.status,hello:this.hello?{policy_defaults:this.hello.policy_defaults,capabilities:this.hello.capabilities}:null,
      snapshot:this.snapshot,pending:!!this.pending,error:this.error,confirmed:this.confirmed,remaining_ms:this.remaining(),revision:this.revision||0});
  }
  remaining() {
    if(!this.snapshot||this.snapshot.view.timer.kind==='none')return null;
    return Math.max(0,this.remainingAtReceipt-(this.now()-this.receivedAt));
  }
  publish() {this.revision=(this.revision||0)+1;const view=this.read();for(const listener of this.listeners)listener(view);}
  onChange(listener) {this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  isActive() {return !!this.room || !!this.pending;}
  openLobby(profile) {
    if(this.running)return this.read();
    validateCommand('session.open',{profile:{nickname:profile.nickname,avatar_id:profile.avatar_id}});
    this.profile={nickname:profile.nickname,avatar_id:profile.avatar_id};
    this.error=null;this.snapshot=null;this.confirmed=null;
    try {this.address=endpoint(this.url);if(typeof this.socketFactory!=='function')throw new Error('WEBSOCKET_UNAVAILABLE');}
    catch(e){this.status='unavailable';this.error={code:e.message,field:null,retryable:false};this.publish();return this.read();}
    this.running=true;this.connect();return this.read();
  }
  connect() {
    if(!this.running)return;
    const generation=++this.generation;
    this.status=this.identity?'reconnecting':'connecting';this.authenticated=false;this.handshake=null;this.buffered=null;this.publish();
    let socket;
    try {socket=this.socketFactory(this.address,'deidei.rooms.v1');this.socket=socket;}
    catch {this.disconnected(generation);return;}
    const current=()=>this.running&&generation===this.generation;
    socket.addEventListener('message',event=>{if(current())this.receive(event.data,generation);});
    socket.addEventListener('close',event=>{
      if(!current())return;
      if(event.code===1008||event.code===1009){this.stop('CONNECTION_REJECTED');return;}
      this.disconnected(generation);
    });
    socket.addEventListener('error',()=>{if(current())this.disconnected(generation);});
    this.armTimeout(generation);
  }
  armTimeout(generation) {
    this.cancel(this.timeout);
    this.timeout=this.schedule(()=>{if(generation===this.generation&&this.running)this.disconnected(generation);},5000);
  }
  disconnected(generation) {
    if(generation!==this.generation||!this.running)return;
    ++this.generation;this.cancel(this.timeout);this.authenticated=false;this.handshake=null;
    try{this.socket?.close();}catch{}
    this.status='reconnecting';this.publish();
    const delay=[1000,2000,4000,8000][Math.min(this.retry++,3)]*(0.8+0.4*this.random());
    this.cancel(this.reconnectTimer);this.reconnectTimer=this.schedule(()=>this.connect(),delay);
  }
  send(message) {
    try {this.socket.send(JSON.stringify(message));this.armTimeout(this.generation);}
    catch {this.disconnected(this.generation);}
  }
  receive(raw,generation) {
    try {
      const envelope=parse(raw);
      const awaiting=envelope?.request_id===this.handshake?.request_id?this.handshake:envelope?.request_id===this.pending?.request_id?this.pending:null;
      const m=readMessage(raw,awaiting?.op);if(!m)return;
      if(m.type==='hello') {
        if(this.handshake||this.authenticated)throw new Error('INVALID_MESSAGE');
        if(this.identity&&m.boot_id!==this.identity.boot_id){this.stop('SERVER_RESTART');return;}
        this.hello=m;
        this.handshake={v:1,type:'command',request_id:randomUUID(),command_seq:null,op:this.identity?'session.resume':'session.open',payload:this.identity?{session_id:this.identity.session_id,resume_token:this.identity.resume_token}:{profile:this.profile}};
        this.send(this.handshake);return;
      }
      if(m.type==='snapshot') {
        if(!this.authenticated)return;
        if(m.view.self.player_id!==this.identity.player_id)return;
        if(m.room_id!==this.room) {
          if(this.pending&&['room.create','room.join'].includes(this.pending.op)&&!this.room) {
            if(this.pending.op==='room.join'&&m.view.room_code!==this.pending.payload.room_code)return;
            if(!this.buffered||BigInt(m.seq)>BigInt(this.buffered.seq))this.buffered=m;
          }
          return;
        }
        this.applySnapshot(m);return;
      }
      if(!awaiting)return;
      if(awaiting===this.handshake) {
        if(!m.ok){this.stop(m.error.code);return;}
        const d=m.data;
        if(d.boot_id!==this.hello.boot_id||(this.identity&&(d.session_id!==this.identity.session_id||d.player_id!==this.identity.player_id)))throw new Error('INVALID_MESSAGE');
        this.identity={...d,resume_token:d.resume_token||this.identity?.resume_token};
        this.commandSeq=BigInt(d.last_command_seq)>this.commandSeq?BigInt(d.last_command_seq):this.commandSeq;
        this.handshake=null;this.authenticated=true;this.status='connected';this.retry=0;this.error=null;this.cancel(this.timeout);this.publish();
        if(this.pending)this.send(this.pending);
        else if(this.room)this.command('room.sync',{room_id:this.room});
        return;
      }
      if(!this.authenticated)return;
      this.cancel(this.timeout);this.pending=null;
      if(!m.ok) {
        this.error=m.error;this.buffered=null;
        if(['SESSION_EXPIRED','SESSION_REPLACED'].includes(m.error.code)){this.stop(m.error.code);return;}
        if(['ROOM_NOT_MEMBER','ROOM_GONE'].includes(m.error.code)){this.room=null;this.snapshot=null;this.confirmed=null;}
      } else {
        this.error=null;const d=m.data;
        if(awaiting.op==='room.create'||awaiting.op==='room.join') {
          this.room=d.room_id;this.snapshot=null;this.confirmed=null;
          if(this.buffered?.room_id===this.room)this.applySnapshot(this.buffered);
          this.buffered=null;
        } else {
          if(d.room_id!==awaiting.payload.room_id)throw new Error('INVALID_MESSAGE');
          if(awaiting.op==='room.submit') {
            if(d.match_id!==awaiting.payload.match_id||d.turn_id!==awaiting.payload.turn_id||d.accepted_entry_id!==awaiting.payload.entry_id)throw new Error('INVALID_MESSAGE');
            const match=this.snapshot?.view.match;
            if(this.room===d.room_id&&match?.match_id===d.match_id&&match.turn_id===d.turn_id&&this.snapshot.view.phase==='selecting')this.confirmed={room_id:d.room_id,match_id:d.match_id,turn_id:d.turn_id,entry_id:d.accepted_entry_id};
          }
          if(awaiting.op==='room.leave') {this.close();return;}
        }
      }
      this.publish();
    } catch {if(generation===this.generation)this.stop('INVALID_MESSAGE');}
  }
  applySnapshot(m) {
    if(this.snapshot?.room_id===m.room_id&&BigInt(m.seq)<BigInt(this.snapshot.seq))return;
    const v=m.view;
    this.snapshot=m;this.receivedAt=this.now();
    this.remainingAtReceipt=v.timer.kind==='none'?0:Math.max(0,Math.min(v.timer.remaining_ms,v.timer.deadline_at_ms-m.server_time_ms));
    if(this.confirmed&&(v.match?.turn_id!==this.confirmed.turn_id||v.match?.match_id!==this.confirmed.match_id||v.phase!=='selecting'))this.confirmed=null;
    if(v.phase==='closed') {this.room=null;this.pending=null;this.confirmed=null;this.error={code:v.close_reason,field:null,retryable:false};this.cancel(this.timeout);}
    this.publish();
  }
  command(op,payload) {
    if(!this.authenticated||this.status!=='connected')throw new Error('NOT_CONNECTED');
    if(this.pending)throw new Error('COMMAND_PENDING');
    validateCommand(op,payload);
    if(op==='room.create'||op==='room.join'){if(this.room)throw new Error('ALREADY_IN_ROOM');}
    else if(!this.room||payload.room_id!==this.room)throw new Error('ROOM_NOT_MEMBER');
    if(op==='room.submit') {
      const v=this.snapshot?.view;
      if(!v||v.phase!=='selecting')throw new Error(v?.phase==='paused'?'HOST_RECONNECTING':'TURN_CLOSED');
      if(v.match?.match_id!==payload.match_id||v.match?.turn_id!==payload.turn_id)throw new Error('STALE_TURN');
      if(v.self.accepted_entry_id||this.confirmed)throw new Error('ALREADY_SUBMITTED');
      if(!v.self.options.some(o=>o.entry_id===payload.entry_id&&o.available&&!o.forced))throw new Error('UNAVAILABLE_MOVE');
      if(this.remaining()<=0)throw new Error('TURN_CLOSED');
    }
    if(this.commandSeq>=18446744073709551615n)throw new Error('STALE_COMMAND');
    this.pending={v:1,type:'command',request_id:randomUUID(),command_seq:String(++this.commandSeq),op,payload:structuredClone(payload)};
    this.error=null;this.publish();this.send(this.pending);return this.read();
  }
  create(p){return this.command('room.create',p);}
  join(p){return this.command('room.join',p);}
  ready(p){return this.command('room.ready',p);}
  start(p){return this.command('room.start',p);}
  changeRole(p){return this.command('room.role',p);}
  submit(p){return this.command('room.submit',p);}
  returnLobby(p){return this.command('room.return_lobby',p);}
  leave() {
    // Explicit offline exit cancels the retained intent and all reconnect callbacks.
    if(this.status==='connected'&&this.pending)throw new Error('COMMAND_PENDING');
    if(!this.room||this.status!=='connected'){this.close();return this.read();}
    return this.command('room.leave',{room_id:this.room});
  }
  stop(code) {
    this.close(false);this.status='unavailable';this.error={code,field:null,retryable:false};this.publish();
  }
  close(clear=true) {
    this.running=false;++this.generation;this.cancel(this.timeout);this.cancel(this.reconnectTimer);
    try{this.socket?.close();}catch{}
    this.identity=null;this.pending=null;this.handshake=null;this.authenticated=false;this.room=null;this.buffered=null;this.confirmed=null;this.commandSeq=0n;
    if(clear){this.snapshot=null;this.hello=null;this.error=null;this.status='idle';}
    this.publish();
  }
}
module.exports={NetworkRoomPort};
