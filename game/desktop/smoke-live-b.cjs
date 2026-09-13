const { _electron: electron }=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const before=process.argv.includes('--before');
const output=path.resolve(__dirname,'../../docs/results/R02-T04-b');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-t04-b-'));
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 const label=before?'before':'after';let app;
 const evidence={scope:'Real Electron window automation',phase:label,source_sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],screenshots:[],match_ids:[]};
 const pass=s=>{evidence.checks.push(s);console.log('PASS',s);};
 try {
  app=await electron.launch({args:[path.join(__dirname,'smoke-live-b-main.cjs')],env});
  const page=await app.firstWindow();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  evidence.native=await app.evaluate(({BrowserWindow,screen})=>({bounds:BrowserWindow.getAllWindows()[0].getContentBounds(),displays:screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor})),versions:process.versions}));
  const shot=async name=>{const file=`${name}-${label}.png`;await page.screenshot({path:path.join(output,file),scale:'css'});evidence.screenshots.push(file);};
  const arm=async(op,fail=false)=>app.evaluate((_,data)=>{global.__b.arm=data;},{op,fail});
  const release=async()=>app.evaluate(()=>global.__b.release());
  const title=()=>page.locator('.page-title').innerText();
  const begin=async fail=>{await arm('start',fail);await page.getByRole('button',{name:'开始单人对局',exact:true}).click();await page.getByRole('button',{name:'正在开场…',exact:true}).waitFor();};
  const goPrepare=async()=>{await page.getByRole('button',{name:'单人对局'}).click();};
  const leave=async()=>{await page.getByRole('button',{name:'离开牌桌',exact:true}).click();await page.getByRole('button',{name:'离开',exact:true}).click();await page.getByRole('button',{name:'单人对局'}).waitFor();};
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('摘要验收');
  await page.getByRole('button',{name:'保存，进入课间 →'}).click();await goPrepare();
  await begin(false);
  evidence.pending_controls={backDisabled:await page.getByRole('button',{name:'返回',exact:true}).isDisabled(),brandDisabled:await page.locator('.brand').isDisabled()};
  await shot('F02-pending-success');
  if(before){
   assert.equal(evidence.pending_controls.backDisabled,false);assert.equal(evidence.pending_controls.brandDisabled,false);
   await page.getByRole('button',{name:'返回',exact:true}).click();evidence.after_back=await title();await shot('F02-left-while-pending');
   await release();await page.locator('.table').waitFor();evidence.after_resolve=await title();
   assert.equal(evidence.after_back,'课间开始了');assert.equal(evidence.after_resolve,'双人牌桌');await shot('F02-late-return');
   pass('Baseline reproduces prepare → menu → table late-start navigation');
  }else{
   assert.equal(evidence.pending_controls.backDisabled,true);assert.equal(evidence.pending_controls.brandDisabled,true);
   assert.equal(await page.getByRole('button',{name:'开发预览',exact:true}).isDisabled(),true);
   for(const locator of [page.getByRole('button',{name:'返回',exact:true}),page.locator('.brand')]){
    const r=await locator.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
   }
   assert.equal(await title(),'单人准备');await release();await page.locator('.table').waitFor();
   assert.equal(await title(),'双人牌桌');assert.equal(await page.locator('.brand').isEnabled(),true);await shot('F02-success');
   pass('Delayed success blocks native back/title clicks and restores navigation');
  }
  evidence.match_ids.push((await page.evaluate(()=>window.desktop.port.getView())).data.match_id);
  await page.locator('[data-entry="Charge"] .card-pick').click();await page.getByRole('button',{name:'提交所选',exact:true}).click();
  await page.locator('.table[data-phase="revealed"]').waitFor();await page.locator('.summary details').evaluate(e=>{e.open=true;});
  const view=(await page.evaluate(()=>window.desktop.port.getView())).data;
  evidence.summary=view.summary;
  assert.equal(view.participants.find(p=>p.player_id===view.self_id).resources.dd6,'0');
  assert.equal(view.summary.some(line=>line.includes('本次攒未生效，DD没有增加')), !before);
  assert.equal(view.summary.some(line=>line.includes('六分之一单位')||line.includes('resource_gain')),before);
  await page.locator('.summary p').filter({hasText:before?'六分之一单位':'本次攒未生效，DD没有增加'}).first().scrollIntoViewIfNeeded();
  await shot('F01-cancelled-charge');pass(before?'Baseline confirms cancelled charge is falsely shown as DD gain':'Cancelled Charge/Cloud shows no gain and exact zero balance');
  await leave();await goPrepare();
  if(!before){
   for(const recovery of ['retry','back']){
    await begin(true);assert.equal(await page.getByRole('button',{name:'返回',exact:true}).isDisabled(),true);
    assert.equal(await page.locator('.brand').isDisabled(),true);await shot(`F02-pending-failure-${recovery}`);
    await release();await page.getByRole('button',{name:'开始单人对局',exact:true}).waitFor();
    assert.match(await page.getByRole('alert').innerText(),/本场中断，可重新开始/);
    assert.equal(await title(),'单人准备');assert.equal(await page.getByRole('button',{name:'返回',exact:true}).isEnabled(),true);
    assert.equal(await page.locator('.brand').isEnabled(),true);await shot(`F02-failure-recovered-${recovery}`);
    if(recovery==='back'){await page.getByRole('button',{name:'返回',exact:true}).click();await goPrepare();}
    await page.getByRole('button',{name:'开始单人对局',exact:true}).click();await page.locator('.table').waitFor();
    const newMatch=(await page.evaluate(()=>window.desktop.port.getView())).data.match_id;
    assert.ok(!evidence.match_ids.includes(newMatch));evidence.match_ids.push(newMatch);
    await leave();await goPrepare();
   }
   pass('Delayed failure unlocks back/title and allows retry and fresh start');
   await page.getByRole('button',{name:'开始单人对局',exact:true}).click();await page.locator('.table').waitFor();
   await page.getByRole('button',{name:'开发预览',exact:true}).click();await arm('preview');
   await page.getByRole('button',{name:'P07 · 中局 B / 26 可用',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.brand').disabled);
   assert.equal(await page.getByRole('button',{name:'关闭弹窗',exact:true}).isDisabled(),true);
   await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);await shot('F02-preview-pending');
   await release();await page.getByRole('dialog').waitFor({state:'hidden'});assert.match(await page.locator('.demo-label').innerText(),/演示数据/);
   assert.equal(await page.locator('.brand').isEnabled(),true);await shot('F02-preview-restored');
   pass('Scene switching also blocks dialog/title navigation, then restores fixture controls');
  }
  assert.deepEqual(errors,[]);evidence.console_errors=errors;evidence.status=before?'BASELINE_REPRODUCED':'PASS';
 }catch(error){evidence.status='FAIL';evidence.error=error.stack;if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(output,`smoke-failure-${label}.png`)}).catch(()=>{});}throw error;}
 finally{
  if(app){await app.evaluate(async()=>{global.__b.release?.();await global.__testPort?.close();}).catch(()=>{});await app.close();}
  await fs.copyFile(path.join(directory,'ledger.jsonl'),path.join(output,`window-ledger-${label}.jsonl`)).catch(()=>{});
  await fs.writeFile(path.join(output,`window-${label}.json`),JSON.stringify(evidence,null,2)+'\n');
  await fs.rm(directory,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
