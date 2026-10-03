// Actual loopback service/relay/NetworkRoomPort. No Electron or private request output.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),readline=require('node:readline'),{spawn}=require('node:child_process');
const {NetworkRoomPort}=require('../desktop/online/network-room-port.cjs'),{until}=require('./peer.cjs');
const root=path.resolve(__dirname,'../..');
test('accepted ACK loss retries the same request and records one public action',{timeout:30000},async()=>{
 const children=[],ports=[],cleanupErrors=[],cleanup=[];let firstError;
 const launch=async args=>{
  const child=spawn(process.env.DEIDEI_PYTHON||'python3',args,{cwd:root,env:{...process.env,PYTHONPATH:[path.join(root,'game/core'),path.join(root,'game/server')].join(path.delimiter),PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','pipe']});children.push(child);
  const lines=[];readline.createInterface({input:child.stdout}).on('line',line=>lines.push(line));child.stderr.on('data',()=>{});
  const address=await until(()=>lines.find(x=>x.startsWith('Listening: ')),'service/relay listening',5000);
  return {child,lines,url:address.slice(11)};
 };
 try{
  const service=await launch(['-u','-m','deidei_server','--port','0']);
  const relay=await launch(['-u','game/integration/fault_proxy.py','--upstream',service.url]);
  const control=async value=>{const count=relay.lines.length;relay.child.stdin.write(JSON.stringify(value)+'\n');await until(()=>relay.lines.slice(count).includes('Control: '+value.op),'relay control');return relay.lines.slice(count);};
  const host=new NetworkRoomPort({url:service.url}),guest=new NetworkRoomPort({url:relay.url});ports.push(host,guest);
  host.openLobby({nickname:'重发房主',avatar_id:'leaf'});guest.openLobby({nickname:'重发玩家',avatar_id:'leaf'});
  await until(()=>ports.every(p=>p.read().status==='connected'),'authenticated');
  const command=async(p,method,payload)=>{p[method](payload);await until(()=>!p.read().pending,method+' ack');assert.equal(p.read().error,null);};
  await command(host,'create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});
  const {room_id:rid,view:{room_code:code}}=host.read().snapshot;
  await command(guest,'join',{room_code:code,password:null,role:'player'});
  for(const p of ports)await command(p,'ready',{room_id:rid,ready:true});
  await command(host,'start',{room_id:rid});await until(()=>guest.read().snapshot?.view.phase==='selecting','selecting');
  const view=guest.read().snapshot.view,match=view.match,id=view.self.player_id;
  await control({op:'drop_ack',command:'room.submit'});
  guest.submit({room_id:rid,match_id:match.match_id,turn_id:match.turn_id,entry_id:'Def'});
  await until(()=>guest.read().status==='reconnecting','ACK dropped');
  await until(()=>{const s=guest.read();return s.status==='connected'&&!s.pending&&s.snapshot?.view.self.accepted_entry_id==='Def';},'recovered',15000);
  assert.equal(guest.read().error,null,'a rejected duplicate cannot count as recovery');
  const lines=await control({op:'retry_check'}),comparison=JSON.parse(lines.find(x=>x.startsWith('Retry: ')).slice(7));
  assert.deepEqual(comparison,{observed:true,request_id_same:true,command_seq_same:true,payload_same:true});
  await command(host,'submit',{room_id:rid,match_id:match.match_id,turn_id:match.turn_id,entry_id:'Charge'});
  await until(()=>guest.read().snapshot?.view.phase==='revealing','public ledger');
  const turn=guest.read().snapshot.view.match.last_turn;
  assert.equal(turn.core_resolution.ledger.actions[id].entry_id,'Def');assert.equal(turn.action_sources[id],'human');
  assert.equal(turn.effective_state.players[id].nx_charge,'1','single Def base gain, no duplicate settlement');
  console.log('ACK retry comparison:',JSON.stringify(comparison),'; public Def settled once');
 }catch(error){firstError=error;}
 finally{
  for(const p of ports)try{p.close();}catch(error){cleanupErrors.push(error.message);}
  for(const child of children){
   const result={forced:false,interrupt_sent:false};cleanup.push(result);
   try{
    if(child.exitCode===null&&!child.signalCode){result.interrupt_sent=true;child.kill('SIGINT');}
    await until(()=>child.exitCode!==null||child.signalCode,'owned child exit',5000);
   }catch(error){
    result.error=error.message;
    if(child.exitCode===null&&!child.signalCode){result.forced=true;try{child.kill('SIGKILL');}catch(k){result.kill_error=k.message;}}
    try{await until(()=>child.exitCode!==null||child.signalCode,'forced child exit',5000);}catch(e){result.wait_error=e.message;}
   }
   result.exit_code=child.exitCode;result.signal=child.signalCode;
   result.status=!result.error&&!result.wait_error&&!result.forced&&(result.exit_code===0&&!result.signal||result.interrupt_sent&&result.signal==='SIGINT')?'PASS':'FAIL';
   if(result.status==='FAIL')cleanupErrors.push('owned service/relay did not exit normally');
  }
  if(cleanupErrors.length)console.error('ACK cleanup:',JSON.stringify({errors:cleanupErrors,processes:cleanup}));
 }
 if(firstError)throw firstError;
 assert.equal(cleanupErrors.length,0,'owned service/relay cleanup failed');
});
