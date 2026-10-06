// External automation only. Requires an independent fresh fixture; native installation also requires effective signatures.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {_electron:electron}=require('../desktop/node_modules/playwright-core');
const semver=require('../desktop/node_modules/semver');
const {enterHall}=require('../integration/gui-actions.cjs');
const {closeApplication}=require('../desktop/smoke-performance.cjs');
const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:null;};
const from=option('--from'),next=option('--next'),destination=option('--out');
if(!from||!next||!destination)throw Error('Usage: --from <N build directory> --next <N+1 build directory> --out <new ignored test directory> [--expect-native-failure] [--resume]');
const out=path.resolve(destination),source=path.resolve(from),future=path.resolve(next),resume=args.includes('--resume'),expectFailure=args.includes('--expect-native-failure'),transportOnly=args.includes('--transport-only'),isolatedFixture=args.includes('--isolated-fixture');
if(isolatedFixture&&process.platform!=='darwin')throw Error('isolated-fixture currently supports macOS');
if(transportOnly&&expectFailure)throw Error('transport-only and native failure modes are separate');
const report={evidence_kind:'real packaged UI / native updater / replacement / new process',native_install:'NOT_RUN',production_trust:'NOT_RUN',checks:[],requests:[]};
if(!resume){fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out,{recursive:false});}
else if(!fs.statSync(out).isDirectory())throw Error('owned resume directory required');
const runId=Date.now()+'-'+require('node:crypto').randomUUID();
const save=()=>{const bytes=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(path.join(out,'native-update.json'),bytes);fs.writeFileSync(path.join(out,'native-update-'+runId+'.json'),bytes);};
const pass=id=>report.checks.push({id,status:'PASS'}),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const resources=app=>path.join(app,process.platform==='darwin'?'Contents/Resources':'resources');
const executable=app=>path.join(app,process.platform==='darwin'?'Contents/MacOS/DeiDeiR02':'DeiDeiR02.exe');
const buildInfo=app=>JSON.parse(fs.readFileSync(path.join(resources(app),'app/build-info.json')));
async function until(test,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){if(await test())return;await pause(250);}throw Error('NATIVE_FIXTURE_TIMEOUT');}
(async()=>{
 let app,page,server,nativeAttempted=false;const ownProcesses=new Set();
 const closeOwned=async()=>{if(!app)return;const result=await closeApplication(app);(report.closes??=[]).push(result);app=null;assert.equal(result.normalExit,true,'ordinary fixture close must exit normally');assert.equal(result.forced,false,'ordinary fixture close must not require force');};
 try{
  assert.ok(isolatedFixture||process.env.GITHUB_ACTIONS==='true'||process.env.DEIDEI_ISOLATED_TEST_ACCOUNT==='1','requires disposable test OS account or explicit macOS isolated fixture');
  assert.ok(['darwin','win32'].includes(process.platform));
  const windows=(mode,file,destination)=>{const shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');return execFileSync(shell,['-NoProfile','-File',path.join(__dirname,'native-windows.ps1'),mode,file,...(destination?[destination]:[])],{encoding:'utf8'}).trim();};
  const n=JSON.parse(fs.readFileSync(path.join(source,'release-manifest.json'))),n1=JSON.parse(fs.readFileSync(path.join(future,'release-manifest.json')));
  assert.equal(n.distribution,'fixture');assert.equal(n1.distribution,'fixture');assert.ok(n.appName.startsWith('DeiDei Update Fixture'));assert.equal(n.appName,n1.appName);assert.equal(n.appId,'cn.kalopsia.deidei.update-fixture');assert.equal(n.appId,n1.appId);assert.ok(semver.gt(n1.version,n.version));
  assert.ok(/^DeiDei Update Fixture [A-Za-z0-9][A-Za-z0-9 ._-]{0,99}$/.test(n.appName),'bounded independent app name required');
  if(isolatedFixture){
   const syntheticData=path.join(os.homedir(),'Library/Application Support',n.appName);
   if(!resume)assert.throws(()=>fs.lstatSync(syntheticData),{code:'ENOENT'},'isolated fixture requires a fresh default synthetic userData identity');
   report.isolation={mode:'explicit isolated fixture in current OS account; no new OS account',appName:n.appName,appId:n.appId,freshDefaultSyntheticUserData:!resume,ownedFixtureResume:resume};
  }
  const original=fs.readFileSync(path.join(source,'application-path.txt'),'utf8'),candidate=fs.readFileSync(path.join(future,'application-path.txt'),'utf8');
  // codesign writes its description to stderr, even on success.
  const description=dir=>{const {spawnSync}=require('node:child_process');return spawnSync('codesign',['--display','--verbose=4','-r-',dir],{encoding:'utf8'});};
  let initialInstaller;
  if(process.platform==='darwin') {
   const sig=description(original),newSig=description(candidate);
   if(!transportOnly&&(sig.status!==0||!/Authority=/.test(sig.stderr)||/Signature=adhoc/.test(sig.stderr)||(!expectFailure&&(newSig.status!==0||!/Authority=/.test(newSig.stderr)||/Signature=adhoc/.test(newSig.stderr))))){report.reason='No effective signed fixture identity; ad-hoc bytes cannot establish Squirrel designated requirement acceptance.';save();return;}
   if(!expectFailure){execFileSync('codesign',['--verify','--deep','--strict',candidate]);if(!transportOnly){const requirement=result=>(result.stdout+result.stderr).match(/designated => ([^\n]+)/)?.[1];assert.ok(requirement(sig));assert.equal(requirement(sig),requirement(newSig),'N and N+1 must share designated requirement');}}
  }else {
   initialInstaller=path.join(source,'packaged',n.artifacts.find(file=>file.filename.endsWith('.exe')).filename);
   const newInstaller=path.join(future,'packaged',n1.artifacts.find(file=>file.filename.endsWith('.exe')).filename);
   const sig=JSON.parse(windows('signature',initialInstaller)),newSig=JSON.parse(windows('signature',newInstaller));
   if(!transportOnly&&(sig.status!=='Valid'||(!expectFailure&&newSig.status!=='Valid'))){report.reason='No effective trusted Windows test publisher signature.';save();return;}
   if(!expectFailure&&!transportOnly)assert.equal(sig.publisher,newSig.publisher,'same NSIS publisher required');
  }
  const installed=path.join(out,'install',path.basename(original));
  if(!resume){assert.ok(!fs.existsSync(installed),'use a fresh output directory');fs.mkdirSync(path.dirname(installed),{recursive:true});if(process.platform==='darwin')execFileSync('ditto',[original,installed]);else windows('install',initialInstaller,installed);}
  else {const ownership=JSON.parse(fs.readFileSync(path.join(out,'fixture-ownership.json')));assert.equal(ownership.appName,n.appName);assert.equal(ownership.install,installed);assert.ok(fs.existsSync(installed));}
  const config=JSON.parse(fs.readFileSync(path.join(resources(installed),'update-config.json'))),url=new URL(config.url);
  assert.equal(config.mode,'fixture');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');assert.ok(url.port);
  for(const record of n1.artifacts){const file=path.join(future,'packaged',record.filename);assert.equal(path.basename(record.filename),record.filename);assert.equal(digest(file),record.sha256);assert.equal(fs.statSync(file).size,record.bytes);}
  server=http.createServer((request,response)=>{
   const parsed=new URL(request.url,config.url),name=parsed.pathname.slice(url.pathname.length);
   report.requests.push({path:parsed.pathname,staging_id_sent:Object.keys(request.headers).some(key=>key.toLowerCase()==='x-user-staging-id')});
   if(request.method!=='GET'||!parsed.pathname.startsWith(url.pathname)||!n1.artifacts.some(item=>item.filename===name)){response.writeHead(404);response.end();return;}
   const file=path.join(future,'packaged',name);response.setHeader('Content-Length',fs.statSync(file).size);fs.createReadStream(file).pipe(response);
  });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(url.port),'127.0.0.1',resolve);});
  const launch=async()=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await electron.launch({executablePath:executable(installed),args:[],env,timeout:45000});page=await app.firstWindow();page.setDefaultTimeout(15000);return app.evaluate(({app})=>({pid:process.pid,name:app.getName(),version:app.getVersion(),isPackaged:app.isPackaged,userData:app.getPath('userData')}));};
  const welcome=async()=>{await enterHall(page,'更新夹具');};
  const settings=async()=>{await page.getByRole('button',{name:/^设置(?:\s+S)?$/}).click();await page.locator('[aria-label="设置分类"]').getByRole('button',{name:/更新/}).click();};
  const state=()=>page.evaluate(()=>window.desktop.updates.read().then(r=>{if(!r.ok)throw Error(r.error);return r.data;}));
  const download=async()=>{await page.getByRole('button',{name:'检查更新',exact:true}).click();await until(async()=>(await state()).status==='available');await page.getByRole('button',{name:'下载',exact:true}).click();await until(async()=>{const value=await state();if(value.status==='error')throw Error(value.error);return value.status==='ready';});};
  const context=await launch();ownProcesses.add(context.pid);assert.equal(context.isPackaged,true);assert.equal(context.name,n.appName);assert.equal(context.version,n.version);assert.equal(path.basename(context.userData),n.appName);if(isolatedFixture)assert.equal(context.userData,path.join(os.homedir(),'Library/Application Support',n.appName));
  if(!resume){assert.equal((await page.evaluate(()=>window.desktop.profile.read())).data,null,'fresh fixture profile required');fs.writeFileSync(path.join(out,'fixture-ownership.json'),JSON.stringify({appName:n.appName,install:installed,userData:context.userData}));}
  await welcome(resume);
  if(!resume){const request=JSON.parse(fs.readFileSync(path.join(__dirname,'../../docs/rules/packs/golden-vectors.json')))[0].request;const r=await page.evaluate(request=>window.desktop.rules.savePreset('更新保留测试',request),request);assert.equal(r.ok,true);await page.getByRole('button',{name:/^设置(?:\s+S)?$/}).click();await page.getByRole('slider',{name:'音乐音量'}).fill('25');await page.getByRole('button',{name:'保存并关闭',exact:true}).click();}
  const before=await page.evaluate(async()=>({profile:(await window.desktop.profile.read()).data,rules:(await window.desktop.rules.read()).data,privacy:(await window.desktop.privacy.read()).data}));
  const cipher=await app.evaluate(()=>{const {safeStorage}=require('electron');return safeStorage.isEncryptionAvailable()?Array.from(safeStorage.encryptString('synthetic-update-fixture-capability')):null;});
  await settings();
  try {await download();}
  catch(error){
   if(!(expectFailure&&process.platform==='win32'&&error.message==='UPDATE_SIGNATURE_INVALID'))throw error;
   assert.equal((await state()).status,'error');assert.equal(buildInfo(installed).version,n.version);assert.equal((await state()).installPlan,null);
   pass('bad-Windows-publisher-rejected-during-download-old-app-retained');report.download_publisher='EXPECTED_FAILURE_OBSERVED';report.native_install='NOT_RUN';report.reason='Windows publisher rejection occurs before native handoff';save();return;
  }
  await closeOwned();
  assert.equal(buildInfo(installed).version,n.version);const again=await launch();ownProcesses.add(again.pid);assert.equal(again.version,n.version);await welcome(true);assert.equal((await state()).installPlan,null);pass('complete-download-ordinary-quit-reopen-remains-N');
  await settings();await download();
  if(transportOnly){assert.equal((await state()).installPlan,null);const preserved=await page.evaluate(async()=>({profile:(await window.desktop.profile.read()).data,rules:(await window.desktop.rules.read()).data,privacy:(await window.desktop.privacy.read()).data}));assert.deepEqual(preserved.profile,before.profile);assert.deepEqual(preserved.rules,before.rules);assert.deepEqual(preserved.privacy.persistedScopes,before.privacy.persistedScopes);assert.equal(preserved.privacy.recordLocal,before.privacy.recordLocal);assert.ok(report.requests.every(request=>!request.staging_id_sent));await page.screenshot({path:path.join(out,'download-ready.png')});pass('normal-main-real-complete-artifact-ready-after-recheck-and-cache-validation');report.transport_layer='PASS';report.native_install='NOT_RUN';report.reason='transport-only deliberately never calls native; native replacement not exercised';report.from_version=n.version;report.candidate_version=n1.version;save();return;}
  const closed=expectFailure?null:app.waitForEvent('close',{timeout:90000});nativeAttempted=true;await page.getByRole('button',{name:'现在重启安装',exact:true}).click();await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
  if(expectFailure){await until(async()=>(await state()).restartRequired===true);assert.equal(buildInfo(installed).version,n.version);assert.equal((await state()).status,'error');pass('bad-signature-fails-old-app-retained-restart-required');await closeOwned();report.native_install='EXPECTED_FAILURE_OBSERVED';save();return;}
  await closed;app=null;await until(()=>buildInfo(installed).version===n1.version);
  const processRows=()=>process.platform==='win32'?[JSON.parse(windows('processes',executable(installed))||'[]')].flat():execFileSync('/bin/ps',['-axo','pid=,comm='],{encoding:'utf8'}).split('\n').flatMap(line=>{const match=line.trim().match(/^(\d+)\s+(.+)$/);return match&&match[2]===executable(installed)?[Number(match[1])]:[];});
  await until(()=>processRows().some(pid=>!ownProcesses.has(pid)));const nativePids=processRows().filter(pid=>!ownProcesses.has(pid));assert.ok(nativePids.length);report.native_relaunched_pids=nativePids;
  // Only the unique fixture installation created above belongs to this harness.
  for(const pid of nativePids){ownProcesses.add(pid);process.kill(pid,'SIGTERM');}await until(()=>processRows().length===0);
  const upgraded=await launch();ownProcesses.add(upgraded.pid);assert.equal(upgraded.version,n1.version);assert.equal(buildInfo(installed).code_sha,n1.code_sha);assert.equal(upgraded.userData,context.userData);await welcome(true);
  const after=await page.evaluate(async()=>({profile:(await window.desktop.profile.read()).data,rules:(await window.desktop.rules.read()).data,privacy:(await window.desktop.privacy.read()).data}));assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.rules,before.rules);assert.deepEqual(after.privacy.persistedScopes,before.privacy.persistedScopes);assert.equal(after.privacy.recordLocal,before.privacy.recordLocal);pass('native-replacement-new-process-version-build-info-profile-rules-privacy-preserved');
  if(cipher){assert.equal(await app.evaluate(bytes=>require('electron').safeStorage.decryptString(Buffer.from(bytes)),cipher),'synthetic-update-fixture-capability');pass('same-safeStorage-fixture-capability-decrypts-after-replacement');}else report.checks.push({id:'safeStorage',status:'NOT_RUN',reason:'OS secure storage unavailable'});
  assert.ok(report.requests.every(request=>!request.staging_id_sent));pass('real-native-feed-never-receives-staging-installation-header');report.checks.push({id:'old-statistics-origin-erasure',status:'NOT_RUN',reason:'requires separately configured synthetic collector and consent scenarios'});report.native_install='PASS';report.from_version=n.version;report.to_version=n1.version;report.to_code_sha=n1.code_sha;save();
 }catch(error){report.status='FAIL';report.native_install=nativeAttempted?'FAIL':'NOT_RUN';if(transportOnly)report.transport_layer='FAIL';report.error=String(error.stack||error);save();process.exitCode=1;}
 finally{try{await closeOwned();}catch(error){report.status='FAIL';report.cleanup_error=String(error.stack||error);if(transportOnly)report.transport_layer='FAIL';process.exitCode=1;}if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}save();}
})();
