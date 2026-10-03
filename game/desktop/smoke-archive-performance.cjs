// Bounded source-build diagnosis. Run sequentially with a fresh OUT for each product input.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),nativeFs=require('node:fs');
const path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
async function bounded(action,ms,label){let timer;try{return await Promise.race([action(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms);})]);}finally{clearTimeout(timer);}}
async function readTrace(cdp,handle){
 let content='',failure;
 try{for(;;){const part=await cdp.send('IO.read',{handle});content+=part.data;if(part.eof)break;}}
 catch(e){failure=e;}
 finally{try{await cdp.send('IO.close',{handle});}catch(e){failure??=e;}}
 if(failure){failure.partialTrace=content;throw failure;}
 return content;
}
function ownedChildren(pid){
 const rows=execFileSync('ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').map(s=>s.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m[1]),ppid:Number(m[2]),command:m[3].trim()}));
 const parents=new Set([pid]),children=[];
 for(let changed=true;changed;){changed=false;for(const row of rows)if(parents.has(row.ppid)&&!parents.has(row.pid)){parents.add(row.pid);children.push(row);changed=true;}}
 return children;
}
function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function cleanupChildren(children){
 const deadline=Date.now()+2000;
 while(children.some(c=>alive(c.pid))&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));
 const report=[];
 for(const child of children){
  const row={...child,forced:false};
  if(alive(child.pid))try{
   const current=execFileSync('ps',['-p',String(child.pid),'-o','comm='],{encoding:'utf8'}).trim();
   if(current===child.command){process.kill(child.pid,'SIGKILL');row.forced=true;}
   else row.error='PID no longer identifies the owned child; not terminated';
  }catch(e){if(alive(child.pid))row.error=e.message;}
  report.push(row);
 }
 const forcedDeadline=Date.now()+2000;
 while(report.some(c=>alive(c.pid))&&Date.now()<forcedDeadline)await new Promise(r=>setTimeout(r,25));
 for(const row of report)row.alive=alive(row.pid);
 return report;
}
async function main(){
 const desktop=process.argv[2]||__dirname;
 assert.ok(desktop&&path.isAbsolute(desktop),'Pass the absolute task game/desktop directory');
 assert.ok(process.env.OUT,'Set OUT to a new evidence directory');
 const output=path.resolve(process.env.OUT),root=path.resolve(desktop,'../..');
 assert.ok(!nativeFs.existsSync(path.join(output,'evidence.json')),'OUT already contains evidence.json; preserve it and use a fresh directory');
 const {_electron:electron}=require(path.join(desktop,'node_modules/playwright-core'));
 const {enterHall}=require(path.join(root,'game/integration/gui-actions.cjs'));
 const {sourceInput,segment,closeApplication,frameSummary,captureDiagnostics}=require(path.join(desktop,'smoke-performance.cjs'));
 const result={input:{...sourceInput(),wrapperSha256:createHash('sha256').update(nativeFs.readFileSync(__filename)).digest('hex')},host:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0].model,cpuCount:os.cpus().length,memoryBytes:os.totalmem()},protocol:{source:'ordinary main, temporary synthetic profile; no fixture transport',viewport:[1920,1080],dpr:'native 2, no CDP emulation',backgroundThrottling:'ordinary main default, not overridden',focus:'native and document focus asserted before each region and after every wheel; separate RAF focus sampler',wheelCount:8,deltaY:[500,500,500,500,-500,-500,-500,-500],wheelWaitMs:180,profiling:'CPU profile plus bounded CDP trace in both regions; diagnostic overhead present',caveat:'fresh process short archive path; not the full old welcome/replay history or physical 1920 display; RAF callback intervals are not presentation times'},segments:[],pageErrors:[],secondaryErrors:[]};
 let app,page,directory;
 const details=e=>({name:e.name||'Error',message:e.message||String(e),stack:e.stack});
 const fail=(e,stage)=>{const row={stage,...details(e)};if(!result.firstError)result.firstError=row;else result.secondaryErrors.push(row);process.exitCode=1;};
 const persist=()=>fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(result,null,2)+'\n');
 const nativeState=()=>app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0],display=screen.getDisplayMatching(w.getBounds());return {at:Date.now(),focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),bounds:w.getBounds(),contentBounds:w.getContentBounds(),display:{id:display.id,bounds:display.bounds,scaleFactor:display.scaleFactor,displayFrequency:display.displayFrequency},events:globalThis.__archiveNativeEvents.slice()};});
 async function probe(name,selector){
  const scroll=page.locator(selector),record={name,selector,wheels:[]};result.regions??=[];result.regions.push(record);
  let cdp,profiling=false,tracing=false,traceComplete,traceListener;
  const scrollState=()=>scroll.evaluate(n=>({at:performance.now(),top:n.scrollTop,height:n.scrollHeight,client:n.clientHeight,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,focused:document.hasFocus(),visibility:document.visibilityState}));
  try{
   await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].focus();});await page.bringToFront();await scroll.hover();
   if(!(await nativeState()).focused){console.log('FOCUS_REQUIRED '+name);await bounded(async()=>{while(!(await nativeState()).focused)await new Promise(r=>setTimeout(r,100));},20000,'Native archive window focus');}
   record.before=await scrollState();record.nativeBefore=await nativeState();assert.ok(record.nativeBefore.focused&&record.before.focused,'native and document focus at measurement start');
   assert.deepEqual(record.before.viewport,[1920,1080]);assert.equal(record.before.dpr,2);assert.ok(record.before.height>record.before.client,`${name}: region has no scroll range`);
   cdp=await page.context().newCDPSession(page);
   await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');profiling=true;
   traceComplete=new Promise(resolve=>{traceListener=resolve;cdp.once('Tracing.tracingComplete',traceListener);});
   await cdp.send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{recordMode:'recordContinuously',includedCategories:['devtools.timeline','v8','blink','cc','gpu','disabled-by-default-devtools.timeline']}});tracing=true;
   await segment(page,()=>app.evaluate(({app})=>app.getAppMetrics()),result.segments,name,async()=>{
    await page.evaluate(()=>{const s=window.__archiveFocus={active:true,frames:[]};function frame(t){if(!s.active)return;s.frames.push({t,focused:document.hasFocus(),visibility:document.visibilityState});requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    for(let i=0;i<8;i++){
     const wheel={i,deltaY:i<4?500:-500,before:await scrollState()};record.wheels.push(wheel);
     await page.mouse.wheel(0,wheel.deltaY);await page.waitForTimeout(180);wheel.after=await scrollState();wheel.native=await nativeState();assert.ok(wheel.native.focused&&wheel.after.focused&&wheel.after.visibility==='visible','archive wheel focus retained');
    }
    assert.ok(record.wheels.some(w=>w.deltaY>0&&w.after.top>w.before.top),name+' positive wheels move scrollTop');assert.ok(record.wheels.some(w=>w.deltaY<0&&w.after.top<w.before.top),name+' negative wheels move scrollTop');
   });
  }catch(e){fail(e,name);throw e;}
  finally{
   if(page&&!page.isClosed())try{record.focusSample=await bounded(()=>page.evaluate(()=>{const s=window.__archiveFocus;if(!s)return null;s.active=false;return {active:s.active,frames:s.frames.slice()};}),2000,'Stop archive focus sample');}catch(e){fail(e,`${name}:focus-stop`);}
   if(page&&!page.isClosed())try{record.after=await scrollState();record.nativeAfter=await nativeState();}catch(e){fail(e,`${name}:after-state`);}
   if(profiling)try{const profile=await bounded(()=>cdp.send('Profiler.stop'),3000,'Stop archive CPU profile');profiling=false;await fs.writeFile(path.join(output,`${name}-cpu-profile.json`),JSON.stringify(profile)+'\n');record.cpuProfile=`${name}-cpu-profile.json`;}catch(e){fail(e,`${name}:profile-stop/write`);}
   if(tracing)try{
    await bounded(async()=>{await cdp.send('Tracing.end');tracing=false;const {stream}=await traceComplete;const content=await readTrace(cdp,stream);await fs.writeFile(path.join(output,`${name}-trace.json`),content);record.trace=`${name}-trace.json`;},7000,'Stop/write archive trace');
   }catch(e){fail(e,`${name}:trace-stop/write`);if(e.partialTrace)try{await fs.writeFile(path.join(output,`${name}-trace.partial`),e.partialTrace);}catch(writeError){fail(writeError,`${name}:partial-trace-write`);}}
   if(cdp){if(traceListener)cdp.removeListener('Tracing.tracingComplete',traceListener);try{await bounded(()=>cdp.detach(),2000,'Detach archive CDP');}catch(e){fail(e,`${name}:cdp-detach`);}}
   try{await bounded(persist,3000,'Partial archive evidence write');}catch(e){fail(e,`${name}:partial-evidence-write`);}
  }
 }
 try{
  await fs.mkdir(output,{recursive:true});directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-archive-perf-'));
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_PERF_DPR;delete env.DEIDEI_ROOM_URL;
  app=await electron.launch({args:[path.join(desktop,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>result.pageErrors.push(details(e)));
  result.electron=await app.evaluate(({screen})=>({versions:process.versions,displays:screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds,scaleFactor:d.scaleFactor,displayFrequency:d.displayFrequency}))}));
  await app.evaluate(({BrowserWindow,app})=>{const w=BrowserWindow.getAllWindows()[0];globalThis.__archiveNativeEvents=[];for(const event of ['focus','blur','show','hide','minimize','restore'])w.on(event,()=>globalThis.__archiveNativeEvents.push({event,at:Date.now()}));w.setContentSize(1920,1080);app.focus({steal:true});w.show();w.focus();});
  await enterHall(page,'图鉴性能样本');await page.locator('.app[data-page="menu"]').waitFor();await page.waitForTimeout(800);
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();await page.locator('.app[data-page="manual"]').waitFor();
  await probe('manual-stack-scroll','.archive-stack');await probe('manual-detail-scroll','.archive-detail-scroll');
  assert.equal(result.pageErrors.length,0,JSON.stringify(result.pageErrors));
 }catch(e){if(!result.firstError)fail(e,'scenario');}
 finally{
  if(page&&!page.isClosed())try{result.final=await bounded(()=>captureDiagnostics(page),2000,'Final archive diagnostics');}catch(e){fail(e,'final-diagnostics');}
  try{await bounded(persist,3000,'Pre-cleanup archive evidence write');}catch(e){fail(e,'pre-cleanup-evidence-write');}
  if(page&&!page.isClosed())try{await page.screenshot({path:path.join(output,result.firstError?'failure.png':'final.png'),timeout:8000});}catch(e){fail(e,'screenshot');}
  result.cleanup={profile:{path:directory||null,removed:!directory}};let descendants=[];
  if(app){
   try{descendants=ownedChildren(app.process().pid);}catch(e){fail(e,'owned-child-capture');}
   try{result.cleanup.application=await closeApplication(app);if(!result.cleanup.application.normalExit)fail(new Error('Owned Electron did not exit normally'),'application-close');}catch(e){fail(e,'application-close');}
   try{result.cleanup.children=await cleanupChildren(descendants);if(result.cleanup.children.some(c=>c.forced||c.alive||c.error))fail(new Error('Owned child cleanup required force or left a live process'),'child-cleanup');}catch(e){fail(e,'child-cleanup');}
  }
  if(directory)try{await bounded(()=>fs.rm(directory,{recursive:true,force:true}),3000,'Temporary archive profile removal');result.cleanup.profile.removed=!nativeFs.existsSync(directory);assert.ok(result.cleanup.profile.removed);}catch(e){fail(e,'profile-removal');}
  result.finishedAt=new Date().toISOString();result.status=result.firstError?'FAIL':'PASS';
  try{
   await bounded(persist,3000,'Final archive evidence write');const saved=JSON.parse(await fs.readFile(path.join(output,'evidence.json'),'utf8'));
   for(const sample of saved.segments){const {frames,...summary}=frameSummary(sample.frameTimestamps);assert.equal(sample.frameCount,frames);for(const [key,value] of Object.entries(summary))assert.equal(sample[key],value);assert.equal(sample.active,false);}
   result.evidenceReadBack={frameCountsAndSummariesMatch:true,segments:saved.segments.length};await bounded(persist,3000,'Archive read-back evidence write');
  }catch(e){fail(e,'evidence-read-back');result.status='FAIL';try{await bounded(persist,3000,'Failed archive evidence write');}catch(writeError){fail(writeError,'failure-evidence-write');}}
 }
 console.log(JSON.stringify({output,input:result.input,status:result.status,segments:result.segments.map(({name,p50,p95,p99,over50ms,max,frameCount,viewport,dpr})=>({name,p50,p95,p99,over50ms,max,frameCount,viewport,dpr})),firstError:result.firstError,cleanup:result.cleanup},null,2));
}
async function selfCheck(){
 let reads=0,closed=false;
 const complete={send:async(method)=>method==='IO.read'?{data:++reads===1?'first':'second',eof:reads===2}:(closed=true,{})};
 assert.equal(await readTrace(complete,'stream'),'firstsecond');assert.ok(closed);
 const original=new Error('read failed');closed=false;
 const failing={send:async(method)=>{if(method==='IO.read')throw original;closed=true;throw new Error('secondary close failed');}};
 await assert.rejects(readTrace(failing,'stream'),e=>e===original);assert.ok(closed);
 await assert.rejects(bounded(()=>new Promise(()=>{}),10,'probe'),/probe timed out/);
 console.log('PASS no-GUI trace chunks/IO cleanup/first-error preservation/bounded wait self-check');
}
(process.argv[2]==='--self-check'?selfCheck():main()).catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
