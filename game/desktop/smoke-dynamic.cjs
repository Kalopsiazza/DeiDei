// Issue #35: continuous native content resizing and real public controls.
const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {enterArena,leaveSolo}=require('../integration/gui-actions.cjs');
const {sourceInput,captureDiagnostics,closeApplication}=require('./smoke-performance.cjs');
const {checkBattle}=require('./smoke-geometry.cjs');
const output=path.resolve(process.env.DEIDEI_DYNAMIC_OUTPUT||path.join(__dirname,'../../.local-outputs/r04-t03-a/dynamic-'+Date.now()));
(async()=>{
 const report={input:sourceInput(),source:'ordinary main; real local worker; continuous native setContentSize',routes:[],controls:[],errors:[]};let app,page,profile,outputOwned=false;
 const fail=e=>{report.status='FAIL';if(!report.failure)report.failure={message:e.message,stack:e.stack};else report.errors.push({stage:'secondary',message:e.message});process.exitCode=1;};
 const button=name=>page.getByRole('button',{name,exact:typeof name==='string'});
 const bounds=()=>app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0];return {outer:w.getBounds(),content:w.getContentBounds(),minimum:w.getMinimumSize(),fullscreen:w.isFullScreen(),focused:w.isFocused(),display:screen.getDisplayMatching(w.getBounds())};});
 const resize=async(w,h)=>{const from=await page.evaluate(()=>[innerWidth,innerHeight]);for(let i=1;i<=12;i++){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[Math.round(from[0]+(w-from[0])*i/12),Math.round(from[1]+(h-from[1])*i/12)]);await page.waitForTimeout(35);}};
 const target=async(name,locator,{allowScroll=false}={})=>{
  await locator.waitFor();assert.equal(await locator.count(),1,name+' exists once');const rawBox=await locator.boundingBox();if(allowScroll)await locator.scrollIntoViewIfNeeded();
  const value=await locator.evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),scrollAncestors=[];for(let p=n.parentElement;p;p=p.parentElement)scrollAncestors.push({tag:p.tagName,classes:p.className,top:p.scrollTop,left:p.scrollLeft,client:[p.clientWidth,p.clientHeight],size:[p.scrollWidth,p.scrollHeight],overflow:[getComputedStyle(p).overflowX,getComputedStyle(p).overflowY]});return {box:{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom},hit:!!hit&&(n===hit||n.contains(hit)),style:{opacity:s.opacity,visibility:s.visibility,font:s.fontSize},disabled:n.matches(':disabled'),pressed:n.getAttribute('aria-pressed'),busy:n.getAttribute('aria-busy'),focusVisible:n.matches(':focus-visible'),scrollAncestors};});
  const viewport=await page.evaluate(()=>[innerWidth,innerHeight]);const record={name,viewport,rawBox,explicitScroll:allowScroll,...value,verified:false};report.controls.push(record);
  assert.ok(value.box.w>0&&value.box.h>0&&value.box.x>=0&&value.box.y>=0,name+' has visible area');assert.ok(value.hit,name+' is not occluded');assert.notEqual(value.style.visibility,'hidden');assert.notEqual(value.style.opacity,'0');
  assert.ok(value.box.right<=viewport[0]+1&&value.box.bottom<=viewport[1]+1,name+' fully within viewport');record.verified=true;return value;
 };
 const click=async(name,locator=button(name))=>{await target(String(name),locator);await locator.click();};
 const states=async(name,locator)=>{
  const sample=()=>locator.evaluate(n=>{const s=getComputedStyle(n);return {active:n.matches(':active'),focusVisible:n.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,shadow:s.boxShadow,border:s.borderColor,background:s.backgroundImage,transform:s.transform,disabled:n.matches(':disabled'),selected:n.getAttribute('aria-pressed'),checked:n.checked};});
  await target(name,locator);await page.mouse.move(0,0);await locator.evaluate(n=>n.blur());const normal=await sample();await locator.hover();const hover=await sample();await page.mouse.down();await page.waitForTimeout(90);const active=await sample();assert.ok(active.active);await page.mouse.move(0,0);await page.mouse.up();
  let focused=false;for(let i=0;i<100;i++){await page.keyboard.press('Tab');if(await locator.evaluate(n=>n===document.activeElement)){focused=true;break;}}
  assert.ok(focused,name+' reachable by keyboard Tab');const focus=await sample();assert.ok(focus.focusVisible&&((focus.outline!=='none'&&parseFloat(focus.width)>0)||(focus.shadow!=='none'&&focus.shadow!==normal.shadow)||focus.border!==normal.border),name+' visible keyboard focus');report.controls.push({name,source:'real pointer/keyboard state; no synthetic attributes',normal,hover,active,focus});
 };
 const shot=name=>page.screenshot({path:path.join(output,name+'.png'),scale:'css'});
 const route=async(name,selectors,actions=[])=>{
  const r={name,samples:[]};report.routes.push(r);
  const sizes=[[1366,768],[1000,650],[1920,1080],[1366,768]];
  if(['solo-select','archive'].includes(name))sizes.push([1600,650],[1000,1000],[1920,1200],[2560,1080],[1366,768]);
  for(const [index,size]of sizes.entries()){
   await resize(...size);await page.waitForTimeout(180);
   const sample={requested:size,native:await bounds(),dom:await page.evaluate(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,route:document.querySelector('.app')?.dataset.page,stage:document.querySelector('.welcome-scene')?.dataset.stage,focus:document.activeElement?.outerHTML?.slice(0,160)}))};r.samples.push(sample);
   assert.deepEqual(sample.dom.viewport,size,'actual CSS content matches request');
   const area=sample.native.display.workArea,outer=sample.native.outer;
   sample.physicalCoverage=outer.x>=area.x&&outer.y>=area.y&&outer.x+outer.width<=area.x+area.width&&outer.y+outer.height<=area.y+area.height?'within display work area':'oversized native content sample; not physical ultrawide/4K evidence';
   for(const s of selectors)await target(name+' '+s,page.locator(s));if(name==='solo-select')await checkBattle(page,report,name+' '+size,{cards:33});
   if(actions[index])await actions[index]();
   if(index===1)await shot(name+'-minimum');
  }
  console.log('checked route '+name);await fs.writeFile(path.join(output,'dynamic.partial.json'),JSON.stringify(report,null,2));
 };
 const hall=()=>page.locator('.app[data-page=menu]').waitFor();
 try{
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});outputOwned=true;profile=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-dynamic-'));
  const env={...process.env,DEIDEI_TEST_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;
  app=await electron.launch({args:[path.join(__dirname,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));await page.emulateMedia({reducedMotion:'no-preference'});
  report.environment={platform:os.platform(),release:os.release(),...await app.evaluate(({screen})=>({versions:process.versions,displays:screen.getAllDisplays()}))};report.initial=await bounds();
  if(process.argv.includes('--preferences-only')){await require('../integration/gui-actions.cjs').enterHall(page,'偏好验证');await hall();}else{
  await page.locator('.welcome-scene[data-stage=opening]').waitFor();
  await route('welcome-video',['.welcome-film-controls button:last-child'],[,()=>click('开启开场声音'),()=>click('关闭开场声音')]);
  await click('跳过开场');await route('welcome-title',['.welcome-title .welcome-action'],[,()=>click('重播开场').then(()=>click('跳过开场')),()=>click('重播开场').then(()=>click('跳过开场'))]);
  await states('welcome action',page.locator('.welcome-title .welcome-action'));
  await click('进入牌厅');await resize(1000,650);await page.getByRole('textbox',{name:'昵称',exact:true}).waitFor();
  await route('welcome-name',['.welcome-card-front input','.welcome-card-front .welcome-action'],[,async()=>{await page.getByRole('textbox',{name:'昵称',exact:true}).fill('动态验证');await click('头像：太阳');},()=>click('头像：月亮')]);
  await click('确认名字');await click('进入主菜单');await resize(1000,650);await hall();
  await route('menu',['.menu-options button:first-child','.menu-preview'],[,async()=>{await click('设置 S');await click('settings back',page.locator('.settings-layout .settings-back'));await hall();},async()=>{await click('开发预览');await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});}]);
  await states('menu option',page.locator('.menu-option-primary'));
  await click('设置 S');await click('昵称头像 PROFILE');
  await states('settings avatar',button('头像：太阳'));await states('settings input',page.getByRole('textbox',{name:'昵称',exact:true}));
  await route('settings',['.settings-layout .settings-back','.settings-save'],[,async()=>{await page.getByRole('textbox',{name:'昵称',exact:true}).fill('动态设置保留');await click('头像：星星');},async()=>{await click('窗口 DISPLAY');await page.getByRole('checkbox').check();await page.getByRole('checkbox').uncheck();await click('昵称头像 PROFILE');assert.equal(await page.getByRole('textbox',{name:'昵称',exact:true}).inputValue(),'动态设置保留');}]);
  await click('settings back',page.locator('.settings-layout .settings-back'));await page.getByRole('dialog').waitFor();await resize(1000,650);await target('short modal close',page.locator('dialog .dialog-close'));await states('dialog action',button('继续编辑'));await click('继续编辑');await resize(1366,768);await page.locator('dialog').waitFor({state:'detached'});
  await states('settings save',button('保存并关闭'));await click('保存并关闭');await hall();await click(/^单人对局/);
  await route('prepare',['.prepare-start','.prepare-back'],[,async()=>{await click('prepare back',page.locator('.prepare-back'));await hall();await click(/^单人对局/);},async()=>{await page.locator('.prepare-start').focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');assert.equal(await page.locator('.prepare-start').evaluate(n=>n===document.activeElement),true);}]);await click('start',page.locator('.prepare-start'));await resize(1000,650);await enterArena(page);
  const initial=(await page.evaluate(()=>window.desktop.port.getView())).data;assert.equal(initial.source,'live');
  await route('solo-select',['.battle-pause','.battle-situation','.battle-actions button'],[,()=>click('Charge',page.locator('[data-entry=Charge] .card-pick')),async()=>{const v=(await page.evaluate(()=>window.desktop.port.getView())).data;assert.equal(v.match_id,initial.match_id);assert.equal(await page.locator('[data-entry=Charge] .card-pick').getAttribute('aria-pressed'),'true');}]);
  await states('selected card',page.locator('[data-entry=Charge] .card-pick'));
  const locked=page.locator('.card-pick:disabled').first();await target('unavailable card',locked);await click('确认出招');await resize(1000,650);await page.waitForFunction(()=>['selecting','result'].includes(document.querySelector('.battle-table')?.dataset.phase)||!!document.querySelector('.match-outro'));report.soloAfter=(await page.evaluate(()=>window.desktop.port.getView())).data;assert.equal(report.soloAfter.source,'live');assert.equal(report.soloAfter.match_id,initial.match_id);if(report.soloAfter.phase==='result'){await click('返回主菜单 EXIT');await hall();await click(/^单人对局/);await click('start',page.locator('.prepare-start'));await enterArena(page);}await target('solo restored pause',page.locator('.battle-pause'));
  await click('暂停');await click(/继续游戏/);await page.locator('dialog').waitFor({state:'detached'});await click('冻结');await click('恢复');await leaveSolo(page);await hall();
  await click('经典规则手册 R');const scrollBeforeWheel=await page.locator('.archive-stack').evaluate(n=>n.scrollTop);await page.locator('.archive-stack').hover();await page.mouse.wheel(0,1100);await page.waitForFunction(before=>document.querySelector('.archive-stack').scrollTop>=before+1099,scrollBeforeWheel);
  report.archiveBefore=await page.evaluate(()=>({selected:document.querySelector('.archive-card-detail')?.dataset.entry,stack:document.querySelector('.archive-stack')?.scrollTop,detail:document.querySelector('.archive-detail-scroll')?.scrollTop}));
  await route('archive',['.archive-search input','.archive-view-toggle']);report.archiveAfterResize=await page.evaluate(()=>({selected:document.querySelector('.archive-card-detail')?.dataset.entry,stack:document.querySelector('.archive-stack')?.scrollTop,detail:document.querySelector('.archive-detail-scroll')?.scrollTop}));assert.deepEqual(report.archiveAfterResize,report.archiveBefore,'pure resize retains archive selection and scroll');await click('切换为图标显示');await click('切换为卡牌显示');
  await resize(1000,650);await click('切换为图标显示');await resize(1920,1080);await click('切换为卡牌显示');await resize(1366,768);await states('archive mode',page.locator('.archive-view-toggle'));
  const precision=page.getByRole('tab',{name:'精确属性与完整限制',exact:true});await target('精确属性与完整限制',precision,{allowScroll:true});await precision.click();await page.locator('.archive-detail-scroll').hover();await page.mouse.wheel(0,600);await click('完整规则');await resize(1000,650);await page.locator('.archive-dialog-scroll').hover();await page.mouse.wheel(0,600);await target('long rule close',page.locator('dialog .dialog-close'));await page.keyboard.press('Escape');await resize(1366,768);await page.locator('dialog').waitFor({state:'detached'});
  await click('新手实战');await enterArena(page);await route('tutorial',['.battle-pause','.tutorial-coach','.battle-actions button'],[,()=>click('Charge',page.locator('[data-entry=Charge] .card-pick')),async()=>{await click('局势');await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});}]);await click('确认出招');await resize(1000,650);await click('明白了，继续');await leaveSolo(page);await hall();
  await click('开发预览');await click('P09 · 全员淘汰');await page.locator('.match-outro').waitFor();await route('local-result',['.result-actions button:first-child','.result-actions button:last-child'],[,async()=>{await click('局势回顾 REVIEW');await target('situation close',page.locator('dialog .dialog-close'));await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});},async()=>{await click('局势回顾 REVIEW');await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});}]);await click('返回主菜单 EXIT');await resize(1000,650);await hall();
  }
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
  report.preferences=await page.evaluate(()=>({motion:matchMedia('(prefers-reduced-motion:reduce)').matches,transparency:matchMedia('(prefers-reduced-transparency:reduce)').matches}));assert.ok(report.preferences.motion&&report.preferences.transparency);
  await click('开发预览');await click('P01 · 首次进入／欢迎建档');await click('进入牌厅');await page.getByRole('textbox',{name:'昵称',exact:true}).fill('减少动态');await click('确认名字 · 仅预览');assert.equal(await page.locator('.welcome-card-content').evaluate(n=>getComputedStyle(n).animationName),'none');assert.equal(await page.locator('.welcome-card-front').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(12, 25, 37)');await click('结束预览，返回主菜单');await hall();
  await click(/^单人对局/);assert.equal(await page.locator('.prepare-signal > span').first().evaluate(n=>getComputedStyle(n).animationName),'none');await click('start',page.locator('.prepare-start'));await enterArena(page);assert.equal(await page.locator('.battle-arena').evaluate(n=>getComputedStyle(n,'::after').backdropFilter),'none');await click('暂停');assert.equal(await page.locator('dialog').evaluate(n=>getComputedStyle(n).animationName),'none');await click(/继续游戏/);await page.locator('dialog').waitFor({state:'detached'});await leaveSolo(page);await hall();
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'},{name:'prefers-reduced-transparency',value:'no-preference'}]});
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1000,height:560,deviceScaleFactor:2,mobile:false});await click('设置 S');await click('昵称头像 PROFILE');await target('short-space settings close',page.locator('.settings-close'),{allowScroll:true});report.shortSpace={source:'CDP content simulation below native minimum; no mobile claim',viewport:[1000,560],scrollable:await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight)};assert.ok(report.shortSpace.scrollable);await click('short-space settings close',page.locator('.settings-close'));await hall();await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.detach();
  assert.deepEqual(report.errors,[]);report.status='PASS';
 }catch(e){fail(e);}
 finally{
  if(page&&!page.isClosed()){report.final=await captureDiagnostics(page).catch(e=>({error:e.message}));await shot('final').catch(fail);}if(outputOwned)await fs.writeFile(path.join(output,'dynamic.json'),JSON.stringify(report,null,2)).catch(fail);
  if(app)try{report.cleanup=await closeApplication(app);if(!report.cleanup.normalExit)fail(new Error('owned app did not exit normally'));}catch(e){fail(e);}if(profile)try{await fs.rm(profile,{recursive:true,force:true});}catch(e){fail(e);}if(outputOwned)await fs.writeFile(path.join(output,'dynamic.json'),JSON.stringify(report,null,2)).catch(fail);
 }
 console.log(JSON.stringify({status:report.status,routes:report.routes.length,controls:report.controls.length,failure:report.failure,cleanup:report.cleanup}));
})();
