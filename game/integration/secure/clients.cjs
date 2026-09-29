// Same checks through real NetworkRoomPort or ordinary Electron main/preload.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),readline=require('node:readline');
const {NetworkRoomPort}=require('../../desktop/online/network-room-port.cjs');
const {WorkerPort}=require('../../desktop/worker-port.cjs');
const {until}=require('../peer.cjs');
const layer=process.env.DEIDEI_TLS_LAYER,gui=layer==='L4',output=process.env.DEIDEI_SECURE_OUTPUT,desktop=path.resolve(__dirname,'../../desktop');
const clients=[],directories=[],workers=[],processes=[];
const evidence={layer,status:'FAIL',checks:[],screenshots:[],page_errors:[],versions:process.versions};
const input=readline.createInterface({input:process.stdin});let controlReply;
input.on('line',line=>{assert.equal(line,'OK');controlReply?.();controlReply=null;});
async function control(control,extra={}){const reply=new Promise(resolve=>{controlReply=resolve;});process.stdout.write(JSON.stringify({control,...extra})+'\n');await reply;}
function pass(id,detail){evidence.checks.push({id,layer,status:'PASS',detail});}
async function make(name,url){
 const c={name};clients.push(c);
 if(gui){
  const {_electron}=require('../../desktop/node_modules/playwright-core');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-tls-window-'));directories.push(dir);
  c.dir=dir;c.app=await _electron.launch({args:[path.join(desktop,'main.cjs')],env:{...process.env,DEIDEI_TEST_DATA_DIR:dir,DEIDEI_ROOM_URL:url}});
  c.process=c.app.process();processes.push(c.process);c.page=await c.app.firstWindow();c.page.setDefaultTimeout(10000);c.page.on('pageerror',e=>evidence.page_errors.push(e.message));
  await c.page.getByRole('textbox',{name:'昵称',exact:true}).fill(name);await c.page.getByRole('button',{name:'保存，进入课间 →',exact:true}).click();
  await c.page.getByRole('button',{name:'好友联机',exact:false}).click();evidence.electron=await c.app.evaluate(()=>process.versions);
 }else{c.port=new NetworkRoomPort({url});c.port.openLobby({nickname:name,avatar_id:'leaf'});}
 return c;
}
async function state(c){if(!gui)return c.port.read();const r=await c.page.evaluate(()=>window.desktop.online.read());assert.ok(r.ok);return r.data;}
async function call(c,method,payload){
 if(gui){const r=await c.page.evaluate(({method,payload})=>window.desktop.online[method](payload),{method,payload});assert.ok(r.ok,`${method}: ${r.error}`);}else c.port[method](payload);
 await until(async()=>!(await state(c)).pending,`${method} ack`);const s=await state(c);assert.equal(s.error,null,`${method} rejected: ${s.error?.code}`);return s;
}
async function shot(c,name){if(!gui)return;await c.page.screenshot({path:path.join(output,name+'.png'),scale:'css'});evidence.screenshots.push({name,source:'ordinary Electron main/preload, real TLS service'});}
async function close(c){
 c.port?.close();if(c.app&&!c.closed){
  try{await c.app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});await c.app.close();}catch{if(c.process.exitCode===null&&!c.process.signalCode)c.process.kill('SIGKILL');}
  await until(()=>c.process.exitCode!==null||c.process.signalCode,'owned Electron exit',5000);c.closed=true;
 }
}
async function select(c,entry){
 const s=await state(c),m=s.snapshot.view.match;
 if(gui){await c.page.locator(`[data-entry="${entry}"] .card-pick`).click();await c.page.getByRole('button',{name:'提交所选',exact:true}).click();await until(async()=>!(await state(c)).pending,'UI submit ack');assert.equal((await state(c)).error,null);}
 else await call(c,'submit',{room_id:s.snapshot.room_id,match_id:m.match_id,turn_id:m.turn_id,entry_id:entry});
}
async function readyStart(h,g,rid){for(const c of [h,g])await call(c,'ready',{room_id:rid,ready:true});await call(h,'start',{room_id:rid});await until(async()=>(await state(g)).snapshot?.view.phase==='selecting','new selecting');}
async function round(h,g,v,entries){
 const turn=(await state(h)).snapshot.view.match.turn_id;
 for(const c of [g,v])await until(async()=>(await state(c)).snapshot?.view.match.turn_id===turn,'same turn');
 await select(h,entries[0]);await select(g,entries[1]);await until(async()=>(await state(g)).snapshot?.view.phase==='revealing','real reveal');
 const ledger=(await state(g)).snapshot.view.match.last_turn;
 for(const c of [h,v]){await until(async()=>(await state(c)).snapshot?.view.match.last_turn?.turn_id===turn,'ledger broadcast');assert.deepEqual((await state(c)).snapshot.view.match.last_turn,ledger);}
 await until(async()=>(await state(g)).snapshot?.view.phase!=='revealing','reveal over');return ledger;
}
(async()=>{
 try{
  for(const [scenario,url] of Object.entries(JSON.parse(process.env.DEIDEI_TLS_BAD_URLS))){
   const c=await make(`坏证书${scenario}`,url);await until(async()=>(await state(c)).error?.code==='SECURE_CONNECTION_FAILED',`${scenario} certificate rejected`,10000);
   const s=await state(c);assert.equal(s.hello,null);assert.equal(s.snapshot,null);
   if(gui)await c.page.getByText('安全连接未建立，请检查服务器证书或网络。',{exact:true}).waitFor();
   await shot(c,'tls-'+scenario);await close(c);pass('S08',`${scenario}: no hello or identity; certificate validation retained`);
  }
  await control('bad-counts');
  const url=process.env.DEIDEI_TLS_URL,host=await make('安全房主',url),guest=await make('安全玩家',url),viewer=await make('安全观众',url);
  for(const c of [host,guest,viewer])await until(async()=>(await state(c)).status==='connected','valid TLS connected',12000);
  pass('S02','valid root trusted only at process startup; actual authenticated secure connection');
  await call(host,'create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});await until(async()=>(await state(host)).snapshot,'room created');
  const snap=(await state(host)).snapshot,rid=snap.room_id,code=snap.view.room_code;
  await call(guest,'join',{room_code:code,password:null,role:'player'});await call(viewer,'join',{room_code:code,password:null,role:'spectator'});
  await until(async()=>(await state(host)).snapshot.view.members.length===3,'three members');const matches=new Set();
  for(let game=0;game<2;game++){
   await readyStart(host,guest,rid);let s=await state(host);const mid=s.snapshot.view.match.match_id;assert.ok(!matches.has(mid));matches.add(mid);
   if(game===0){
    const deadline=s.snapshot.view.timer.deadline_at_ms;await select(host,'Charge');
    await call(host,'setTurnLimit',{room_id:rid,turn_ms:5000,expected_policy_revision:'1'});
    s=await state(host);assert.equal(s.snapshot.view.timer.deadline_at_ms,deadline);assert.equal(s.snapshot.view.current_turn_ms,10000);assert.equal(s.snapshot.view.policy.turn_ms,5000);
    const spectator=await state(viewer);assert.equal(spectator.snapshot.view.self.accepted_entry_id,null);assert.deepEqual(spectator.snapshot.view.self.options,[]);assert.equal(JSON.stringify(spectator).includes('resume_token'),false);
    const payload={room_id:rid,match_id:mid,turn_id:s.snapshot.view.match.turn_id,entry_id:'Charge'};
    if(gui){const rejected=await viewer.page.evaluate(p=>window.desktop.online.submit(p),payload);assert.equal(rejected.ok,false);assert.equal(rejected.error,'UNAVAILABLE_MOVE');}else assert.throws(()=>viewer.port.submit(payload),/UNAVAILABLE_MOVE/);
    await shot(host,'tls-current-next-limit');await shot(viewer,'tls-spectator-private');await select(guest,'Charge');
    await until(async()=>(await state(guest)).snapshot?.view.phase==='revealing','charge reveal');await until(async()=>(await state(guest)).snapshot?.view.phase==='selecting','5 second next turn');
    assert.equal((await state(host)).snapshot.view.current_turn_ms,5000);pass('S14','10 -> 5 seconds preserves current deadline and applies next selection');
    const before=(await state(guest)).snapshot.view.self.player_id;await select(guest,'Def');await control('drop',{name:'安全玩家'});
    await until(async()=>(await state(guest)).status==='reconnecting','disconnect visible before recovery');
    await until(async()=>{const x=await state(guest);return x.status==='connected'&&x.snapshot?.view.self.player_id===before&&x.snapshot?.view.self.accepted_entry_id==='Def';},'same identity resumes accepted submission');
    await select(host,'Bi');await until(async()=>(await state(guest)).snapshot?.view.phase==='revealing','resumed round revealed');
    const result=(await state(guest)).snapshot.view.match.last_turn;assert.equal(result.core_resolution.ledger.actions[before].entry_id,'Def');assert.equal(result.action_sources[before],'human');assert.equal(result.effective_state.players[before].nx_charge,'2');
    await shot(guest,'tls-resumed');await until(async()=>(await state(guest)).snapshot?.view.phase==='selecting','next turn');pass('S15','real connection dropped after selection; same identity/Def, exactly one +2 charge result');
   }
   await round(host,guest,viewer,['SelfBi','SelfBi']);const result=(await state(guest)).snapshot.view;
   assert.equal(result.phase,'result');assert.equal(result.match.effective_outcome.kind,'nobody_survives');await shot(guest,`tls-result-${game+1}`);
   await call(host,'returnLobby',{room_id:rid});await until(async()=>(await state(guest)).snapshot?.view.phase==='lobby','return lobby');
  }
  pass('S13','two full matches, two players + spectator, matching real-core ledgers, fresh IDs, private choices hidden, spectator submit denied');
  await readyStart(host,guest,rid);await select(host,'Charge');await call(host,'leave');await select(guest,'Charge');
  await until(async()=>(await state(viewer)).snapshot?.view.phase==='closed','host departure closes current turn',10000);
  const closed=(await state(viewer)).snapshot.view;assert.equal(closed.close_reason,'HOST_LEFT');assert.equal(closed.match.effective_outcome,null);await shot(viewer,'tls-host-left');pass('S16','host leaves after submission; current turn closes HOST_LEFT with no fabricated winner');
  await control('restart');await until(async()=>(await state(guest)).error?.code==='SERVER_RESTART','old identity rejected');await shot(guest,'tls-server-restart');pass('S15','same TLS endpoint restarts: SERVER_RESTART, no silent room restoration');
  await control('stop');const profile=gui?await fs.readFile(path.join(guest.dir,'local-profile/profile.json')):null;
  if(gui){
   await guest.page.getByRole('button',{name:'返回主菜单',exact:true}).click();await guest.page.getByRole('button',{name:'单人对局',exact:false}).click();await guest.page.getByRole('button',{name:'开始单人对局',exact:true}).click();
   await guest.page.locator('.table[data-phase="selecting"]').waitFor();assert.equal((await guest.page.evaluate(()=>window.desktop.port.getView())).data.source,'live');await shot(guest,'tls-stopped-offline');
   await guest.page.getByRole('button',{name:'离开牌桌',exact:true}).click();await guest.page.getByRole('button',{name:'离开',exact:true}).click();assert.deepEqual(await fs.readFile(path.join(guest.dir,'local-profile/profile.json')),profile);
  }else{const profile={local_id:'tls-offline',nickname:'离线测试',avatar_id:'leaf'},worker=new WorkerPort(profile);workers.push(worker);const view=await worker.startSolo(profile.local_id);assert.equal(view.source,'live');assert.equal(view.phase,'selecting');await worker.close();}
  pass('S17','service stays stopped; actual source offline worker starts');assert.deepEqual(evidence.page_errors,[]);evidence.status='PASS';
 }catch(e){evidence.error=e.message;process.exitCode=1;for(const c of clients)if(c.page&&!c.closed)try{await shot(c,'tls-failure-'+c.name);}catch{}}
 finally{
  for(const c of clients)await close(c);for(const w of workers)await w.close();for(const dir of directories)await fs.rm(dir,{recursive:true,force:true});
  evidence.processes=processes.map(p=>({pid:p.pid,exit_code:p.exitCode,signal:p.signalCode,exited:p.exitCode!==null||!!p.signalCode}));evidence.profiles_removed=true;
  pass('S18','owned clients closed; temporary profiles removed; server/CA cleanup in Python evidence');
  await fs.writeFile(path.join(output,layer+'.json'),JSON.stringify(evidence,null,2)+'\n');input.close();
 }
})().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;input.close();});
