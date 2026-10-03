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
 return {frames:frames.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),over50ms:intervals.filter(t=>t>50).length,max:intervals.at(-1)||null};
}
module.exports={sourceInput,captureDiagnostics,frameSummary};

if(require.main===module && process.argv[2]==='--self-check'){
 assert.deepEqual(frameSummary([0,10,20,80]),{frames:4,p50:10,p95:60,p99:60,over50ms:1,max:60});assert.equal(frameSummary([]).p50,null);console.log('PASS frame summary');
}else if(require.main===module) (async()=>{
 const output=path.resolve(process.env.DEIDEI_PERF_OUTPUT||path.join(root,'.local-outputs/performance-baseline'));
 await fs.mkdir(output,{recursive:true});
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-perf-'));
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 const result={input:sourceInput(),host:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0].model,memoryBytes:os.totalmem(),cpuCount:os.cpus().length},budget:{refreshHz:60,nominalFrameMs:1000/60,stallMs:50,samples:'one complete flow and two replay cycles; diagnostic, no long stress'},segments:[],errors:[],gpu:'per-frame GPU utilization/VRAM unavailable; Electron GPU process CPU/RSS only'};
 let app,page,cdp;
 const metrics=()=>app.evaluate(({app})=>app.getAppMetrics());
 async function segment(name,action){
  const before=await metrics();
  await page.evaluate(()=>{const s=window.__frameSample={frames:[],active:true};function frame(t){s.frames.push(t);if(s.active)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  const start=Date.now();await action();
  const sample=await page.evaluate(()=>{window.__frameSample.active=false;return {frames:window.__frameSample.frames,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});
  const after=await metrics();
  result.segments.push({name,durationMs:Date.now()-start,...sample,...frameSummary(sample.frames),metricsBefore:before,metricsAfter:after});
 }
 async function preview(){await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:'P01 · 首次进入／欢迎建档',exact:true}).click();}
 try {
  const started=Date.now();app=await electron.launch({args:[path.join(__dirname,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>result.errors.push(e.message));
  await page.getByRole('button',{name:'跳过开场',exact:true}).waitFor();result.coldFirstOperableMs=Date.now()-started;
  result.electron=await app.evaluate(({app,screen})=>({versions:process.versions,displays:screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor,displayFrequency:d.displayFrequency}))}));
  if(process.env.DEIDEI_PERF_DPR){cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:Number(process.env.DEIDEI_PERF_DPR),mobile:false});result.dprMode='CDP emulation';}else result.dprMode='native';
  await segment('first-normal-video',async()=>{await page.waitForFunction(()=>document.querySelector('video')?.currentTime>.3);await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  assert.equal(await page.locator('video').evaluate(v=>v.videoWidth),1920);
  for(let i=1;i<=2;i++)await segment(`normal-replay-${i}`,async()=>{await page.getByRole('button',{name:'重播开场',exact:true}).click();await page.locator('.welcome-scene[data-stage=opening]').waitFor();await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  await segment('replay-then-skip',async()=>{await page.getByRole('button',{name:'重播开场',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'跳过开场',exact:true}).click();await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  await segment('unknown-media-fallback',async()=>{await page.getByRole('button',{name:'重播开场',exact:true}).click();await page.locator('video').evaluate(v=>{v.src='assets/menu/unknown.mp4';v.load();});await page.locator('.welcome-scene[data-stage=title]').waitFor();});
  result.mediaFailure=await captureDiagnostics(page);
  await segment('name-flip',async()=>{await page.getByRole('button',{name:'进入牌厅',exact:true}).click();await page.getByRole('textbox',{name:'昵称',exact:true}).waitFor();await page.waitForTimeout(600);});
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('性能样本');await page.getByRole('button',{name:'确认名字',exact:true}).click();
  await segment('welcome-hall-handoff',async()=>{await page.getByRole('button',{name:'进入主菜单',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();await page.waitForTimeout(800);});
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
   if(cdp)await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:Number(process.env.DEIDEI_PERF_DPR),mobile:false});
   await segment(`menu-idle-${width}`,()=>page.waitForTimeout(3000));
   await segment(`welcome-return-${width}`,async()=>{await preview();await page.getByRole('button',{name:'跳过开场',exact:true}).click();await page.getByRole('button',{name:'结束预览，返回主菜单',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();await page.waitForTimeout(800);});
  }
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();
  const scroll=page.locator('.archive-stack');await scroll.hover();
  result.manualScrollBefore=await scroll.evaluate(n=>n.scrollTop);
  const profiler=await page.context().newCDPSession(page);await profiler.send('Profiler.enable');await profiler.send('Profiler.start');
  await segment('manual-stack-scroll',async()=>{for(let i=0;i<8;i++){await page.mouse.wheel(0,i<4?500:-500);await page.waitForTimeout(180);}});
  const profile=await profiler.send('Profiler.stop');await fs.writeFile(path.join(output,'manual-cpu-profile.json'),JSON.stringify(profile)+'\n');
  result.manualScrollAfter=await scroll.evaluate(n=>n.scrollTop);
  result.manualScrollMoved=await scroll.evaluate(n=>n.scrollHeight>n.clientHeight);
  await page.locator('.archive-detail-scroll').hover();
  await segment('manual-detail-scroll',async()=>{for(let i=0;i<8;i++){await page.mouse.wheel(0,i<4?500:-500);await page.waitForTimeout(180);}});
  await page.getByRole('button',{name:'新手实战',exact:true}).click();await page.locator('.battle-table[data-ready=true]').waitFor();
  await page.getByRole('button',{name:'暂停',exact:true}).click();result.pauseBefore=await captureDiagnostics(page);await page.waitForTimeout(500);result.pauseAfter=await captureDiagnostics(page);
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'冻结',exact:true}).click();result.freezeBefore=await captureDiagnostics(page);await page.waitForTimeout(500);result.freezeAfter=await captureDiagnostics(page);
  await page.getByRole('button',{name:'恢复',exact:true}).click();
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(true));await page.waitForTimeout(700);
  if(cdp)await cdp.send('Emulation.clearDeviceMetricsOverride');
  await segment('native-fullscreen-menu',()=>page.waitForTimeout(3000));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(false));
  // ponytail: inspect existing animations; no profiler framework or synthetic effect replacements.
  assert.equal(result.errors.length,0,result.errors.join(';'));
 } catch(e){result.failure={message:e.message,stack:e.stack};process.exitCode=1;}
 finally {
  result.final=await captureDiagnostics(page).catch(e=>({unavailable:e.message}));
  await fs.writeFile(path.join(output,'performance.json'),JSON.stringify(result,null,2)+'\n');
  if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'final.png')}).catch(()=>{});
  if(app){await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{});await app.close();}await fs.rm(directory,{recursive:true,force:true});
 }
 console.log(JSON.stringify({output,input:result.input,coldFirstOperableMs:result.coldFirstOperableMs,segments:result.segments.map(({name,p50,p95,p99,over50ms,frames,viewport,dpr})=>({name,p50,p95,p99,over50ms,frames,viewport,dpr})),failure:result.failure},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
