// Actual Electron + Python/core; temporary profile never touches the user's live match.
const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-tutorial-'));
 const output=path.resolve(__dirname,'../../docs/results/R04-T01-b/tutorial');
 await fs.mkdir(output,{recursive:true});
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 let app,checks=0;const errors=[];
 const check=(condition,message)=>{assert.ok(condition,message);checks++;};
 try {
  app=await electron.launch({args:[path.join(__dirname,'smoke-live-main.cjs')],env});
  const page=await app.firstWindow();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'进入牌厅',exact:true}).click();
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('新手实战验收');
  await page.getByRole('button',{name:'确认名字',exact:true}).click();await page.getByRole('button',{name:'进入主菜单',exact:true}).click();
  check(await page.getByRole('button',{name:'新手实战 T',exact:true}).count()===0,'tutorial removed from menu');
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();
  await page.getByRole('button',{name:'新手实战',exact:true}).click();
  await page.locator('.battle-table[data-ready="true"]').waitFor();
  const coach=page.getByRole('region',{name:'新手实战指导'});
  // section with accessible name has an implicit region role.
  await coach.waitFor();
  const view=async()=>(await page.evaluate(()=>window.desktop.port.getView())).data;
  check((await view()).source==='live','tutorial uses actual worker');
  check((await view()).tutorial.stage==='guided','guided initial state');
  check(await page.locator('.card-pick').count()===3,'only three beginner cards');
  check(await page.locator('.card[data-tutorial-target="true"]').getAttribute('data-entry')==='Charge','charge pointer');
  check(await page.locator('.card[data-entry="Bi"] .card-pick').isDisabled(),'core locks unavailable bi');
  const stableTable=async label=>{
   await page.mouse.move(500,300);await page.mouse.wheel(0,800);await page.waitForTimeout(100);
   const layout=await page.evaluate(()=>{
    const button=document.querySelector('.battle-actions .primary').getBoundingClientRect();
    const app=document.querySelector('.app').getBoundingClientRect();
    return {height:innerHeight,scrollHeight:document.scrollingElement.scrollHeight,scrollY,appTop:app.top,appHeight:app.height,buttonBottom:button.bottom};
   });
   await fs.writeFile(path.join(output,label+'.json'),JSON.stringify(layout,null,2));
   await page.screenshot({path:path.join(output,label+'.png')});
   check(layout.scrollHeight===layout.height&&layout.scrollY===0&&layout.appTop===0,'table cannot scroll '+label);
   check(layout.buttonBottom<=layout.height,'confirmation stays visible '+label);
  };
  for(const [width,height] of [[1000,650],[1366,768],[1920,1080]]){
   await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setContentSize(width,height),{width,height});
   await page.waitForTimeout(850);
   const geometry=await page.evaluate(()=>{
    const selectors=['.tutorial-coach','.battle-cards','.battle-actions .primary'];
    const bounds=selectors.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
    return {bounds,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   await fs.writeFile(path.join(output,'geometry-'+width+'.json'),JSON.stringify(geometry,null,2));
   await page.screenshot({path:path.join(output,'guided-'+width+'.png')});
   check(!geometry.overflow,'no horizontal overflow '+width);
   check(geometry.bounds.every(r=>r.x>=0&&r.y>=0&&r.right<=width&&r.bottom<=height),'guidance and controls fit '+width);
   check(geometry.bounds[0].bottom<geometry.bounds[1].y,'coach does not cover cards '+width);
   await page.locator('.card[data-entry="Def"] .card-pick').click();
   await stableTable('wrong-selected-'+width);
   await page.getByRole('button',{name:'确认出招',exact:true}).click();
   await page.getByRole('alert').waitFor();
   await stableTable('wrong-confirmed-'+width);
   await page.locator('.card[data-entry="Charge"] .card-pick').click();
   check(await page.getByRole('alert').count()===0,'correcting selection clears feedback '+width);
   await stableTable('corrected-'+width);

   await page.screenshot({path:path.join(output,'guided-'+width+'.png')});
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
  await page.locator('.card[data-entry="Def"] .card-pick').click();
  await page.getByRole('button',{name:'确认出招',exact:true}).click();
  await page.getByRole('alert').waitFor();
  check((await view()).phase==='selecting','wrong guided choice is not submitted');
  check((await view()).participants.every(p=>p.resources.dd6==='0'),'wrong choice spends nothing');
  await page.locator('.card[data-entry="Charge"] .card-pick').click();
  const play=async entry=>{
   await page.locator(`.card[data-entry="${entry}"] .card-pick`).click();
   const before=await view();
   if(before.tutorial.stage==='guided')check(await page.locator('.battle-actions .primary').getAttribute('data-tutorial-target')==='true','pointer shifts to confirmation');
   await page.getByRole('button',{name:'确认出招',exact:true}).click();
   await page.locator('.battle-table[data-phase="revealed"]').waitFor();
   check(await page.locator('.arena-countdown').count()===0,'no automatic reveal countdown');
   check((await view()).phase==='revealed','actual reveal');
   return await view();
  };
  let next=await play('Charge');
  check(next.participants.find(p=>p.player_id===next.self_id).resources.dd6==='6','charge gives 1 DD');
  await page.waitForTimeout(3300);
  check((await view()).phase==='revealed','reveal waits beyond ordinary 3s');
  await page.screenshot({path:path.join(output,'charge-revealed.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1000,650));
  await page.waitForTimeout(850);
  check(await coach.evaluate(n=>{const r=n.getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight;}),'revealed coach fits small window');
  check(await coach.getByRole('button',{name:'明白了，继续'}).evaluate(n=>{const r=n.getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight;}),'continue fits small window');
  await page.screenshot({path:path.join(output,'reveal-1000.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
  await page.getByRole('button',{name:'明白了，继续'}).click();
  await page.locator('.card[data-entry="Def"][data-tutorial-target="true"]').waitFor();
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  check((await view()).phase==='selecting','pause does not advance');
  await page.getByRole('button',{name:'继续游戏 RESUME',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  next=await play('Def');
  check(next.participants.find(p=>p.player_id===next.self_id).resources.dd6==='6','defense preserves DD');
  await page.getByRole('button',{name:'明白了，继续'}).click();
  await page.locator('.card[data-entry="Bi"][data-tutorial-target="true"]').waitFor();
  next=await play('Bi');check(next.tutorial.won,'guided win');
  const oldMatch=next.match_id;
  await page.getByRole('button',{name:'开始独立练习'}).click();
  await page.locator('.tutorial-coach[data-stage="challenge"]').waitFor();
  next=await view();check(next.match_id!==oldMatch,'independent new match');
  check(next.participants.every(p=>p.resources.dd6==='0'),'independent resources reset');
  check(await page.locator('[data-tutorial-target="true"]').count()===0,'independent has no forced pointer');
  await page.getByRole('button',{name:'给点提示'}).click();
  check((await coach.innerText()).includes('先攒一拍'),'contextual optional hint');
  await page.screenshot({path:path.join(output,'challenge.png')});
  await play('Charge');await page.getByRole('button',{name:'继续下一拍'}).click();
  await page.locator('.battle-table[data-phase="selecting"]').waitFor();
  next=await play('Charge');check(next.tutorial.ended&&!next.tutorial.won,'true failed practice');
  await page.screenshot({path:path.join(output,'retry.png')});
  await page.getByRole('button',{name:'重试独立练习'}).click();
  await page.locator('.battle-table[data-phase="selecting"]').waitFor();
  for(const entry of ['Charge','Def','Bi']){
   next=await play(entry);
   await page.getByRole('button',{name:next.tutorial.ended?'完成教程':'继续下一拍',exact:true}).click();
   await page.locator(next.tutorial.ended?'.tutorial-coach[data-stage="complete"]':'.battle-table[data-phase="selecting"]').waitFor();
  }
  check((await view()).tutorial.stage==='complete','complete only after independent core win');
  await page.screenshot({path:path.join(output,'complete.png')});
  await page.getByRole('button',{name:'进入普通单人',exact:true}).click();
  await page.getByRole('button',{name:/立即进入/}).click();
  await page.locator('.battle-table[data-ready="true"]').waitFor();
  check(await coach.count()===0,'ordinary table has no coach');
  check(await page.locator('.card-pick').count()===33,'ordinary 33 cards retained');
  check(!(await view()).tutorial,'normal random session metadata unchanged');
  await playNormal(page);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();
  await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
  check(await page.getByRole('button',{name:'新手实战 T',exact:true}).count()===0,'tutorial removed from menu');
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();
  await page.getByRole('button',{name:'新手实战',exact:true}).click();
  await page.locator('.battle-table[data-ready="true"]').waitFor();
  check((await view()).tutorial.step===0,'reentry starts fresh guided course');
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await page.locator('.card[data-tutorial-target="true"]').evaluate(n=>getComputedStyle(n).animationName)==='none','reduced motion pointer');
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();
  await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
  check((await page.evaluate(()=>window.desktop.port.startTutorial('wrong-id'))).ok===false,'IPC rejects wrong profile');
  const ledger=(await fs.readFile(path.join(directory,'ledger.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  check(ledger.length>=9,'actual core ledger captured');
  check(ledger.every(r=>r.ok),'all core resolutions valid');
  check(errors.length===0,'no renderer errors');
  await fs.writeFile(path.join(output,'ledger.json'),JSON.stringify(ledger,null,2));
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors,ledgerRounds:ledger.length},null,2));
  console.log('PASS tutorial '+checks+' checks; '+ledger.length+' actual core rounds');
 } catch(error) {
  if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});console.error('FAILED',error.message);}
  throw error;
 } finally {
  if(app){await app.evaluate(async()=>{await global.__testPort?.close();}).catch(()=>{});await app.close().catch(()=>{});}
  await fs.rm(directory,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
async function playNormal(page){
 await page.locator('.card[data-entry="Charge"] .card-pick').click();
 await page.getByRole('button',{name:'确认出招',exact:true}).click();
 await page.locator('.battle-table[data-phase="revealed"]').waitFor();
}
