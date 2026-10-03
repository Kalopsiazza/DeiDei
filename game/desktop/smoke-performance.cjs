// Source-build diagnostics only. No renderer privileges or production instrumentation.
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const fsSync=require('node:fs'),{createHash}=require('node:crypto');
function sourceInput() {
 const git = args => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
 const files=['main.cjs','preload.cjs','ui-assets.cjs','build/ui/renderer.js','build/ui/style.css','build/ui/welcome.css','build/ui/assets/menu/welcome-opening-v1.mp4','smoke-entry.cjs','smoke-performance.cjs'];
 const sha256=Object.fromEntries(files.map(file=>[file,fsSync.existsSync(path.join(__dirname,file))?createHash('sha256').update(fsSync.readFileSync(path.join(__dirname,file))).digest('hex'):null]));
 return {sha:git(['rev-parse','HEAD']),dirty:git(['status','--short']),sha256,startedAt:new Date().toISOString(),mainProcess:'fresh launch; no old hot-update process reused'};
}
async function captureDiagnostics(page) {
 if(!page || page.isClosed()) return {unavailable:'window already closed'};
 return page.evaluate(() => {
  const nodes = [...document.querySelectorAll('.app,.front-stage,.welcome-scene,.welcome-card,.welcome-card-turn,.scene-world,.menu-environment,.scene-character,.menu-rail,.battle-table,.battle-arena,.battle-operation')];
  const styles = nodes.flatMap(n => [null,'::before','::after'].map(pseudo => {
   const s=getComputedStyle(n,pseudo);
   return {selector:n.className,pseudo,opacity:s.opacity,transform:s.transform,filter:s.filter,display:s.display,visibility:s.visibility,animationName:s.animationName,animationPlayState:s.animationPlayState,transition:s.transition,content:s.content};
  }));
  const animations=document.getAnimations().map(a => ({type:a.constructor.name,name:a.animationName||a.transitionProperty,currentTime:a.currentTime,playState:a.playState,target:a.effect?.target?.className,pseudo:a.effect?.pseudoElement||null}));
  const media=[...document.querySelectorAll('video')].map(v => ({src:v.currentSrc,currentTime:v.currentTime,readyState:v.readyState,networkState:v.networkState,paused:v.paused,ended:v.ended,muted:v.muted,width:v.videoWidth,height:v.videoHeight,error:v.error?{code:v.error.code,message:v.error.message}:null,quality:{totalVideoFrames:v.getVideoPlaybackQuality?.().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality?.().droppedVideoFrames}}));
  return {at:performance.now(),route:document.querySelector('.app')?.dataset.page,stage:document.querySelector('.welcome-scene')?.dataset.stage,url:location.href,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,visibility:document.visibilityState,styles,animations,media};
 });
}
function frameSummary(frames) {
 const intervals=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
 const percentile=p=>intervals.length?intervals[Math.ceil(intervals.length*p)-1]:null;
 // Keep the numeric summary contract used by integration/gui.cjs; segment renames it.
 return {frames:frames.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),over50ms:intervals.filter(t=>t>50).length,max:intervals.at(-1)||null};
}
const errorDetails=e=>({name:e.name,message:e.message,stack:e.stack});
async function segment(page,metrics,segments,name,action) {
 const start=Date.now(),record={name,frameTimestamps:[],active:false,errors:[]};let failure,samplingStarted=false;
 try {
  record.metricsBefore=await metrics();
  await page.evaluate(()=>{const s=window.__frameSample={frameTimestamps:[],active:true};function frame(t){if(!s.active)return;s.frameTimestamps.push(t);requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  samplingStarted=true;
  await action();
 } catch(e){failure=e;}
 finally {
  if(samplingStarted)try {Object.assign(record,await page.evaluate(()=>{const s=window.__frameSample;if(!s)return {active:false,frameTimestamps:[]};s.active=false;return {active:s.active,frameTimestamps:s.frameTimestamps.slice(),viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};}));}
  catch(e){record.active=null;record.errors.push({stage:'stop-sampling',...errorDetails(e)});failure??=e;}
  try {record.metricsAfter=await metrics();}catch(e){record.errors.push({stage:'metrics-after',...errorDetails(e)});failure??=e;}
  const {frames:frameCount,...summary}=frameSummary(record.frameTimestamps);
  Object.assign(record,{frameCount,...summary,durationMs:Date.now()-start,failed:!!failure});
  if(failure)record.failure=errorDetails(failure);
  segments.push(record);
 }
 if(failure)throw failure;
 return record;
}
async function bounded(action,ms,label) {
 let timer;
 try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms);})]);}
 finally{clearTimeout(timer);}
}
async function waitForExit(child,ms) {
 const end=Date.now()+ms;
 while(child.exitCode===null&&!child.signalCode){if(Date.now()>=end)throw new Error('Owned Electron did not exit');await new Promise(r=>setTimeout(r,25));}
}
async function closeApplication(app,timeoutMs=6500) {
 const child=app.process(),record={pid:child.pid,normalExit:false,forced:false,errors:[]};
 try {
  if(child.exitCode===null&&!child.signalCode)await bounded(async()=>{
   // Exercise ordinary close/before-quit, including active worker cleanup; no destroyed window.
   await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
   await app.close();await waitForExit(child,1000);
  },timeoutMs,'Normal Electron close');
  record.normalExit=child.exitCode===0&&!child.signalCode;
  if(!record.normalExit)throw new Error('Owned Electron did not exit normally');
 }catch(e){record.errors.push(errorDetails(e));record.normalExit=false;}
 if(child.exitCode===null&&!child.signalCode){record.forced=true;try{child.kill('SIGKILL');await waitForExit(child,2000);}catch(e){record.errors.push(errorDetails(e));}}
 Object.assign(record,{exitCode:child.exitCode,signal:child.signalCode,exited:child.exitCode!==null||!!child.signalCode});
 return record;
}
function ownedChildren(pid) {
 if(process.platform==='win32')return {unavailable:'ps descendant check is unavailable on Windows',children:[]};
 const rows=execFileSync('ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').map(s=>s.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m[1]),ppid:Number(m[2]),command:m[3].trim()}));
 const parents=new Set([pid]),children=[];
 for(let changed=true;changed;){changed=false;for(const row of rows)if(parents.has(row.ppid)&&!parents.has(row.pid)){parents.add(row.pid);children.push(row);changed=true;}}
 return {children};
}
function alive(pid) {try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function checkChildren(children) {
 const end=Date.now()+1500;
 while(children.some(c=>alive(c.pid))&&Date.now()<end)await new Promise(r=>setTimeout(r,25));
 const report=[];
 for(const child of children){
  const row={pid:child.pid,ppid:child.ppid,kind:/python/i.test(child.command)?'worker':'Electron child',forced:false};
  if(alive(child.pid)){
   try{
    const current=execFileSync('ps',['-p',String(child.pid),'-o','comm='],{encoding:'utf8'}).trim();
    if(current===child.command){process.kill(child.pid,'SIGKILL');row.forced=true;row.signalSent='SIGKILL';}
    else row.error='PID no longer identifies the owned child; not terminated';
   }catch(e){if(alive(child.pid))row.error=e.message;}
  }
  report.push(row);
 }
 const forcedEnd=Date.now()+1500;
 while(report.some(c=>alive(c.pid))&&Date.now()<forcedEnd)await new Promise(r=>setTimeout(r,25));for(const row of report)row.alive=alive(row.pid);
 return report;
}
module.exports={sourceInput,captureDiagnostics,frameSummary,segment,closeApplication};

if(require.main===module && process.argv[2]==='--self-check') (async()=>{
 assert.deepEqual(frameSummary([0,10,20,80]),{frames:4,p50:10,p95:60,p99:60,over50ms:1,max:60});assert.equal(frameSummary([]).p50,null);
 const vm=require('node:vm');
 for(const mode of ['throw','timeout']){
  let t=0;const context={window:{},innerWidth:1366,innerHeight:768,devicePixelRatio:2,requestAnimationFrame:fn=>setTimeout(()=>fn(t+=16),1)};
  const page={evaluate:async fn=>structuredClone(vm.runInNewContext(`(${fn})()`,context))},segments=[];
  const original=new Error(`injected-${mode}`);if(mode==='timeout')original.name='TimeoutError';
  let reads=0;const metrics=async()=>{if(++reads===2&&mode==='throw')throw new Error('secondary-metrics-error');return [];};
  await assert.rejects(segment(page,metrics,segments,mode,async()=>{await new Promise((resolve,reject)=>setTimeout(()=>mode==='timeout'?reject(original):resolve(),12));throw original;}),e=>e===original);
  assert.equal(context.window.__frameSample.active,false);assert.equal(segments.length,1);const sample=segments[0];
  assert.ok(sample.frameCount>0);assert.equal(sample.active,false);assert.equal(sample.failure.message,original.message);
  const saved=JSON.parse(JSON.stringify(sample)),{frames,...summary}=frameSummary(saved.frameTimestamps);assert.equal(saved.frameCount,frames);
  for(const [key,value] of Object.entries(summary))assert.equal(saved[key],value);
  const count=context.window.__frameSample.frameTimestamps.length;await new Promise(r=>setTimeout(r,5));assert.equal(context.window.__frameSample.frameTimestamps.length,count);
 }
 for(const mode of ['normal','throw','timeout']){
  const original=new Error('injected-close-error'),child={pid:0,exitCode:null,signalCode:null,kill:s=>{child.signalCode=s;}};
  const app={process:()=>child,evaluate:async()=>{},close:async()=>{if(mode==='throw')throw original;if(mode==='timeout')return new Promise(()=>{});child.exitCode=0;}};
  const cleanup=await closeApplication(app,15);assert.equal(cleanup.normalExit,mode==='normal');assert.equal(cleanup.forced,mode!=='normal');
  if(mode==='throw')assert.equal(cleanup.errors[0].message,original.message);
  if(mode==='timeout')assert.match(cleanup.errors[0].message,/Normal Electron close timed out/);
  if(mode!=='normal')assert.equal(cleanup.signal,'SIGKILL');else assert.equal(cleanup.exitCode,0);
 }
 const source=fsSync.readFileSync(__filename,'utf8'),failSource=source.slice(source.lastIndexOf(' const fail='),source.lastIndexOf(' const metrics='));
 const start=source.lastIndexOf('\n finally {')+'\n finally {'.length,finishSource=source.slice(start,source.indexOf('\n }\n console.log',start));
 for(const original of [null,{stage:'scenario',message:'original scenario failure'}]){
  const result={segments:[],failure:original||undefined},saved=[],process={exitCode:0};
  const finish=vm.runInNewContext(`(async()=>{${failSource}${finishSource}})`,{result,process,path,output:'.',app:null,page:null,directory:null,assert,Date,errorDetails,frameSummary,bounded:async fn=>fn(),captureDiagnostics:async()=>({}),fs:{writeFile:async(_path,data)=>saved.push(JSON.parse(data)),readFile:async()=>{throw new Error('injected read-back EACCES');}}});
  await finish();assert.equal(process.exitCode,1);assert.equal(saved.at(-1).status,'FAIL');
  if(original){assert.equal(result.failure,original);assert.match(result.secondaryFailures[0].message,/EACCES/);}
  else assert.match(result.failure.message,/EACCES/);
 }
 console.log('PASS frame summary; real segment throw/timeout partial samples and inactive sampler; normal/forced close; read-back failure persisted');
})().catch(e=>{console.error(e);process.exitCode=1;});
else if(require.main===module) (async()=>{
 const output=path.resolve(process.env.DEIDEI_PERF_OUTPUT||path.join(root,'.local-outputs/performance-baseline'));
 const result={input:sourceInput(),host:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0].model,memoryBytes:os.totalmem(),cpuCount:os.cpus().length},budget:{refreshHz:60,nominalFrameMs:1000/60,stallMs:50,samples:'one complete flow and two replay cycles; diagnostic, no long stress'},segments:[],errors:[],gpu:'per-frame GPU utilization/VRAM unavailable; Electron GPU process CPU/RSS only'};
 let app,page,cdp,directory;
 const fail=(e,stage)=>{const detail={stage,...errorDetails(e)};if(!result.failure)result.failure=detail;else (result.secondaryFailures??=[]).push(detail);process.exitCode=1;};
 const metrics=()=>app.evaluate(({app})=>app.getAppMetrics());
 const measure=(name,action)=>segment(page,metrics,result.segments,name,action);
 async function preview(){await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:'P01 · 首次进入／欢迎建档',exact:true}).click();}
 try {
  await fs.mkdir(output,{recursive:true});directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-perf-'));
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
  const failureMode=process.argv.find(s=>s.startsWith('--failure='))?.slice(10);
  assert.ok(!failureMode||['throw','timeout'].includes(failureMode),'Only --failure=throw or --failure=timeout is supported');
  const started=Date.now();app=await electron.launch({args:[path.join(__dirname,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>result.errors.push(e.message));
  await page.getByRole('button',{name:'跳过开场',exact:true}).waitFor();result.coldFirstOperableMs=Date.now()-started;
  result.firstOperable={elapsedMs:result.coldFirstOperableMs,...await page.evaluate(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,visibility:document.visibilityState})),condition:'native startup before any DPR override'};
  result.electron=await app.evaluate(({app,screen})=>({versions:process.versions,displays:screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor,displayFrequency:d.displayFrequency}))}));
  if(process.env.DEIDEI_PERF_DPR){cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:Number(process.env.DEIDEI_PERF_DPR),mobile:false});result.dprMode='CDP emulation';}else result.dprMode='native';
  if(failureMode){
   const {enterHall}=require('../integration/gui-actions.cjs');await enterHall(page,'故障段样本');
   await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();await page.getByRole('button',{name:'新手实战',exact:true}).click();await page.locator('.battle-table[data-ready=true]').waitFor();
   const reply=await page.evaluate(()=>window.desktop.port.getView());assert.ok(reply.ok&&reply.data.source==='live'&&reply.data.mode==='tutorial'&&reply.data.phase==='selecting');
   result.budget.samples='one bounded real tutorial injected failure segment; no performance matrix';
   result.injectedFailure={mode:failureMode,view:reply.data,condition:'ordinary main and real WorkerPort tutorial active; no worker mock'};
   await measure(`tutorial-injected-${failureMode}`,async()=>{await page.waitForTimeout(150);if(failureMode==='throw')throw new Error('INJECTED_SEGMENT_THROW');await page.locator('[data-r34-never-present]').waitFor({timeout:150});});
  }else{
  await measure('first-normal-video',async()=>{await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.3);await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  assert.equal(await page.locator('video').evaluate(v=>v.videoWidth),1920);
  for(let i=1;i<=2;i++)await measure(`normal-replay-${i}`,async()=>{await page.getByRole('button',{name:'重播开场',exact:true}).click();await page.locator('.welcome-scene[data-stage=opening]').waitFor();await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  await measure('replay-then-skip',async()=>{await page.getByRole('button',{name:'重播开场',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'跳过开场',exact:true}).click();await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  await measure('unknown-media-fallback',async()=>{await page.getByRole('button',{name:'重播开场',exact:true}).click();await page.locator('video').evaluate(v=>{v.src='assets/menu/unknown.mp4';v.load();});await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  result.mediaFailure=await captureDiagnostics(page);
  await measure('name-flip',async()=>{await page.getByRole('button',{name:'进入牌厅',exact:true}).click();await page.getByRole('textbox',{name:'昵称',exact:true}).waitFor();await page.waitForTimeout(600);});
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('性能样本');await page.getByRole('button',{name:'确认名字',exact:true}).click();
  await measure('welcome-hall-handoff',async()=>{await page.getByRole('button',{name:'进入主菜单',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();await page.waitForTimeout(800);});
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
   if(cdp)await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:Number(process.env.DEIDEI_PERF_DPR),mobile:false});
   await measure(`menu-idle-${width}`,()=>page.waitForTimeout(3000));
   await measure(`welcome-return-${width}`,async()=>{await preview();await page.getByRole('button',{name:'跳过开场',exact:true}).click();await page.getByRole('button',{name:'结束预览，返回主菜单',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();await page.waitForTimeout(800);});
  }
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();
  const scroll=page.locator('.archive-stack');await scroll.hover();
  result.manualScrollBefore=await scroll.evaluate(n=>n.scrollTop);
  const profiler=await page.context().newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');
  await measure('manual-stack-scroll',async()=>{for(let i=0;i<8;i++){await page.mouse.wheel(0,i<4?500:-500);await page.waitForTimeout(180);}});
  const profile=await profiler.send('Profiler.stop');await fs.writeFile(path.join(output,'manual-cpu-profile.json'),JSON.stringify(profile)+'\n');
  result.manualScrollAfter=await scroll.evaluate(n=>n.scrollTop);
  result.manualScrollMoved=await scroll.evaluate(n=>n.scrollHeight>n.clientHeight);
  await page.locator('.archive-detail-scroll').hover();
  await measure('manual-detail-scroll',async()=>{for(let i=0;i<8;i++){await page.mouse.wheel(0,i<4?500:-500);await page.waitForTimeout(180);}});
  await page.getByRole('button',{name:'新手实战',exact:true}).click();await page.locator('.battle-table[data-ready=true]').waitFor();
  await page.getByRole('button',{name:'暂停',exact:true}).click();result.pauseBefore=await captureDiagnostics(page);await page.waitForTimeout(500);result.pauseAfter=await captureDiagnostics(page);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'冻结',exact:true}).click();result.freezeBefore=await captureDiagnostics(page);await page.waitForTimeout(500);result.freezeAfter=await captureDiagnostics(page);
  await page.getByRole('button',{name:'恢复',exact:true}).click();
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(true));await page.waitForTimeout(700);
  if(cdp)await cdp.send('Emulation.clearDeviceMetricsOverride');
  await measure('native-fullscreen-menu',()=>page.waitForTimeout(3000));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(false));
  // ponytail: inspect existing animations; no profiler framework or synthetic effect replacements.
  assert.equal(result.errors.length,0,result.errors.join(';'));
  }
 } catch(e){fail(e,'scenario');}
 finally {
  try{result.final=await bounded(()=>captureDiagnostics(page),2000,'Final diagnostics');}catch(e){result.final={unavailable:e.message};fail(e,'final-diagnostics');}
  const persist=()=>fs.writeFile(path.join(output,'performance.json'),JSON.stringify(result,null,2)+'\n');
  try{await bounded(persist,3000,'Partial evidence write');}catch(e){fail(e,'partial-evidence-write');}
  if(page&&!page.isClosed())try{await page.screenshot({path:path.join(output,'final.png'),timeout:2000});}catch(e){(result.secondaryFailures??=[]).push({stage:'screenshot',...errorDetails(e)});}
  result.cleanup={profile:{path:directory||null,removed:!directory}};let children=[];
  if(app){
   try{const owned=ownedChildren(app.process().pid);children=owned.children;if(owned.unavailable)result.cleanup.processCheck={unavailable:owned.unavailable};}catch(e){fail(e,'owned-process-capture');}
   try{result.cleanup.application=await closeApplication(app);if(!result.cleanup.application.normalExit)fail(result.cleanup.application.errors[0]||new Error('Normal application exit failed'),'application-close');}catch(e){fail(e,'application-close');}
   try{result.cleanup.children=await checkChildren(children);if(result.cleanup.children.some(c=>c.forced||c.alive||c.error))fail(new Error('Owned child cleanup required force or left a live process'),'child-cleanup');}catch(e){fail(e,'child-cleanup');}
  }
  if(directory)try{await bounded(()=>fs.rm(directory,{recursive:true,force:true}),3000,'Temporary profile removal');result.cleanup.profile.removed=!fsSync.existsSync(directory);assert.ok(result.cleanup.profile.removed,'Temporary profile remains');}catch(e){fail(e,'profile-removal');}
  result.finishedAt=new Date().toISOString();result.status=result.failure?'FAIL':'PASS';
  try{
   await bounded(persist,3000,'Final evidence write');const saved=JSON.parse(await fs.readFile(path.join(output,'performance.json'),'utf8'));
   for(const sample of saved.segments){const {frames,...summary}=frameSummary(sample.frameTimestamps);assert.equal(sample.frameCount,frames);for(const [key,value] of Object.entries(summary))assert.equal(sample[key],value);}
   result.evidenceReadBack={segments:saved.segments.length,frameCountsAndSummariesMatch:true};await bounded(persist,3000,'Read-back result write');
  }catch(e){
   fail(e,'evidence-read-back');result.status='FAIL';
   try{await bounded(persist,3000,'Failed read-back evidence write');}catch(writeError){fail(writeError,'failure-evidence-write');}
  }
 }
 console.log(JSON.stringify({output,input:result.input,firstOperable:result.firstOperable,status:result.status,segments:result.segments.map(({name,p50,p95,p99,over50ms,frameCount,active,failed,viewport,dpr})=>({name,p50,p95,p99,over50ms,frameCount,active,failed,viewport,dpr})),failure:result.failure,secondaryFailures:result.secondaryFailures,cleanup:result.cleanup},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
