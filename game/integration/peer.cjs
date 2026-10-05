// Test-only real WebSocket peer. It never reads service-private state or prints credentials.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {readMessage}=require('../desktop/online/wire.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await sleep(30);}throw new Error(`Timed out: ${label}`);}
class Peer {
 constructor(url,name){this.ws=new WebSocket(url,'deidei.rooms.v1');this.seq=0;this.pending=new Map();this.name=name;this.error=null;this.view=null;this.lastSeq=new Map();
  this.ws.addEventListener('message',e=>{try{const envelope=JSON.parse(e.data),pending=this.pending.get(envelope.request_id);const m=readMessage(e.data,pending?.op);if(!m)return;
   if(m.type==='hello')this.hello=m;
   else if(m.type==='ack'){if(pending){this.pending.delete(m.request_id);pending.resolve(m);}}
   else if(m.type==='membership.ended'){this.ended=m;this.view=null;}
   else if(m.type==='snapshot'){assert.ok(BigInt(m.seq)>=BigInt(this.lastSeq.get(m.room_id)||0));this.lastSeq.set(m.room_id,m.seq);this.view=m;}
  }catch(e){this.error=e;}});
 }
 async open(){await until(()=>this.hello||this.error,'hello');if(this.error)throw this.error;const a=await this.command('session.open',{profile:{nickname:this.name,avatar_id:'leaf'}});assert.ok(a.ok);this.identity=a.data;return this;}
 async command(op,payload){if(this.error)throw this.error;await sleep(55);const id=randomUUID();const result=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`ack timeout: ${op}`));},5000);this.pending.set(id,{op,resolve:m=>{clearTimeout(timer);resolve(m);}});});this.ws.send(JSON.stringify({v:1,type:'command',request_id:id,command_seq:op.startsWith('session.')?null:String(++this.seq),op,payload}));return result;}
 async ok(op,payload){const a=await this.command(op,payload);assert.equal(a.ok,true,`${op}: ${a.error?.code}`);return a.data;}
 async sync(rid){await this.ok('room.sync',{room_id:rid});return until(()=>this.view,'snapshot');}
 async submit(entry){const {room_id,view:{match}}=this.view;return this.ok('room.submit',{room_id,match_id:match.match_id,turn_id:match.turn_id,entry_id:entry});}
 close(){this.ws.close();}
}
module.exports={Peer,until,sleep};
