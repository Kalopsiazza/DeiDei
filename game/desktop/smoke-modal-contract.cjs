// Issue #35: compile the real SharedUI Modal with a test-only React parent.
// Run from the task worktree. --compile-only never launches Electron.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), fsSync = require('node:fs');
const os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { createRequire } = require('node:module'), { execFileSync } = require('node:child_process');
const sourceRoot = path.resolve(process.env.DEIDEI_SOURCE_ROOT || process.cwd());
const desktop = path.join(sourceRoot, 'game/desktop');
const fromDesktop = createRequire(path.join(desktop, 'package.json'));
const { _electron: electron } = fromDesktop('playwright-core');
const esbuild = fromDesktop('esbuild');
const { sourceInput, closeApplication } = fromDesktop('./smoke-performance.cjs');
const output = path.resolve(process.env.DEIDEI_MODAL_CONTRACT_OUTPUT || path.join(os.tmpdir(), 'deidei-modal-contract-' + Date.now()));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const details = e => ({ message: e?.message || String(e), stack: e?.stack || null });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(action, ms, label) {
 let timer;
 try { return await Promise.race([action(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms); })]); }
 finally { clearTimeout(timer); }
}

// No Modal timer, close implementation, or ref is reproduced in this parent.
// Its only scenario mutation is a prop update after legal profile.read resolves.
const parentSource = `import React, {useLayoutEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Modal} from './SharedUI';
const evidence: any[] = [];
const record = (kind: string, data: any = {}) => evidence.push({kind,t:performance.now(),...data});
let dialogSerial = 0;
const nodes = new WeakMap<HTMLDialogElement, number>();
function Parent() {
 const [open,setOpen] = useState(false), [disabled,setDisabled] = useState(false), [version,setVersion] = useState('old');
 const [caseId,setCaseId] = useState('unarmed');
 const pending = useRef<string|null>(null), activeCase = useRef(caseId);
 activeCase.current = caseId;
 const capturedVersion = version, capturedCase = caseId;
 useLayoutEffect(() => {
  record('props',{caseId,open,disabled,version});
  (window as any).__modalContract = {
   evidence,
   reset: (id: string) => { pending.current=null;setCaseId(id);setDisabled(false);setVersion('old');setOpen(false); },
   arm: (transition: string) => { pending.current=transition;record('armed',{caseId,transition}); },
   clearBusy: () => setDisabled(false),
   watchNode: () => {
    const dialog=document.querySelector<HTMLDialogElement>('dialog');
    if(!dialog)throw new Error('No actual Modal dialog to watch');
    if(!nodes.has(dialog)){
     const nodeId=++dialogSerial;nodes.set(dialog,nodeId);
     dialog.addEventListener('close',e=>record('native-close',{caseId:activeCase.current,nodeId,trusted:e.isTrusted,connected:dialog.isConnected}));
     dialog.addEventListener('cancel',e=>record('native-cancel',{caseId:activeCase.current,nodeId,trusted:e.isTrusted}));
    }
    return nodes.get(dialog);
   },
   snapshot: () => {
    const dialog=document.querySelector<HTMLDialogElement>('dialog'), focus=document.activeElement;
    return {caseId,open,disabled,version,dialog:dialog?{nodeId:nodes.get(dialog)||null,open:dialog.open,inert:dialog.inert,closing:dialog.dataset.closing,closeDisabled:dialog.querySelector<HTMLButtonElement>('.dialog-close')?.disabled}:null,
     focus:{tag:focus?.tagName,id:(focus as HTMLElement)?.id||null,text:focus?.textContent?.trim()||null,insideDialog:!!dialog?.contains(focus),visible:focus instanceof HTMLElement&&focus.getBoundingClientRect().width>0&&focus.getBoundingClientRect().height>0},
     documentFocus:document.hasFocus(),visibility:document.visibilityState,dpr:devicePixelRatio,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
   }
  };
 },[caseId,open,disabled,version]);
 useLayoutEffect(() => {
  const key = (e: KeyboardEvent) => {
   const dialog=document.querySelector<HTMLDialogElement>('dialog');
   record('key',{caseId:activeCase.current,key:e.key,trusted:e.isTrusted,target:(e.target as HTMLElement)?.tagName,closing:dialog?.dataset.closing,disabled:dialog?.querySelector<HTMLButtonElement>('.dialog-close')?.disabled});
   if(e.key==='Escape'&&e.isTrusted&&pending.current&&dialog?.open){
    const transition=pending.current, id=activeCase.current;pending.current=null;
    record('ipc-start',{caseId:id,transition});
    (window as any).desktop.profile.read().then((response: any)=>{
     record('ipc-result',{caseId:id,transition,ok:response.ok});
     if(!response.ok)throw new Error('Legal profile.read failed: '+response.error);
     if(transition==='busy')setDisabled(true);else if(transition==='callback')setVersion('new');else throw new Error('Unknown prop transition');
    }).catch((e: Error)=>record('parent-error',{caseId:id,message:e.message}));
   }
  };
  document.addEventListener('keydown',key,true);
  return()=>document.removeEventListener('keydown',key,true);
 },[]);
 return <main className="app" data-page="modal-contract">
  <button id="contract-trigger" type="button" onClick={()=>{record('open-click',{caseId});setOpen(true);}}>打开测试弹窗</button>
  {open&&<Modal title="SharedUI 合同验证" closeDisabled={disabled} onClose={()=>{record('callback',{caseId:capturedCase,version:capturedVersion});setOpen(false);}}>
   <p>只验证真实 Modal 的关闭合同。</p>
   <button id="contract-action" type="button" onClick={()=>record('action',{caseId})}>内部测试动作</button>
  </Modal>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Parent/>);
`;

function ownedChildren(pid) {
 const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,comm='], {encoding:'utf8'}).split('\n').map(s=>s.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)).filter(Boolean).map(m=>({pid:Number(m[1]),ppid:Number(m[2]),command:m[3].trim()}));
 const parents=new Set([pid]),children=[];
 for(let changed=true;changed;){changed=false;for(const row of rows)if(parents.has(row.ppid)&&!parents.has(row.pid)){parents.add(row.pid);children.push(row);changed=true;}}
 return children;
}
function alive(pid) {try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
async function checkChildren(children) {
 const end=Date.now()+1500;
 while(children.some(c=>alive(c.pid))&&Date.now()<end)await delay(25);
 const records=[];
 for(const child of children){
  const row={pid:child.pid,ppid:child.ppid,forced:false};
  if(alive(child.pid))try{
   const current=execFileSync('ps',['-p',String(child.pid),'-o','comm='],{encoding:'utf8'}).trim();
   if(current===child.command){process.kill(child.pid,'SIGKILL');row.forced=true;}
   else row.error='PID identity changed; not terminated';
  }catch(e){if(alive(child.pid))row.error=e.message;}
  records.push(row);
 }
 const forcedEnd=Date.now()+1500;
 while(records.some(c=>alive(c.pid))&&Date.now()<forcedEnd)await delay(25);
 for(const row of records)row.alive=alive(row.pid);
 return records;
}

(async()=>{
 await fs.mkdir(output,{recursive:true});
 const parentFile=path.join(output,'modal-contract-parent.tsx'),bundleFile=path.join(output,'modal-contract-renderer.js'),wrapper=path.join(output,'controlled-main.cjs');
 const compiled=await esbuild.build({stdin:{contents:parentSource,resolveDir:desktop,sourcefile:'modal-contract-parent.tsx',loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',logLevel:'silent'});
 await fs.writeFile(parentFile,parentSource);await fs.writeFile(bundleFile,compiled.outputFiles[0].contents);
 const wrapperSource=`const fs=require('node:fs');
const {ipcMain,protocol}=require('electron');
global.__control={channel:'profile.read',delay:80,fail:false,calls:0,events:[]};
const handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,fn)=>handle(channel,async(...args)=>{const c=global.__control;if(channel===c.channel){c.calls++;c.events.push({kind:'ipc-wrapper-start',t:Date.now(),channel});await new Promise(r=>setTimeout(r,c.delay));if(c.fail)return {ok:false,error:'SAVE_FAILED'};}const response=await fn(...args);if(channel===c.channel)c.events.push({kind:'ipc-wrapper-result',t:Date.now(),channel,ok:response?.ok});return response;});
const protocolHandle=protocol.handle.bind(protocol);
protocol.handle=(scheme,fn)=>protocolHandle(scheme,request=>{if(scheme==='app'&&request.method==='GET'&&request.url==='app://desktop/renderer.js')return new Response(fs.readFileSync(${JSON.stringify(bundleFile)}),{headers:{'Content-Type':'text/javascript'}});return fn(request);});
require(${JSON.stringify(path.join(desktop,'main.cjs'))});
`;
 await fs.writeFile(wrapper,wrapperSource);
 const report={input:sourceInput(),source:'actual SharedUI export / test-only React parent props / ordinary main and original CSP/preload/sender guard / legal delayed profile.read',files:{parent:parentFile,bundle:bundleFile,wrapper},fingerprints:{driver:sha256(await fs.readFile(__filename)),parent:sha256(parentSource),bundle:sha256(compiled.outputFiles[0].contents),wrapper:sha256(wrapperSource),sharedUI:sha256(await fs.readFile(path.join(desktop,'SharedUI.tsx'))),index:sha256(await fs.readFile(path.join(desktop,'index.html')))},cases:[],errors:[],assetEvents:[]};
 if(process.argv.includes('--compile-only')){
  report.status='COMPILED';report.guiRun=false;await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,guiRun:false,output,input:report.input,files:report.files,fingerprints:report.fingerprints},null,2));return;
 }
 let app,page,profile;
 const fail=(e,stage)=>{const error={stage,...details(e)};if(!report.failure)report.failure=error;else(report.secondaryFailures??=[]).push(error);process.exitCode=1;};
 const persist=()=>fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n');
 const native=()=>app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0];if(!w)return {window:null};const display=screen.getDisplayMatching(w.getBounds());return {pid:process.pid,bounds:w.getBounds(),contentBounds:w.getContentBounds(),focused:w.isFocused(),visible:w.isVisible(),minimized:w.isMinimized(),fullscreen:w.isFullScreen(),display:{id:display.id,scaleFactor:display.scaleFactor},control:global.__control};});
 const state=()=>page.evaluate(()=>window.__modalContract.snapshot());
 const logs=id=>page.evaluate(id=>window.__modalContract.evidence.filter(e=>e.caseId===id),id);
 const focusAction=async()=>{
  for(let i=0;i<5;i++){
   if(await page.locator('#contract-action').evaluate(n=>document.activeElement===n))return;
   await page.keyboard.press('Tab');
  }
  assert.fail('Actual Tab did not reach visible internal action');
 };
 try{
  profile=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-modal-contract-profile-'));
  const env={...process.env,DEIDEI_TEST_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;delete env.DEIDEI_DEV_RELOAD;
  app=await electron.launch({args:[wrapper],env});page=await app.firstWindow();page.setDefaultTimeout(5000);
  page.on('pageerror',e=>report.errors.push({kind:'pageerror',message:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',message:m.text()});});
  page.on('requestfailed',r=>report.assetEvents.push({kind:'requestfailed',url:r.url(),failure:r.failure()}));
  page.on('response',r=>{if(r.status()>=400)report.assetEvents.push({kind:'http-error',url:r.url(),status:r.status()});});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>!!window.__modalContract);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();});await page.bringToFront();
  report.initial={native:await native(),state:await state()};
  assert.equal(report.initial.native.focused,true,'Owned native window must actually be focused');
  assert.equal(report.initial.state.documentFocus,true);assert.equal(report.initial.state.visibility,'visible');assert.equal(report.initial.state.reducedMotion,false);
  const csp=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');report.csp=csp;
  assert.match(csp,/default-src 'none'/);assert.match(csp,/script-src 'self'/);assert.match(csp,/connect-src 'none'/);
  for(const id of ['busy','callback']){
   const row={name:id==='busy'?'busy-change-during-240ms-cancels-close':'latest-callback-on-same-dialog-node',id};report.cases.push(row);
   await app.evaluate(()=>{global.__control.calls=0;global.__control.events=[];});
   await page.evaluate(id=>window.__modalContract.reset(id),id);
   await page.waitForFunction(id=>{const s=window.__modalContract.snapshot();return s.caseId===id&&!s.open&&!s.disabled&&s.version==='old';},id);
   await page.locator('#contract-trigger').click();await page.getByRole('dialog',{name:'SharedUI 合同验证',exact:true}).waitFor();
   row.nodeId=await page.evaluate(()=>window.__modalContract.watchNode());await focusAction();
   row.before={native:await native(),state:await state()};assert.equal(row.before.native.focused,true);assert.equal(row.before.state.documentFocus,true);assert.equal(row.before.state.focus.insideDialog,true);assert.equal(row.before.state.focus.id,'contract-action');
   await page.evaluate(id=>window.__modalContract.arm(id),id);
   await page.keyboard.press('Escape');row.closing=await state();assert.equal(row.closing.dialog?.closing,'true');assert.equal(row.closing.dialog.inert,true);assert.equal(row.closing.dialog.nodeId,row.nodeId);
   await page.keyboard.press('Enter');
   await page.waitForFunction(id=>window.__modalContract.evidence.some(e=>e.caseId===id&&e.kind==='props'&&(id==='busy'?e.disabled:e.version==='new')),id);
   row.propsChanged=await state();assert.equal(row.propsChanged.dialog?.nodeId,row.nodeId,'Prop change must use the identical native dialog node');
   let events=await logs(id);const escape=events.find(e=>e.kind==='key'&&e.key==='Escape'), enter=events.find(e=>e.kind==='key'&&e.key==='Enter');
   const commit=events.find(e=>e.kind==='props'&&(id==='busy'?e.disabled:e.version==='new'));
   assert.ok(escape?.trusted&&enter?.trusted,'Escape and Enter must be real trusted input');assert.equal(escape.disabled,false);
   assert.ok(enter.t>=escape.t&&enter.t-escape.t<240,'Escape → Enter must occur during ordinary close interval');
   assert.ok(commit.t>escape.t&&commit.t-escape.t<240,'New props must commit after Escape and before the ordinary 240ms timer');row.propCommitDelayMs=commit.t-escape.t;
   await page.waitForFunction(t=>performance.now()>=t+320,escape.t);
   row.after240={native:await native(),state:await state()};events=await logs(id);
   const count=kind=>events.filter(e=>e.kind===kind).length;
   assert.equal(row.after240.native.control.calls,1);assert.equal(count('parent-error'),0);assert.equal(count('action'),0);
   if(id==='busy'){
    assert.equal(row.after240.state.dialog?.nodeId,row.nodeId);assert.equal(row.after240.state.dialog.open,true);assert.equal(row.after240.state.dialog.closing,'false');assert.equal(row.after240.state.dialog.inert,false);assert.equal(row.after240.state.dialog.closeDisabled,true);
    assert.equal(count('callback'),0);assert.equal(count('native-close'),0);
    await page.screenshot({path:path.join(output,'busy-cancelled-close.png'),timeout:2000});
    await page.evaluate(()=>window.__modalContract.clearBusy());await page.waitForFunction(()=>!window.__modalContract.snapshot().disabled);
    await focusAction();row.afterBusyCleared={native:await native(),state:await state()};assert.equal(row.afterBusyCleared.native.focused,true);assert.equal(row.afterBusyCleared.state.focus.insideDialog,true);
    await page.keyboard.press('Escape');
   }
   await page.locator('dialog').waitFor({state:'detached'});
   await page.waitForFunction(id=>window.__modalContract.evidence.some(e=>e.caseId===id&&e.kind==='native-close'),id);
   row.final={native:await native(),state:await state()};row.events=await logs(id);
   const callbacks=row.events.filter(e=>e.kind==='callback'), closes=row.events.filter(e=>e.kind==='native-close');
   assert.equal(callbacks.length,1,'Exactly one parent close callback');assert.equal(closes.length,1,'Exactly one actual native close event');assert.ok(closes[0].trusted);
   assert.equal(callbacks[0].version,id==='callback'?'new':'old','Callback must be captured by the newest committed parent render');
   assert.equal(row.events.filter(e=>e.kind==='action').length,0);assert.equal(row.final.state.open,false);assert.equal(row.final.state.focus.id,'contract-trigger');assert.equal(row.final.state.documentFocus,true);assert.equal(row.final.native.focused,true);row.status='PASS';
   await page.screenshot({path:path.join(output,id+'-final.png'),timeout:2000});
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.assetEvents,[]);assert.equal(report.cases.length,2);
 }catch(e){fail(e,'scenario');}
 finally{
  if(page&&!page.isClosed()){
   try{report.final={native:await bounded(native,2000,'Final native state'),state:await bounded(state,2000,'Final renderer state'),events:await bounded(()=>page.evaluate(()=>window.__modalContract?.evidence||[]),2000,'Final event log')};}catch(e){fail(e,'final-diagnostics');}
   try{await page.screenshot({path:path.join(output,'final.png'),timeout:2000});}catch(e){(report.secondaryFailures??=[]).push({stage:'screenshot',...details(e)});}
  }
  try{await bounded(persist,3000,'Partial evidence write');}catch(e){fail(e,'partial-evidence-write');}
  report.cleanup={profile:{path:profile||null,removed:!profile}};let children=[];
  if(app){
   try{children=ownedChildren(app.process().pid);}catch(e){fail(e,'owned-process-capture');}
   try{report.cleanup.application=await closeApplication(app);assert.equal(report.cleanup.application.normalExit,true,'Normal owned Electron close must exit 0');assert.equal(report.cleanup.application.forced,false);}catch(e){fail(e,'application-close');}
   try{report.cleanup.children=await checkChildren(children);assert.ok(report.cleanup.children.every(c=>!c.forced&&!c.alive&&!c.error),'Owned child cleanup must not require force or leave a live process');}catch(e){fail(e,'child-cleanup');}
  }
  if(profile)try{await bounded(()=>fs.rm(profile,{recursive:true,force:true}),3000,'Temporary profile removal');report.cleanup.profile.removed=!fsSync.existsSync(profile);assert.equal(report.cleanup.profile.removed,true);}catch(e){fail(e,'profile-removal');}
  report.finishedAt=new Date().toISOString();report.status=report.failure?'FAIL':'PASS';
  try{
   await bounded(persist,3000,'Final evidence write');const saved=JSON.parse(await fs.readFile(path.join(output,'checks.json'),'utf8'));
   assert.equal(saved.status,report.status);assert.equal(saved.cases.length,report.cases.length);assert.deepEqual(saved.fingerprints,report.fingerprints);
   report.evidenceReadBack={cases:saved.cases.length,statusMatches:true,fingerprintsMatch:true};await bounded(persist,3000,'Read-back evidence write');
  }catch(e){fail(e,'evidence-read-back');report.status='FAIL';try{await bounded(persist,3000,'Failure evidence write');}catch(e){fail(e,'failure-evidence-write');}}
 }
 console.log(JSON.stringify({output,status:report.status,cases:report.cases.map(({name,status,propCommitDelayMs})=>({name,status,propCommitDelayMs})),failure:report.failure,secondaryFailures:report.secondaryFailures,cleanup:report.cleanup},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
