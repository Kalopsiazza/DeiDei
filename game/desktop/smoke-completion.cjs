// Issue #35: actual main consumers, isolated profile, bounded owned cleanup.
const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { enterHall, enterArena, leaveSolo } = require('../integration/gui-actions.cjs');
const { sourceInput, captureDiagnostics, closeApplication } = require('./smoke-performance.cjs');
const output = path.resolve(process.env.DEIDEI_COMPLETION_OUTPUT || path.join(__dirname, '../../.local-outputs/r04-t03-a/interaction'));
if(process.argv.includes('--self-check')){
 const source=require('node:fs').readFileSync(__filename,'utf8'),body=source.match(/ finally \{\n([\s\S]*)\n \}\n console\.log/)[1];
 (async()=>{for(const failWrites of [1,2]){const report={status:'FAIL',failure:{message:'original GUI error'}},counts={write:0,close:0,remove:0},fakeProcess={exitCode:0};
  await new (Object.getPrototypeOf(async function(){}).constructor)('report','page','app','profile','fs','path','output','captureDiagnostics','closeApplication','process',body)(report,null,{},'owned-profile',{writeFile:async()=>{if(++counts.write<=failWrites)throw Object.assign(new Error('denied'),{code:'EACCES'});},rm:async()=>{counts.remove++;}},path,'owned-output',null,async()=>{counts.close++;return {normalExit:true};},fakeProcess);
  assert.deepEqual(counts,{write:2,close:1,remove:1});assert.equal(report.failure.message,'original GUI error');assert.equal(report.secondaryFailures.length,failWrites);assert.equal(fakeProcess.exitCode,1);
 }console.log(JSON.stringify({status:'PASS',guiRun:false,cases:['first write denied','both writes denied'],scope:'actual finally block; owned close and profile removal survive evidence write errors'}));})().catch(e=>{console.error(e);process.exitCode=1;});return;
}
(async () => {
 const report = { input: sourceInput(), source: 'ordinary main / fixture preview and real worker / test-only IPC delay', consumerOverride:process.env.DEIDEI_CONSUMER_BASE||null, checks: [], errors: [] };
 let app, page, profile;
 try {
  await fs.mkdir(output, {recursive:true});
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'deidei-completion-'));
  const wrapper = path.join(output, 'controlled-main.cjs');
  await fs.writeFile(wrapper, `const {ipcMain}=require('electron');
global.__control={channel:'',delay:0,fail:false,calls:0};
const handle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,fn)=>handle(channel,async(...args)=>{const c=global.__control;if(channel===c.channel){c.calls++;await new Promise(r=>setTimeout(r,c.delay));if(c.fail)return {ok:false,error:'SAVE_FAILED'};}return fn(...args);});
require(${JSON.stringify(path.join(__dirname,'main.cjs'))});
`);
  const env = {...process.env,DEIDEI_TEST_DATA_DIR:profile}; delete env.ELECTRON_RUN_AS_NODE; delete env.DEIDEI_ROOM_URL;
  app = await electron.launch({args:[wrapper],env}); page = await app.firstWindow(); page.setDefaultTimeout(10000);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{window.__keyEvents=[];document.addEventListener('keydown',e=>window.__keyEvents.push({key:e.key,t:performance.now(),trusted:e.isTrusted,target:e.target?.tagName,closing:document.querySelector('dialog')?.dataset.closing}),true);});
  page.on('pageerror',e=>report.errors.push(e.message));
  await enterHall(page,'收尾交互验证');await page.locator('.app[data-page=menu]').waitFor();
  const state = () => page.evaluate(()=>({page:document.querySelector('.app')?.dataset.page,dialog:!!document.querySelector('dialog[open]'),closing:document.querySelector('dialog')?.dataset.closing,focus:document.activeElement?.textContent}));
  const control = (channel,fail=false) => app.evaluate((_electron,{channel,fail})=>{global.__control={channel,delay:700,fail,calls:0};},{channel,fail});
  const calls = () => app.evaluate(()=>global.__control.calls);
  if (!process.argv.includes('--modal-only')) {
   const ids = new Set();
   for (const [scene,label] of [['winner','P09 · 唯一赢家'],['defeat','P09 · 本人阵亡'],['draw','P09 · 全员淘汰'],['winner','P09 · 唯一赢家']]) {
    if(await page.locator('.match-outro').count()){await page.getByRole('button',{name:'返回主菜单 EXIT',exact:true}).click();await page.locator('.menu-layout').waitFor();}
    await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();
    await page.locator('.match-outro').waitFor();await page.waitForTimeout(800);
    const r=await page.evaluate(()=>window.desktop.port.getView());assert.ok(r.ok);const v=r.data;
    assert.ok(!ids.has(v.match_id),'new FixturePort preview must have a unique match ID');ids.add(v.match_id);
    const moves=await page.locator('.result-last-turn').innerText();
    if(scene==='defeat'){assert.match(moves,/你.*攒/s);assert.match(moves,/玩家 02.*Pragon/s);}
    if(scene==='winner'){assert.match(moves,/你.*Pragon/s);assert.match(moves,/玩家 02.*攒/s);}
    if(scene==='draw')assert.equal(await page.locator('.result-last-turn > div > article').count(),6);
    await page.getByRole('button',{name:'局势回顾 REVIEW',exact:true}).click();
    const history=await page.locator('.situation-timeline').innerText();assert.ok(history.includes('第 6'));await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
    report.checks.push({name:'preview-'+scene,id:v.match_id,actions:v.public_round.actions,moves,history});
    await page.screenshot({path:path.join(output,'preview-'+scene+'.png'),scale:'css'});
   }
   await page.getByRole('button',{name:'返回主菜单 EXIT',exact:true}).click();await page.locator('.menu-layout').waitFor();
  }
  for (const fail of [false,true]) {
   await control('fixture.preview',fail);
   await page.getByRole('button',{name:'开发预览',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'开发场景',exact:true});const action=dialog.getByRole('button',{name:'P09 · 唯一赢家',exact:true});
   await page.keyboard.press('Tab');await action.focus();
   await page.keyboard.press('Escape');assert.equal((await state()).closing,'true');await page.keyboard.press('Enter');await page.waitForTimeout(900);const keys=await page.evaluate(()=>window.__keyEvents.slice(-2));assert.equal(keys[0].key,'Escape');assert.equal(keys[1].key,'Enter');assert.ok(keys[1].t-keys[0].t<240);assert.ok(keys.every(e=>e.trusted),'keyboard events are trusted');report.checks.push({name:'native-close-key-sequence',keys});
   const current=await state(),count=await calls();report.checks.push({name:'preview-close-enter-'+fail,count,current});
   assert.equal(count,0,'closing Modal must not execute focused preview action');assert.equal(current.page,'menu');assert.equal(current.dialog,false);
   await page.getByRole('button',{name:'开发预览',exact:true}).click();await action.click();await page.waitForTimeout(100);
   assert.equal(await calls(),1);assert.equal(await dialog.locator('.dialog-close').isDisabled(),true);
   await page.keyboard.press('Escape');await page.waitForTimeout(900);
   if(fail){await dialog.waitFor();assert.ok(await dialog.locator('[role=alert]').count());await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});}
   else {await page.locator('.match-outro').waitFor();await page.getByRole('button',{name:'返回主菜单 EXIT',exact:true}).click();await page.locator('.menu-layout').waitFor();}
   assert.equal(await calls(),1);report.checks.push({name:'preview-delayed-action-'+fail,count:await calls(),current:await state()});
  }
  for (const fail of [false,true]) {
   await control('settings.apply',fail);
   await page.getByRole('button',{name:'设置 S',exact:true}).click();await page.getByRole('button',{name:'昵称头像 PROFILE',exact:true}).click();
   await page.getByRole('textbox',{name:'昵称',exact:true}).fill('未保存-'+fail);
   await page.locator('.settings-layout .settings-back').click();
   const dialog=page.getByRole('dialog',{name:'还有未保存的修改',exact:true}),action=dialog.getByRole('button',{name:'保存关闭',exact:true});
   await page.keyboard.press('Tab');await action.focus();await page.keyboard.press('Escape');assert.equal((await state()).closing,'true');await page.keyboard.press('Enter');await page.waitForTimeout(900);const keys=await page.evaluate(()=>window.__keyEvents.slice(-2));assert.equal(keys[0].key,'Escape');assert.equal(keys[1].key,'Enter');assert.ok(keys[1].t-keys[0].t<240);assert.ok(keys.every(e=>e.trusted),'keyboard events are trusted');report.checks.push({name:'native-close-key-sequence',keys});
   assert.equal(await calls(),0);assert.equal((await state()).page,'settings');assert.equal((await state()).dialog,false);
   await page.locator('.settings-layout .settings-back').click();await action.click();await page.waitForTimeout(100);
   assert.ok(await action.isDisabled());await page.keyboard.press('Escape');await page.waitForTimeout(900);
   if(fail){await dialog.waitFor();assert.match(await dialog.innerText(),/保存失败/);await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.getByRole('textbox',{name:'昵称',exact:true}).inputValue(),'未保存-'+fail);await page.locator('.settings-layout .settings-back').click();await page.getByRole('button',{name:'不保存关闭',exact:true}).click();}
   await page.locator('.menu-layout').waitFor();assert.equal(await calls(),1);report.checks.push({name:'settings-delayed-'+fail,calls:await calls(),state:await state()});
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
 finally {
  const cleanupFailure=(e,stage)=>{report.status='FAIL';process.exitCode=1;const value={stage,message:e.message,stack:e.stack};if(!report.failure)report.failure=value;else(report.secondaryFailures??=[]).push(value);};
  if(page&&!page.isClosed()){report.diagnostics=await captureDiagnostics(page).catch(e=>({error:e.message}));await page.screenshot({path:path.join(output,'final.png'),scale:'css'}).catch(()=>{});}
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)).catch(e=>cleanupFailure(e,'evidence-before-cleanup'));
  try{if(app){report.cleanup=await closeApplication(app);if(!report.cleanup.normalExit){report.status='FAIL';process.exitCode=1;}}}catch(e){cleanupFailure(e,'application-cleanup');}
  if(profile)await fs.rm(profile,{recursive:true,force:true}).catch(e=>cleanupFailure(e,'profile-cleanup'));
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)).catch(e=>cleanupFailure(e,'evidence-after-cleanup'));
 }
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure,secondaryFailures:report.secondaryFailures,cleanup:report.cleanup}));
})();
