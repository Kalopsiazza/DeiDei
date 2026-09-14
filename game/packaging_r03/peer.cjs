// Normal loopback protocol peer, external to all delivered executables. Never log frames.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(read,predicate,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){const value=await read();if(predicate(value))return value;await pause(40);}throw new Error('STATE_WAIT_TIMEOUT');}
class Peer{
 constructor(url){assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+\/rooms-v1$/);this.socket=new WebSocket(url,'deidei.rooms.v1');this.pending=new Map();this.seq=0;this.socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='hello')this.hello=m;if(m.type==='snapshot')this.snapshot=m;if(m.type==='membership.ended')this.ended=m;if(m.type==='ack'){const done=this.pending.get(m.request_id);if(done){this.pending.delete(m.request_id);done(m);}}});}
 async command(op,payload){const request_id=randomUUID();const response=new Promise(resolve=>this.pending.set(request_id,resolve));this.socket.send(JSON.stringify({v:1,type:'command',request_id,command_seq:op.startsWith('session.')?null:String(++this.seq),op,payload}));let timer;try{const m=await Promise.race([response,new Promise((_,reject)=>timer=setTimeout(()=>reject(new Error('ACK_TIMEOUT')),5000))]);assert.equal(m.ok,true,`ACK_${m.error?.code}`);return m.data;}finally{clearTimeout(timer);this.pending.delete(request_id);}}
 async open(){await until(()=>this.hello,v=>!!v);assert.equal(this.hello.protocol,'rooms-1.1');this.identity=await this.command('session.open',{profile:{nickname:'成包测试同学',avatar_id:'sun'}});return this;}
 async join(code){const d=await this.command('room.join',{room_code:code,password:null,role:'player'});this.room=d.room_id;return d;}
 async ready(){return this.command('room.ready',{room_id:this.room,ready:true});}
 async submit(view,entry_id){return this.command('room.submit',{room_id:this.room,match_id:view.match.match_id,turn_id:view.match.turn_id,entry_id});}
 close(){this.socket.close();}
}
module.exports={Peer,pause,until};
