// R04-T02-C: real Electron UI with explicit scripted MOCK faults, never real-network evidence.
const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {ProfileStore}=require('../profile.cjs');
const output=path.resolve(process.env.DEIDEI_RECOVERY_SMOKE_OUTPUT||path.join(__dirname,'../../../.local-outputs/r04-t02-c/online-recovery'));
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-online-recovery-'));
 await new ProfileStore(path.join(directory,'local-profile')).save('create',{nickname:'恢复验收',avatar_id:'leaf'});
 await fs.mkdir(output,{recursive:true});
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;
 const evidence={input_head:execFileSync('git',['rev-parse','HEAD'],{cwd:__dirname,encoding:'utf8'}).trim(),input_dirty:execFileSync('git',['status','--short'],{cwd:__dirname,encoding:'utf8'}).trim(),source:'MOCK scripted socket in actual Electron; no real room service',checks:[]};
 let app,page;
 const pass=text=>{evidence.checks.push(text);console.log('PASS',text);};
 const shot=name=>page.screenshot({path:path.join(output,`${name}.png`),scale:'css'});
 try{
  app=await electron.launch({args:[path.join(__dirname,'smoke-main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(10000);
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1366,height:768});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:/身份进入牌厅/}).click();
  const create=async()=>{await page.getByRole('button',{name:/^好友联机/}).click();await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.locator('.online-lobby').waitFor();};
  await create();
  const injectResult=async()=>{
   await app.evaluate(()=>{const ctl=global.__onlineTest,{snapshot,samples}=global.__onlineSamples,next=snapshot('result',String(BigInt(ctl.view.seq)+1n)),v=next.view;
    v.match.public_state=structuredClone(samples.win.next_state);v.match.match_id='match2';v.match.turn_id='match2:g1:t1';v.match.effective_outcome={kind:'sole_survivor',winner_id:'p1',reason:'rules'};
    v.match.last_turn={turn_id:'match2:g1:t1',core_resolution:structuredClone(samples.win),room_forfeits:[],effective_transition:structuredClone(samples.win.transition),effective_state:structuredClone(samples.win.next_state),action_sources:Object.fromEntries(v.members.map(member=>[member.player_id,'human']))};
    ctl.view=next;ctl.socket.message(next);
   });await page.locator('.online-result[data-leaving="false"]').waitFor();
  };
  const fail=async op=>app.evaluate((_electron,op)=>{const socket=global.__onlineTest.socket;socket.onSend=command=>setTimeout(()=>command.op===op?socket.fail(command,'RATE_LIMITED'):socket.respond(command),90);},op);
  const restore=()=>app.evaluate(()=>{const socket=global.__onlineTest.socket;socket.onSend=command=>setTimeout(()=>socket.respond(command),15);});
  const count=op=>app.evaluate((_electron,op)=>global.__onlineTest.socket.sent.filter(command=>command.op===op).length,op);
  await injectResult();await fail('room.return_lobby');
  const before=await count('room.return_lobby');await page.locator('.result-actions>.primary').evaluate(button=>{button.click();button.click();});
  await page.getByText('操作过快，请稍后重试。',{exact:false}).waitFor();await page.locator('.online-result[data-leaving="false"]').waitFor();
  assert.equal(await count('room.return_lobby')-before,1);assert.equal(await page.locator('.result-actions>.primary').isEnabled(),true);await shot('return-rejected-restored');
  await restore();await page.locator('.result-actions>.primary').click();await page.locator('.online-lobby').waitFor();pass('Same-result delayed return rejection restores fade/actions; double click sends once and retry follows lobby snapshot');
  await injectResult();const leaves=await count('room.leave');await page.getByRole('button',{name:/^退出房间/}).click();await page.getByRole('dialog',{name:'结束整个房间？',exact:true}).waitFor();
  assert.equal(await page.locator('.online-result').getAttribute('data-leaving'),'false');await page.getByRole('button',{name:'留在房间',exact:true}).click();assert.equal(await count('room.leave'),leaves);await shot('host-exit-cancelled');
  await app.evaluate(()=>{const ctl=global.__onlineTest;ctl.view.seq=String(BigInt(ctl.view.seq)+1n);ctl.view.view.host_id='p2';ctl.socket.message(ctl.view);});
  await page.getByRole('button',{name:/^退出房间/}).click();await page.getByRole('dialog',{name:'退出房间？',exact:true}).waitFor();await page.getByRole('button',{name:'留在房间',exact:true}).click();assert.equal(await count('room.leave'),leaves);assert.equal(await page.locator('.online-result').getAttribute('data-leaving'),'false');
  await app.evaluate(()=>{const ctl=global.__onlineTest;ctl.view.seq=String(BigInt(ctl.view.seq)+1n);ctl.view.view.host_id='p1';ctl.socket.message(ctl.view);});
  await fail('room.leave');await page.getByRole('button',{name:/^退出房间/}).click();await page.getByRole('button',{name:'确认结束房间',exact:true}).click();
  await page.getByText('操作过快，请稍后重试。',{exact:false}).waitFor();await page.locator('.online-result[data-leaving="false"]').waitFor();assert.equal(await page.getByRole('button',{name:/^退出房间/}).isEnabled(),true);await shot('leave-rejected-restored');
  await restore();await page.getByRole('button',{name:/^退出房间/}).click();await page.getByRole('button',{name:'确认结束房间',exact:true}).click();await page.locator('.menu-layout').waitFor();pass('Host/member terminal exit cancel preserves page/intent; host confirms room impact, delayed leave rejection recovers and retry exits');
  await create();
  await app.evaluate(()=>{const port=global.__onlinePort,ready=port.ready.bind(port);port.ready=payload=>{const reply=ready(payload);return new Promise(resolve=>setTimeout(()=>resolve(reply),1200));};});
  await page.getByRole('button',{name:'准备',exact:true}).click();await page.locator('.online[data-pending="true"]').waitFor();await app.evaluate(()=>global.__onlineTest.socket.emit('close',{}));
  await page.getByText('网络暂断 · 重连中…',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'退出房间',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'退出房间',exact:true}).click();await page.getByRole('button',{name:'确认结束房间',exact:true}).click();await page.locator('.menu-layout').waitFor();
  await page.waitForTimeout(1400);assert.equal(await page.locator('.menu-layout').count(),1);assert.equal(await app.evaluate(()=>global.__onlinePort.running),false);await shot('offline-lobby-exit-late-reply');pass('Disconnected lobby exit stays enabled during slow IPC, stops reconnect and ignores the late response after unmount');
  await create();await injectResult();const returns=await count('room.return_lobby');await page.locator('.result-actions>.primary').click();
  await app.evaluate(()=>{const ctl=global.__onlineTest,{snapshot}=global.__onlineSamples,next=snapshot('selecting',String(BigInt(ctl.view.seq)+1n)),m=next.view.match;Object.assign(m.public_state,{match_id:'match3',game_id:'match3:g1'});m.match_id='match3';m.turn_id=`match3:g1:t${m.public_state.turn_index}`;ctl.view=next;ctl.socket.message(next);});
  await page.locator('.battle-table[data-phase="selecting"][data-ready="true"]').waitFor();assert.equal(await count('room.return_lobby'),returns);
  const pause=page.getByRole('button',{name:'暂停',exact:true});await pause.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'对局菜单',exact:true}).waitFor();assert.equal(await count('room.submit'),0);await page.getByRole('button',{name:'继续游戏',exact:false}).click();
  const situation=page.getByRole('button',{name:'局势',exact:true});await situation.focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'本局态势',exact:true}).waitFor();assert.equal(await count('room.submit'),0);assert.equal(await page.locator('.situation-resources > .elimination-log').count(),1,'explicit online mode keeps elimination history in the resource column');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();await shot('new-snapshot-cancels-old-result-timer');pass('New match snapshot cancels the old fade timer; native Enter and online elimination resource column stay correct');
  await injectResult();const disconnectedReturns=await count('room.return_lobby');await page.locator('.result-actions>.primary').click();await app.evaluate(()=>global.__onlineTest.socket.emit('close',{}));
  await page.locator('.online-result[data-leaving="false"]').waitFor();assert.equal(await page.getByRole('button',{name:/^退出房间/}).isEnabled(),true);await page.getByRole('button',{name:/^退出房间/}).click();await page.getByRole('button',{name:'确认结束房间',exact:true}).click();await page.locator('.menu-layout').waitFor();
  assert.equal(await count('room.return_lobby'),disconnectedReturns);assert.equal(await app.evaluate(()=>global.__onlinePort.running),false);pass('Result disconnect cancels the queued return, restores offline exit and stops reconnect after confirmation');
  assert.deepEqual(errors,[]);evidence.ok=true;
 }catch(error){evidence.error=String(error.stack||error);if(page)await shot('failure').catch(()=>{});throw error;}
 finally{
  await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  if(app){await page.evaluate(()=>window.desktop.online.leave()).catch(()=>{});await app.evaluate(({app})=>{setImmediate(()=>app.exit(0));}).catch(()=>{});await app.close().catch(()=>{});}
  await fs.rm(directory,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
