// Bounded real-clock soak: only the owned loopback subprocess; <=4 rooms and <=48 peers.
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const {monitorEventLoopDelay}=require('node:perf_hooks');
const {Peer,until,sleep}=require('./peer.cjs');
const root=path.resolve(__dirname,'../..'),seconds=Number(process.env.DEIDEI_SOAK_SECONDS||900),output=path.resolve(process.env.DEIDEI_INTEGRATION_OUTPUT||path.join(os.tmpdir(),'deidei-soak'));
assert.ok(Number.isInteger(seconds)&&seconds>=10&&seconds<=900);
(async()=>{
 const child=spawn(process.env.DEIDEI_PYTHON||'python3',['-u','-m','deidei_server','--port','0'],{cwd:root,env:{...process.env,PYTHONPATH:[path.join(root,'game/core'),path.join(root,'game/server')].join(path.delimiter)},stdio:['ignore','pipe','pipe']});
 let stdout='';child.stdout.on('data',b=>stdout=(stdout+b).slice(-4096));child.stderr.on('data',()=>{});
 const peers=[],rooms=[],samples=[],latencies=[],histogram=monitorEventLoopDelay({resolution:20});histogram.enable();let matches=0,turns=0,start;
 const report={transport:'real CLI service and native WebSockets; no injected clock',rooms:4,connections:48,requested_seconds:seconds};
 const op=async(p,name,payload)=>{const t=performance.now();const result=await p.ok(name,payload);if(latencies.length<10000)latencies.push(performance.now()-t);return result;};
 try{
  await until(()=>stdout.includes('Listening: '),'owned soak service');const url=stdout.trim().split('Listening: ').at(-1);assert.match(url,/^ws:\/\/127\.0\.0\.1:[0-9]+\/rooms-v1$/);
  for(let r=0;r<4;r++){
   const members=[];for(let i=0;i<12;i++){const p=await new Peer(url,`持续${r}-${i}`).open();peers.push(p);members.push(p);}
   const {room_id,room_code}=await op(members[0],'room.create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});
   await Promise.all(members.slice(1).map((p,i)=>op(p,'room.join',{room_code,password:null,role:i<5?'player':'spectator'})));
   rooms.push({members,room_id,last:null,match:null});
  }
  start=performance.now();let lastSample=-60000;
  while(performance.now()-start<seconds*1000){
   for(const room of rooms){
    const {members,room_id}=room,host=members[0];if(host.error)throw host.error;const view=host.view?.view;if(!view)continue;
    if(view.phase==='lobby'){
     await Promise.all(members.slice(0,6).map(p=>op(p,'room.ready',{room_id,ready:true})));await op(host,'room.start',{room_id});
    }else if(view.phase==='selecting'&&room.last!==view.match.turn_id){
     room.last=view.match.turn_id;await until(()=>members.every(p=>p.view?.view.match?.turn_id===room.last),'soak common turn');
     const turn=Number(view.match.public_state.turn_index),entry=turn<3?'Charge':'SelfBi';
     await Promise.all(members.slice(0,6).map(p=>op(p,'room.submit',{room_id,match_id:view.match.match_id,turn_id:room.last,entry_id:entry})));turns++;
    }else if(view.phase==='result'&&room.match!==view.match.match_id){
     room.match=view.match.match_id;await until(()=>members.every(p=>p.view?.view.phase==='result'),'soak common result');
     for(const p of members){assert.deepEqual(p.view.view.match.last_turn,view.match.last_turn);assert.equal(p.view.room_id,room_id);assert.equal(p.view.view.members.length,12);}
     matches++;await op(host,'room.return_lobby',{room_id});room.last=null;
    }
   }
   const elapsed=performance.now()-start;if(elapsed-lastSample>=60000){lastSample=elapsed;let rss='UNAVAILABLE';try{rss=Number(execFileSync('ps',['-o','rss=','-p',String(child.pid)],{encoding:'utf8'}).trim());}catch{}samples.push({elapsed_ms:Math.round(elapsed),server_rss_kib:rss});console.log('SOAK elapsed_s='+Math.round(elapsed/1000)+' matches='+matches+' turns='+turns);}
   await sleep(30);
  }
  report.status='PASS';
 }catch(e){report.status='FAIL';report.error=e.message;throw e;}
 finally{
  report.elapsed_seconds=start?(performance.now()-start)/1000:0;report.matches=matches;report.turns=turns;report.samples=samples;
  histogram.disable();latencies.sort((a,b)=>a-b);report.response_ms={sample_count:latencies.length,p50:latencies[Math.floor(latencies.length*.5)]||null,p95:latencies[Math.floor(latencies.length*.95)]||null,max:latencies.at(-1)||null};report.client_loop_delay_ms={mean:histogram.mean/1e6,max:histogram.max/1e6};
  for(const p of peers)p.close();await until(()=>peers.every(p=>p.ws.readyState===3),'peer cleanup',5000).catch(()=>{});report.closed_connections=peers.filter(p=>p.ws.readyState===3).length;
  child.kill('SIGINT');await until(()=>child.exitCode!==null||child.signalCode,'owned service cleanup',5000).catch(()=>child.kill('SIGKILL'));report.server_exited=child.exitCode!==null||!!child.signalCode;
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'soak.json'),JSON.stringify(report,null,2)+'\n');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
