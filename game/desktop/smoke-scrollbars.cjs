// Real Electron scroll ports; each run owns a temporary profile.
const {_electron}=require('playwright-core'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {ProfileStore}=require('./profile.cjs');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-scrollbars-'));
 const output=path.resolve(process.env.DEIDEI_SMOKE_OUTPUT||path.join(__dirname,'../../.local-outputs/frontend-round2/scrollbars'));
 await fs.mkdir(output,{recursive:true});
 await new ProfileStore(path.join(directory,'local-profile')).save('create',{nickname:'滚动验收',avatar_id:'leaf'});
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 let app,page,checks=0;const errors=[];
 const check=(v,message)=>{assert.ok(v,message);checks++;};
 try{
  app=await _electron.launch({args:[path.join(__dirname,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'跳过开场'}).click();await page.getByRole('button',{name:'以滚动验收身份进入牌厅'}).click();await page.locator('.app[data-page=menu]').waitFor();
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();await page.locator('.archive-stack').waitFor();
  const skin=selector=>page.locator(selector).evaluate(n=>{const s=getComputedStyle(n),thumb=getComputedStyle(n,'::-webkit-scrollbar-thumb');return {client:[n.clientWidth,n.clientHeight],scroll:[n.scrollWidth,n.scrollHeight],width:getComputedStyle(n,'::-webkit-scrollbar').width,color:thumb.backgroundColor,clip:thumb.backgroundClip,border:thumb.borderWidth,radius:thumb.borderRadius,active:n.dataset.scrollActive,focus:n.matches(':focus-within'),hover:n.matches(':hover')};});
  const idle=async(selector)=>{await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);await page.waitForFunction(selector=>!document.querySelector(selector).dataset.scrollActive,selector);};
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await page.locator('.archive-stack').focus();await page.keyboard.press('Home');await page.locator('.archive-stack-item[data-entry=Charge][data-selected=true]').waitFor();await page.keyboard.press('ArrowDown');await page.locator('.archive-stack-item[data-entry=Bi][data-selected=true]').waitFor();
   await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setContentSize(width,height),{width,height});await page.waitForTimeout(400);
   for(const selector of ['.archive-stack','.archive-detail-scroll','.archive-scene-rail']){
    await idle(selector);const before=await skin(selector);
    check(before.width==='12px'&&before.clip==='padding-box'&&before.border==='3px'&&before.radius==='0px','shared cyan line geometry '+selector);
    check(before.color==='rgba(0, 0, 0, 0)','idle thumb hidden '+selector);
    await page.locator(selector).hover();await page.waitForTimeout(100);const hover=await skin(selector);
    check(hover.color!=='rgba(0, 0, 0, 0)','hover reveals thumb '+selector+' '+JSON.stringify(hover));assert.deepEqual(hover.client,before.client);checks++;
    await page.screenshot({path:path.join(output,`hover-${selector.slice(1)}-${width}.png`)});
    await page.mouse.move(0,0);
    if(before.scroll.some((value,index)=>value>before.client[index])){
     await page.locator(selector).evaluate(n=>{if(n.scrollHeight>n.clientHeight)n.scrollTop+=70;else n.scrollLeft+=70;});
     await page.waitForFunction(selector=>document.querySelector(selector).dataset.scrollActive==='true',selector);
     check((await skin(selector)).color!=='rgba(0, 0, 0, 0)','scroll reveals thumb away from pointer '+selector);
     await idle(selector);check((await skin(selector)).color==='rgba(0, 0, 0, 0)','thumb hides after scrolling '+selector);
    }else check(await page.locator(selector).evaluate(n=>n.offsetHeight===n.clientHeight),'unused horizontal scrollbar occupies no height '+selector);
   }
   await page.locator('.archive-stack').focus();check((await skin('.archive-stack')).color!=='rgba(0, 0, 0, 0)','keyboard focus reveals scroll position');
   const top=await page.locator('.archive-stack').evaluate(n=>n.scrollTop);await page.keyboard.press('ArrowDown');await page.waitForTimeout(500);check(await page.locator('.archive-stack').evaluate((n,top)=>n.scrollTop!==top,top),'existing keyboard card browsing works');
   await page.getByRole('textbox',{name:'搜索招式'}).fill('E33');await page.waitForTimeout(500);const one=await skin('.archive-stack');
   check(one.client[1]===one.scroll[1],'single result has no vertical overflow');check(await page.locator('.archive-stack').evaluate(n=>n.offsetWidth===n.clientWidth),'unused vertical scrollbar consumes no width');
   await page.getByRole('button',{name:'清空搜索'}).click();await page.getByRole('button',{name:'切换为图标显示'}).click();await idle('.archive-icon-grid');
   const icons=await skin('.archive-icon-grid');check(icons.width==='12px'&&icons.color==='rgba(0, 0, 0, 0)','icon mode uses same idle skin');await page.locator('.archive-icon-grid').hover();check((await skin('.archive-icon-grid')).color!=='rgba(0, 0, 0, 0)','icon mode hover reveals shared thumb');
   await page.getByRole('button',{name:'切换为卡牌显示'}).click();
  }
  // Native scrollbar dragging keeps the browser's own hit testing and scroll physics.
  await page.locator('.archive-stack').evaluate(n=>n.scrollTop=0);await page.waitForTimeout(300);
  const rect=await page.locator('.archive-stack').boundingBox();await page.mouse.move(rect.x+rect.width-6,rect.y+12);await page.mouse.down();await page.mouse.move(rect.x+rect.width-6,rect.y+100,{steps:10});await page.mouse.up();
  check(await page.locator('.archive-stack').evaluate(n=>n.scrollTop>0),'custom thumb remains draggable');
  await page.getByRole('button',{name:'完整规则',exact:true}).click();await idle('.archive-dialog-scroll');check((await skin('.archive-dialog-scroll')).width==='12px','rule dialog shares scrollbar');await page.locator('.archive-dialog-scroll').hover();check((await skin('.archive-dialog-scroll')).color!=='rgba(0, 0, 0, 0)','rule dialog hover works');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});await idle('.archive-stack');await page.locator('.archive-stack').hover();check((await skin('.archive-stack')).color!=='rgba(0, 0, 0, 0)','reduced motion retains scroll feedback');
  await page.getByRole('button',{name:/返回主菜单/}).click();await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:'P07 · 中局 B / 26 可用',exact:true}).click();await page.locator('.battle-table[data-ready=true]').waitFor();await page.locator('.card[data-entry=Charge] .card-pick').click();await page.getByRole('button',{name:'确认出招',exact:true}).click();await page.locator('.battle-table[data-phase=revealed]').waitFor();await page.getByRole('button',{name:'局势',exact:true}).click();
  for(const selector of ['.situation-player-list','.situation-timeline>ol'])check((await skin(selector)).width==='12px','situation uses shared scrollbar '+selector);
  await page.screenshot({path:path.join(output,'situation.png')});check(errors.length===0,'no renderer errors');
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors},null,2));console.log(`PASS scrollbars ${checks} checks`);
 }catch(e){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
 finally{if(app)await app.close();await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
