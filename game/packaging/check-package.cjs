// External automation only. Never shipped, no production diagnostic hooks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {_electron:electron}=require('../desktop/node_modules/playwright-core');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samePath=(a,b)=>fs.existsSync(a)&&fs.existsSync(b)&&fs.realpathSync(a)===fs.realpathSync(b);

(async()=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true','GUI automation requires the disposable CI OS account; never use a private profile');
 const latest=JSON.parse(fs.readFileSync(path.join(__dirname,'build/latest.json')));
 const manifestFile=path.join(latest.out,'delivery-manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestFile));
 assert.equal(hash(latest.archive),manifest.sha256);
 const output=path.join(latest.out,'evidence');
 const report={code_sha:manifest.code_sha,package_sha256:manifest.sha256,evidence_kind:'packaged_automation',
  environment:{platform:process.platform,arch:process.arch,os:os.release(),account:'disposable GitHub-hosted CI account'},checks:[],games:[],screenshots:[],workers:[]};
 let app,page,hidden=false;
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'叠叠 成包 测试 '));
 const application=path.join(scratch,path.basename(latest.unpacked_application));
 const pass=(id,text)=>{report.checks.push({id,status:'PASS',text});console.log(id,text);};
 const save=()=>fs.writeFileSync(path.join(output,'packaged-automation.json'),JSON.stringify(report,null,2)+'\n');
 process.on('exit',code=>{report.driver_exit_code=code;save();});
 const exe=base=>path.join(base,process.platform==='darwin'?'Contents/MacOS/DeiDeiR02':'DeiDeiR02.exe');
 const resources=base=>path.join(base,process.platform==='darwin'?'Contents/Resources':'resources');
 const workerPath=path.join(resources(application),'worker',process.platform==='darwin'?'deidei-worker':'deidei-worker.exe');
 const env={...process.env,DEIDEI_PYTHON:'/nonexistent/python',PYTHONHOME:'/nonexistent/python',PYTHONPATH:'/nonexistent/source',
  DEIDEI_TEST_DATA_DIR:path.join(scratch,'must-be-ignored'),
  PATH:process.platform==='win32'?path.join(process.env.SystemRoot,'System32'):'/usr/bin:/bin'};
 delete env.ELECTRON_RUN_AS_NODE;
 if(process.platform==='win32')env.ELECTRON_NO_ATTACH_CONSOLE='1';
 function children(pid) {
  if(process.platform==='darwin')return execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').flatMap(line=>{
   const m=line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);return m&&Number(m[2])===pid?[{pid:Number(m[1]),executable:m[3]}]:[];
  });
  const shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const result=execFileSync(shell,['-NoProfile','-Command',`Get-CimInstance Win32_Process -Filter "ParentProcessId = ${Number(pid)}" | Select-Object ProcessId,ExecutablePath,Name | ConvertTo-Json -Compress`],{encoding:'utf8'}).trim();
  return result?[JSON.parse(result)].flat().map(p=>({pid:p.ProcessId,executable:p.ExecutablePath||p.Name})):[];
 }
 const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
 async function shot(name) {
  await page.screenshot({path:path.join(output,name+'.png'),scale:'css'});
  report.screenshots.push({name:name+'.png',kind:'real packaged Electron renderer screenshot',
   viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))});
 }
 async function launch(base=application) {
  app=await electron.launch({executablePath:exe(base),args:[],cwd:scratch,env,timeout:30000});
  page=await app.firstWindow();page.setDefaultTimeout(12000);
  const context=await app.evaluate(({app})=>({isPackaged:app.isPackaged,name:app.getName(),userData:app.getPath('userData'),resourcesPath:process.resourcesPath,versions:process.versions}));
  assert.equal(context.isPackaged,true);assert.equal(context.name,report.sourceContext.name);
  assert.equal(context.userData,report.sourceContext.userData);
  assert.notEqual(context.userData,env.DEIDEI_TEST_DATA_DIR);
  assert.ok(samePath(context.resourcesPath,resources(base)));
  report.packagedContext={...context,userData:'<CI_USER_DATA>/'+path.basename(context.userData),resourcesPath:'<UNPACKED_APPLICATION>/'+path.relative(base,context.resourcesPath)};
  return context;
 }
 async function start() {
  await page.getByRole('button',{name:/^单人对局/}).click();
  await page.getByRole('button',{name:'开始单人对局',exact:true}).click();
  await page.locator('.table[data-phase="selecting"]').waitFor();
  const view=(await page.evaluate(()=>window.desktop.port.getView())).data;
  assert.equal(view.source,'live');
  const processes=children(app.process().pid);
  const worker=processes.find(p=>samePath(p.executable,workerPath));
  assert.ok(worker,JSON.stringify(processes));
  report.workers.push(worker.pid);
  if(process.platform==='win32')assert.ok(!processes.some(p=>/conhost/i.test(p.executable)));
  return view;
 }
 async function close() {
  if(!app)return;
  await page.evaluate(()=>window.desktop.port.leave());
  await app.close();app=null;
  await pause(200);
  assert.ok(report.workers.every(pid=>!alive(pid)),'own worker not reaped');
 }
 try {
  // Read the original application's default name/path before creating any CI profile.
  const sourceEnv={...process.env};delete sourceEnv.ELECTRON_RUN_AS_NODE;delete sourceEnv.DEIDEI_TEST_DATA_DIR;
  if(process.platform==='win32')sourceEnv.ELECTRON_NO_ATTACH_CONSOLE='1';
  report.progress='launch source executable for name/path comparison';save();
  const sourceExecutable=path.join(root,'game/desktop/node_modules/electron/dist',process.platform==='darwin'?'Electron.app/Contents/MacOS/Electron':'electron.exe');
  assert.ok(fs.existsSync(sourceExecutable),'install the fixed source Electron before GUI comparison');
  app=await electron.launch({executablePath:sourceExecutable,args:[path.join(root,'game/desktop')],env:sourceEnv});
  page=await app.firstWindow();
  report.sourceContext=await app.evaluate(({app})=>({name:app.getName(),userData:app.getPath('userData'),isPackaged:app.isPackaged}));
  assert.equal(report.sourceContext.isPackaged,false);
  assert.equal((await page.evaluate(()=>window.desktop.profile.read())).data,null,'CI profile must initially be empty');
  report.progress='source comparison read; closing source';save();
  await app.close();app=null;
  report.progress='source closed; copying unpacked application';save();
  if(process.platform==='darwin')execFileSync('ditto',[latest.unpacked_application,application]);
  else fs.cpSync(latest.unpacked_application,application,{recursive:true});
  // Only the disposable CI checkout is hidden, never the user's working trees.
  for(const part of ['core','runtime'])fs.renameSync(path.join(root,'game',part),path.join(root,'game',part+'.t05-hidden'));
  hidden=true;
  if(process.platform==='darwin')execFileSync('chmod',['-R','a-w',application]);
  report.progress='launch real packaged executable';save();
  await launch();
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('成包验收');
  await page.getByRole('button',{name:'保存，进入课间 →',exact:true}).click();
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('slider',{name:'音乐音量'}).fill('25');
  await page.getByRole('button',{name:'保存并关闭',exact:true}).click();
  const manual=await page.evaluate(()=>window.desktop.manual());
  assert.equal(manual.ok,true);assert.equal(manual.data.entries.length,33);report.manual_entries=33;
  let view=await start();
  pass('P06','live options contain all 33 entries; packaged manual read succeeds');
  pass('P07','final archive application isPackaged=true, real worker child belongs to bundled resources');
  pass('P08','invalid developer variables, OS-only PATH, Chinese space path, different cwd, isolated CI source tree hidden');
  if(process.platform==='darwin')pass('P10','read-only application successfully writes profile/settings to the unchanged userData; unprivileged CI uid '+os.userInfo().uid);
  else report.checks.push({id:'P10',status:'NOT_RUN',text:'Windows CI account privileges do not establish ordinary-user read-only install acceptance'});
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});
   const layout=await page.evaluate(()=>({body:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],cards:[...document.querySelectorAll('.card')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,font:parseFloat(getComputedStyle(e.querySelector('strong')).fontSize)};})}));
   assert.equal(layout.cards.length,33);assert.equal(new Set(layout.cards.map(c=>Math.round(c.y))).size,3);
   assert.ok(layout.cards.every(c=>c.x>=0&&c.right<=width&&c.bottom<=height&&c.font>=16));
   assert.ok(layout.body[0]<=width&&layout.body[1]<=height);
   await shot(`packaged-${width}x${height}`);
  }
  await page.setViewportSize({width:1366,height:768});
  const deadline=Date.now()+12*60*1000;
  let recovery=false,fraction=false;
  for(let game=0;game<5;game++){
   const match=view.match_id,turns=[];
   let zengUsed=false,lastView='';
   while(view.phase!=='result'&&Date.now()<deadline){
    if(view.summary.some(s=>s.includes('自动休整')))recovery=true;
    if(view.participants.some(p=>BigInt(p.resources.dd6)%6n!==0n))fraction=true;
    if(view.phase==='selecting'&&view.view_id!==lastView){
     const available=id=>view.options.some(o=>o.entry_id===id&&o.available);
     const choice=!zengUsed&&available('ZengYi')?'ZengYi':available('GanBi')?'GanBi':available('Bi')?'Bi':'Charge';
     if(choice==='ZengYi')zengUsed=true;
     await page.locator(`[data-entry="${choice}"] .card-pick`).click();
     await page.getByRole('button',{name:'提交所选',exact:true}).click();
     lastView=view.view_id;turns.push({turn:view.turn_index,entry:choice});
    }
    await pause(150);
    const response=await page.evaluate(()=>window.desktop.port.getView());assert.equal(response.ok,true);
    view=response.data;assert.equal(view.source,'live');
   }
   assert.equal(view.phase,'result','random legal matches exceeded test time budget');
   await page.locator('.results').waitFor();await shot('packaged-result-'+(game+1));
   report.games.push({match_id:match,turns,outcome:view.outcome,summary:view.summary});save();
   await page.getByRole('button',{name:'再来一场',exact:true}).click();
   await page.locator('.table[data-phase="selecting"]').waitFor();
   view=(await page.evaluate(()=>window.desktop.port.getView())).data;
   assert.notEqual(view.match_id,match);assert.equal(view.turn_index,'1');
   assert.ok(view.participants.every(p=>p.alive&&p.resources.dd6==='0'));
   const restartedWorker=children(app.process().pid).find(p=>samePath(p.executable,workerPath));
   assert.ok(restartedWorker);assert.ok(report.workers.every(pid=>!alive(pid)));
   report.workers.push(restartedWorker.pid);
  }
  pass('P12','five real random-legal-v1 matches completed; each restart has fresh match and resources');
  report.checks.push({id:'P12-auto-recovery',status:recovery?'PASS':'NOT_RUN',text:recovery?'observed automatic recovery in actual package':'not encountered within random run budget'});
  report.checks.push({id:'P12-fraction',status:fraction?'PASS':'NOT_RUN',text:fraction?'non-integer DD observed in actual package':'not encountered within random run budget; source regression remains separate'});
  // Abruptly terminate only the actual child we identified by parent and bundled path.
  const own=children(app.process().pid).find(p=>samePath(p.executable,workerPath));assert.ok(own);
  process.kill(own.pid,'SIGTERM');
  await page.getByText('本场中断，可重新开始。',{exact:false}).first().waitFor();await shot('packaged-worker-interrupted');
  await page.getByRole('button',{name:'退出本场',exact:true}).click();await start();
  pass('P12-error','actual bundled worker termination shows interruption and explicit restart succeeds');
  await close();
  for(let i=0;i<9;i++){
   await launch();
   const profile=(await page.evaluate(()=>window.desktop.profile.read())).data;
   assert.equal(profile.nickname,'成包验收');assert.equal(profile.settings.music,25);
   await start();await close();
  }
  pass('P11','ten application open/start/leave/exit cycles; every observed own worker reaped');
  pass('P15','both renderer viewports verified; name/default userData unchanged; nickname and settings survive restart');
  for(const missing of ['worker','catalog']){
   const damaged=path.join(scratch,missing,path.basename(application));fs.mkdirSync(path.dirname(damaged));
   if(process.platform==='darwin'){execFileSync('ditto',[application,damaged]);execFileSync('chmod',['-R','u+w',damaged]);}
   else fs.cpSync(application,damaged,{recursive:true});
   const missingPath=path.join(resources(damaged),'worker',missing==='worker'?(process.platform==='darwin'?'deidei-worker':'deidei-worker.exe'):'_internal/deidei_runtime/data/catalog.json');
   fs.renameSync(missingPath,missingPath+'.removed');
   await launch(damaged);
   await page.getByRole('button',{name:/^单人对局/}).click();await page.getByRole('button',{name:'开始单人对局',exact:true}).click();
   await page.getByText('游戏文件不完整，请重新取得完整测试包',{exact:false}).first().waitFor();await shot('packaged-missing-'+missing);
   assert.ok(!children(app.process().pid).some(p=>/deidei-worker|python/i.test(p.executable)));
   await close();
  }
  pass('P09','damaged bundle copies show PACKAGE_INCOMPLETE; no Python/worker fallback spawned');
  assert.equal(hash(latest.archive),manifest.sha256);
  manifest.levels.packaged_automation='PASS';
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  report.status='PASS';
 }catch(error){report.status='FAIL';report.error=String(error);throw error;}
 finally{
  if(app){await close().catch(async()=>{await app.close().catch(()=>{});});}
  if(hidden)for(const part of ['core','runtime'])fs.renameSync(path.join(root,'game',part+'.t05-hidden'),path.join(root,'game',part));
  if(report.sourceContext)report.sourceContext.userData='<CI_USER_DATA>/'+path.basename(report.sourceContext.userData);
  save();
  // Preserve screenshots and reports; only disposable copied apps are cleaned.
  if(process.platform==='darwin')execFileSync('chmod',['-R','u+w',scratch]);
  fs.rmSync(scratch,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
