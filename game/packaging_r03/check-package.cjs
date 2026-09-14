// Final ZIP automation. Normal product IPC/real sockets only, never a injected room/clock.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
const {spawn,execFileSync}=require('node:child_process');
const {Peer,pause,until}=require('./peer.cjs');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const out=path.resolve(process.argv[2]);const headless=process.argv.includes('--headless');
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'delivery-manifest.json')));
 assert.equal(path.basename(manifest.filename),manifest.filename,'INVALID_ARTIFACT_PATH');
 assert.equal(hash(path.join(out,manifest.filename)),manifest.sha256);
 const evidence=path.join(out,'evidence');const report={source_sha:manifest.source_sha,packaging_sha:manifest.packaging_sha,archive_sha256:manifest.sha256,platform:process.platform,arch:process.arch,status:'RUNNING',headless,games:0,cycles:0,checks:[],screenshots:[]};
 const file=path.join(evidence,headless?'frozen-server-probe.json':'packaged-automation.json');
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 const unpacked=path.join(out,headless?'中文 空格 无界面解压':'中文 空格 再次解压');assert.ok(!fs.existsSync(unpacked),'FRESH_EXTRACTION_REQUIRED');fs.mkdirSync(unpacked);
 const python=process.env.R03_PYTHON;assert.ok(python,'DEDICATED_PYTHON_REQUIRED_FOR_DRIVER');
 const archive=path.join(out,manifest.filename);
 if(process.platform==='darwin')execFileSync('ditto',['-x','-k',archive,unpacked]);
 else execFileSync(python,['-c','import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',archive,unpacked]);
 execFileSync(python,['-c',"import sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from verify import verify; verify(Path(sys.argv[2]),sys.argv[3],sys.argv[4],sys.argv[5])",__dirname,unpacked,manifest.source_sha,manifest.packaging_sha,manifest.platform]);
 const mac=process.platform==='darwin';const serverExe=path.join(unpacked,'room-server',mac?'deidei-room-server':'deidei-room-server.exe');
 const application=path.join(unpacked,mac?'DeiDei R03 Diagnostic.app':'DeiDei R03 Diagnostic-win32-x64');
 const appExe=path.join(application,mac?'Contents/MacOS/DeiDeiR03':'DeiDeiR03.exe');
 const env={...process.env,PYTHONHOME:'/nonexistent',PYTHONPATH:'/nonexistent',DEIDEI_PYTHON:'/nonexistent',PATH:mac?'/usr/bin:/bin':path.join(process.env.SystemRoot,'System32')};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_TEST_DATA_DIR;
 let server,app,page,peer,helper,url,serverText='';
 const startServer=async()=>{serverText='';server=spawn(serverExe,['--host','127.0.0.1','--port','0'],{env,cwd:unpacked,stdio:['ignore','pipe','pipe'],windowsHide:true});server.on('error',()=>{report.server_spawn_error=true;});server.stdout.on('data',b=>{serverText=(serverText+b).slice(-2048);});server.stderr.on('data',()=>{});url=await until(()=>serverText,s=>/^Listening: ws:\/\/127\.0\.0\.1:\d+\/rooms-v1\r?\n/.test(s));url=url.trim().slice('Listening: '.length);assert.match(url,/^ws:\/\/127\.0\.0\.1:\d+\/rooms-v1$/);};
 const pass=name=>{report.checks.push(name);save();console.log('PASS',name);};
 const state=async()=>{const r=await page.evaluate(()=>window.desktop.online.read());assert.equal(r.ok,true);return r.data;};
 const invoke=async(name,payload)=>{const r=await page.evaluate(async({name,payload})=>payload===undefined?window.desktop.online[name]():window.desktop.online[name](payload),{name,payload});assert.equal(r.ok,true,`IPC_${r.error}`);return r.data;};
 const view=async(phase)=>until(state,s=>s.snapshot?.view.phase===phase&&!s.pending);
 const shot=async name=>{await page.screenshot({path:path.join(evidence,name+'.png'),scale:'css'});report.screenshots.push(name+'.png');};
 const leave=async()=>{await invoke('leave');await until(state,s=>!s.pending&&!s.snapshot);};
 try{
  save();await startServer();peer=await new Peer(url).open();pass('final ZIP frozen server starts without system Python; rooms-1.1 hello');
  if(headless){report.status='HEADLESS_DIAGNOSTIC_PASS';return;}
  assert.equal(process.env.GITHUB_ACTIONS,'true','DISPOSABLE_CI_ACCOUNT_REQUIRED; no private default profile');
  const { _electron:electron }=require(path.join(out,'source/game/desktop/node_modules/playwright-core'));
  const launch=async(executablePath=appExe)=>{app=await electron.launch({executablePath,args:[],env:{...env,DEIDEI_ROOM_URL:url},cwd:unpacked,timeout:30000});page=await app.firstWindow();page.setDefaultTimeout(15000);assert.equal(await app.evaluate(({app})=>app.isPackaged),true);};
  await launch();assert.equal((await page.evaluate(()=>window.desktop.profile.read())).data,null,'NONEMPTY_OS_PROFILE');
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('成包验收');await page.getByRole('button',{name:'保存，进入课间 →'}).click();
  await page.getByRole('button',{name:'好友联机',exact:false}).click();await until(state,s=>s.status==='connected');
  const create=async()=>{await invoke('create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});return (await view('lobby')).snapshot;};
  let room=await create();await peer.join(room.view.room_code);
  for(let game=0;game<5;game++){
   await peer.ready();await invoke('ready',{room_id:room.room_id,ready:true});await until(state,s=>s.snapshot?.view.members.filter(p=>p.role==='player').every(p=>p.ready));await invoke('start',{room_id:room.room_id});let s=await view('selecting');
   if(game===0){const before=s.snapshot.view;await invoke('setTurnLimit',{room_id:room.room_id,turn_ms:5000,expected_policy_revision:before.policy_revision});s=await until(state,s=>s.snapshot?.view.policy.turn_ms===5000&&!s.pending);assert.equal(s.snapshot.view.current_turn_ms,10000);assert.equal(s.snapshot.view.timer.deadline_at_ms,before.timer.deadline_at_ms);await shot('packaged-future-time');}
   else assert.equal(s.snapshot.view.current_turn_ms,5000);
   if(game===0)for(const [width,height] of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});const layout=await page.evaluate(()=>({scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],cards:[...document.querySelectorAll('.card')].map(e=>{const r=e.getBoundingClientRect();return [r.y,r.right,r.bottom];})}));assert.equal(layout.cards.length,33);assert.equal(new Set(layout.cards.map(c=>Math.round(c[0]))).size,3);assert.ok(layout.cards.every(c=>c[1]<=width&&c[2]<=height));assert.ok(layout.scroll[0]<=width&&layout.scroll[1]<=height);await shot(`packaged-table-${width}x${height}`);}
   await page.setViewportSize({width:1366,height:768});await peer.submit(s.snapshot.view,'SelfBi');await page.locator('[data-entry="Charge"] .card-pick').click();await page.getByRole('button',{name:'提交所选',exact:true}).click();s=await view('result');assert.equal(s.snapshot.view.match.effective_outcome.winner_id,s.snapshot.view.self.player_id);assert.ok(s.snapshot.view.match.last_turn);report.games++;await shot('packaged-result-'+report.games);
   await invoke('returnLobby',{room_id:room.room_id});await view('lobby');
  }
  pass('five real packaged Electron + normal peer matches; future timing effective only next select');
  helper=await new Peer(url).open();await helper.join(room.view.room_code);await helper.ready();await peer.ready();await invoke('ready',{room_id:room.room_id,ready:true});await until(state,s=>s.snapshot.view.members.every(p=>p.ready));await invoke('start',{room_id:room.room_id});
  for(let missing=0;missing<3;missing++){
   const s=await view('selecting');await helper.submit(s.snapshot.view,'Charge');await invoke('submit',{room_id:room.room_id,match_id:s.snapshot.view.match.match_id,turn_id:s.snapshot.view.match.turn_id,entry_id:'Charge'});await view('revealing');
  }
  await until(()=>peer.ended,e=>e?.reason==='three_absences');pass('ordinary peer receives directed removal after three absent turns');
  await leave();await until(()=>helper.snapshot,s=>s?.view.phase==='closed'&&s.view.close_reason==='HOST_LEFT');assert.equal(helper.snapshot.view.match.effective_outcome,null);pass('host after_turn leave closes without false winner');helper.close();helper=null;
  await invoke('openLobby');await until(state,s=>s.status==='connected');room=await create();peer.close();peer=null;
  const oldUrl=url;server.kill();await until(()=>server.exitCode!==null||server.signalCode!==null,v=>v);await until(state,s=>s.status==='reconnecting');const port=new URL(oldUrl).port;server=spawn(serverExe,['--host','127.0.0.1','--port',port],{env,cwd:unpacked,stdio:'ignore',windowsHide:true});
  await until(state,s=>s.status==='unavailable'&&s.error?.code==='SERVER_RESTART',20000);await shot('packaged-server-restarted');pass('server restart invalidates old temporary identity');
  await page.getByRole('button',{name:'返回主菜单',exact:true}).click();await page.getByRole('button',{name:'单人对局',exact:false}).click();await page.getByRole('button',{name:'开始单人对局',exact:true}).click();await page.locator('.table[data-phase="selecting"]').waitFor();assert.equal((await page.evaluate(()=>window.desktop.port.getView())).data.source,'live');await shot('packaged-offline');await page.evaluate(()=>window.desktop.port.leave());await app.close();app=null;report.cycles=1;
  for(let i=1;i<10;i++){await launch();assert.equal((await page.evaluate(()=>window.desktop.profile.read())).data.nickname,'成包验收');await page.getByRole('button',{name:'单人对局',exact:false}).click();await page.getByRole('button',{name:'开始单人对局',exact:true}).click();await page.locator('.table[data-phase="selecting"]').waitFor();await page.evaluate(()=>window.desktop.port.leave());await app.close();app=null;report.cycles++;}
  pass('ten app launch/solo/leave/exit cycles; bundled offline worker remains usable');
  for(const missing of ['worker','catalog']){
   const damaged=path.join(out,'损坏 副本 '+missing,path.basename(application));fs.mkdirSync(path.dirname(damaged),{recursive:true});
   if(mac)execFileSync('ditto',[application,damaged]);else fs.cpSync(application,damaged,{recursive:true});
   const res=path.join(damaged,mac?'Contents/Resources':'resources');
   fs.unlinkSync(path.join(res,'worker',missing==='worker'?(mac?'deidei-worker':'deidei-worker.exe'):'_internal/deidei_runtime/data/catalog.json'));
   await launch(path.join(damaged,mac?'Contents/MacOS/DeiDeiR03':'DeiDeiR03.exe'));
   await page.getByRole('button',{name:'单人对局',exact:false}).click();await page.getByRole('button',{name:'开始单人对局',exact:true}).click();
   await page.getByText('游戏文件不完整',{exact:false}).first().waitFor();await shot('packaged-missing-'+missing);await app.close();app=null;
  }
  const missingServer=spawn(path.join(unpacked,'missing-server'),[],{stdio:'ignore'});
  const missingError=await new Promise(resolve=>missingServer.once('error',e=>resolve(e.code)));assert.equal(missingError,'ENOENT');
  pass('damaged worker/catalog copies fail explicitly; missing server spawn fails without fallback');
  report.status=manifest.status==='DIAGNOSTIC_BASELINE'?'DIAGNOSTIC_BASELINE_AUTOMATION_PASS':'PACKAGED_AUTOMATION_PASS';
 }catch(e){report.status='FAIL';report.error=e.message.split(os.homedir()).join('<USER_HOME>').slice(0,1500);throw new Error(report.error);}
 finally{if(helper)helper.close();if(peer)peer.close();if(app){await page.evaluate(()=>window.desktop.online.leave()).catch(()=>{});await page.evaluate(()=>window.desktop.port.leave()).catch(()=>{});await app.close().catch(()=>{});}if(server&&server.exitCode===null)server.kill();if(!headless){manifest.packaged_automation=report.status;fs.writeFileSync(path.join(out,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');}save();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
