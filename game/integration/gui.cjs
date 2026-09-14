// Real Electron main/preload/NetworkRoomPort -> owned loopback CLI service. No fixture transport.
const {_electron:electron}=require('../desktop/node_modules/playwright-core');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {Peer,until,sleep}=require('./peer.cjs');
const root=path.resolve(__dirname,'../..'),desktop=path.join(root,'game/desktop');
const output=path.resolve(process.env.DEIDEI_INTEGRATION_OUTPUT||path.join(os.tmpdir(),'deidei-live-gui'));
const python=process.env.DEIDEI_PYTHON||'python3';
const env={...process.env,PYTHONPATH:[path.join(root,'game/core'),path.join(root,'game/server')].join(path.delimiter)};
delete env.ELECTRON_RUN_AS_NODE;
const apps=[],children=[],peers=[],directories=[];
const evidence={source:'online',transport:'real CLI WebSocket server; ordinary Electron main/preload; temporary synthetic profiles',platform:process.platform,arch:process.arch,checks:[],screenshots:[],page_errors:[]};
const pass=(id,detail)=>{evidence.checks.push({id,status:'PASS',detail});console.log('PASS',id,detail);};
async function processWithAddress(args){
 const child=spawn(python,args,{cwd:root,env,stdio:['pipe','pipe','pipe']});children.push(child);
 const lines=readline.createInterface({input:child.stdout});const received=[];lines.on('line',line=>received.push(line));child.stderr.on('data',()=>{});
 const address=await until(()=>received.find(x=>x.startsWith('Listening: ')), 'owned service listening',10000);
 const url=address.slice(11);assert.match(url,/^ws:\/\/127\.0\.0\.1:[0-9]+\/rooms-v1$/);
 return {child,url,received};
}
async function stop(child){if(child.exitCode!==null||child.signalCode)return;child.kill('SIGINT');await until(()=>child.exitCode!==null||child.signalCode,'owned child exit',5000).catch(()=>{child.kill('SIGKILL');});}
async function launch(name,url){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-real-window-'));directories.push(dir);
 const app=await electron.launch({args:[path.join(desktop,'main.cjs')],env:{...env,DEIDEI_TEST_DATA_DIR:dir,DEIDEI_ROOM_URL:url,DEIDEI_PYTHON:python}});apps.push(app);app.__ownedProcess=app.process();
 const page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>evidence.page_errors.push(e.message));
 await page.getByRole('textbox',{name:'昵称',exact:true}).fill(name);await page.getByRole('button',{name:'保存，进入课间 →',exact:true}).click();
 return {app,page,dir,name};
}
async function state(c){const r=await c.page.evaluate(()=>window.desktop.online.read());assert.ok(r.ok);return r.data;}
async function call(c,method,payload){const r=await c.page.evaluate(async({method,payload})=>window.desktop.online[method](payload),{method,payload});assert.ok(r.ok,`${method}: ${r.error}`);await until(async()=>!(await state(c)).pending,`${method} acknowledged`);return state(c);}
async function online(c){await c.page.getByRole('button',{name:'好友联机',exact:false}).click();await until(async()=>(await state(c)).status==='connected','connected');}
async function create(c,password=null){await c.page.getByRole('button',{name:'创建房间',exact:true}).click();if(password)await c.page.getByRole('textbox',{name:'房间密码',exact:true}).fill(password);await c.page.getByRole('button',{name:'创建并进入',exact:true}).click();await c.page.locator('.lobby-seats').waitFor();return (await state(c)).snapshot;}
async function join(c,code,role='player',password=''){
 await c.page.getByRole('button',{name:'加入房间',exact:true}).click();await c.page.getByRole('textbox',{name:'房间号',exact:true}).fill(code);await c.page.getByRole('combobox',{name:'加入身份',exact:true}).selectOption(role);await c.page.getByRole('textbox',{name:'房间密码',exact:true}).fill(password);await c.page.getByRole('button',{name:'加入',exact:true}).click();await until(async()=>!(await state(c)).pending,'join response');return state(c);
}
async function shot(c,name){await c.page.screenshot({path:path.join(output,`${name}.png`),scale:'css'});evidence.screenshots.push({name,source:'real service / real Electron',viewport:await c.page.evaluate(()=>({width:innerWidth,height:innerHeight}))});}
async function submit(c,entry){await c.page.locator(`[data-entry="${entry}"] .card-pick`).click();await c.page.getByRole('button',{name:'提交所选',exact:true}).click();await until(async()=>!(await state(c)).pending,'submit ack');}
async function start(host,guest,players,rid){for(const c of [host,guest]){if(c)await c.page.getByRole('button',{name:'准备',exact:true}).click();}await Promise.all(players.map(p=>p.ok('room.ready',{room_id:rid,ready:true})));await host.page.getByRole('button',{name:'开始对局',exact:true}).click();await host.page.locator('.online[data-phase="selecting"]').waitFor();}
async function leave(c){const s=await state(c);if(s.snapshot&&s.snapshot.view.phase!=='closed'&&s.status!=='unavailable'){await c.page.getByRole('button',{name:'退出房间',exact:true}).click();await c.page.getByRole('button',{name:s.snapshot.view.host_id===s.snapshot.view.self.player_id?'确认结束房间':'确认退出房间',exact:true}).click();}else await c.page.getByRole('button',{name:'返回主菜单',exact:true}).click();await c.page.getByRole('button',{name:'好友联机',exact:false}).waitFor();}
(async()=>{
 await fs.mkdir(output,{recursive:true});
 let service,proxy;
 try {
  service=await processWithAddress(['-u','-m','deidei_server','--port','0']);
  proxy=await processWithAddress(['-u','game/integration/fault_proxy.py','--upstream',service.url]);
  const control=async value=>{const count=proxy.received.length;proxy.child.stdin.write(JSON.stringify(value)+'\n');await until(()=>proxy.received.slice(count).includes('Control: '+value.op),'proxy control');};
  const host=await launch('联调房主',service.url),guest=await launch('联调玩家',proxy.url),viewer=await launch('联调观众',service.url);
  evidence.electron=await host.app.evaluate(()=>({versions:process.versions,pid:process.pid}));
  await online(host);await online(guest);await online(viewer);
  const created=await create(host,'synthetic test');let rid=created.room_id,code=created.view.room_code;
  // Wrong password is surfaced by the ordinary rendered form, then corrected in the same session.
  let s=await join(guest,code,'player','wrong');assert.equal(s.error.code,'ROOM_ACCESS_DENIED');await shot(guest,'real-wrong-password');
  await guest.page.getByRole('textbox',{name:'房间密码',exact:true}).fill('synthetic test');await guest.page.getByRole('button',{name:'加入',exact:true}).click();await guest.page.locator('.lobby-seats').waitFor();
  const players=[],watchers=[];
  for(let i=0;i<10;i++){const p=await new Peer(service.url,`测试席${i}`).open();peers.push(p);await p.ok('room.join',{room_code:code,password:'synthetic test',role:i<4?'player':'spectator'});(i<4?players:watchers).push(p);}
  let full=await join(viewer,code,'player','synthetic test');assert.equal(full.error.code,'ROOM_FULL');await shot(viewer,'real-player-full');
  await viewer.page.getByRole('combobox',{name:'加入身份',exact:true}).selectOption('spectator');await viewer.page.getByRole('button',{name:'加入',exact:true}).click();await until(async()=>!(await state(viewer)).pending,'full spectator reply');assert.equal((await state(viewer)).error.code,'SPECTATORS_FULL');await shot(viewer,'real-spectators-full');
  const freed=watchers.pop();await freed.ok('room.leave',{room_id:rid});freed.close();await viewer.page.getByRole('button',{name:'加入',exact:true}).click();await viewer.page.locator('.lobby-seats').waitFor();
  await until(async()=>(await state(host)).snapshot.view.members.length===12,'6 plus 6');
  const extra=await new Peer(service.url,'满席验证').open();peers.push(extra);
  for(const [role,error] of [['player','ROOM_FULL'],['spectator','SPECTATORS_FULL']]){const a=await extra.command('room.join',{room_code:code,password:'synthetic test',role});assert.equal(a.error.code,error);}
  let current=await state(viewer);assert.equal(current.snapshot.view.self.options.length,0);
  const denied=await viewer.page.evaluate(rid=>window.desktop.online.setTurnLimit({room_id:rid,turn_ms:5000,expected_policy_revision:'1'}),rid);assert.equal(denied.error,'NOT_HOST');
  pass('Q06/Q14','Three actual Electron processes plus socket peers fill 6 player and 6 spectator places; wrong password, full capacities and spectator permission reject.');
  const allPeers=[...players,...watchers];const ids=new Set();
  async function round(entries,hostPlays=true){
   const cstate=await state(guest);const turn=cstate.snapshot.view.match.turn_id;
   await until(()=>players.every(p=>p.view?.view.phase==='selecting'&&p.view.view.match.turn_id===turn),'peers current turn');
   if(hostPlays)await submit(host,entries[0]);await submit(guest,entries[1]);
   await Promise.all(players.map((p,i)=>p.submit(entries[i+2])));
   await until(async()=>(await state(guest)).snapshot.view.phase==='revealing','real reveal');
   const result=(await state(guest)).snapshot.view.match.last_turn;
   await until(()=>allPeers.every(p=>p.view?.view.match?.last_turn?.turn_id===result.turn_id),'public ledger delivered');
   for(const p of allPeers)assert.deepEqual(p.view.view.match.last_turn,result);
   assert.deepEqual((await state(viewer)).snapshot.view.match.last_turn,result);
   await until(async()=>(await state(guest)).snapshot.view.phase!=='revealing','reveal complete');return result;
  }
  for(let game=0;game<3;game++){
   await start(host,guest,players,rid);let s=await state(host);assert.ok(!ids.has(s.snapshot.view.match.match_id));ids.add(s.snapshot.view.match.match_id);
   if(game===0){
    assert.equal(s.snapshot.view.current_turn_ms,10000);
    for(const [width,height] of [[1366,768],[1920,1080]]){
     await host.page.setViewportSize({width,height});const layout=await host.page.evaluate(()=>({size:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],cards:[...document.querySelectorAll('.card')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})}));
     assert.equal(layout.cards.length,33);assert.equal(new Set(layout.cards.map(c=>Math.round(c.y))).size,3);assert.ok(layout.cards.every(c=>c.x>=0&&c.right<=width&&c.bottom<=height));assert.ok(layout.scroll[0]<=width&&layout.scroll[1]<=height);evidence[`layout_${width}`]=layout;await shot(host,`real-online-${width}x${height}`);
    }
    await host.page.setViewportSize({width:1366,height:768});pass('Q23','33 cards, three rows, both specified viewports without overflow; actual service and renderer.');
    const before=(await state(host)).snapshot.view.timer.deadline_at_ms;
    await submit(host,'Charge');
    for(const ms of [5000,30000,30000]){const v=(await state(host)).snapshot.view;await call(host,'setTurnLimit',{room_id:rid,turn_ms:ms,expected_policy_revision:v.policy_revision});assert.equal((await state(host)).snapshot.view.timer.deadline_at_ms,before);}
    assert.equal((await state(host)).snapshot.view.policy_revision,'3');
    const other=await state(viewer);assert.equal(other.snapshot.view.self.accepted_entry_id,null);assert.deepEqual(other.snapshot.view.self.options,[]);assert.equal(JSON.stringify(other).includes('resume_token'),false);assert.equal(other.source,'online');
    await shot(host,'real-current-next-limit');await shot(viewer,'real-spectator-private');
    await submit(guest,'Charge');await Promise.all(players.map(p=>p.submit('Charge')));await until(async()=>(await state(guest)).snapshot.view.phase==='revealing','initial reveal');await until(async()=>(await state(guest)).snapshot.view.phase==='selecting','next select');
    assert.equal((await state(host)).snapshot.view.current_turn_ms,30000);pass('Q05/Q15','In-flight timing and accepted card unchanged; next stage uses final 30s revision; spectator receives no private option or accepted entry.');
    // The relay cuts only after the real service accepted submit and produced its ACK.
    await control({op:'drop_ack',command:'room.submit'});
    await guest.page.locator('[data-entry="Def"] .card-pick').click();await guest.page.getByRole('button',{name:'提交所选',exact:true}).click();
    await until(async()=>(await state(guest)).status==='reconnecting','ACK loss disconnect');
    await until(async()=>{const x=await state(guest);return x.status==='connected'&&!x.pending&&x.snapshot?.view.self.accepted_entry_id==='Def';},'resume and identical submission',15000);
    await submit(host,'Bi');await Promise.all(players.map(p=>p.submit('Def')));
    await until(async()=>(await state(guest)).snapshot.view.phase==='revealing','after resumed submit');
    const revealed=(await state(guest)).snapshot.view.match.last_turn;const gid=(await state(guest)).snapshot.view.self.player_id;assert.equal(revealed.action_sources[gid],'human');assert.equal(revealed.core_resolution.ledger.actions[gid].entry_id,'Def');await shot(guest,'real-resume-accepted');
    await until(async()=>(await state(guest)).snapshot.view.phase==='selecting','post resumed reveal');pass('Q12','ACK dropped after real server acceptance; original pending submission resumed once, same entry and human source.');
   }else if(game===1){
    await round(['SelfBi','Charge','Charge','Charge','Charge','Charge']);const v=(await state(host)).snapshot.view;const me=v.members.find(m=>m.player_id===v.self.player_id);assert.equal(me.participation,'eliminated');assert.equal(me.role,'player');assert.equal(me.seat,0);assert.equal(v.host_id,v.self.player_id);assert.equal(v.self.options.length,0);
    await call(host,'setTurnLimit',{room_id:rid,turn_ms:5000,expected_policy_revision:v.policy_revision});await shot(host,'real-eliminated-host');pass('Q08','Naturally eliminated host keeps seat and management rights, no selectable cards; other players continue.');
   }else {await round(['Charge','Charge','Charge','Charge','Charge','Charge']);await round(['Bi','Def','Def','Def','Def','Def']);}
   await round(['SelfBi','SelfBi','SelfBi','SelfBi','SelfBi','SelfBi'],game!==1);
   await guest.page.locator('.online[data-phase="result"]').waitFor();await shot(guest,`real-result-${game+1}`);
   await host.page.getByRole('button',{name:'准备下一场',exact:true}).click();await host.page.locator('.lobby-seats').waitFor();
  }
  pass('Q07','Three complete real-core matches, including Charge/Bi/Def, natural elimination, common outcomes and return to lobby/new match IDs.');
  // Delay a genuine old snapshot and automatic removal receipt; release after a fresh room exists.
  const hv=(await state(host)).snapshot.view;await call(host,'setTurnLimit',{room_id:rid,turn_ms:5000,expected_policy_revision:hv.policy_revision});
  await start(host,guest,players,rid);await control({op:'hold',types:['snapshot','membership.ended']});
  for(let n=0;n<3;n++){
   await submit(host,'Charge');await until(()=>players.every(p=>p.view?.view.phase==='selecting'),'players ready');await Promise.all(players.map(p=>p.submit('Charge')));
   await until(async()=>(await state(host)).snapshot.view.phase==='revealing','ordinary absence reveal',10000);await until(async()=>(await state(host)).snapshot.view.phase==='selecting','ordinary next turn');
  }
  await until(async()=>!(await state(host)).snapshot.view.members.some(m=>m.nickname==='联调玩家'),'ordinary member removed');
  await leave(guest);await online(guest);const fresh=await create(guest);assert.notEqual(fresh.room_id,rid);await control({op:'release'});await sleep(100);assert.equal((await state(guest)).snapshot.room_id,fresh.room_id);
  pass('Q11/Q13','Third ordinary absence removes the member; delayed genuine snapshot/removal receipt released after a new room cannot revive or clear the old/new room.');
  await leave(guest);
  // End the active old room through the host's normal UI; only its remaining turn is allowed.
  await leave(host);await until(async()=>(await state(viewer)).snapshot?.view.phase==='closed','after-turn host close',10000);assert.equal((await state(viewer)).snapshot.view.close_reason,'HOST_LEFT');assert.equal((await state(viewer)).snapshot.view.match.effective_outcome,null);await shot(viewer,'real-host-left');await leave(viewer);
  for(const p of [...players,...watchers])p.close();
  pass('Q09','Host selecting-phase UI exit closes after the current turn with HOST_LEFT and no new outcome. Reveal-phase exact-once boundary covered by server regression.');
  // Active host disappears without a voluntary leave. The surviving real window observes all four deadlines.
  await online(host);await online(guest);await online(viewer);let r=await create(host);rid=r.room_id;code=r.view.room_code;await join(guest,code);await join(viewer,code,'spectator');
  await call(host,'setTurnLimit',{room_id:rid,turn_ms:5000,expected_policy_revision:'1'});await start(host,guest,[],rid);
  const hostId=(await state(host)).snapshot.view.host_id;host.app.__ownedProcess.kill('SIGKILL');await until(()=>host.app.__ownedProcess.signalCode,'owned host process exit');
  for(let n=1;n<=4;n++){
   await submit(guest,'Def');await until(async()=>['revealing','closed'].includes((await state(guest)).snapshot?.view.phase),'host missing deadline',10000);
   const v=(await state(guest)).snapshot.view;if(n<4){assert.equal(v.host_recovery.missing_count,n);assert.equal(v.match.last_turn.core_resolution.ledger.actions[hostId].entry_id,'Charge');await until(async()=>(await state(guest)).snapshot.view.phase==='selecting','host next missing turn');}else{assert.equal(v.close_reason,'HOST_ABSENT');await shot(guest,'real-host-fourth-close');}
  }
  pass('Q10','Real host process loss: three Charge turns observed, fourth deadline closes; no voluntary leave injected.');await leave(guest);await leave(viewer);
  // Observe the automatic removal notice in an ordinary renderer without delaying its event.
  await online(guest);await online(viewer);r=await create(guest);rid=r.room_id;code=r.view.room_code;await join(viewer,code,'player');
  const third=await new Peer(service.url,'移除验证同伴').open();peers.push(third);await third.ok('room.join',{room_code:code,password:null,role:'player'});
  await call(guest,'setTurnLimit',{room_id:rid,turn_ms:5000,expected_policy_revision:'1'});await start(guest,viewer,[third],rid);
  for(let n=0;n<3;n++){await submit(guest,'Charge');await until(()=>third.view?.view.phase==='selecting','removal peer select');await third.submit('Charge');await until(async()=>(await state(guest)).snapshot.view.phase==='revealing','visible absence result',10000);await until(async()=>(await state(guest)).snapshot.view.phase==='selecting','visible absence next');}
  await viewer.page.getByText('连续三拍缺席，已在当拍结算后移除。',{exact:false}).waitFor();assert.equal((await state(viewer)).snapshot,null);await shot(viewer,'real-membership-ended-notice');pass('Q11-visible','Ordinary renderer receives membership.ended without another command and presents the removal reason.');
  await submit(guest,'Charge');await until(()=>third.view?.view.phase==='selecting','last reveal peer select');await third.submit('Charge');await until(async()=>(await state(guest)).snapshot.view.phase==='revealing','host leaves reveal');const published=structuredClone((await state(guest)).snapshot.view.match.last_turn);await leave(guest);await until(()=>third.view?.view.phase==='closed','reveal host close');assert.equal(third.view.view.close_reason,'HOST_LEFT');assert.deepEqual(third.view.view.match.last_turn,published);third.close();await leave(viewer);pass('Q09-reveal','Host exits during real reveal; closure retains exactly the existing ledger.');
  // Restart exactly the owned endpoint. Identity loss must not silently restore the old game.
  await online(guest);await create(guest);const port=new URL(service.url).port;await stop(service.child);service=await processWithAddress(['-u','-m','deidei_server','--port',port]);
  await until(async()=>(await state(guest)).error?.code==='SERVER_RESTART','server restart identity error',15000);await shot(guest,'real-server-restart');await leave(guest);
  const profile=await fs.readFile(path.join(guest.dir,'local-profile/profile.json'));
  await guest.page.getByRole('button',{name:'单人对局',exact:false}).click();await guest.page.getByRole('button',{name:'开始单人对局',exact:true}).click();await guest.page.locator('.table[data-phase="selecting"]').waitFor();assert.equal((await guest.page.evaluate(()=>window.desktop.port.getView())).data.source,'live');await shot(guest,'real-offline-after-network-failure');
  await guest.page.getByRole('button',{name:'离开牌桌',exact:true}).click();await guest.page.getByRole('button',{name:'离开',exact:true}).click();assert.deepEqual(await fs.readFile(path.join(guest.dir,'local-profile/profile.json')),profile);pass('Q16/Q22','Owned service restart is visible as SERVER_RESTART; original real offline worker still starts and persisted profile bytes survive.');
  await online(guest);await create(guest);
  await guest.app.evaluate(({dialog,BrowserWindow})=>{global.__closePrompts=[];dialog.showMessageBox=async(_w,o)=>{global.__closePrompts.push(o.message);return {response:0};};BrowserWindow.getAllWindows()[0].close();});await sleep(100);assert.equal(await guest.app.evaluate(()=>global.__closePrompts.length),1);assert.equal((await state(guest)).status,'connected');
  await control({op:'hold',types:['ack']});const began=Date.now();const closed=guest.app.waitForEvent('close');await guest.app.evaluate(({dialog,BrowserWindow})=>{dialog.showMessageBox=async()=>({response:1});BrowserWindow.getAllWindows()[0].close();});await closed;assert.ok(Date.now()-began<4500);pass('Q17','Existing native close confirmation cancelled then accepted; genuine leave ACK held by relay, exit finishes within bounded 3s wait. Dialog response automated, no transport mock.');
  assert.deepEqual(evidence.page_errors,[]);evidence.status='PASS';
 } catch(error){evidence.status='FAIL';evidence.error=error.message;for(let i=0;i<apps.length;i++){try{const page=await apps[i].firstWindow();await page.screenshot({path:path.join(output,`failure-window-${i}.png`),scale:'css'});}catch{}}throw error;}
 finally{
  for(const p of peers)p.close();
  for(const app of apps){try{await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});await app.close();}catch{app.__ownedProcess?.kill('SIGKILL');}}
  for(const child of children)await stop(child);
  await fs.writeFile(path.join(output,'gui.json'),JSON.stringify(evidence,null,2)+'\n');
  for(const dir of directories)await fs.rm(dir,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
