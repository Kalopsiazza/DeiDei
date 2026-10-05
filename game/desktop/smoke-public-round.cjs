// Targeted R04-T02-B check: real local worker/core, then explicitly scripted MOCK room snapshots.
const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {ProfileStore}=require('./profile.cjs');
const {execFileSync}=require('node:child_process');
const output=path.resolve(process.env.DEIDEI_PUBLIC_SMOKE_OUTPUT||path.join(__dirname,'../../.local-outputs/r04-t02-b/public-smoke'));
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-public-round-'));
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;
 await new ProfileStore(path.join(directory,'local-profile')).save('create',{nickname:'公开字段验收',avatar_id:'leaf'});
 await fs.mkdir(output,{recursive:true});
 const evidence={input_head:execFileSync('git',['rev-parse','HEAD'],{cwd:__dirname,encoding:'utf8'}).trim(),platform:process.platform,arch:process.arch,source:'real local Python worker/core and separate scripted MOCK socket; no real online service',checks:[],screenshots:[]};
 let app,page;
 const pass=text=>{evidence.checks.push(text);console.log('PASS',text);};
 const shot=async name=>{await page.screenshot({path:path.join(output,`${name}.png`),scale:'css'});evidence.screenshots.push(name);};
 const open=async launcher=>{
  app=await electron.launch({args:[path.join(__dirname,launcher)],env});page=await app.firstWindow();page.setDefaultTimeout(10000);
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1366,height:768});
  evidence.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}));
  await page.getByRole('button',{name:/身份进入牌厅/}).click();await page.getByRole('button',{name:/^单人对局/}).waitFor();
 };
 try{
  await open('smoke-live-main.cjs');
  await page.getByRole('button',{name:/^单人对局/}).click();
  assert.match(await page.locator('.prepare-screen').innerText(),/随机合法对手/);
  assert.equal(await page.getByRole('button',{name:'不限时',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('group',{name:'选择 AI 强度'}).count(),0);await shot('real-solo-prepare');
  await page.locator('.prepare-start').click();await page.getByRole('button',{name:/立即进入/}).click();
  await page.locator('.battle-table[data-ready="true"]').waitFor();
  const initial=(await page.evaluate(()=>window.desktop.port.getView())).data;
  assert.equal(initial.source,'live');assert.equal(initial.mode,'solo');assert.equal(initial.public_round,null);assert.equal(initial.timer.mode,'untimed');
  await page.locator('[data-entry="Charge"] .card-pick').click();await page.getByRole('button',{name:'确认出招',exact:true}).click();
  await page.locator('.battle-table[data-phase="revealed"]').waitFor();
  const reveal=(await page.evaluate(()=>window.desktop.port.getView())).data;evidence.local_round=reveal.public_round;
  assert.equal(reveal.public_round.actions[reveal.self_id].entry_id,'Charge');assert.equal(reveal.public_round.turn_index,'1');
  assert.equal(await page.locator('.self-seat .move-card.current img').getAttribute('src'),'assets/moves/Charge.png');await shot('real-solo-revealed');
  await page.locator('.battle-table[data-phase="selecting"]').waitFor();
  assert.equal(await page.locator('.selection-history>span').count(),1);pass('Real local Charge reveal, current sprite, next-turn retained history and honest preparation');
  for(let turns=0;turns<40&&await page.locator('.match-outro').count()===0;turns++){
   await page.waitForFunction(()=>document.querySelector('.match-outro')||document.querySelector('.battle-table[data-phase="selecting"]'));
   if(await page.locator('.match-outro').count())break;
   const bi=page.locator('[data-entry="Bi"] .card-pick'),card=await bi.isEnabled()?bi:page.locator('[data-entry="Charge"] .card-pick');
   await card.click();await page.getByRole('button',{name:'确认出招',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.battle-table[data-phase="revealed"]')||document.querySelector('.match-outro'));
   await page.waitForFunction(()=>document.querySelector('.battle-table[data-phase="selecting"]')||document.querySelector('.match-outro'));
  }
  await page.locator('.match-outro').waitFor();await shot('real-solo-result');pass('Real seeded random-legal local match completed through the current UI');
  await app.close();app=null;
  await fs.copyFile(path.join(directory,'ledger.jsonl'),path.join(output,'real-local-ledger.jsonl'));
  await open('tests-online/smoke-main.cjs');
  await page.getByRole('button',{name:/^好友联机/}).click();await page.getByRole('button',{name:'创建房间',exact:true}).click();
  await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始对局',exact:true}).click();
  await page.locator('.battle-table[data-mode="online"][data-ready="true"]').waitFor();
  const inject=async(turn,phase='revealing',entry='Charge',restart=false)=>{
   await app.evaluate((_electron,{turn,phase,entry,restart})=>{
    const ctl=global.__onlineTest,{snapshot}=global.__onlineSamples;
    const next=snapshot(phase,String(BigInt(ctl.view.seq)+1n)),m=next.view.match,s=m.public_state;
    s.turn_index=String(turn);m.turn_id=`${s.game_id}:t${turn}`;
    next.view.members[0].nickname=next.view.members[1].nickname='同名玩家';m.roster_profiles[0].nickname=m.roster_profiles[1].nickname='同名玩家';
    if(m.last_turn){const last=m.last_turn,core=last.core_resolution;last.turn_id=m.turn_id;Object.assign(core.ledger,{game_id:s.game_id,turn_index:String(turn)});
     Object.assign(core.ledger.actions.p1,{entry_id:entry,actual_move:entry,branch:null,is_recovery:false});Object.assign(core.ledger.actions.p2,{entry_id:'Def',actual_move:'Def',branch:null,is_recovery:false});
     core.next_state.turn_index=String(turn+1);last.effective_state.turn_index=String(turn+1);
     if(restart){for(const state of [core.next_state,last.effective_state])Object.assign(state,{game_id:'match1:g2',game_index:'2',turn_index:'1',active_ids:['p1','p2','p3']});for(const transition of [core.transition,last.effective_transition])Object.assign(transition,{kind:'restart_survivors',to_game_id:'match1:g2'});}
    }
    ctl.view=next;ctl.socket.message(next);
   },{turn,phase,entry,restart});
   await page.waitForFunction(turn=>document.querySelector('.battle-status>span')?.textContent===`第 ${turn} 回合`,turn);
  };
  const wrong=['ThreeDef','PragonDef','VolvoDef','NieXiangDef','BombPragon','BombVolvo','BombFlipVolvo','ZengRewardBigBi'];
  for(let index=0;index<10;index++){
   const entry=wrong[index]||'Charge';await inject(index+1,'revealing',entry);
   await page.waitForFunction(entry=>document.querySelector('.self-seat .move-card.current img')?.getAttribute('src')===`assets/moves/${entry}.png`,entry);
   assert.equal(await page.locator('.opponent-seat').first().locator('.move-card.current img').getAttribute('src'),'assets/moves/Def.png');
   assert.equal(await page.getByText('你已淘汰，等待下一场。',{exact:true}).count(),0);
  }
  await shot('mock-eight-icons-same-names');await inject(10,'revealing','Charge');
  await page.getByRole('button',{name:'局势',exact:true}).click();assert.equal(await page.locator('.situation-timeline ol>li').count(),10);await shot('mock-ten-rounds');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await inject(11,'selecting');assert.equal(await page.locator('.selection-history>span').count(),8);assert.equal(await page.locator('.self-seat .move-card:not(.active)').count(),3);pass('MOCK all eight sprite IDs, identical nicknames, active revealed role, duplicate suppression and ten-round capture with 8/3 display caps');
  await inject(12,'revealing');await page.getByRole('button',{name:'局势',exact:true}).click();await page.getByText('第 11 拍记录未收到。',{exact:true}).waitFor();await shot('mock-gap-marker');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await inject(13,'revealing','BombPragon',true);await page.getByText('秒后进入新局',{exact:true}).waitFor();await shot('mock-old-game-restart-reveal');
  await app.evaluate(()=>{const ctl=global.__onlineTest,{snapshot}=global.__onlineSamples;const next=snapshot('selecting',String(BigInt(ctl.view.seq)+1n)),m=next.view.match;Object.assign(m.public_state,{game_id:'match1:g2',game_index:'2',turn_index:'1',active_ids:['p1','p2','p3']});m.turn_id='match1:g2:t1';ctl.view=next;ctl.socket.message(next);});
  await page.waitForFunction(()=>document.querySelector('.battle-status>span')?.textContent==='第 1 回合'&&document.querySelectorAll('.selection-history>span').length===0);await shot('mock-new-game-empty-history');pass('MOCK missing round stays an explicit gap; restart revelation stays in old game and next selecting clears current-game history');
  evidence.ok=true;
 }catch(error){evidence.error=String(error.stack||error);if(page)await shot('failure').catch(()=>{});throw error;}
 finally{await fs.writeFile(path.join(output,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');if(app){await page.evaluate(async()=>{await window.desktop.online.leave();await window.desktop.port.leave();}).catch(()=>{});await page.waitForFunction(async()=>{const reply=await window.desktop.online.read();return reply.ok&&!reply.data.pending&&!reply.data.snapshot;}).catch(()=>{});await app.evaluate(({app})=>{setImmediate(()=>app.exit(0));}).catch(()=>{});await app.close().catch(()=>{});}await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
