// Issue #35 draft. Run from the task root; only owned loopback service, apps and synthetic peers.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process'),readline=require('node:readline');
const root=path.resolve(process.env.DEIDEI_SOURCE_ROOT||process.cwd()),desktop=path.join(root,'game/desktop');
const {_electron:electron}=require(path.join(desktop,'node_modules/playwright-core'));
const {Peer,until,sleep}=require(path.join(root,'game/integration/peer.cjs'));
const {enterHall,enterArena}=require(path.join(root,'game/integration/gui-actions.cjs'));
const {sourceInput,captureDiagnostics,segment,frameSummary,closeApplication}=require(path.join(desktop,'smoke-performance.cjs'));
const {checkBattle,armCommitFlight,finishCommitFlight}=require('./smoke-geometry.cjs');
const {bounded,readTrace}=require('./smoke-archive-performance.cjs');
const steadyOnly=process.argv.includes('--steady-only');assert.ok(process.argv.slice(2).every(a=>a==='--steady-only'),'unknown diagnostic argument');
const output=path.resolve(process.env.DEIDEI_ONLINE_DYNAMIC_OUTPUT||path.join(root,'.local-outputs/r04-t03-a/online-dynamic-'+Date.now()));
const python=process.env.DEIDEI_PYTHON||'python3',apps=[],peers=[],profiles=[];
const report={input:sourceInput(),source:'ordinary main / real owned CLI service / synthetic socket peers',geometrySource:'continuous native setContentSize; not physical dragging or cross-display evidence',checks:[],geometry:[],targets:[],business:[],segments:[],screenshots:[],errors:[],cleanup:[]};
let service,host,viewer,outputOwned=false;
const fail=e=>{report.status='FAIL';if(!report.failure)report.failure={message:e.message,stack:e.stack};else report.errors.push({stage:'secondary',message:e.message});process.exitCode=1;};
async function state(c){const r=await c.page.evaluate(()=>window.desktop.online.read());assert.ok(r.ok,r.error);assert.equal(r.data.source,'online');return r.data;}
async function geometry(c,label){
 const native=await c.app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {outer:w.getBounds(),content:w.getContentBounds(),fullscreen:w.isFullScreen(),focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized()};});
 const css=await c.page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,page:document.querySelector('.app')?.dataset.page,phase:document.querySelector('.battle-table')?.dataset.phase,ready:document.querySelector('.battle-table')?.dataset.ready,focus:document.hasFocus()}));
 report.geometry.push({label,app:c.name,pid:c.pid,at:Date.now(),native,css});return native.content;
}
async function leg(c,label,width,height){
 const from=await geometry(c,label+'-start');
 for(let step=1;step<=6;step++){
  await c.app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[Math.round(from.width+(width-from.width)*step/6),Math.round(from.height+(height-from.height)*step/6)]);
  await sleep(35);await geometry(c,label+'-'+step);
 }
 await c.page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,[width,height]);await geometry(c,label+'-settled');
}
async function route(c,label,atSmall=async()=>{},atLarge=async()=>{}){
 await c.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());await c.page.bringToFront();
 await leg(c,label+'-small',1000,650);await atSmall();await leg(c,label+'-large',1920,1080);await atLarge();await leg(c,label+'-return',1366,768);
}
async function targets(c,label,selectors){
 const viewport=await c.page.evaluate(()=>[innerWidth,innerHeight]);const values=await c.page.evaluate(selectors=>selectors.map(selector=>({selector,nodes:[...document.querySelectorAll(selector)].map(n=>{const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,s=getComputedStyle(n),hit=document.elementFromPoint(x,y);return {text:(n.getAttribute('aria-label')||n.textContent).trim().slice(0,60),box:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},visible:s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0,hit:!!hit&&(hit===n||n.contains(hit)),disabled:n.matches(':disabled'),busy:n.getAttribute('aria-busy'),selected:n.getAttribute('aria-pressed'),focusVisible:n.matches(':focus-visible')};})})),selectors);
 report.targets.push({label,app:c.name,values});
 for(const group of values){assert.ok(group.nodes.length,label+' missing '+group.selector);for(const n of group.nodes){assert.ok(n.box.width>0&&n.box.height>0&&n.visible,label+' invisible '+group.selector);assert.ok(n.hit,label+' occluded center '+group.selector+' '+n.text);assert.ok(n.box.x>=-1&&n.box.y>=-1&&n.box.right<=viewport[0]+1&&n.box.bottom<=viewport[1]+1,label+' clipped '+group.selector+' '+n.text);}}
 return values;
}
async function shot(c,name){await c.page.screenshot({path:path.join(output,name+'.png'),scale:'css'});report.screenshots.push({name,source:'real service / actual Electron',app:c.name});}
async function business(c,label,action){
 await c.page.evaluate(()=>{window.__onlineBusiness=[];window.__onlineBusinessObserver=new MutationObserver(()=>{for(const n of document.querySelectorAll('.online-deploy-submit,.battle-actions .primary,dialog .primary'))window.__onlineBusiness.push({pending:document.querySelector('.online')?.dataset.pending,disabled:n.matches(':disabled'),text:n.textContent.trim(),phase:document.querySelector('.battle-table')?.dataset.phase});});window.__onlineBusinessObserver.observe(document.body,{subtree:true,attributes:true,childList:true});});
 try{await action();}finally{const samples=await c.page.evaluate(()=>{window.__onlineBusinessObserver.disconnect();return window.__onlineBusiness;});report.business.push({label,app:c.name,source:'natural React/IPC business state; no attributes synthesized',samples});}
}
async function profiled(c,label,action){
 const record={label,before:await geometry(c,label+'-before'),errors:[]};(report.profiles||=[]).push(record);
 const cdp=await c.page.context().newCDPSession(c.page);let profiling=false,tracing=false,ended,first;
 try{await cdp.send('Profiler.enable');await cdp.send('Profiler.start');profiling=true;ended=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{recordMode:'recordContinuously',includedCategories:['devtools.timeline','v8','blink','cc','gpu']}});tracing=true;await action();}
 catch(e){first=e;record.failure={message:e.message,stack:e.stack};}
 finally{
  if(profiling)try{const {profile}=await bounded(()=>cdp.send('Profiler.stop'),3000,'stop online profile');record.cpuProfile=label+'-cpu-profile.json';await fs.writeFile(path.join(output,record.cpuProfile),JSON.stringify(profile));}catch(e){first??=e;record.errors.push({stage:'profile-stop/write',message:e.message});}
  if(tracing)try{await bounded(async()=>{await cdp.send('Tracing.end');const {stream}=await ended;const content=await readTrace(cdp,stream);record.trace=label+'-trace.json';await fs.writeFile(path.join(output,record.trace),content);},7000,'stop/write online trace');}catch(e){first??=e;record.errors.push({stage:'trace-stop/write',message:e.message});if(e.partialTrace)await fs.writeFile(path.join(output,label+'-trace.partial'),e.partialTrace).catch(error=>record.errors.push({stage:'partial-write',message:error.message}));}
  await bounded(()=>cdp.detach(),2000,'detach online CDP').catch(e=>{first??=e;record.errors.push({stage:'detach',message:e.message});});
  await geometry(c,label+'-after').catch(e=>{first??=e;record.errors.push({stage:'after-geometry',message:e.message});});
 }
 if(first)throw first;
}
async function launch(name,url){
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-online-dynamic-'));profiles.push(profile);
 const env={...process.env,DEIDEI_TEST_DATA_DIR:profile,DEIDEI_ROOM_URL:url,DEIDEI_PYTHON:python};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[path.join(desktop,'main.cjs')],env});const c={name,app,page:await app.firstWindow(),pid:app.process().pid};apps.push(c);
 c.page.setDefaultTimeout(12000);c.page.on('pageerror',e=>report.errors.push({app:name,message:e.message}));
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();});
 await enterHall(c.page,name);await c.page.locator('.app[data-page=menu]').waitFor();return c;
}
async function portal(c){await c.page.getByRole('button',{name:/^好友联机/}).click();await until(async()=>(await state(c)).status==='connected','real service connection');}
async function leaveRoom(c){
 if(!c)return;const s=await state(c);if(!s.snapshot)return;
 if(['selecting','revealing'].includes(s.snapshot.view.phase)){await enterArena(c.page);await c.page.getByRole('button',{name:'暂停',exact:true}).click();await c.page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();}
 else await c.page.getByRole('button',{name:'退出房间',exact:true}).click();
 await c.page.getByRole('button',{name:s.snapshot.view.host_id===s.snapshot.view.self.player_id?'确认结束房间':'确认退出房间',exact:true}).click();await c.page.locator('.menu-layout').waitFor();
}
async function select(c,entry){await c.page.bringToFront();await c.page.locator('.battle-table[data-phase="selecting"][data-ready="true"]').waitFor();await c.page.locator(`[data-entry="${entry}"] .card-pick`).click();assert.equal(await c.page.locator(`[data-entry="${entry}"] .card-pick`).getAttribute('aria-pressed'),'true');}
async function confirm(c){await business(c,'submit',async()=>{await c.page.getByRole('button',{name:'确认出招',exact:true}).click();await until(async()=>!(await state(c)).pending,'submit ACK');});assert.ok(await c.page.locator('.battle-actions .primary').isDisabled());}
async function submit(c,entry){await select(c,entry);await confirm(c);}
async function situation(c,label){await c.page.getByRole('button',{name:'局势',exact:true}).click();const dialog=c.page.getByRole('dialog',{name:'本局态势',exact:true});await dialog.waitFor();await sleep(260);await targets(c,label,['dialog[open] .dialog-close']);await c.page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});}
function summary(s){const v=s.snapshot.view;return {source:s.source,phase:v.phase,turn:v.match.turn_id,currentTurn:v.current_turn_ms,deadline:v.timer.deadline_at_ms,accepted:v.self.accepted_entry_id,submission:v.members.find(m=>m.player_id===v.self.player_id).submission_state,policy:v.policy.turn_ms,revision:v.policy_revision};}
async function timing(c){
 const before=summary(await state(c));assert.equal(before.phase,'selecting');assert.equal(before.currentTurn,30000);assert.equal(before.accepted,'Charge');
 await c.page.getByRole('button',{name:'调整时限',exact:true}).click();const dialog=c.page.getByRole('dialog',{name:'调整之后每拍时限',exact:true});await dialog.waitFor();await sleep(260);
 await targets(c,'timing-open',['dialog[open] select','dialog[open] .dialog-close','dialog[open] button.primary']);
 const opened=summary(await state(c));assert.equal(opened.phase,'selecting');await leg(c,'timing-dialog',1000,650);
 await dialog.getByRole('combobox',{name:'之后每拍时限',exact:true}).selectOption('20000');
 const applying=summary(await state(c));assert.equal(applying.phase,'selecting');
 await business(c,'timing-apply',async()=>{await dialog.getByRole('button',{name:'应用到之后每拍',exact:true}).click();await dialog.waitFor({state:'detached'});await until(async()=>(await state(c)).snapshot.view.policy.turn_ms===20000,'20s policy snapshot');});
 const after=summary(await state(c));assert.equal(after.phase,'selecting');
 for(const key of ['turn','currentTurn','deadline','accepted','submission'])assert.equal(after[key],before[key],key+' unchanged on current turn');
 assert.equal(after.policy,20000);assert.equal(BigInt(after.revision),BigInt(before.revision)+1n);report.checks.push({name:'selecting-time-limit',before,opened,applying,after,nativeChoice:'selectOption; OS popup/key acceptance is separate'});
}
async function reveal(c,roomPeers,n,full){
 await Promise.all(roomPeers.map(p=>p.submit('Charge')));await until(async()=>(await state(c)).snapshot.view.phase==='revealing','Charge public reveal');await c.page.locator('.battle-table[data-phase="revealed"]').waitFor();
 assert.equal(await c.page.locator('.arena-seat').count(),n);
 if(!steadyOnly){if(full)await route(c,'reveal-'+n,async()=>{await targets(c,'reveal-'+n,['.battle-pause','.battle-situation']);await sleep(500);await checkBattle(c.page,report,'reveal-min-'+n,{seats:n,names:(await state(c)).snapshot.view.match.roster_profiles.map(p=>p.nickname)});await c.page.getByRole('button',{name:'局势',exact:true}).click();},async()=>{await targets(c,'reveal-dialog-'+n,['dialog[open] .dialog-close']);await c.page.keyboard.press('Escape');await c.page.locator('dialog').waitFor({state:'detached'});});
 else{await leg(c,'crowded-reveal-'+n,1000,650);await sleep(500);await checkBattle(c.page,report,'reveal-min-'+n,{seats:n,names:(await state(c)).snapshot.view.match.roster_profiles.map(p=>p.nickname)});await situation(c,'crowded-'+n);await shot(c,'crowded-reveal-'+n);}
 }
 await until(async()=>(await state(c)).snapshot.view.phase==='selecting','next real select');await c.page.locator('.battle-table[data-phase="selecting"]').waitFor();
 const v=(await state(c)).snapshot.view;assert.equal(v.current_turn_ms,n===6&&!steadyOnly?20000:30000);report.checks.push({name:'next-real-select-'+n,currentTurn:v.current_turn_ms,turn:v.match.turn_id,roster:v.match.roster_profiles.length});
}
async function viewerRoute(c,n){
 await c.app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.show();w.focus();});
 assert.equal((await state(c)).snapshot.view.match.roster_profiles.length,6);assert.equal(await c.page.locator('.arena-seat').count(),6);assert.equal(await c.page.locator('.battle-operation').count(),0);assert.equal(await c.page.locator('.self-seat').count(),0);assert.ok(await c.page.getByRole('button',{name:'冻结',exact:true}).isDisabled());
 const before=(await state(c)).snapshot.view.self;await c.page.keyboard.press('9');await c.page.keyboard.press('Enter');assert.deepEqual((await state(c)).snapshot.view.self,before);
 await route(c,'six-spectator',async()=>{await targets(c,'spectator-pause',['.battle-pause','.battle-situation']);await c.page.getByRole('button',{name:'暂停',exact:true}).click();},async()=>{const dialog=c.page.getByRole('dialog',{name:'对局菜单',exact:true});await targets(c,'spectator-dialog',['dialog[open] .dialog-close','dialog[open] .primary']);await dialog.getByRole('button',{name:/继续游戏/}).click();await dialog.waitFor({state:'detached'});});
 await situation(c,'spectator-situation');report.checks.push({name:'six-spectator',roster:6,self:before,noSelectionControls:true});
}
async function result(c,roomPeers,n,full){
 await submit(c,'SelfBi');await Promise.all(roomPeers.map(p=>p.submit('SelfBi')));await until(async()=>(await state(c)).snapshot.view.phase==='result','real nobody-survives result',15000);
 if(full)await route(c,'result-return-'+n,async()=>{await c.page.locator('.online-result').waitFor();await targets(c,'result-'+n,['.result-actions button']);await shot(c,'result-'+n);await c.page.getByRole('button',{name:'局势回顾 REVIEW',exact:true}).click();},async()=>{await c.page.keyboard.press('Escape');await c.page.locator('dialog').waitFor({state:'detached'});await c.page.getByRole('button',{name:/准备下一局/}).click();});
 else{await c.page.locator('.online-result').waitFor();await c.page.getByRole('button',{name:/准备下一局/}).click();}
 await c.page.locator('.online-lobby').waitFor();assert.equal((await state(c)).snapshot.view.phase,'lobby');report.checks.push({name:'result-return-'+n,pid:c.pid});
}
async function closePeer(p){p.close();await until(()=>p.ws.readyState===3,'owned peer close',2500);}
function descendants(pid){const rows=execFileSync('ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').map(s=>s.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m[1]),ppid:Number(m[2]),command:m[3]})),parents=new Set([pid]);for(let changed=true;changed;){changed=false;for(const r of rows)if(parents.has(r.ppid)&&!parents.has(r.pid)){parents.add(r.pid);changed=true;}}return rows.filter(r=>r.pid!==pid&&parents.has(r.pid));}
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
async function cleanupApp(c){
 const owned=descendants(c.pid),clean=await closeApplication(c.app);c.closed=true;report.cleanup.push({kind:'app',name:c.name,...clean});if(!clean.normalExit||clean.forced)fail(new Error(c.name+' ordinary close failed'));
 await sleep(500);for(const child of owned)if(alive(child.pid))try{const current=execFileSync('ps',['-p',String(child.pid),'-o','comm='],{encoding:'utf8'}).trim();assert.equal(current,child.command.trim(),'owned descendant PID changed');process.kill(child.pid,'SIGKILL');report.cleanup.push({kind:'descendant',pid:child.pid,forced:true});await until(()=>!alive(child.pid),'owned descendant forced exit',2000);fail(new Error('owned app descendant needed force'));}catch(e){fail(e);}
}
(async()=>{
 try{
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});outputOwned=true;
  report.mode=steadyOnly?'fixed original native window, no viewer/resize':'full dynamic route';report.input.mainProcess='one owned host reused for all N=[6,3,4,5,2]; final two-player sample is reused-process investigation';
  report.displays=[];
  const env={...process.env,PYTHONPATH:[path.join(root,'game/core'),path.join(root,'game/server')].join(path.delimiter)};delete env.ELECTRON_RUN_AS_NODE;
  service=spawn(python,['-u','-m','deidei_server','--port','0'],{cwd:root,env,stdio:['ignore','pipe','pipe']});report.servicePid=service.pid;const lines=[],stderr=[];readline.createInterface({input:service.stdout}).on('line',s=>lines.push(s));service.stderr.on('data',s=>stderr.push(String(s)));report.serviceStderr=stderr;
  const address=await until(()=>lines.find(s=>s.startsWith('Listening: ')),'owned CLI Listening',10000),url=address.slice(11);assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+\/rooms-v1$/);
  host=await launch('动态房主',url);report.hostPid=host.pid;report.displays=await host.app.evaluate(({screen})=>screen.getAllDisplays().map(d=>({label:d.label,bounds:d.bounds,workArea:d.workArea,scaleFactor:d.scaleFactor,internal:d.internal})));
  for(const n of [6,3,4,5,2]){
   await portal(host);
   if(n===6&&!steadyOnly)await route(host,'online-front',async()=>{await targets(host,'front-small',['.online-portal-nav button','.online-front-actions button']);await host.page.getByRole('button',{name:'加入房间',exact:true}).click();},async()=>{await host.page.getByRole('button',{name:'返回联机前厅',exact:true}).click();});
   await host.page.getByRole('button',{name:'创建房间',exact:true}).click();await host.page.getByRole('textbox',{name:'房间密码',exact:true}).fill('synthetic-'+n);const slider=host.page.getByRole('slider',{name:'每拍时间',exact:true});await slider.focus();await host.page.keyboard.press('End');assert.equal(await slider.inputValue(),'30000');
   if(n===6&&!steadyOnly){await route(host,'online-create',async()=>{await targets(host,'create-small',['.online-portal-nav button','.online-deploy input:not([type=checkbox])','.online-switch','.online-deploy button']);await host.page.getByRole('slider',{name:'观众容量',exact:true}).focus();await host.page.keyboard.press('End');},async()=>{await host.page.locator('.online-switch input').uncheck();await host.page.locator('.online-switch input').check();});assert.equal(await host.page.getByRole('textbox',{name:'房间密码',exact:true}).inputValue(),'synthetic-'+n);}
   await business(host,'create-'+n,async()=>{await host.page.getByRole('button',{name:'创建并进入',exact:true}).click();await host.page.locator('.online-lobby').waitFor();});
   const created=(await state(host)).snapshot,rid=created.room_id,code=created.view.room_code,roomPeers=[];
   for(let i=1;i<n;i++){const p=await new Peer(url,'动态同学'+i).open();peers.push(p);roomPeers.push(p);await p.ok('room.join',{room_code:code,password:'synthetic-'+n,role:'player'});}
   if(n===6&&!steadyOnly){
    viewer=await launch('动态观众',url);await portal(viewer);await viewer.page.getByRole('button',{name:'加入房间',exact:true}).click();await viewer.page.getByRole('textbox',{name:'房间号',exact:true}).fill(code);await viewer.page.getByRole('textbox',{name:'房间密码',exact:true}).fill('synthetic-'+n);await viewer.page.getByRole('radio',{name:'观战',exact:true}).check();
    await route(viewer,'online-join',async()=>{await targets(viewer,'join-small',['.online-portal-nav button','.online-deploy input:not([type=radio])','.online-role label','.online-deploy button']);await viewer.page.getByRole('radio',{name:'参战',exact:true}).check();},async()=>{await viewer.page.getByRole('radio',{name:'观战',exact:true}).check();});assert.equal(await viewer.page.getByRole('textbox',{name:'房间号',exact:true}).inputValue(),code);assert.equal(await viewer.page.getByRole('textbox',{name:'房间密码',exact:true}).inputValue(),'synthetic-'+n);
    await viewer.page.getByRole('button',{name:'加入房间',exact:true}).click();await viewer.page.locator('.online-lobby').waitFor();assert.equal((await state(viewer)).snapshot.view.self.role,'spectator');
   }
   await until(async()=>(await state(host)).snapshot.view.members.filter(m=>m.role==='player').length===n,'real roster '+n);assert.ok(await host.page.getByRole('button',{name:'开始对局',exact:true}).isDisabled());
   if(n===6&&!steadyOnly)await route(host,'online-lobby',async()=>{await targets(host,'lobby-small',['.online-room-nav button','.online-room-actions button','.online-room-tools button']);await host.page.getByRole('button',{name:'准备',exact:true}).click();},async()=>{await host.page.getByRole('button',{name:'复制房号',exact:true}).click();});else await host.page.getByRole('button',{name:'准备',exact:true}).click();
   await Promise.all(roomPeers.map(p=>p.ok('room.ready',{room_id:rid,ready:true})));await host.page.getByRole('button',{name:'开始对局',exact:true}).click();await until(async()=>(await state(host)).snapshot.view.phase==='selecting','start selecting');
   if((n===6||n===2)&&!steadyOnly){await leg(host,'intro-'+n,1000,650);await enterArena(host.page);await leg(host,'intro-return-'+n,1366,768);}else await enterArena(host.page);
   const match=(await state(host)).snapshot.view.match.match_id;assert.equal((await state(host)).snapshot.view.match.roster_profiles.length,n);
   if(n===6&&!steadyOnly){await enterArena(viewer.page);await viewer.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());}
   if((n===6||n===2)&&!steadyOnly)await route(host,'selecting-'+n,async()=>{await targets(host,'selecting-small-'+n,['.battle-hud-button','.battle-cards .card-pick','.battle-actions button']);await checkBattle(host.page,report,'33-min-'+n,{cards:33});await select(host,'Charge');await shot(host,'selecting-'+n);},async()=>{assert.equal(await host.page.locator('[data-entry="Charge"] .card-pick').getAttribute('aria-pressed'),'true');await checkBattle(host.page,report,'33-large-'+n,{cards:33});await armCommitFlight(host.page);await confirm(host);});else await submit(host,'Charge');
   if((n===6||n===2)&&!steadyOnly)await finishCommitFlight(host.page,report,'resized-live-flight-'+n);assert.equal((await state(host)).snapshot.view.match.match_id,match);
   if(n===6&&!steadyOnly){await timing(host);await viewerRoute(viewer,n);await viewer.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());}
   if(n===2){
    await host.page.evaluate(()=>{const s=window.__reusedReveal={active:true,frames:[]};function frame(t){if(!s.active)return;s.frames.push({t,phase:document.querySelector('.battle-table')?.dataset.phase,focus:document.hasFocus(),visibility:document.visibilityState,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio});requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    try{await segment(host.page,()=>host.app.evaluate(({app})=>app.getAppMetrics()),report.segments,'two-player-reused-host',()=>reveal(host,roomPeers,n,true));}
    finally{const sample=await host.page.evaluate(()=>{window.__reusedReveal.active=false;return window.__reusedReveal.frames;});report.reusedTwoPlayer={pid:host.pid,priorPlayerCounts:[6,3,4,5],source:'same ordinary main process reused; no claim that historical stall is fixed',phaseFrames:sample,summary:frameSummary(sample.filter(f=>f.phase==='revealed').map(f=>f.t))};}
   }else await reveal(host,roomPeers,n,n===6);
   if(n===2){
    await submit(host,'Charge');await host.page.evaluate(()=>{const s=window.__steadyReveal={active:true,frames:[]};function frame(t){if(!s.active)return;s.frames.push({t,phase:document.querySelector('.battle-table')?.dataset.phase,focus:document.hasFocus(),visibility:document.visibilityState,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio});requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    try{await profiled(host,'two-player-reused-steady',()=>segment(host.page,()=>host.app.evaluate(({app})=>app.getAppMetrics()),report.segments,'two-player-reused-steady',async()=>{await Promise.all(roomPeers.map(p=>p.submit('Charge')));await until(async()=>(await state(host)).snapshot.view.phase==='revealing','steady real reveal');await host.page.locator('.battle-table[data-phase="revealed"]').waitFor();await checkBattle(host.page,report,'two-player-two-history',{seats:2,minHistory:2,names:(await state(host)).snapshot.view.match.roster_profiles.map(p=>p.nickname)});await until(async()=>(await state(host)).snapshot.view.phase==='selecting','steady next select');await sleep(850);}));}
    finally{const frames=await host.page.evaluate(()=>{window.__steadyReveal.active=false;return window.__steadyReveal.frames;});report.reusedTwoPlayer.steady={viewport:await host.page.evaluate(()=>[innerWidth,innerHeight]),frames,summary:frameSummary(frames.filter(f=>f.phase==='revealed').map(f=>f.t)),condition:steadyOnly?'same host after 6/3/4/5 and 2; original fixed native window':'same host after 6/3/4/5 and dynamic 2; no resizing in this reveal'};}
   }
   await result(host,roomPeers,n,(n===6||n===2)&&!steadyOnly);
   if(viewer){await viewer.app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.focus();});await viewer.page.locator('.online-lobby').waitFor();await leaveRoom(viewer);await cleanupApp(viewer);viewer=null;}
   console.log('completed real room '+n);await leaveRoom(host);for(const p of roomPeers)await closePeer(p);report.checks.push({name:'room-complete-'+n,pid:host.pid,match});
  }
  assert.ok(report.business.some(b=>b.samples.some(s=>s.pending==='true'&&s.disabled)),'no natural pending/disabled business sample captured');assert.deepEqual(report.errors,[]);assert.equal(report.failure,undefined,'earlier cleanup failure must not be replaced by PASS');report.status='PASS';
 }catch(e){fail(e);if(host&&!host.page.isClosed()){report.diagnostics=await captureDiagnostics(host.page).catch(e=>({error:e.message}));await shot(host,'failure').catch(e=>report.errors.push({stage:'failure-screenshot',message:e.message}));}}
 finally{
  if(outputOwned)await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n').catch(fail);
  for(const p of peers)if(p.ws.readyState!==3)try{await closePeer(p);}catch(e){fail(e);report.cleanup.push({kind:'peer',normalExit:false,message:e.message});}
  for(const c of apps)if(!c.closed)try{await cleanupApp(c);}catch(e){fail(e);}
  if(service){const clean={kind:'service',pid:service.pid,forced:false};try{if(service.exitCode===null&&!service.signalCode)service.kill('SIGINT');await until(()=>service.exitCode!==null||service.signalCode,'owned service normal stop',5000);assert.ok(service.exitCode===0||service.signalCode==='SIGINT','unexpected service exit');}catch(e){clean.error=e.message;if(service.exitCode===null&&!service.signalCode){clean.forced=true;service.kill('SIGKILL');await until(()=>service.exitCode!==null||service.signalCode,'forced service exit',2500).catch(fail);}fail(e);}Object.assign(clean,{exitCode:service.exitCode,signal:service.signalCode});report.cleanup.push(clean);}
  for(const profile of profiles)try{await fs.rm(profile,{recursive:true,force:true});report.cleanup.push({kind:'profile',removed:true});}catch(e){fail(e);}
  if(outputOwned)await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n').catch(fail);
  console.log(JSON.stringify({status:report.status,output,failure:report.failure,checks:report.checks.length,segments:report.segments.map(({name,p95,max,over50ms})=>({name,p95,max,over50ms}))}));
 }
})().catch(fail);
