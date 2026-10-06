// External macOS harness: ordinary packaged main, fresh independent fixture and real frozen ML.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createHash,randomUUID}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {_electron:electron}=require('../desktop/node_modules/playwright-core');
const {enterHall,enterArena}=require('../integration/gui-actions.cjs');
const {verifyStage}=require('./stage.cjs');
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
if(!option('--from')||!option('--out')||process.platform!=='darwin')throw Error('macOS usage: --from <complete fixture build> --out <new ignored output>');
const source=path.resolve(option('--from')),out=path.resolve(option('--out')),runId=randomUUID();
fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out,{recursive:false});
const report={evidence_kind:'ordinary packaged UI -> bundled core -> bundled AI -> preserved model',status:'NOT_RUN',native_install:'NOT_RUN',checks:[],screenshots:[],children:[],isolation:'current OS account; independent fixture identity and fresh default synthetic userData'};
const persist=()=>fs.writeFileSync(path.join(out,'frozen-ui.json'),JSON.stringify(report,null,2)+'\n');
const pass=(id,detail)=>{report.checks.push({id,status:'PASS',detail});console.log('PASS',id);};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test,timeout=30000){const end=Date.now()+timeout;while(Date.now()<end){const value=await test();if(value)return value;await pause(100);}throw Error('FROZEN_UI_TIMEOUT');}
function processes(){return execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).split('\n').flatMap(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);return m?[{pid:Number(m[1]),parent:Number(m[2]),executable:m[3]}]:[];});}
function descendants(pid){const rows=processes(),owned=new Set([pid]);for(let changed=true;changed;){changed=false;for(const row of rows)if(owned.has(row.parent)&&!owned.has(row.pid)){owned.add(row.pid);changed=true;}}return rows.filter(row=>owned.has(row.pid)&&row.pid!==pid);}
function alive(pid){try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}}
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samePath=(a,b)=>fs.existsSync(a)&&fs.existsSync(b)&&fs.realpathSync(a)===fs.realpathSync(b);
(async()=>{
 let app,page,application,userData,marker,ownedDirectory=false;const tracked=new Map();
 const shot=async name=>{await page.screenshot({path:path.join(out,name+'.png')});report.screenshots.push({file:name+'.png',version:report.version,code_sha:report.code_sha,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),cardStyle:await page.locator('.app').getAttribute('data-card-style')});};
 const read=async()=>{const reply=await page.evaluate(()=>window.desktop.port.getView());assert.equal(reply.ok,true,reply.error);return reply.data;};
 const rememberChildren=()=>{for(const child of descendants(app.process().pid))if(child.executable.startsWith(application+'/'))tracked.set(child.pid,child);};
 const close=async()=>{if(!app)return;rememberChildren();await app.close();app=null;await until(()=>[...tracked.keys()].every(pid=>!alive(pid)),7000);};
 try {
  const manifest=JSON.parse(fs.readFileSync(path.join(source,'release-manifest.json')));
  assert.equal(manifest.distribution,'fixture');assert.equal(manifest.appId,'cn.kalopsia.deidei.update-fixture');assert.ok(/^DeiDei Update Fixture [A-Za-z0-9][A-Za-z0-9 ._-]{0,99}$/.test(manifest.appName));
  report.version=manifest.version;report.code_sha=manifest.code_sha;report.appName=manifest.appName;
  userData=path.join(os.homedir(),'Library/Application Support',manifest.appName);assert.throws(()=>fs.lstatSync(userData),{code:'ENOENT'},'fresh independent default userData required');
  const original=fs.readFileSync(path.join(source,'application-path.txt'),'utf8');
  assert.equal(execFileSync('/usr/bin/plutil',['-extract','CFBundleIdentifier','raw',path.join(original,'Contents/Info.plist')],{encoding:'utf8'}).trim(),manifest.appId);
  const scratch=path.join(out,'中文 空格 只读安装');fs.mkdirSync(scratch);application=path.join(scratch,path.basename(original));execFileSync('/usr/bin/ditto',[original,application]);
  execFileSync('/bin/chmod',['-R','a-w',application]);assert.equal(fs.statSync(application).mode&0o222,0);
  const resources=path.join(application,'Contents/Resources');verifyStage(path.join(resources,'app'));
  assert.equal(hash(path.join(resources,'app/build-info.json')),manifest.build_info_sha256);
  const env={...process.env,PATH:'/usr/bin:/bin',DEIDEI_PYTHON:'/nonexistent/python',PYTHONHOME:'/nonexistent/python',PYTHONPATH:'/nonexistent/source'};
  for(const key of Object.keys(env))if(/^DEIDEI_AI_|^VIRTUAL_ENV$|^CONDA|^_PYI|^PYINSTALLER|^ELECTRON_RUN_AS_NODE$|^DEIDEI_TEST_DATA_DIR$|^DEIDEI_ROOM_URL$/.test(key))delete env[key];
  const cwd=path.join(out,'不同 工作目录');fs.mkdirSync(cwd);
  const launch=async base=>{app=await electron.launch({executablePath:path.join(base,'Contents/MacOS/DeiDeiR02'),args:[],cwd,env,timeout:45000});page=await app.firstWindow();page.setDefaultTimeout(15000);const context=await app.evaluate(({app})=>({pid:process.pid,isPackaged:app.isPackaged,name:app.getName(),version:app.getVersion(),userData:app.getPath('userData'),resources:process.resourcesPath}));assert.equal(context.isPackaged,true);assert.equal(context.name,manifest.appName);assert.equal(context.version,manifest.version);assert.equal(context.userData,userData);assert.ok(samePath(context.resources,path.join(base,'Contents/Resources')));return context;};
  const context=await launch(application);assert.equal((await page.evaluate(()=>window.desktop.profile.read())).data,null);
  assert.equal(fs.realpathSync(userData),userData);marker=path.join(userData,'.frozen-ui-owned-'+runId);fs.writeFileSync(marker,runId,{flag:'wx'});ownedDirectory=true;
  report.context={...context,userData:'<SYNTHETIC_DEFAULT>/'+manifest.appName};
  await enterHall(page,'冻结模型验收');await page.getByRole('button',{name:'单人对局',exact:false}).click();await page.locator('.prepare-screen').waitFor();
  await page.getByRole('radio',{name:'旧版 AI（试验）',exact:true}).check();
  const status=await until(async()=>{const reply=await page.evaluate(()=>window.desktop.port.soloStatus());assert.equal(reply.ok,true,reply.error);if(reply.data.state==='failed')throw Error('FROZEN_PREWARM_FAILED');return reply.data.state==='ready'?reply.data:false;},45000);
  const children=descendants(context.pid);const core=children.find(child=>samePath(child.executable,path.join(resources,'worker/deidei-worker'))),ai=children.find(child=>samePath(child.executable,path.join(resources,'ai-worker/deidei-ai-worker')));
  assert.ok(core,'real bundled core process required');assert.ok(ai,'real bundled AI process required');tracked.set(core.pid,core);tracked.set(ai.pid,ai);
  assert.ok(!children.some(child=>/worker-entry\.py|deidei_runtime\.worker/.test(child.executable)));
  pass('readonly-non-source-cwd-OS-only-PATH-frozen-prewarm',{state:status.state,corePid:core.pid,aiPid:ai.pid,developerAIEnvironmentRemoved:true});
  await shot('frozen-model-ready');await page.getByRole('button',{name:'开始对局',exact:false}).click();await enterArena(page);
  const deadline=Date.now()+120000;let view=await read(),last='',turns=[];
  while(view.phase!=='result'&&Date.now()<deadline){
   if(view.phase==='selecting'&&view.view_id!==last){
    await page.locator('.battle-table[data-phase="selecting"][data-ready="true"]').waitFor();
    const choice=view.options.some(option=>option.entry_id==='Bi'&&option.available)?'Bi':'Charge';
    await page.locator(`[data-entry="${choice}"] .card-pick`).click();await page.getByRole('button',{name:'确认出招',exact:true}).click();last=view.view_id;turns.push({turn:view.turn_index,choice});
   }
   await pause(100);view=await read();assert.equal(view.source,'live');
   if(view.opponent_status?.model_turns>0&&!report.firstModelTurn){assert.equal(view.decision_source,'legacy_model');assert.equal(view.opponent_status.fallback_turns,0);report.firstModelTurn={decision_source:view.decision_source,status:view.opponent_status};await shot('frozen-model-real-turn');}
  }
  assert.equal(view.phase,'result','bounded real model match must settle');assert.ok(view.opponent_status.model_turns>0);assert.equal(view.opponent_status.fallback_turns,0);
  report.match={turns,outcome:view.outcome,opponent_status:view.opponent_status};pass('ordinary-packaged-ML-match-settles-with-real-model-no-fallback',view.opponent_status);await shot('frozen-model-settlement');
  await close();pass('own-core-and-AI-reaped-on-ordinary-product-close');
  const damaged=path.join(out,'缺失 AI 副本',path.basename(application));fs.mkdirSync(path.dirname(damaged));execFileSync('/usr/bin/ditto',[application,damaged]);execFileSync('/bin/chmod',['-R','u+w',damaged]);fs.unlinkSync(path.join(damaged,'Contents/Resources/ai-worker/deidei-ai-worker'));
  const invalid=await launch(damaged);await enterHall(page,'冻结模型验收');await page.getByRole('button',{name:'单人对局',exact:false}).click();await page.locator('.prepare-screen').waitFor();
  await until(()=>page.getByText('PACKAGE_INCOMPLETE',{exact:false}).count());assert.equal(await page.getByRole('button',{name:'开始对局',exact:false}).isEnabled(),false);
  assert.ok(!descendants(invalid.pid).some(child=>/deidei-(?:ai-)?worker|python/i.test(child.executable)));await shot('frozen-missing-AI-rejected');pass('missing-fixed-AI-path-rejects-without-developer-fallback');await close();
  report.status='PASS';
 }catch(error){report.status='FAIL';report.error=String(error.stack||error);process.exitCode=1;if(page)await shot('failure').catch(()=>{});}
 finally {
  try{await close();}catch(error){report.status='FAIL';report.cleanup_error=String(error);process.exitCode=1;}
  report.children=[...tracked.values()].map(child=>({...child,alive:alive(child.pid)}));
  // Only a path absent before launch and subsequently marked by this run can be removed.
  if(ownedDirectory&&report.children.every(child=>!child.alive)&&fs.existsSync(marker)&&fs.readFileSync(marker,'utf8')===runId&&fs.realpathSync(userData)===userData){fs.rmSync(userData,{recursive:true});report.synthetic_userData_removed=true;}
  else if(ownedDirectory){report.synthetic_userData_removed=false;report.status='FAIL';process.exitCode=1;}
  persist();console.log(JSON.stringify({status:report.status,output:out,synthetic_userData_removed:report.synthetic_userData_removed}));
 }
})();
