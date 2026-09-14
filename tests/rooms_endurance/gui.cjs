// Three ordinary Electron windows, real service/IPC; native dialog responses are scripted explicitly.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const {once}=require('node:events');
const {createInterface}=require('node:readline');
const [product,python,output,sha]=process.argv.slice(2);
const {_electron:electron}=require(path.join(product,'game/desktop/node_modules/playwright-core'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const report={source_sha:sha,platform:process.platform,arch:process.arch,transport:'ordinary main.cjs / real loopback CLI / real core',
  dialog_scope:'real HTML leave dialog; native OS callback responses scripted (no native dialog visual acceptance)',checks:[],screenshots:[]};
(async()=>{
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:product,encoding:'utf8'}).trim(),sha);
 assert.equal(execFileSync('git',['status','--porcelain','--','game/server','game/desktop','game/core'],{cwd:product,encoding:'utf8'}).trim(),'');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'r03-c-gui-'));
 const apps=[],pages=[],errors=[],processes=[];let service,port;await fs.mkdir(output,{recursive:true});
 async function startService(){
  service=spawn(python,['-u','-m','deidei_server','--port',String(port||0)],{env:{...process.env,PYTHONPATH:[path.join(product,'game/core'),path.join(product,'game/server')].join(path.delimiter)},stdio:['ignore','pipe','ignore']});
  const lines=createInterface({input:service.stdout});
  const [line]=await Promise.race([once(lines,'line'),delay(5000).then(()=>{throw Error('SERVICE_TIMEOUT');})]);lines.close();
  assert.match(line,/^Listening: ws:\/\/127\.0\.0\.1:\d+\/rooms-v1$/);const url=line.slice(11);port=new URL(url).port;return url;
 }
 async function stopService(){if(service&&service.exitCode===null){const exited=once(service,'exit');service.kill('SIGINT');await exited;}}
 async function state(page){const r=await page.evaluate(()=>window.desktop.online.read());assert.equal(r.ok,true);return r.data;}
 async function wait(page,fn){for(let i=0;i<160;i++){const s=await state(page);if(fn(s))return s;await delay(50);}throw Error('STATE_TIMEOUT');}
 async function call(page,op,p){const r=await page.evaluate(async({op,p})=>p===undefined?window.desktop.online[op]():window.desktop.online[op](p),{op,p});assert.equal(r.ok,true);return wait(page,s=>!s.pending);}
 try{
  const url=await startService();
  for(let i=0;i<3;i++){
   const env={...process.env,DEIDEI_TEST_DATA_DIR:path.join(directory,String(i)),DEIDEI_ROOM_URL:url,DEIDEI_PYTHON:python};delete env.ELECTRON_RUN_AS_NODE;
   const app=await electron.launch({executablePath:require(path.join(product,'game/desktop/node_modules/electron')),args:[path.join(product,'game/desktop/main.cjs')],env});apps.push(app);processes.push(app.process());
   const page=await app.firstWindow();pages.push(page);page.setDefaultTimeout(10000);page.on('pageerror',()=>errors.push('PAGE_ERROR'));
   await page.getByRole('textbox',{name:'昵称',exact:true}).fill(['测试房主','测试玩家','测试观众'][i]);await page.getByRole('button',{name:'保存，进入课间 →'}).click();
   if(i===0){await page.getByRole('button',{name:'单人对局',exact:false}).click();await page.getByRole('button',{name:'返回',exact:true}).click();report.checks.push('solo pre-start cancel returns to menu');}
   await page.getByRole('button',{name:'好友联机',exact:false}).click();await wait(page,s=>s.status==='connected');
  }
  let h=await call(pages[0],'create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});
  const room=h.snapshot.room_id,code=h.snapshot.view.room_code;
  for(let i=1;i<3;i++)await call(pages[i],'join',{room_code:code,password:null,role:i===1?'player':'spectator'});
  for(let i=0;i<2;i++)await call(pages[i],'ready',{room_id:room,ready:true});
  await call(pages[0],'start',{room_id:room});
  for(let i=0;i<3;i++){
   const s=await wait(pages[i],s=>s.snapshot?.view.phase==='selecting');assert.equal(s.source,'online');assert.equal(s.snapshot.room_id,room);
   assert.equal(JSON.stringify(s).includes('resume_token'),false);
   await pages[i].locator('.online[data-phase="selecting"]').waitFor();
   if(i===2)assert.equal(await pages[i].locator('.card').count(),0);
   const file=`real-${['host','player','observer'][i]}.png`;await pages[i].screenshot({path:path.join(output,file),scale:'css'});report.screenshots.push(file);
  }
  report.checks.push('three actual host/player/observer windows share real room; observer has no cards');
  await pages[0].getByRole('button',{name:'退出房间',exact:true}).click();await pages[0].getByRole('dialog',{name:'结束整个房间？'}).waitFor();
  await pages[0].getByRole('button',{name:'留在房间',exact:true}).click();assert.equal((await state(pages[0])).snapshot.room_id,room);
  await apps[0].evaluate(({dialog,BrowserWindow})=>{global.__cancel=0;dialog.showMessageBox=async()=>{global.__cancel++;return {response:0};};BrowserWindow.getAllWindows()[0].close();});
  await delay(80);assert.equal(await apps[0].evaluate(()=>global.__cancel),1);assert.equal((await state(pages[0])).snapshot.room_id,room);
  report.checks.push('real HTML host-leave cancellation and scripted native-close cancellation preserve live room');
  await stopService();await startService();
  for(const page of pages){const s=await wait(page,s=>s.error?.code==='SERVER_RESTART');assert.equal(s.status,'unavailable');assert.equal(s.pending,false);await page.getByRole('button',{name:'重新连接',exact:true}).waitFor();assert.equal(await page.locator('.card').count(),0);}
  report.checks.push('actual service restart hides all three old tables with SERVER_RESTART');
  // A new room cannot inherit the old room view. Use the same real IPC exposed to UI.
  await call(pages[0],'openLobby');await wait(pages[0],s=>s.status==='connected');
  h=await call(pages[0],'create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});assert.notEqual(h.snapshot.room_id,room);
  const profile=(await pages[1].evaluate(()=>window.desktop.profile.read())).data;
  const solo=await pages[1].evaluate(id=>window.desktop.port.startSolo(id),profile.local_id);assert.equal(solo.ok,true);assert.equal(solo.data.source,'live');
  report.checks.push('recovery creates distinct new room; offline real worker starts after restart');
  report.close_ms=[];
  for(const app of apps){
   const started=performance.now();const closed=app.waitForEvent('close',{timeout:5000});
   await app.evaluate(({dialog,BrowserWindow})=>{dialog.showMessageBox=async()=>({response:1});BrowserWindow.getAllWindows()[0].close();}).catch(()=>{});
   await closed;report.close_ms.push(Math.round(performance.now()-started));assert.ok(processes[apps.indexOf(app)].exitCode!==null||processes[apps.indexOf(app)].signalCode!==null);
  }
  report.checks.push('three sequential closes exit owned Electron processes');assert.deepEqual(errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.error=e.name;report.stage=report.checks.length;process.exitCode=1;}
 finally{
  for(const app of apps)if(processes[apps.indexOf(app)].exitCode===null&&processes[apps.indexOf(app)].signalCode===null){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close().catch(()=>{});}
  await stopService();report.owned_processes_after=processes.filter(p=>p.exitCode===null&&p.signalCode===null).length+(service&&service.exitCode===null&&service.signalCode===null?1:0);
  await fs.writeFile(path.join(output,'gui.json'),JSON.stringify(report,null,2)+'\n');await fs.rm(directory,{recursive:true,force:true});
 }
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.name);process.exitCode=1;});
