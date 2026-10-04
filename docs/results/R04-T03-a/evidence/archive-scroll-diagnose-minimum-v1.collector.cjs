// Read-only renderer diagnosis. Run from the task root with a fresh OUT.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),nativeFs=require('node:fs');
const path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(process.env.DEIDEI_SOURCE_ROOT||process.cwd()),desktop=path.join(root,'game/desktop');
const {_electron:electron}=require(path.join(desktop,'node_modules/playwright-core'));
const {sourceInput,captureDiagnostics,closeApplication}=require(path.join(desktop,'smoke-performance.cjs'));
const {enterHall}=require(path.join(root,'game/integration/gui-actions.cjs'));
const {bounded}=require(path.join(desktop,'smoke-archive-performance.cjs'));
const output=path.resolve(process.env.OUT||process.env.DEIDEI_ARCHIVE_SCROLL_OUTPUT||path.join(root,'.local-outputs/r04-t03-a/archive-scroll-'+Date.now()));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),hash=value=>createHash('sha256').update(value).digest('hex');
const sizes=[[1366,768],[1000,650],[1920,1080],[1366,768],[1600,650],[1000,1000],[1920,1200],[2560,1080],[1366,768]];
function ownedChildren(pid){
 const rows=execFileSync('ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').map(s=>s.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:+m[1],ppid:+m[2],command:m[3].trim()})),parents=new Set([pid]),children=[];
 for(let changed=true;changed;){changed=false;for(const row of rows)if(parents.has(row.ppid)&&!parents.has(row.pid)){parents.add(row.pid);children.push(row);changed=true;}}return children;
}
function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function cleanupChildren(children){
 const rows=children.map(c=>({...c,forced:false})),end=Date.now()+1500;
 while(rows.some(c=>alive(c.pid))&&Date.now()<end)await pause(25);
 for(const c of rows)if(alive(c.pid))try{const current=execFileSync('ps',['-p',String(c.pid),'-o','comm='],{encoding:'utf8'}).trim();if(current===c.command){process.kill(c.pid,'SIGKILL');c.forced=true;}else c.error='PID no longer belongs to the captured child; not terminated';}catch(e){if(alive(c.pid))c.error=e.message;}
 const forcedEnd=Date.now()+1500;while(rows.some(c=>alive(c.pid))&&Date.now()<forcedEnd)await pause(25);for(const c of rows)c.alive=alive(c.pid);return rows;
}
(async()=>{
 let app,page,profile,owned=false,stage='output';
 const report={input:sourceInput(),source:'ordinary original main and renderer / isolated real profile / actual hover and wheel / native content resize',scope:'Diagnosis only; additional read snapshots add observational overhead. No product state, DOM properties, deadlines or scroll positions are changed. Not strict performance or continuous native-focus acceptance.',sizes,records:[],events:[],errors:[],cleanup:{}};
 const fail=(e,where)=>{const failure={stage:where,message:e.message||String(e),stack:e.stack};if(!report.failure)report.failure=failure;else(report.secondaryFailures??=[]).push(failure);process.exitCode=1;};
 const persist=()=>fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n');
 const comparable=s=>({selected:s.dom.selected,stack:s.dom.stackTop,detail:s.dom.detailTop});
 const read=async label=>{
  const dom=await bounded(()=>page.evaluate(()=>{
   const n=document.querySelector('.archive-stack'),list=document.querySelector('.archive-stack-list');
   if(!n)throw new Error('Actual archive stack is unavailable');
   const item=[...n.querySelectorAll('.archive-stack-item')].find(x=>getComputedStyle(x).visibility!=='hidden'&&parseFloat(getComputedStyle(x).opacity)>0);
   return {at:performance.now(),viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,documentFocus:document.hasFocus(),visibility:document.visibilityState,selected:document.querySelector('.archive-card-detail')?.dataset.entry,stackTop:n.scrollTop,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,overflowAnchor:getComputedStyle(n).overflowAnchor,detailTop:document.querySelector('.archive-detail-scroll')?.scrollTop,listHeight:list?.style.height,scrollEndSupported:'onscrollend'in n,firstVisible:item?{entry:item.dataset.entry,top:item.getBoundingClientRect().top,logicalIndex:[...n.querySelectorAll('.archive-stack-item')].indexOf(item)}:null};
  }),3000,'DOM '+label);
  const native=await bounded(()=>app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0];return {pid:process.pid,id:w.id,focused:w.isFocused(),visible:w.isVisible(),bounds:w.getBounds(),content:w.getContentBounds(),display:{id:screen.getDisplayMatching(w.getBounds()).id,scaleFactor:screen.getDisplayMatching(w.getBounds()).scaleFactor}};}),3000,'Native '+label);
  const value={label,at:Date.now(),dom,native};report.records.push(value);return value;
 };
 const label=async value=>page.evaluate(value=>window.__archiveScrollProbe.label=value,value);
 const settle=async name=>{await bounded(()=>page.waitForFunction(()=>{const s=window.__archiveScrollProbe;return s.last!==null&&performance.now()-s.changedAt>=500;},null,{timeout:3000}),3200,name+' unchanged for 500ms');return read(name);};
 const shot=name=>bounded(()=>page.screenshot({path:path.join(output,name+'.png'),scale:'css',timeout:2500}),3000,'PNG '+name);
 const check=(name,fn)=>{try{fn();}catch(e){fail(e,name);}};
 try{
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});owned=true;
  report.driver={path:__filename,sha256:hash(await fs.readFile(__filename))};report.sourceHashes={};for(const file of ['ManualArchive.tsx','styles/archive.css','smoke-dynamic.cjs'])report.sourceHashes[file]=hash(await fs.readFile(path.join(desktop,file)));
  const original=path.join(root,'.local-outputs/r04-t03-a/dynamic-final-p5-v1/dynamic.json');if(nativeFs.existsSync(original)){const bytes=await fs.readFile(original),raw=JSON.parse(bytes);report.originalFullFailure={path:original,sha256:hash(bytes),status:raw.status,failure:raw.failure,archiveBefore:raw.archiveBefore,archiveAfterResize:raw.archiveAfterResize};}
  profile=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-archive-scroll-'));report.cleanup.profile={path:profile,removed:false};
  const env={...process.env,DEIDEI_TEST_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;delete env.DEIDEI_DEV_RELOAD;
  stage='launch';app=await electron.launch({args:[path.join(desktop,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push({kind:'pageerror',message:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',message:m.text()});});await page.emulateMedia({reducedMotion:'no-preference'});
  await app.evaluate(({app,BrowserWindow})=>{global.__archiveNativeEvents=[];const mark=(kind,w)=>{const live=w&&!w.isDestroyed();global.__archiveNativeEvents.push({kind,at:Date.now(),pid:process.pid,id:live?w.id:null,focused:live?w.isFocused():null});};app.on('browser-window-focus',(_e,w)=>mark('focus',w));app.on('browser-window-blur',(_e,w)=>mark('blur',w));mark('initial',BrowserWindow.getAllWindows()[0]);});
  stage='real-profile-and-hall';await enterHall(page,'图鉴滚动诊断');await page.locator('.app[data-page=menu]').waitFor();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1000,650));await page.waitForTimeout(500);
  await page.evaluate(()=>{
   const p=window.__archiveScrollProbe={label:'mount',events:[],last:null,lastKey:null,changedAt:0,startedAt:performance.now()};
   const take=kind=>{const n=document.querySelector('.archive-stack');if(!n)return;const v={kind,label:p.label,at:performance.now(),viewport:[innerWidth,innerHeight],stackTop:n.scrollTop,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,overflowAnchor:getComputedStyle(n).overflowAnchor,selected:document.querySelector('.archive-card-detail')?.dataset.entry,detailTop:document.querySelector('.archive-detail-scroll')?.scrollTop,listHeight:document.querySelector('.archive-stack-list')?.style.height,documentFocus:document.hasFocus(),scrollEndSupported:'onscrollend'in n};const key=JSON.stringify([v.stackTop,v.clientHeight,v.scrollHeight,v.listHeight,v.selected]);if(key!==p.lastKey){p.changedAt=v.at;p.lastKey=key;}p.last=v;p.events.push(v);};
   p.scroll=e=>{if(e.target?.matches?.('.archive-stack'))take('scroll');};p.scrollend=e=>{if(e.target?.matches?.('.archive-stack'))take('scrollend');};p.wheel=e=>{if(e.target?.closest?.('.archive-stack'))p.events.push({kind:'wheel',label:p.label,at:performance.now(),trusted:e.isTrusted,deltaX:e.deltaX,deltaY:e.deltaY});};document.addEventListener('scroll',p.scroll,true);document.addEventListener('scrollend',p.scrollend,true);document.addEventListener('wheel',p.wheel,{capture:true,passive:true});p.timer=setInterval(()=>take('interval-50ms'),50);
  });
  stage='archive-mount';await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();await page.locator('.archive-stack').waitFor();await read('mount-first-observed');await page.waitForTimeout(500);report.mountStable=await settle('mount-stable-500ms');assert.equal(report.mountStable.dom.selected,'Bi');assert.equal(report.mountStable.dom.overflowAnchor,'none');await shot('mount-stable');
  stage='real-wheel';await label('wheel');const stack=page.locator('.archive-stack');await stack.hover();report.beforeWheel=await read('before-wheel');await bounded(()=>page.mouse.wheel(0,1100),3000,'Actual wheel1100');await bounded(()=>page.waitForFunction(before=>document.querySelector('.archive-stack').scrollTop>=before+1099,report.beforeWheel.dom.stackTop,{timeout:3000}),3200,'Original wheel early threshold');report.earlyThreshold=await read('early-threshold');report.wheelSettled=await settle('wheel-settled-500ms');report.baseline=comparable(report.wheelSettled);await shot('wheel-settled');
  stage='no-resize-hold';await label('no-resize-hold-1s');await page.waitForTimeout(1000);report.noResizeHold=await read('no-resize-hold-1s');check('no-resize hold retains stable baseline',()=>assert.deepEqual(comparable(report.noResizeHold),report.baseline));
  for(const [leg,size]of sizes.entries()){
   stage='resize-leg-'+leg+'-'+size.join('x');await label(stage);const from=await page.evaluate(()=>[innerWidth,innerHeight]);
   for(let step=1;step<=12;step++){const requested=[Math.round(from[0]+(size[0]-from[0])*step/12),Math.round(from[1]+(size[1]-from[1])*step/12)];await bounded(()=>app.evaluate(({BrowserWindow},requested)=>BrowserWindow.getAllWindows()[0].setContentSize(...requested),requested),3000,stage+' setContentSize');await page.waitForTimeout(35);const sample=await read(stage+'-step-'+step);sample.requested=requested;sample.leg=leg;sample.step=step;}
   await page.waitForTimeout(180);const settled=await read(stage+'-stop-180ms');settled.requested=size;assert.deepEqual(settled.dom.viewport,size,'actual native CSS size');if(leg===1)await shot('archive-minimum');
  }
  stage='final-strict-compare';await label(stage);report.finalStable=await settle('final-stable-500ms');report.finalComparable=comparable(report.finalStable);check('pure resize retains archive selection and scroll',()=>assert.deepEqual(report.finalComparable,report.baseline));assert.deepEqual(report.errors,[]);await shot('final');
 }catch(e){fail(e,stage);}
 finally{
  if(page&&!page.isClosed()){
   try{report.events=await bounded(()=>page.evaluate(()=>{const p=window.__archiveScrollProbe;if(!p)return [];clearInterval(p.timer);document.removeEventListener('scroll',p.scroll,true);document.removeEventListener('scrollend',p.scrollend,true);document.removeEventListener('wheel',p.wheel,true);return p.events;}),3000,'Raw event evidence');report.nativeEvents=await bounded(()=>app.evaluate(()=>global.__archiveNativeEvents||[]),3000,'Native focus event evidence');report.diagnostics=await bounded(()=>captureDiagnostics(page),3000,'Final diagnostics');await shot('final');}catch(e){fail(e,'final-evidence');}
  }
  if(owned)try{await bounded(persist,3000,'Partial evidence');}catch(e){fail(e,'partial-write');}
  let children=[];
  if(app){try{children=ownedChildren(app.process().pid);}catch(e){fail(e,'owned-child-capture');}try{report.cleanup.application=await closeApplication(app);assert.equal(report.cleanup.application.normalExit,true);assert.equal(report.cleanup.application.forced,false);}catch(e){fail(e,'normal-close');}try{report.cleanup.children=await cleanupChildren(children);assert.ok(report.cleanup.children.every(c=>!c.alive&&!c.forced&&!c.error),'owned children exit without force');}catch(e){fail(e,'owned-child-cleanup');}}
  if(profile)try{await bounded(()=>fs.rm(profile,{recursive:true,force:true}),3000,'Isolated profile removal');report.cleanup.profile.removed=!nativeFs.existsSync(profile);assert.ok(report.cleanup.profile.removed);}catch(e){fail(e,'profile-cleanup');}
  report.finishedAt=new Date().toISOString();report.status=report.failure?'FAIL':'PASS';report.settleContract='Top/clientHeight/scrollHeight/listHeight/selected unchanged for at least500ms; raw scrollend events separately retained. No pixel tolerance or scroll reset.';
  if(owned)try{await bounded(persist,3000,'Final evidence');const saved=JSON.parse(await fs.readFile(path.join(output,'checks.json'),'utf8'));assert.equal(saved.status,report.status);assert.equal(saved.records.length,report.records.length);assert.equal(saved.events.length,report.events.length);report.readBack={status:saved.status,records:saved.records.length,events:saved.events.length};await bounded(persist,3000,'Readback evidence');}catch(e){fail(e,'readback');report.status='FAIL';await persist().catch(e=>fail(e,'failure-write'));}
 }
 console.log(JSON.stringify({output,status:report.status,failure:report.failure,secondaryFailures:report.secondaryFailures,baseline:report.baseline,final:report.finalComparable,records:report.records.length,events:report.events.length,cleanup:report.cleanup},null,2));
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
