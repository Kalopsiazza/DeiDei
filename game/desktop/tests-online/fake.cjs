// Scripted transport for tests only. It is not a room service or online acceptance.
const samples=require('./core-samples.json');
const policy={turn_ms:12000,early_reveal:true,spectator_cap:6,host_disconnect_grace_ms:30000,reveal_ms:1500,min_select_ms:300};
const hello=()=>({v:1,type:'hello',boot_id:'boot1',connection_id:'connection1',protocol:'rooms-1.0',rules_version:'classic-1.0.1',server_time_ms:100000,policy_defaults:structuredClone(policy),capabilities:{max_players:6,allowed_turn_ms:[5000,8000,12000,20000,30000],spectator_max:6}});
const identity={session_id:'session1',player_id:'p1',resume_token:'synthetic-test-credential-not-a-real-session',boot_id:'boot1',last_command_seq:'0'};
function snapshot(phase='lobby',seq='1',selfId='p1') {
 const members=Array.from({length:6},(_,i)=>({player_id:`p${i+1}`,nickname:i===0?'本机验收':`同学 ${i+1}`,avatar_id:['leaf','sun','moon','star'][i%4],seat:i,role:'player',connected:true,ready:i!==0,participation:phase==='lobby'?'lobby':'active',submission_state:phase==='lobby'?'none':'thinking',absence_count:0}));
 const state=structuredClone(samples.state),resolution=structuredClone(samples.resolution);
 const result={turn_id:`${state.game_id}:t${state.turn_index}`,core_resolution:resolution,room_forfeits:[],effective_transition:resolution.transition,effective_state:resolution.next_state,action_sources:Object.fromEntries(members.map(p=>[p.player_id,'human']))};
 const view={source:'online',room_code:'ABCD2345',host_id:'p1',phase,has_password:false,policy:structuredClone(policy),members,match:phase==='lobby'?null:{match_id:state.match_id,mode_at_start:'multiplayer',turn_id:`${state.game_id}:t${state.turn_index}`,public_state:state,roster_profiles:members.map(({player_id,nickname,avatar_id,seat})=>({player_id,nickname,avatar_id,seat})),last_turn:phase==='revealing'?result:null,effective_outcome:null},self:{player_id:selfId,role:'player',seat:members.find(m=>m.player_id===selfId)?.seat??null,options:phase==='selecting'?structuredClone(samples.options):[],accepted_entry_id:null},timer:{kind:phase==='lobby'?'none':phase==='revealing'?'reveal':'select',deadline_at_ms:phase==='lobby'?null:112000,remaining_ms:phase==='lobby'?null:12000},pause:null,close_reason:null};
 return {v:1,type:'snapshot',room_id:'room1',seq,server_time_ms:100000,view};
}
class FakeSocket {
 constructor(){this.listeners={};this.sent=[];this.closed=false;}
 addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
 emit(type,event){for(const fn of this.listeners[type]||[])fn(event);}
 message(value){this.emit('message',{data:JSON.stringify(value)});}
 send(raw){this.sent.push(JSON.parse(raw));this.onSend?.(this.sent.at(-1));}
 close(){this.closed=true;}
 ack(command,data){this.message({v:1,type:'ack',request_id:command.request_id,ok:true,data});}
 fail(command,code){this.message({v:1,type:'ack',request_id:command.request_id,ok:false,error:{code,field:null,retryable:code==='RATE_LIMITED'||code==='SERVER_BUSY'}});}
}
function clock() {
 let time=0,serial=0;const timers=new Map();
 return {now:()=>time,schedule:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:time+delay});return id;},cancel:id=>timers.delete(id),advance:ms=>{time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}},timers};
}
class ScriptedSocket extends FakeSocket {
 constructor(controller){super();this.controller=controller;controller.socket=this;this.onSend=c=>setTimeout(()=>this.respond(c),15);setTimeout(()=>this.message(hello()),10);}
 respond(c){
  const ctl=this.controller;
  if(c.op==='session.open'){this.ack(c,identity);return;}
  if(c.op==='session.resume'){const {resume_token,...rest}=identity;this.ack(c,{...rest,last_command_seq:ctl.lastSeq||'0'});if(ctl.view)this.message(ctl.view);return;}
  ctl.lastSeq=c.command_seq;
  if(c.op==='room.create'||c.op==='room.join'){
   if(c.op==='room.join'&&c.payload.room_code==='WRONG123'){this.fail(c,'ROOM_ACCESS_DENIED');return;}
   if(c.op==='room.join'&&c.payload.role==='player'){this.fail(c,'ROOM_FULL');return;}
   ctl.view=snapshot();if(c.op==='room.join'){ctl.view.view.host_id='p2';ctl.view.view.members=ctl.view.view.members.filter(p=>p.player_id!=='p1');ctl.view.view.members.push({player_id:'p1',nickname:'本机验收',avatar_id:'leaf',seat:null,role:'spectator',connected:true,ready:false,participation:'spectating',submission_state:'none',absence_count:0});ctl.view.view.self={player_id:'p1',role:'spectator',seat:null,options:[],accepted_entry_id:null};}
   this.ack(c,{room_id:'room1',room_code:'ABCD2345',...(c.op==='room.join'?{role:c.payload.role}:{})});
  }else if(c.op==='room.ready'){ctl.view.view.members.find(p=>p.player_id==='p1').ready=c.payload.ready;this.ack(c,{room_id:'room1',ready:c.payload.ready});}
  else if(c.op==='room.role'){
   const v=ctl.view.view,me=v.members.find(p=>p.player_id==='p1');Object.assign(me,{role:c.payload.role,seat:c.payload.role==='player'?0:null,participation:c.payload.role==='player'?'lobby':'spectating',ready:false});Object.assign(v.self,{role:me.role,seat:me.seat});for(const p of v.members)p.ready=false;
   this.ack(c,{room_id:'room1',role:c.payload.role});
  }else if(c.op==='room.start'){ctl.view=snapshot('selecting',String(BigInt(ctl.view.seq)+1n));this.ack(c,{room_id:'room1',match_id:'match1'});}
  else if(c.op==='room.submit'){ctl.view.view.self.accepted_entry_id=c.payload.entry_id;ctl.view.view.members[0].submission_state='submitted';this.ack(c,{...c.payload,accepted_entry_id:c.payload.entry_id,entry_id:undefined});}
  else if(c.op==='room.return_lobby'){ctl.view=snapshot('lobby',String(BigInt(ctl.view.seq)+1n));ctl.view.view.members.forEach(p=>p.ready=false);this.ack(c,{room_id:'room1'});}
  else if(c.op==='room.leave'){ctl.view=null;this.ack(c,{room_id:'room1',left:true});return;}
  else this.ack(c,{room_id:'room1'});
  if(ctl.view){ctl.view.seq=String(BigInt(ctl.view.seq)+1n);this.message(ctl.view);}
 }
}
module.exports={FakeSocket,ScriptedSocket,clock,hello,identity,snapshot,policy,samples};
