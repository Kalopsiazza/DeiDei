// Welcome/reload diagnosis plus a bounded observation window for native CUA actions.
// From the task root: node game/desktop/smoke-welcome-native.cjs [--native-hold|--native-only]
// Native hold observes real CUA actions; it never calls setBounds/setFullScreen or CDP size overrides.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),fsSync=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRequire}=require('node:module');
const {execFile,execFileSync}=require('node:child_process');
const {promisify}=require('node:util'),{createHash}=require('node:crypto');
const root=path.resolve(process.env.DEIDEI_SOURCE_ROOT||path.resolve(__dirname,'../..'));
const desktop=path.join(root,'game/desktop'),fromDesktop=createRequire(path.join(desktop,'package.json'));
const {_electron:electron}=fromDesktop('playwright-core');
const {sourceInput,captureDiagnostics,frameSummary,segment,closeApplication}=fromDesktop('./smoke-performance.cjs');
const nativeOnly=process.argv.includes('--native-only'),nativeHold=nativeOnly||process.argv.includes('--native-hold');
assert.ok(process.argv.slice(2).every(arg=>['--native-hold','--native-only'].includes(arg)),'Only --native-hold is supported');
const details=e=>({name:e.name,message:e.message,stack:e.stack});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(action,ms,label){let timer;try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms);})]);}finally{clearTimeout(timer);}}
function beginTrace(){
 if(window.__welcomeTrace)window.__welcomeTrace.active=false;
 const trace=window.__welcomeTrace={documentId:`${Date.now()}-${Math.random()}`,startedAt:new Date().toISOString(),active:true,frames:[],states:[],lastKey:null};
 function frame(t){
  if(!trace.active)return;trace.frames.push(t);
  const welcome=document.querySelector('.welcome-scene'),app=document.querySelector('.app'),video=document.querySelector('.welcome-film');
  const key=[app?.dataset.page,welcome?.dataset.stage,welcome?.dataset.ready,document.hasFocus(),document.activeElement?.className].join('|');
  if(key!==trace.lastKey){trace.lastKey=key;trace.states.push({t,route:app?.dataset.page,stage:welcome?.dataset.stage,ready:welcome?.dataset.ready,focus:{document:document.hasFocus(),tag:document.activeElement?.tagName,className:document.activeElement?.className,text:document.activeElement?.textContent?.trim().slice(0,80)},viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,media:video?{currentTime:video.currentTime,paused:video.paused,ended:video.ended,width:video.videoWidth,height:video.videoHeight,error:video.error?.message}:null});}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
function collectChildren(pid){
 const rows=execFileSync('ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8',timeout:2000}).split('\n').map(s=>s.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m[1]),ppid:Number(m[2]),command:m[3].trim()}));
 const parents=new Set([pid]),children=[];
 for(let changed=true;changed;){changed=false;for(const row of rows)if(parents.has(row.ppid)&&!parents.has(row.pid)){parents.add(row.pid);children.push(row);changed=true;}}
 return children;
}
function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function verifyChildren(children){
 for(let end=Date.now()+1500;children.some(c=>alive(c.pid))&&Date.now()<end;)await sleep(25);
 const records=[];
 for(const child of children){
  const record={...child,forced:false};
  if(alive(child.pid))try{
   const command=execFileSync('ps',['-p',String(child.pid),'-o','comm='],{encoding:'utf8',timeout:2000}).trim();
   if(command===child.command){process.kill(child.pid,'SIGKILL');record.forced=true;}else record.error='PID now belongs to a different command; not terminated';
  }catch(e){if(alive(child.pid))record.error=e.message;}
  records.push(record);
 }
 for(let end=Date.now()+1500;records.some(c=>alive(c.pid))&&Date.now()<end;)await sleep(25);
 for(const record of records)record.alive=alive(record.pid);
 return records;
}
(async()=>{
 const output=path.resolve(process.env.DEIDEI_WELCOME_NATIVE_OUTPUT||path.join(os.tmpdir(),`deidei-welcome-native-${Date.now()}`));
 await fs.mkdir(output,{recursive:false});
 const result={input:sourceInput(),driver:{path:__filename,sha256:createHash('sha256').update(fsSync.readFileSync(__filename)).digest('hex')},entry:nativeOnly?'main.cjs':'tests-online/smoke-main.cjs + DEIDEI_DEV_RELOAD=1',transport:nativeOnly?'ordinary offline main; no room URL':'scripted test socket; no real online acceptance',nativeManipulation:'Only external CUA actions during --native-hold can establish physical dragging/fullscreen evidence',segments:[],documents:[],checkpoints:[],assetEvents:[],rendererErrors:[],consoleErrors:[],nativeEvents:[],nativeSnapshots:[],checks:0};
 let app,page,directory,interrupted,nativeCursor=0,recording=false,recorderChildren=[];
 const onSignal=signal=>{interrupted=signal;};
 process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
 const fail=(e,stage)=>{const failure={stage,...details(e)};if(!result.failure)result.failure=failure;else(result.secondaryFailures??=[]).push(failure);process.exitCode=1;};
 const check=(condition,message)=>{assert.ok(condition,message);result.checks++;};
 const persist=()=>fs.writeFile(path.join(output,'welcome-native.json'),JSON.stringify(result,null,2)+'\n');
 const measure=(name,action)=>segment(page,()=>app.evaluate(({app})=>app.getAppMetrics()),result.segments,name,action);
 async function syncNative(label){
  const state=await bounded(()=>app.evaluate(({BrowserWindow,screen},cursor)=>{
   const window=BrowserWindow.getAllWindows()[0];
   const snapshot=()=>!window||window.isDestroyed()?{destroyed:true}:{id:window.id,bounds:window.getBounds(),contentBounds:window.getContentBounds(),fullscreen:window.isFullScreen(),focused:window.isFocused(),visible:window.isVisible(),minimized:window.isMinimized(),maximized:window.isMaximized(),display:screen.getDisplayMatching(window.getBounds()),focusedWindowId:BrowserWindow.getFocusedWindow()?.id??null};
   const buffer=global.__r04WelcomeNativeEvents||[];
   return {at:new Date().toISOString(),pid:process.pid,state:snapshot(),events:buffer.slice(cursor),nextCursor:buffer.length};
  },nativeCursor),2000,'Native diagnostics');
  result.nativeEvents.push(...state.events);nativeCursor=state.nextCursor;
  delete state.events;delete state.nextCursor;result.nativeSnapshots.push({label,...state});return state;
 }
 async function checkpoint(label,screenshot=true){
  const state=await captureDiagnostics(page);
  const extra=await page.evaluate(()=>({documentId:window.__welcomeTrace?.documentId,focus:{document:document.hasFocus(),tag:document.activeElement?.tagName,className:document.activeElement?.className,text:document.activeElement?.textContent?.trim().slice(0,80)},resources:performance.getEntriesByType('resource').filter(e=>e.name.startsWith('app://desktop/')).map(e=>({name:e.name,initiatorType:e.initiatorType,startTime:e.startTime,duration:e.duration,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize}))}));
  result.checkpoints.push({label,...state,...extra});await syncNative(label);
  if(screenshot)await page.screenshot({path:path.join(output,`${label}.png`),timeout:8000});
 }
 async function drainDocument(label){
  const trace=await page.evaluate(()=>{const trace=window.__welcomeTrace;if(trace)trace.active=false;return trace||null;});
  if(trace&&!result.documents.some(document=>document.documentId===trace.documentId)){const{frames,...summary}=frameSummary(trace.frames);result.documents.push({label,...trace,frameCount:frames,...summary});}
 }
 async function readProfile(){const reply=await page.evaluate(()=>window.desktop.profile.read());check(reply.ok,'profile.read succeeds');return reply.data;}
 async function skipOpening(label){
  await page.locator('.welcome-scene[data-stage=opening]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.welcome-film')?.currentTime>.3);
  await checkpoint(`${label}-opening`);
  await page.getByRole('button',{name:'跳过开场',exact:true}).click({noWaitAfter:true});
  await page.locator('.welcome-scene[data-stage=title]').waitFor();
  check(await page.locator('.welcome-film').evaluate(v=>v.paused),'skip pauses the actual opening video');
  await page.waitForFunction(()=>document.activeElement?.matches('.welcome-title .welcome-action'));
  await checkpoint(`${label}-title`);
 }
 async function replayNatural(label){
  await page.getByRole('button',{name:'重播开场',exact:true}).click({noWaitAfter:true});
  await page.locator('.welcome-scene[data-stage=opening]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.welcome-film')?.currentTime>.3);
  check(await page.locator('.welcome-film').evaluate(v=>v.videoWidth===1920&&v.videoHeight===1080&&!v.error&&!v.paused),'real 1920x1080 opening advances after replay');
  await page.locator('.welcome-scene[data-stage=title]').waitFor({timeout:20000});
  check(await page.locator('.welcome-film').evaluate(v=>v.ended&&v.paused),'natural replay end reaches title');
  await page.waitForFunction(()=>document.activeElement?.matches('.welcome-title .welcome-action'));
  await checkpoint(`${label}-natural-title`);
 }
 async function enterMenu(buttonName,label){
  await page.getByRole('button',{name:buttonName,exact:true}).click({noWaitAfter:true});
  await page.locator('.welcome-scene[data-stage=entering]').waitFor();
  check(await page.locator('.welcome-scene').evaluate(n=>n.inert),'welcome is inert during docking');
  check(await page.locator('.menu-layout').evaluate(n=>n.inert),'menu is inert during docking');
  await page.waitForTimeout(400);await checkpoint(`${label}-docking`);
  await page.locator('.app[data-page=menu]').waitFor();
  await page.waitForFunction(()=>document.activeElement===document.querySelector('.menu-option'));
  await checkpoint(`${label}-menu`);
 }
 try{
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-welcome-native-profile-'));
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory,DEIDEI_DEV_RELOAD:'1'};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;
  const started=Date.now();app=await electron.launch({args:[path.join(desktop,nativeOnly?'main.cjs':'tests-online/smoke-main.cjs')],env,timeout:20000});page=await app.firstWindow();const mainPid=app.process().pid;result.nativeOnly=nativeOnly;
  if(nativeOnly){result.videoStartedAt=new Date().toISOString();await page.screencast.start({path:path.join(output,'native-content.webm'),size:{width:1920,height:1080}});recording=true;recorderChildren=collectChildren(process.pid).filter(c=>/ffmpeg/i.test(c.command));}
  if(nativeOnly)app.process().stderr.on('data',bytes=>{result.mainStderr=((result.mainStderr||'')+String(bytes)).slice(-6000);});
  page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(15000);
  app.on('console',message=>{const text=message.text();if(text.startsWith('NATIVE_CLOSE '))(result.closeLifecycle??=[]).push({at:new Date().toISOString(),text});});
  if(nativeOnly)await app.evaluate(({app,BrowserWindow})=>{for(const event of ['before-quit','will-quit','quit'])app.on(event,()=>console.log('NATIVE_CLOSE '+event));BrowserWindow.getAllWindows()[0].on('close',()=>console.log('NATIVE_CLOSE window-close'));});
  page.on('pageerror',e=>result.rendererErrors.push(details(e)));
  page.on('console',message=>{if(message.type()==='error')result.consoleErrors.push({text:message.text(),location:message.location()});});
  const assetName=url=>{try{const u=new URL(url);return u.protocol==='app:'&&u.host==='desktop'?u.pathname:null;}catch{return null;}};
  page.on('request',request=>{const asset=assetName(request.url());if(asset)result.assetEvents.push({kind:'request',at:new Date().toISOString(),asset,method:request.method(),resourceType:request.resourceType()});});
  page.on('response',response=>{const asset=assetName(response.url());if(asset)result.assetEvents.push({kind:'response',at:new Date().toISOString(),asset,status:response.status()});});
  page.on('requestfailed',request=>{const asset=assetName(request.url());if(asset)result.assetEvents.push({kind:'failed',at:new Date().toISOString(),asset,error:request.failure()?.errorText});});
  result.assetCollection='Playwright events from firstWindow attachment, plus initial and later document resource timing; early launch events may precede attachment';
  await app.evaluate(({BrowserWindow,screen})=>{
   const window=BrowserWindow.getAllWindows()[0];global.__r04WelcomeNativeEvents=[];
   const record=type=>{if(window.isDestroyed())return;global.__r04WelcomeNativeEvents.push({type,at:new Date().toISOString(),bounds:window.getBounds(),contentBounds:window.getContentBounds(),fullscreen:window.isFullScreen(),focused:window.isFocused(),displayId:screen.getDisplayMatching(window.getBounds()).id});};
   for(const event of ['resize','move','enter-full-screen','leave-full-screen','focus','blur','show','hide','minimize','restore','maximize','unmaximize'])window.on(event,()=>record(event));record('attached');
  });
  result.electron=await app.evaluate(({screen})=>({pid:process.pid,versions:process.versions,displays:screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds,workArea:d.workArea,scaleFactor:d.scaleFactor,displayFrequency:d.displayFrequency}))}));
  await page.addInitScript(beginTrace);await page.evaluate(beginTrace);
  result.initialMotion=await page.evaluate(()=>({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio}));
  if(nativeOnly){await page.locator('.welcome-scene[data-stage=title]').waitFor({timeout:20000});check(await page.locator('.welcome-film').evaluate(v=>v.ended&&v.paused&&v.videoWidth===1920&&v.videoHeight===1080&&!v.error),'native entry naturally completes decoded opening');await checkpoint('native-opening-ended');await require('../integration/gui-actions.cjs').enterHall(page,'原生动态验收');await page.locator('.app[data-page=menu]').waitFor();}else{
  check(!result.initialMotion.reduced,'ordinary welcome flow requires native no-preference motion; initial reduced mode is recorded, not silently remounted');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('.welcome-scene[data-stage=opening]').waitFor();result.firstOperableMs=Date.now()-started;
  check((await readProfile())===null,'isolated profile starts empty');
  await measure('fresh-opening-skip',()=>skipOpening('fresh'));
  await measure('fresh-replay-natural',()=>replayNatural('fresh-replay'));
  await measure('fresh-name-flip-save',async()=>{
   await page.getByRole('button',{name:'进入牌厅',exact:true}).click({noWaitAfter:true});
   await page.locator('.welcome-scene[data-stage=flip]').waitFor();
   await page.locator('.welcome-scene[data-stage=name]').waitFor();
   await page.waitForFunction(()=>document.activeElement?.matches('input[aria-label="昵称"]'));
   await page.getByRole('textbox',{name:'昵称',exact:true}).fill('欢迎原生验收');
   await page.getByRole('button',{name:'确认名字',exact:true}).click({noWaitAfter:true});
   await page.getByRole('heading',{name:'你的牌，已就位。',exact:true}).waitFor();
   await checkpoint('fresh-profile-ready');
  });
  await measure('fresh-profile-menu',()=>enterMenu('进入主菜单','fresh-profile'));
  const profile=await readProfile();check(profile.nickname==='欢迎原生验收','first-entry action persists the chosen local identity');
  await measure('settings-save-return',async()=>{
   await page.getByRole('button',{name:'设置 S',exact:true}).click();
   await page.locator('.app[data-page=settings]').waitFor();
   await page.getByRole('slider',{name:'音乐音量',exact:true}).fill('25');
   await checkpoint('settings');
   await page.getByRole('button',{name:'保存并关闭',exact:true}).click({noWaitAfter:true});
   await page.locator('.app[data-page=menu]').waitFor();
  });
  const saved=await readProfile();check(saved.settings.music===25&&saved.nickname===profile.nickname&&saved.avatar_id===profile.avatar_id,'settings save returns with identity intact');
  await measure('p01-open-skip-replay',async()=>{
   await page.getByRole('button',{name:'开发预览',exact:true}).click();
   await page.getByRole('button',{name:'P01 · 首次进入／欢迎建档',exact:true}).click({noWaitAfter:true});
   await skipOpening('p01');await replayNatural('p01-replay');
  });
  await measure('p01-name-preview',async()=>{
   await page.getByRole('button',{name:'进入牌厅',exact:true}).click({noWaitAfter:true});
   await page.locator('.welcome-scene[data-stage=name]').waitFor();
   await page.getByRole('textbox',{name:'昵称',exact:true}).fill('仅预览，不写档案');
   await page.getByRole('button',{name:'确认名字 · 仅预览',exact:true}).click({noWaitAfter:true});
   await page.getByRole('heading',{name:'你的牌，已就位。',exact:true}).waitFor();
   assert.deepEqual(await readProfile(),saved);result.checks++;
  });
  await measure('p01-return-menu',()=>enterMenu('进入主菜单','p01'));
  assert.deepEqual(await readProfile(),saved);result.checks++;
  await drainDocument('before-watcher-reload');
  const oldDocumentId=await page.evaluate(()=>window.__welcomeTrace.documentId),oldPid=app.process().pid;
  result.reload={before:sourceInput(),oldDocumentId,oldPid,trigger:'successful node build.cjs, then write build/ui/.reload; ordinary main fs.watch + reloadIgnoringCache'};
  const buildStarted=Date.now();
  const build=await promisify(execFile)(process.execPath,[path.join(desktop,'build.cjs')],{cwd:desktop,encoding:'utf8',timeout:80000,maxBuffer:1024*1024});
  result.reload.build={durationMs:Date.now()-buildStarted,stdout:build.stdout,stderr:build.stderr};
  let reloadError;const loaded=page.waitForEvent('load',{timeout:15000}).catch(e=>{reloadError=e;});
  await fs.writeFile(path.join(desktop,'build/ui/.reload'),`welcome-native:${Date.now()}\n`);await loaded;if(reloadError)throw reloadError;
  await page.waitForFunction(previous=>window.__welcomeTrace?.documentId&&window.__welcomeTrace.documentId!==previous,oldDocumentId);
  result.reload.newDocumentId=await page.evaluate(()=>window.__welcomeTrace.documentId);result.reload.newPid=app.process().pid;
  result.reload.after=sourceInput();result.reload.after.mainProcess='same main process; renderer reloadIgnoringCache via .reload watcher';
  check(result.reload.newPid===oldPid,'watcher reload preserves the launched main process');
  check(result.reload.before.sha===result.reload.after.sha,'build/reload stays at the same Git head');
  await measure('returning-opening-skip',()=>skipOpening('returning'));
  await measure('same-process-returning-replay-natural',()=>replayNatural('returning-replay'));
  check(await page.getByRole('button',{name:`以${saved.nickname}身份进入牌厅`,exact:true}).count()===1,'watcher reload reads saved identity for returning entrance');
  await measure('same-process-returning-menu',()=>enterMenu(`以${saved.nickname}身份进入牌厅`,'returning'));
  assert.deepEqual(await readProfile(),saved);result.checks++;
  await drainDocument('after-watcher-reload');
  }
  if(nativeHold){
   const start=Date.now(),deadline=start+600000;
   result.nativeHold={startedAt:new Date(start).toISOString(),deadline:new Date(deadline).toISOString(),samples:[],actions:'external CUA only; no programmatic resize/move/fullscreen'};
   console.log('NATIVE_HOLD_READY '+JSON.stringify({pid:mainPid,output,deadline:result.nativeHold.deadline}));
   await persist();
   let lastCheckpoint='';
   while(Date.now()<deadline&&!fsSync.existsSync(path.join(output,'native.done'))){
    if(interrupted)throw new Error(`Interrupted by ${interrupted}`);
    assert.ok(!page.isClosed(),'owned native window remains open during hold');
    const state=await syncNative('native-hold');
    const renderer=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,documentFocus:document.hasFocus(),route:document.querySelector('.app')?.dataset.page}));
    result.nativeHold.samples.push({at:state.at,state:state.state,...renderer});
    const marker=path.join(output,'native.checkpoint');
    if(fsSync.existsSync(marker)){const label=(await fs.readFile(marker,'utf8')).trim();assert.match(label,/^[a-z0-9-]+$/);if(label!==lastCheckpoint){await checkpoint(label);lastCheckpoint=label;}}
    await persist();await sleep(500);
   }
   result.nativeHold.finishedAt=new Date().toISOString();
   const since=result.nativeEvents.filter(e=>Date.parse(e.at)>=start);
   result.nativeHold.events=Object.fromEntries(['resize','move','enter-full-screen','leave-full-screen','focus','blur'].map(type=>[type,since.filter(e=>e.type===type).length]));
   result.nativeHold.observedResize=since.some(e=>e.type==='resize');result.nativeHold.observedMove=since.some(e=>e.type==='move');
   result.nativeHold.observedNativeFullscreenRoundTrip=since.some(e=>e.type==='enter-full-screen')&&since.some(e=>e.type==='leave-full-screen');
   result.nativeHold.acceptance=result.nativeHold.observedResize&&result.nativeHold.observedMove&&result.nativeHold.observedNativeFullscreenRoundTrip?'events observed; root CUA evidence still required':'PENDING_CUA: required native event coverage was not observed';
   await checkpoint('native-hold-final');
  }
  check(result.rendererErrors.length===0,'no renderer page errors');
  check(result.consoleErrors.length===0,'no renderer console errors');
  check(result.assetEvents.every(e=>e.kind!=='failed'&&(e.kind!=='response'||e.status<400)),'observed desktop assets load successfully');
  if(!nativeOnly)check(result.checkpoints.some(c=>c.media?.some(v=>v.src.endsWith('/assets/menu/welcome-opening-v1.mp4')&&v.width===1920&&v.height===1080&&!v.error)),'decoded welcome asset is preserved in evidence');
 }catch(e){fail(e,'scenario');}
 finally{
  try{if(page&&!page.isClosed()){await drainDocument('final-partial');await checkpoint(result.failure?'failure':'final',true);}}catch(e){fail(e,'final-diagnostics');}
  if(recording)try{recorderChildren=collectChildren(process.pid).filter(c=>/ffmpeg/i.test(c.command));const stopped=Date.now();await bounded(()=>page.screencast.stop(),60000,'Native recording stop');const file=path.join(output,'native-content.webm');result.video={path:path.basename(file),scope:'renderer content during CUA; native frame/fullscreen/display events separate',stopMs:Date.now()-stopped,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')};}catch(e){fail(e,'video-stop');}
  try{await bounded(persist,3000,'Partial evidence write');}catch(e){fail(e,'partial-evidence-write');}
  result.cleanup={profile:{path:directory||null,removed:!directory}};let children=[];
  if(app){
   try{children=collectChildren(app.process().pid);}catch(e){fail(e,'owned-child-capture');}
   let stallProbe;const probeTimer=nativeOnly?setTimeout(()=>{if(alive(app.process().pid)){const file=path.join(output,'quit-stall.sample.txt');stallProbe=promisify(execFile)('/usr/bin/sample',[String(app.process().pid),'1','10','-file',file],{timeout:2000}).then(()=>{result.closeStallSample=path.basename(file);},e=>{result.closeStallSampleError=e.message;});}},4500):null;
   try{result.cleanup.application=await closeApplication(app);if(!result.cleanup.application.normalExit||result.cleanup.application.forced)throw new Error('Owned application did not quit normally');}catch(e){fail(e,'application-quit');}finally{if(probeTimer)clearTimeout(probeTimer);if(stallProbe)await stallProbe;}
   try{result.cleanup.children=await verifyChildren(children);check(result.cleanup.children.every(c=>!c.forced&&!c.alive&&!c.error),'all owned children exit without force');}catch(e){fail(e,'child-cleanup');}
  }
  if(recorderChildren.length)try{result.cleanup.recorders=await verifyChildren(recorderChildren);check(result.cleanup.recorders.every(c=>!c.forced&&!c.alive&&!c.error),'owned recorder exits without force');}catch(e){fail(e,'recorder-cleanup');}
  if(directory)try{await bounded(()=>fs.rm(directory,{recursive:true,force:true}),3000,'Temporary profile removal');result.cleanup.profile.removed=!fsSync.existsSync(directory);check(result.cleanup.profile.removed,'isolated temporary profile removed');}catch(e){fail(e,'profile-removal');}
  result.finishedAt=new Date().toISOString();result.status=result.failure?'FAIL':'PASS';
  try{
   await bounded(persist,3000,'Final evidence write');const reread=JSON.parse(await fs.readFile(path.join(output,'welcome-native.json'),'utf8'));
   for(const sample of reread.segments){const{frames,...summary}=frameSummary(sample.frameTimestamps);assert.equal(sample.frameCount,frames);for(const[key,value]of Object.entries(summary))assert.equal(sample[key],value);}
   for(const document of reread.documents){const{frames,...summary}=frameSummary(document.frames);assert.equal(document.frameCount,frames);for(const[key,value]of Object.entries(summary))assert.equal(document[key],value);}
   result.evidenceReadBack={segments:reread.segments.length,documents:reread.documents.length,frameCountsAndSummariesMatch:true};await bounded(persist,3000,'Read-back result write');
  }catch(e){fail(e,'evidence-read-back');result.status='FAIL';try{await bounded(persist,3000,'Read-back failure evidence');}catch(writeError){fail(writeError,'failure-evidence-write');}}
  process.removeListener('SIGINT',onSignal);process.removeListener('SIGTERM',onSignal);
 }
 console.log(JSON.stringify({output,status:result.status,input:result.input,checks:result.checks,firstOperableMs:result.firstOperableMs,reload:result.reload&&{oldPid:result.reload.oldPid,newPid:result.reload.newPid,oldDocumentId:result.reload.oldDocumentId,newDocumentId:result.reload.newDocumentId},segments:result.segments.map(({name,frameCount,p95,p99,over50ms,failed})=>({name,frameCount,p95,p99,over50ms,failed})),nativeHold:result.nativeHold&&{acceptance:result.nativeHold.acceptance,observedResize:result.nativeHold.observedResize,observedMove:result.nativeHold.observedMove,observedNativeFullscreenRoundTrip:result.nativeHold.observedNativeFullscreenRoundTrip,events:result.nativeHold.events},failure:result.failure,cleanup:result.cleanup},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
