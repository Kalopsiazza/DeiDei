// Ordinary main, owned synthetic profile; fixed preview scenes only test presentation.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {_electron:electron}=require('playwright-core');
const {ProfileStore}=require('./profile.cjs');
const {sourceInput,closeApplication}=require('./smoke-performance.cjs');
const catalog=require('./catalog.json');

async function main(){
 assert.ok(process.argv[2],'Pass a fresh evidence directory');
 const output=path.resolve(process.argv[2]);await fs.mkdir(output,{recursive:true});
 await assert.rejects(fs.access(path.join(output,'checks.json')),'Previous evidence must be preserved');
 const report={input:sourceInput(),checks:[],screenshots:[],rendererErrors:[],protocol:'ordinary main, temporary synthetic profile, native content resizing; fixed previews plus one real worker round'};
 const check=(condition,message,evidence)=>{assert.ok(condition,message);report.checks.push({message,evidence});};
 let app,page,directory;
 const shot=async label=>{await page.waitForTimeout(650);await page.screenshot({path:path.join(output,`${label}.png`),scale:'css'});report.screenshots.push(label);};
 const images=async selector=>{
  await page.waitForFunction(selector=>{const nodes=[...document.querySelectorAll(selector)];return nodes.length>0&&nodes.every(n=>n.complete&&n.naturalWidth>0);},selector);
  const values=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>({src:n.getAttribute('src'),loaded:n.complete&&n.naturalWidth>0,style:getComputedStyle(n).objectFit,box:n.getBoundingClientRect().toJSON()})));
  check(values.length>0&&values.every(n=>n.loaded),'visible card images decode',values);
  return values;
 };
 const resize=async(width,height)=>{
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);await page.waitForTimeout(300);
  const state=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.deepEqual(state.viewport,[width,height]);check(!state.overflow,'native resize without horizontal overflow',state);
 };
 const leave=async()=>{
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();
  await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
  await page.locator('.app[data-page=menu]').waitFor();
 };
 try{
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-card-art-'));
  await new ProfileStore(path.join(directory,'local-profile')).save('create',{nickname:'卡牌验收',avatar_id:'leaf'});
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};
  delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;delete env.DEIDEI_DEV_RELOAD;
  app=await electron.launch({args:[path.join(__dirname,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(12000);
  page.on('pageerror',error=>report.rendererErrors.push(String(error)));
  await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].focus();});
  await page.locator('.welcome-scene').waitFor();const skip=page.getByRole('button',{name:'跳过开场',exact:true});if(await skip.count())await skip.click();
  await page.getByRole('button',{name:'以卡牌验收身份进入牌厅',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
  const decoded=await page.evaluate(async ids=>Promise.all(ids.flatMap(id=>['cards','moves'].map(kind=>new Promise(resolve=>{
   const image=new Image();image.onload=()=>resolve({id,kind,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>resolve({id,kind,error:true});image.src=`assets/${kind}/${id}.${kind==='cards'?'webp':'png'}`;
  })))),catalog.entries.map(e=>e.entry_id));
  check(decoded.length===66&&decoded.every(n=>n.kind==='cards'?n.width===1080&&n.height===1440:n.width===512&&n.height===512),'all 33 faces and 33 icons load through the exact local protocol',decoded);
  await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:'P07 · 中局 B / 26 可用',exact:true}).click();
  await page.locator('.battle-table[data-ready=true]').waitFor();
  for(const eid of ['Bi','Def','Charge']){
   await page.locator(`[data-entry="${eid}"] .card-pick`).click();
   check(await page.locator(`[data-entry="${eid}"] .card-pick`).getAttribute('aria-pressed')==='true','selection feedback retained',eid);
   await images('.selection-card .full-card-face');await shot(`select-${eid}`);
  }
  await page.locator('[data-entry="Xiao"] .card-pick').click();
  check(await page.locator('.selection-card .card-state-tag').innerText()==='强化','enhanced Xiao remains visibly marked');await shot('enhanced-Xiao');
  for(const size of [[1366,768],[1180,720],[1000,650],[1366,768]]){
   await resize(...size);await page.locator('[data-entry="Def"] .card-pick').click();
   const image=(await images('.selection-card .full-card-face'))[0];check(image.style==='contain'&&image.box.width>100&&image.box.height>130,'whole selected face remains visible',image);
   check(await page.getByRole('button',{name:'确认出招',exact:true}).isVisible(),'submit stays reachable');await shot(`table-${size.join('x')}`);
  }
  await page.getByRole('button',{name:'确认出招',exact:true}).click();await page.locator('.battle-table[data-phase=revealed]').waitFor();
  await images('.move-card .full-card-face');await shot('preview-revealed');await leave();
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();await page.locator('.archive-card-detail').waitFor();
  await page.getByRole('button',{name:'切换为图标显示',exact:true}).click();
  check(await page.locator('.archive-icon-tile').count()===33,'archive still lists all 33 entries');
  for(const {entry_id:eid,name} of catalog.entries){
   await page.locator(`.archive-icon-tile[data-entry="${eid}"]`).click();await page.locator(`.archive-card-detail[data-entry="${eid}"]`).waitFor();
   assert.equal(await page.locator('.archive-card-title h2').innerText(),name);
   await images('.archive-card-title .full-card-face');
  }
  await shot('archive-all-icons');
  await page.locator('.archive-icon-tile[data-entry="Bi"]').click();
  await page.getByRole('button',{name:'切换为卡牌显示',exact:true}).click();
  for(const size of [[1366,768],[1000,650],[1366,900],[1366,768]]){
   await resize(...size);await images('.archive-card-title .full-card-face');await shot(`archive-${size.join('x')}`);
  }
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
  check(await page.locator('.archive-card-face').first().evaluate(n=>getComputedStyle(n).transitionDuration==='0s'),'system reduced motion preserves immediate card reveal');
  check(await page.locator('.archive-dossier').evaluate(n=>getComputedStyle(n).backdropFilter==='none'),'system reduced transparency remains effective');
  await shot('archive-reduced-preferences');await cdp.send('Emulation.setEmulatedMedia',{features:[]});
  await page.getByRole('button',{name:'2 · 同时揭晓',exact:true}).click();await images('.archive-card-face .full-card-face');await shot('archive-example');
  await page.getByRole('textbox',{name:'搜索招式',exact:true}).fill('E32');await page.locator('.archive-card-detail[data-entry=ZengYi]').waitFor();
  await page.getByRole('button',{name:'第 2 拍',exact:true}).click();await page.getByRole('button',{name:'2 · 同时揭晓',exact:true}).click();
  const recovery=page.locator('.archive-card-face[data-recovery=true]>strong');
  check(await recovery.innerText()==='系统休整'&&await recovery.evaluate(n=>getComputedStyle(n).clipPath==='inset(50%)'),'recovery remains accessible without an extra face label');await shot('archive-recovery');
  await page.locator('.archive-heading .settings-back').click();await page.locator('.app[data-page=menu]').waitFor();
  await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:'P09 · 唯一赢家',exact:true}).click();
  await page.locator('.match-outro').waitFor();await images('.result-move-art .full-card-face');await page.waitForTimeout(1600);await shot('result');
  for(const size of [[1000,650],[1366,768]]){
   await resize(...size);
   const faces=await page.locator('.result-last-turn>div>article').evaluateAll(nodes=>nodes.map(n=>({parent:n.getBoundingClientRect().toJSON(),image:n.querySelector('.full-card-face').getBoundingClientRect().toJSON()})));
   check(faces.every(n=>n.image.bottom<=n.parent.bottom+1&&n.image.left>=n.parent.left&&n.image.right<=n.parent.right),'complete result faces fit their containers',faces);await shot(`result-${size.join('x')}`);
  }
  await page.getByRole('button',{name:'返回主菜单',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
  await page.getByRole('button',{name:/^单人对局/}).click();await page.getByRole('button',{name:/^开始对局/}).click();
  await page.locator('.battle-table[data-ready=true]').waitFor();
  await page.locator('[data-entry="Charge"] .card-pick').click();await page.getByRole('button',{name:'确认出招',exact:true}).click();
  await page.locator('.battle-table[data-phase=revealed]').waitFor();await images('.move-card .full-card-face');await shot('real-worker-revealed');
  // A legal random opponent can end the match in round one; either terminal state is valid.
  await page.locator('.battle-table[data-phase=selecting],.match-outro').waitFor();
  if(await page.locator('.battle-table[data-phase=selecting]').isVisible()){
   await images('.selection-history .full-card-face');await shot('real-worker-history');await leave();
  }else{
   await images('.result-move-art .full-card-face');await page.waitForTimeout(1600);await shot('real-worker-result');
   await page.getByRole('button',{name:'返回主菜单',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
  }
  check(report.rendererErrors.length===0,'no renderer errors');report.status='PASS';
 }catch(error){report.status='FAIL';report.failure=String(error);if(page&&!page.isClosed())await shot('failure').catch(()=>{});process.exitCode=1;}
 finally{
  if(app){report.cleanup=await closeApplication(app);if(!report.cleanup.normalExit||report.cleanup.forced){report.status='FAIL';process.exitCode=1;}}
  if(directory)await fs.rm(directory,{recursive:true,force:true});
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${report.status}: ${report.checks.length} card checks; ${output}`);if(report.failure)console.error(report.failure);
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
