// Two ordinary Electron mains, owned real loopback service, synthetic profiles only.
const {_electron}=require('../desktop/node_modules/playwright-core');
const {spawn}=require('node:child_process');
const readline=require('node:readline'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {ProfileStore}=require('../desktop/profile.cjs');
const {closeApplication}=require('../desktop/smoke-performance.cjs');
const {Peer,until,sleep}=require('./peer.cjs');
const {enterHall,enterArena,leaveOnlinePortal}=require('./gui-actions.cjs');
const root=path.resolve(__dirname,'../..'),desktop=path.join(root,'game/desktop');
const output=path.resolve(process.env.DEIDEI_SMOKE_OUTPUT||path.join(root,'.local-outputs/R05-T01-a/rooms-major'));
const python=process.env.DEIDEI_PYTHON||path.join(root,'game/server/.venv/bin/python');
const env={...process.env,DEIDEI_PYTHON:python,PYTHONPATH:[path.join(root,'game/core'),path.join(root,'game/server')].join(path.delimiter)};
delete env.ELECTRON_RUN_AS_NODE;
const apps=[],children=[],peers=[],directories=[];
const evidence={source:'two ordinary game/desktop/main.cjs -> real owned rooms-1.2 loopback server',platform:process.platform,arch:process.arch,profiles:'synthetic disposable',checks:[],screenshots:[],sizes:[],page_errors:[],native_picker_selection:'NOT_RUN',product_import_io_compiler_persistence:'NOT_RUN'};
const pass=(id,detail)=>{evidence.checks.push({id,status:'PASS',detail});console.log('PASS',id,detail);};
async function focus(c){await c.app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].focus();});await c.page.bringToFront();}
async function address(args){
 const child=spawn(python,args,{cwd:root,env,stdio:['pipe','pipe','pipe']});children.push(child);
 const received=[];readline.createInterface({input:child.stdout}).on('line',line=>received.push(line));let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString();});child.__stderr=()=>stderr;
 const line=await until(()=>received.find(line=>line.startsWith('Listening: ')),'owned server listening',10000);
 const url=line.slice(11);assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+\/rooms-v1$/);return {child,url,received};
}
async function launch(name,style,url){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-major-room-'));directories.push(directory);
 const store=new ProfileStore(path.join(directory,'local-profile'));let profile=await store.save('create',{nickname:name,avatar_id:'leaf'});
 profile=await store.save('settings',{nickname:name,avatar_id:'leaf',settings:{...profile.settings,cardStyle:style}});
 const app=await _electron.launch({args:[path.join(desktop,'main.cjs')],env:{...env,DEIDEI_TEST_DATA_DIR:directory,DEIDEI_ROOM_URL:url}});apps.push(app);
 const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>evidence.page_errors.push({name,message:error.message}));
 const c={app,page,directory,name,style};await focus(c);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
 await enterHall(page,name);return c;
}
async function state(c){const reply=await c.page.evaluate(()=>window.desktop.online.read());assert.ok(reply.ok,reply.error);return reply.data;}
async function settled(c){return until(async()=>{const s=await state(c);return !s.pending&&s;},'ordinary main command acknowledged');}
async function shot(c,name){await focus(c);await c.page.waitForTimeout(200);const filename=name+'.png';await c.page.screenshot({path:path.join(output,filename),scale:'css'});evidence.screenshots.push({filename,source:'real Electron / real service',window:c.name,cardStyle:c.style,viewport:await c.page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))});}
async function online(c){await focus(c);await c.page.getByRole('button',{name:'好友联机',exact:false}).click();await until(async()=>(await state(c)).status==='connected','real main online connected');}
async function openRules(c){await focus(c);await c.page.getByRole('button',{name:/^选择规则：/}).click();return c.page.getByRole('dialog',{name:'选择本场规则',exact:true});}
async function applyRules(c,edit){const dialog=await openRules(c);await edit(dialog);const button=dialog.getByRole('button',{name:'应用本场规则',exact:true});await until(()=>button.isEnabled(),'rule compiler preview ready');await button.click();await dialog.waitFor({state:'detached'});await settled(c);}
async function ready(c){await focus(c);await c.page.getByRole('button',{name:'准备',exact:true}).click();await settled(c);await until(async()=>{const v=(await state(c)).snapshot.view;return v.members.find(m=>m.player_id===v.self.player_id).ready;},'GUI ready hash acknowledged');}
async function start(host,guest){await ready(host);await ready(guest);await focus(host);await host.page.getByRole('button',{name:'开始对局',exact:true}).click();await until(async()=>(await state(host)).snapshot?.view.phase==='selecting','room starts current rules');await enterArena(host.page);await focus(guest);await enterArena(guest.page);}
async function submit(c,entry){await focus(c);await c.page.locator('.battle-table[data-ready=true][data-phase=selecting]').waitFor();const card=c.page.locator(`[data-entry="${entry}"] .card-pick`);await card.click();await until(async()=>await card.getAttribute('aria-pressed')==='true','card selected '+entry);await c.page.getByRole('button',{name:'确认出招',exact:true}).click();await settled(c);}
async function round(host,guest,a,b){
 const before=(await state(host)).snapshot.view.match.turn_id;
 await submit(host,a);await submit(guest,b);
 const snapshot=await until(async()=>{const s=(await state(host)).snapshot;return s.view.match?.last_turn?.turn_id===before&&s.view.match.last_turn;},'real public round');
 await until(async()=>(await state(guest)).snapshot.view.match.last_turn?.turn_id===before,'guest public round');
 assert.deepEqual((await state(guest)).snapshot.view.match.last_turn,snapshot);evidence.rounds??=[];evidence.rounds.push(snapshot);
 return snapshot;
}
async function nextSelect(host,guest){await until(async()=>(await state(host)).snapshot.view.phase==='selecting','next select',10000);await until(async()=>(await state(guest)).snapshot.view.phase==='selecting','guest next select',10000);}
async function finishAndLobby(host,guest){
 const current=(await state(host)).snapshot.view;
 const terminal=['sole_survivor','nobody_survives'].includes(current.match?.last_turn?.core_resolution.transition.kind);
 if(current.phase!=='result'&&!terminal){await nextSelect(host,guest);await round(host,guest,'SelfBi','Charge');}
 await until(async()=>(await state(host)).snapshot.view.phase==='result','real terminal core result',10000);
 await focus(host);await host.page.getByRole('button',{name:'准备下一局',exact:false}).waitFor();await host.page.getByRole('button',{name:'准备下一局',exact:false}).click();
 await host.page.locator('.online-lobby').waitFor();await guest.page.locator('.online-lobby').waitFor();
 const h=(await state(host)).snapshot.view,g=(await state(guest)).snapshot.view;
 assert.equal(h.rules_snapshot.rules_hash,g.rules_snapshot.rules_hash);assert.ok(h.members.every(m=>!m.ready&&m.ready_rules_hash===null));
 return h;
}
async function importPack(host,name){
 const filename=path.join(host.directory,name+'.deidei-pack.json');await fs.copyFile(path.join(root,'docs/rules/packs',name+'.deidei-pack.json'),filename);
 await host.app.evaluate(({dialog},filename)=>{globalThis.__roomsMajorDialog=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filename]});},filename);
 try{
  const dialog=await openRules(host);await dialog.getByRole('button',{name:'导入规则包…',exact:true}).click();
  const radio=dialog.getByRole('radio',{name:name==='fast-opening'?'一拍起手':'必定变招（测试）',exact:true});await radio.waitFor();await radio.check();
  const apply=dialog.getByRole('button',{name:'应用本场规则',exact:true});await until(()=>apply.isEnabled(),'imported pack compiler preview');await apply.click();await dialog.waitFor({state:'detached'});await settled(host);
 }finally{await host.app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__roomsMajorDialog;delete globalThis.__roomsMajorDialog;});}
 const stored=JSON.parse(await fs.readFile(path.join(host.directory,'rules/rules-library.json'),'utf8'));
 assert.ok(stored.packs.some(p=>p.manifest.id===(name==='fast-opening'?'community.fast-opening':'test.certain-luck')));
 evidence.product_import_io_compiler_persistence='PASS';
 return (await state(host)).snapshot.view;
}
async function sizes(c){
 const dialog=await openRules(c);
 for(const [width,height] of [[1366,768],[1000,650],[1000,1000],[1366,768]]){
  await focus(c);await c.app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);await c.page.waitForTimeout(200);
  const size=await c.page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]}));
  const controls=await dialog.evaluate(node=>{const r=node.getBoundingClientRect();const regions=[...node.querySelectorAll('.rule-mode-list,.rule-edit')].map(n=>({client:n.clientHeight,scroll:n.scrollHeight,width:n.clientWidth,scrollWidth:n.scrollWidth}));return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,regions};});
  evidence.sizes.push({requested:[width,height],actual:size,controls});assert.ok(size.document[0]<=size.width&&size.document[1]<=size.height,'rule frame document overflow');assert.ok(controls.x>=0&&controls.y>=0&&controls.right<=size.width&&controls.bottom<=size.height,'rule dialog fits native content');
  await shot(c,`rules-native-${width}x${height}`);
 }
 await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'detached'});
 pass('native-rule-resize','1366×768 → 1000×650 → 1000×1000 → restored; actual DPR and internal scroll extents recorded');
}
async function leaveRoom(host,guest){await focus(host);await host.page.getByRole('button',{name:'退出房间',exact:true}).click();await host.page.getByRole('button',{name:'确认结束房间',exact:true}).click();await host.page.locator('.menu-layout').waitFor();await until(async()=>!(await state(guest)).snapshot||((await state(guest)).snapshot.view.phase==='closed'),'guest room closure');await focus(guest);await leaveOnlinePortal(guest.page);}
(async()=>{
 await fs.mkdir(output,{recursive:true});let host,guest,service,proxy;
 try{
  service=await address(['-u','-m','deidei_server','--port','0']);proxy=await address(['-u','game/integration/fault_proxy.py','--upstream',service.url]);
  host=await launch('规则房主','illustrated',service.url);guest=await launch('规则来宾','classic',proxy.url);await online(host);await online(guest);
  await focus(host);await host.page.getByRole('button',{name:'创建房间',exact:true}).click();await host.page.getByRole('radio',{name:'30 秒',exact:true}).check();await host.page.getByRole('button',{name:'创建并进入',exact:true}).click();await host.page.locator('.online-lobby').waitFor();
  const original=(await state(host)).snapshot;assert.equal(original.view.rules_snapshot.preset_id,'classic');
  await focus(guest);await guest.page.getByRole('button',{name:'加入房间',exact:true}).click();await guest.page.getByRole('textbox',{name:'房间号',exact:true}).fill(original.view.room_code);await guest.page.getByRole('button',{name:'加入房间',exact:true}).click();await guest.page.locator('.online-lobby').waitFor();
  const observer=await new Peer(service.url,'规则只读验收').open();peers.push(observer);await observer.ok('room.join',{room_code:original.view.room_code,password:null,role:'spectator'});await until(()=>observer.view,'observer real snapshot');
  await ready(host);await ready(guest);const old=(await state(host)).snapshot.view;
  assert.ok(old.members.filter(m=>m.role==='player').every(m=>m.ready&&m.ready_rules_hash===old.rules_snapshot.rules_hash));
  await applyRules(host,async dialog=>{await dialog.getByRole('radio',{name:/^火力/}).check();await dialog.getByRole('checkbox',{name:'云',exact:true}).uncheck();});
  await until(async()=>(await state(guest)).snapshot.view.rules_snapshot.preset_id==='firepower','guest new rule manifest');
  let current=(await state(host)).snapshot.view;assert.equal(current.rules_snapshot.parameters.charge_gain_dd6,'12');assert.equal(current.rules_snapshot.skill_flags.Cloud,false);assert.ok(current.members.every(m=>!m.ready&&m.ready_rules_hash===null));assert.notEqual(current.rules_snapshot.rules_hash,old.rules_snapshot.rules_hash);
  await until(async()=>await host.page.locator('.online-room-rules').getAttribute('data-rules-hash')===current.rules_snapshot.rules_hash,'rendered lobby rules hash current');
  const stale={room_id:original.room_id,expected_rules_revision:old.rules_revision,expected_rules_hash:old.rules_snapshot.rules_hash};
  for(const [method,c,payload] of [['ready',guest,{...stale,ready:true}],['start',host,stale]]){
   const reply=await c.page.evaluate(async({method,payload})=>window.desktop.online[method](payload),{method,payload});assert.equal(reply.ok,false);assert.equal(reply.error,'RULES_STALE');
  }
  const oldPeerReady=await observer.command('room.ready',{...stale,ready:true});assert.equal(oldPeerReady.ok,false);assert.equal(oldPeerReady.error.code,'RULES_STALE');
  const oldPeerStart=await observer.command('room.start',stale);assert.equal(oldPeerStart.ok,false);assert.equal(oldPeerStart.error.code,'NOT_HOST');
  // A separate owned room supplies a genuinely authorized server-side host start race.
  const raceHost=await new Peer(service.url,'旧规则房主负测').open(),raceGuest=await new Peer(service.url,'旧规则玩家负测').open();peers.push(raceHost,raceGuest);
  const classicRequest={schema_version:1,preset_id:'classic',skill_flags:{...old.rules_snapshot.skill_flags},preset_params:{},pack_refs:[]};
  const raceCreated=await raceHost.ok('room.create',{password:null,options:{turn_ms:30000,early_reveal:true,spectator_cap:0},rules_request:classicRequest,rule_pack_manifests:[]});await until(()=>raceHost.view,'owned host peer room snapshot');
  await raceGuest.ok('room.join',{room_code:raceCreated.room_code,password:null,role:'player'});await until(()=>raceGuest.view,'owned guest peer snapshot');
  const oldRace=raceHost.view.view,raceStale={room_id:raceCreated.room_id,expected_rules_revision:oldRace.rules_revision,expected_rules_hash:oldRace.rules_snapshot.rules_hash};
  await raceHost.ok('room.ready',{...raceStale,ready:true});await raceGuest.ok('room.ready',{...raceStale,ready:true});
  await raceHost.ok('room.set_rules',{...raceStale,rules_request:{...classicRequest,preset_id:'firepower',skill_flags:{...classicRequest.skill_flags,Cloud:false},preset_params:{firepower_charge_dd6:'12'}},rule_pack_manifests:[]});await until(()=>raceHost.view.view.rules_revision!==oldRace.rules_revision,'owned peer new rule revision');
  const raceReady=await raceHost.command('room.ready',{...raceStale,ready:true});assert.equal(raceReady.ok,false);assert.equal(raceReady.error.code,'RULES_STALE');
  const newRace=raceHost.view.view,raceCurrent={room_id:raceCreated.room_id,expected_rules_revision:newRace.rules_revision,expected_rules_hash:newRace.rules_snapshot.rules_hash};await raceHost.ok('room.ready',{...raceCurrent,ready:true});await raceGuest.ok('room.ready',{...raceCurrent,ready:true});
  const raceStart=await raceHost.command('room.start',raceStale);assert.equal(raceStart.ok,false);assert.equal(raceStart.error.code,'RULES_STALE');assert.equal(raceHost.view.view.phase,'lobby');await raceGuest.ok('room.leave',{room_id:raceCreated.room_id});await raceHost.ok('room.leave',{room_id:raceCreated.room_id});
  pass('rules-ready-race','GUI classic ready; GUI host firepower/cloud-off clears readiness; main preflight guest ready/host start reject RULES_STALE; separate two-player real Peer room confirms authorized host old ready/start RULES_STALE after both re-ready; original spectator start stays NOT_HOST');
  await sizes(host);await start(host,guest);
  for(const c of [host,guest]){assert.equal(await c.page.locator('.app').getAttribute('data-card-style'),c.style);assert.equal(await c.page.locator('.battle-table [data-entry]').count(),33);const src=await c.page.locator('[data-entry="Bi"] img').getAttribute('src');assert.ok(src.includes(c.style==='classic'?'moves-classic/Bi.png':'moves/Bi.png'));await shot(c,`firepower-table-${c.style}`);}
  const first=await round(host,guest,'Charge','Charge');const actions=first.core_resolution.ledger.actions;assert.ok(Object.values(actions).every(a=>a.entry_id==='Charge'&&a.spend.dd6==='0'));assert.ok(Object.values(first.core_resolution.ledger.post_turn_players).every(p=>p.dd6==='12'));
  const opt=(await state(host)).snapshot.view.self.options.find(o=>o.entry_id==='Bi');if(opt)assert.equal(opt.required.dd6,'6');
  await shot(host,'firepower-public-charge');await nextSelect(host,guest);assert.equal((await state(host)).snapshot.view.self.options.find(o=>o.entry_id==='Bi').required.dd6,'6');for(const c of [host,guest])await until(async()=>(await c.page.locator('.battle-resources .resource-dd strong').innerText())==='2','GUI firepower 2 DD');
  proxy.child.stdin.write(JSON.stringify({op:'disconnect'})+'\n');await until(async()=>(await state(guest)).status==='reconnecting','real guest transport break');await until(async()=>{const s=await state(guest);return s.status==='connected'&&s.snapshot?.view.rules_snapshot.rules_hash===current.rules_snapshot.rules_hash;},'real guest resume frozen rules',15000);await shot(guest,'firepower-real-resume');
  current=await finishAndLobby(host,guest);assert.equal(current.rules_snapshot.preset_id,'firepower');assert.equal(current.rules_snapshot.skill_flags.Cloud,false);pass('firepower-public-resume-lobby','two GUI Charge actions gain 12 dd6; ordinary Bi fee stays 6; real guest disconnect/resume retains frozen rules; terminal core result/UI returns lobby preserving rules');
  const libraryReply=await guest.page.evaluate(()=>window.desktop.rules.read());assert.ok(libraryReply.ok);assert.deepEqual(libraryReply.data.packs,[]);
  current=await importPack(host,'fast-opening');await until(async()=>(await state(guest)).snapshot.view.rules_snapshot.rules_hash===current.rules_snapshot.rules_hash,'guest pack snapshot with no install');assert.equal(current.rule_pack_manifests[0].id,'community.fast-opening');
  await focus(guest);await guest.page.getByRole('button',{name:/^选择规则：/}).click();const receivedRules=guest.page.getByRole('dialog',{name:'本场规则',exact:true});await receivedRules.waitFor();assert.ok((await receivedRules.innerText()).includes('一拍起手'));assert.equal(await receivedRules.getByRole('button',{name:'导入规则包…',exact:true}).count(),0);assert.equal(await receivedRules.getByRole('checkbox').count(),0);await shot(guest,'fast-opening-guest-readonly-rules');await receivedRules.getByRole('button',{name:'关闭详情',exact:true}).click();await receivedRules.waitFor({state:'detached'});
  await start(host,guest);let publicState=(await state(host)).snapshot.view.match.public_state;assert.ok(Object.values(publicState.players).every(p=>p.dd6==='6'));for(const c of [host,guest])assert.equal(await c.page.locator('.battle-resources .resource-dd strong').innerText(),'1');
  const fast=await round(host,guest,'Charge','Charge');assert.ok(Object.values(fast.core_resolution.ledger.post_turn_players).every(p=>p.dd6==='18'));await nextSelect(host,guest);for(const c of [host,guest])await until(async()=>(await c.page.locator('.battle-resources .resource-dd strong').innerText())==='3','GUI imported pack 3 DD');await shot(guest,'fast-opening-guest-no-install');await finishAndLobby(host,guest);pass('fast-opening-real-import','owned dialog fixture path → real product file read/compiler/atomic library persistence; guest no local pack, both core and GUI start 1 DD and Charge to 3 DD');
  current=await importPack(host,'certain-luck');await until(async()=>(await state(guest)).snapshot.view.rules_snapshot.rules_hash===current.rules_snapshot.rules_hash,'guest 100 percent luck pack');await start(host,guest);await round(host,guest,'Charge','Charge');await nextSelect(host,guest);
  const lucky=await round(host,guest,'Bi','Def');const me=(await state(host)).snapshot.view.self.player_id,a=lucky.core_resolution.ledger.actions[me];assert.equal(a.entry_id,'Bi');assert.equal(a.base_move,'Bi');assert.equal(a.actual_move,'Pragon');assert.equal(a.origin,'normal');assert.equal(a.spend.dd6,'6');assert.equal(a.upgrade.from,'Bi');assert.equal(a.upgrade.to,'Pragon');const revealedMove=host.page.locator('.self-seat .move-card.current strong');await until(async()=>(await revealedMove.innerText()).includes('幸运'),'GUI lucky declaration and upgraded label');const originalTitle=await revealedMove.getAttribute('title');assert.ok(originalTitle.includes('声明 Bi')&&originalTitle.includes('来源 normal')&&originalTitle.includes('"dd6":"6"'));evidence.luckyRenderedProvenance={name:await revealedMove.innerText(),title:originalTitle};await shot(host,'certain-luck-public-origin');
  assert.deepEqual((await guest.page.evaluate(()=>window.desktop.rules.read())).data.packs,[]);pass('certain-luck-real-attack','real GUI Bi → Pragon at 100 percent; ledger keeps Bi declaration/base/origin and original 6 dd6 fee; guest library stays uninstalled');
  await finishAndLobby(host,guest);await leaveRoom(host,guest);assert.equal(evidence.page_errors.length,0);pass('ordinary-main-complete','both GUI windows return main menu without renderer errors');
 }catch(error){evidence.failure={message:error.message,stack:error.stack};for(const c of [host,guest].filter(Boolean)){evidence.failure[c.name]={state:await state(c).catch(()=>null),body:await c.page.locator('body').innerText().catch(()=>null)};await shot(c,'failure-'+c.style).catch(()=>{});}throw error;}
 finally{
  evidence.cleanup={applications:[],children:[]};for(const p of peers)p.close();
  for(const app of apps){try{const cleanup=await closeApplication(app);evidence.cleanup.applications.push(cleanup);}catch(error){evidence.cleanup.applications.push({error:error.message});}}
  for(const child of children.reverse()){if(child.exitCode===null&&!child.signalCode)child.kill('SIGINT');try{await until(()=>child.exitCode!==null||child.signalCode,'owned child normal exit',5000);}catch(error){child.kill('SIGKILL');await until(()=>child.exitCode!==null||child.signalCode,'owned child forced exit',5000);evidence.cleanup.children.push({pid:child.pid,status:'FAIL',error:error.message,forced:true});continue;}evidence.cleanup.children.push({pid:child.pid,exitCode:child.exitCode,signal:child.signalCode,stderr:child.__stderr?.()});}
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(evidence,null,2));for(const directory of directories)await fs.rm(directory,{recursive:true,force:true});
  if(!evidence.failure){assert.ok(evidence.cleanup.applications.every(c=>c.normalExit&&!c.forced&&!c.errors.length),'owned ordinary mains must exit normally');assert.ok(evidence.cleanup.children.every(c=>!c.forced&&(c.exitCode===0||c.signal==='SIGINT')),'owned service/proxy must exit without forced termination');}
 }
 console.log('PASS rooms major '+evidence.checks.length+' checks '+output);
})().catch(error=>{console.error(error);process.exitCode=1;});
