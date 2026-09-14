const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const output=process.env.DEIDEI_ONLINE_SMOKE_OUTPUT?path.resolve(process.env.DEIDEI_ONLINE_SMOKE_OUTPUT):path.resolve(__dirname,'../../../docs/results/R03-T02-a');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-online-'));
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;
 const evidence={source:'fixture',transport:'scripted fake socket in tests only; NOT a real room service',platform:process.platform,arch:process.arch,checks:[],screenshots:[]};
 let app;
 const passed=text=>{evidence.checks.push(text);console.log('PASS',text);};
 await fs.mkdir(output,{recursive:true});
 try{
  app=await electron.launch({args:[path.join(__dirname,'smoke-main.cjs')],env});const page=await app.firstWindow();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  evidence.native=await app.evaluate(({BrowserWindow})=>({content:BrowserWindow.getAllWindows()[0].getContentBounds(),versions:process.versions,WebSocket:typeof WebSocket}));
  const shot=async name=>{await page.screenshot({path:path.join(output,`${name}.png`),scale:'css'});evidence.screenshots.push({name,source:'fixture',capture:'actual Electron development viewport',viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}))});};
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('本机验收');await page.getByRole('button',{name:'保存，进入课间 →'}).click();
  assert.equal(await app.evaluate(()=>global.__onlineTest.socket===undefined),true);
  await page.getByRole('button',{name:'好友联机',exact:false}).click();await page.getByText('已连接',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
  assert.equal(await page.evaluate(async()=>JSON.stringify((await window.desktop.online.read()).data).includes('resume_token')),false);
  await page.getByRole('button',{name:'创建房间',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'每拍时间'}).inputValue(),'12000');
  await shot('mock-create');await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.locator('.lobby-seats').waitFor();
  assert.equal((await page.evaluate(()=>window.desktop.online.create({password:null,options:{turn_ms:12000,early_reveal:true,spectator_cap:6},url:'ws://example.com'}))).error,'INVALID_MESSAGE');
  assert.equal((await page.evaluate(()=>window.desktop.online.create({password:'x'.repeat(5000),options:{turn_ms:12000,early_reveal:true,spectator_cap:6}}))).error,'INVALID_INPUT');
  for(const [width,height] of [[1366,768],[1920,1080]]){await page.setViewportSize({width,height});await shot(`mock-lobby-${width}x${height}`);}
  assert.equal(await page.getByRole('button',{name:'开始对局',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'取消准备',exact:true}).waitFor();
  await page.getByRole('button',{name:'开始对局',exact:true}).click();await page.locator('.online[data-phase="selecting"]').waitFor();
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});
   const layout=await page.evaluate(()=>({size:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],cards:[...document.querySelectorAll('.card')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,font:parseFloat(getComputedStyle(e.querySelector('strong')).fontSize)};})}));
   assert.equal(layout.cards.length,33);assert.equal(new Set(layout.cards.map(c=>Math.round(c.y))).size,3);assert.ok(layout.cards.every(c=>c.x>=0&&c.right<=width&&c.bottom<=height&&c.font>=16));assert.ok(layout.scroll[0]<=width&&layout.scroll[1]<=height,JSON.stringify(layout));
   evidence[`layout_${width}`]=layout;await shot(`mock-table-${width}x${height}`);
  }
  passed('Actual Electron create, six-seat lobby, ready/start; 33 cards in three rows at both target viewports');
  await page.setViewportSize({width:1366,height:768});
  await page.locator('[data-entry="Charge"] .card-pick').click();await page.getByRole('button',{name:'提交所选',exact:true}).click();await page.getByText('已确认：攒／DeiDei',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'提交所选',exact:true}).isDisabled(),true);await shot('mock-submitted');
  await app.evaluate(()=>{const ctl=global.__onlineTest;const v=ctl.view;v.seq=String(BigInt(v.seq)+1n);v.view.phase='paused';v.view.self.options=[];v.view.pause={reason:'HOST_DISCONNECTED',resume_phase:'selecting',phase_remaining_ms:8500};v.view.timer={kind:'host_grace',deadline_at_ms:130000,remaining_ms:30000};ctl.socket.message(v);});
  await page.locator('.online[data-phase="paused"]').waitFor();assert.equal(await page.locator('.card').count(),0);await shot('mock-host-paused');
  await app.evaluate(()=>{const {snapshot}=global.__onlineSamples;const ctl=global.__onlineTest;ctl.view=snapshot('revealing',String(BigInt(ctl.view.seq)+1n));ctl.socket.message(ctl.view);});
  await page.locator('.online[data-phase="revealing"]').waitFor();await page.locator('.summary details').evaluate(e=>e.open=true);await shot('mock-revealing');assert.match(await page.locator('.online-self-resources').innerText(),/DD 7/);
  await app.evaluate(()=>{const ctl=global.__onlineTest;const {snapshot,samples}=global.__onlineSamples;ctl.view=snapshot('result',String(BigInt(ctl.view.seq)+1n));const v=ctl.view.view;v.timer={kind:'none',deadline_at_ms:null,remaining_ms:null};v.match.public_state=samples.win.next_state;v.match.match_id='match2';v.match.turn_id='match2:g1:t1';v.match.effective_outcome={kind:'sole_survivor',winner_id:'p1',reason:'rules'};ctl.socket.message(ctl.view);});
  await page.locator('.online[data-phase="result"]').waitFor();await shot('mock-result');await page.getByRole('button',{name:'准备下一场',exact:true}).click();await page.locator('.lobby-seats').waitFor();assert.equal(await page.getByRole('button',{name:'准备',exact:true}).count(),1);
  passed('Submit confirmation lock, host pause, public reveal ledger and next-match lobby');
  await page.getByRole('button',{name:'退出房间',exact:true}).click();await page.getByRole('dialog',{name:'结束整个房间？'}).waitFor();await shot('mock-host-leave');await page.getByRole('button',{name:'留在房间',exact:true}).click();
  await page.getByRole('button',{name:'退出房间',exact:true}).click();await page.getByRole('button',{name:'确认结束房间',exact:true}).click();await page.getByRole('button',{name:'好友联机',exact:false}).waitFor();
  await page.getByRole('button',{name:'好友联机',exact:false}).click();await page.getByText('已连接',{exact:true}).waitFor();await page.getByRole('button',{name:'加入房间',exact:true}).click();
  await page.getByRole('textbox',{name:'房间号',exact:true}).fill('WRONG123');await page.getByRole('button',{name:'加入',exact:true}).click();await page.getByText('房间号或密码不正确。',{exact:true}).waitFor();await shot('mock-wrong-room');
  await page.getByRole('textbox',{name:'房间号',exact:true}).fill(' abcd2345 ');await page.getByRole('button',{name:'加入',exact:true}).click();await page.getByRole('button',{name:'以观众身份尝试加入',exact:true}).waitFor();await shot('mock-full-room');
  await page.getByRole('button',{name:'以观众身份尝试加入',exact:true}).click();await page.locator('.lobby-seats').waitFor();assert.equal(await page.getByRole('button',{name:'准备',exact:true}).count(),0);
  await shot('mock-spectator-lobby');await page.getByRole('button',{name:'申请参战',exact:true}).click();await page.getByRole('button',{name:'转为观众',exact:true}).waitFor();await page.getByRole('button',{name:'转为观众',exact:true}).click();await page.getByRole('button',{name:'申请参战',exact:true}).waitFor();
  passed('Host leave confirmation, indistinguishable access error, explicit full-room spectator choice, lobby role buttons');
  await app.evaluate(()=>{const ctl=global.__onlineTest;const {snapshot}=global.__onlineSamples;const old=ctl.view;ctl.view=snapshot('selecting',String(BigInt(old.seq)+1n));ctl.view.view.host_id='p2';ctl.view.view.members=old.view.members;ctl.view.view.self=old.view.self;ctl.socket.message(ctl.view);});
  await page.getByText('你正在观战',{exact:true}).waitFor();assert.equal(await page.locator('.card').count(),0);await shot('mock-spectating');
  await app.evaluate(()=>{global.__onlineTest.socket.emit('close',{code:1006});});await page.getByText('网络暂断 · 重连中…',{exact:true}).waitFor();await shot('mock-reconnecting');
  await page.getByText('已连接',{exact:true}).waitFor();await page.getByRole('button',{name:'退出房间',exact:true}).click();await page.getByRole('button',{name:'确认退出房间',exact:true}).click();await page.getByRole('button',{name:'好友联机',exact:false}).waitFor();
  // OS close uses a native confirmation and waits for the serialized leave ack.
  await page.getByRole('button',{name:'好友联机',exact:false}).click();await page.getByText('已连接',{exact:true}).waitFor();await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.locator('.lobby-seats').waitFor();
  await app.evaluate(({dialog,BrowserWindow})=>{global.__nativeCloseCount=0;dialog.showMessageBox=async(_window,options)=>{global.__nativeCloseCount++;global.__nativeCloseDetail=options.detail;return {response:0};};BrowserWindow.getAllWindows()[0].close();});
  await page.waitForTimeout(50);assert.equal(await app.evaluate(()=>global.__nativeCloseCount),1);assert.match(await app.evaluate(()=>global.__nativeCloseDetail),/房主/);assert.equal((await page.evaluate(()=>window.desktop.online.read())).data.status,'connected');
  const didClose=app.waitForEvent('close');await app.evaluate(({dialog,BrowserWindow})=>{dialog.showMessageBox=async()=>({response:1});BrowserWindow.getAllWindows()[0].close();});await didClose;app=null;
  passed('Named IPC rejects URL injection and oversized input; native host-close cancellation preserves connection and confirmation exits');
  assert.deepEqual(errors,[]);evidence.console_errors=errors;
  // Ordinary main with no endpoint: no fake transport is installed.
  if(app)await app.close();app=await electron.launch({args:[path.join(__dirname,'../main.cjs')],env});
  const real=await app.firstWindow();real.setDefaultTimeout(10000);
  await real.getByRole('button',{name:'好友联机',exact:false}).click();await real.getByText('联机服务尚未配置。',{exact:true}).waitFor();
  assert.equal((await real.evaluate(()=>window.desktop.online.read())).data.source,'online');
  await real.screenshot({path:path.join(output,'unconfigured-real-main.png'),scale:'css'});
  await real.getByRole('button',{name:'返回主菜单',exact:true}).click();await real.getByRole('button',{name:'单人对局',exact:false}).click();await real.getByRole('button',{name:'开始单人对局',exact:true}).click();
  await real.locator('.table[data-phase="selecting"]').waitFor();assert.equal((await real.evaluate(()=>window.desktop.port.getView())).data.source,'live');
  assert.equal((await real.evaluate(()=>window.desktop.online.openLobby())).error,'SOLO_ACTIVE');
  await real.getByRole('button',{name:'离开牌桌',exact:true}).click();await real.getByRole('button',{name:'离开',exact:true}).click();
  passed('Ordinary main without endpoint reports unavailable; original offline worker starts, online switch rejects an active solo');
  evidence.status='PASS';
 }catch(e){evidence.status='FAIL';evidence.error=e.message;if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(output,'mock-smoke-failure.png')}).catch(()=>{});}throw e;}
 finally{if(app){await app.evaluate(()=>global.__onlinePort?.close()).catch(()=>{});await app.close();}await fs.writeFile(path.join(output,'online-smoke.json'),JSON.stringify(evidence,null,2)+'\n');await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
