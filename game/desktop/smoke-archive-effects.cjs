// Ordinary main, owned profile; verifies restored effects, lower presets and real page transitions.
const {_electron}=require('playwright-core'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {ProfileStore}=require('./profile.cjs'),{graphicsForPreset}=require('./graphics.cjs');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-archive-effects-'));
 const output=path.resolve(process.env.DEIDEI_SMOKE_OUTPUT||path.join(__dirname,'../../.local-outputs/archive-effects'));
 await fs.mkdir(output,{recursive:true});
 const store=new ProfileStore(path.join(directory,'local-profile'));
 const profile=await store.save('create',{nickname:'图鉴动效',avatar_id:'leaf'});
 await store.save('settings',{nickname:profile.nickname,avatar_id:profile.avatar_id,settings:{...profile.settings,cardStyle:'classic',graphics:graphicsForPreset('high')}});
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 let app,page,checks=0;const errors=[],evidence=[];
 const check=(value,message)=>{assert.ok(value,message);checks++;};
 const state=()=>page.evaluate(()=>{
  const one=(selector,pseudo)=>{const n=document.querySelector(selector);if(!n)return null;const s=getComputedStyle(n,pseudo);return {filter:s.filter,glass:s.backdropFilter,mask:s.maskImage,transition:s.transitionProperty,animation:s.animationName,play:s.animationPlayState,opacity:s.opacity};};
  return {world:one('.scene-world'),character:one('.menu-character'),pane:one('.archive-dossier'),content:one('.archive-stack-list'),port:one('.archive-stack'),
   cards:[...document.querySelectorAll('.archive-stack-card')].filter(n=>n.parentElement.style.visibility==='visible').map(n=>getComputedStyle(n).filter),
   loops:['.menu-environment','.menu-atmosphere','.menu-aura','.menu-particles'].map(selector=>one(selector)),screen:one('.archive-screen'),sheen:one('.archive-stack-item[data-selected=true] .archive-stack-card','::after')};
 });
 const frames=(leaving=false)=>page.evaluate(leaving=>new Promise((resolve,reject)=>{
  const result=[],waiting=performance.now();let start;const frame=t=>{const n=document.querySelector('.archive-screen'),w=document.querySelector('.scene-world');if(start===undefined){if(n&&(!leaving||n.dataset.leaving==='true'))start=t;else if(t-waiting>5000){reject(new Error('Page transition did not begin'));return;}else{requestAnimationFrame(frame);return;}}result.push({t:t-start,route:document.querySelector('.app').dataset.page,opacity:n?Number(getComputedStyle(n).opacity):null,world:w?getComputedStyle(w).transform:null});if(t-start<1100)requestAnimationFrame(frame);else resolve(result);};requestAnimationFrame(frame);
 }),leaving);
 try{
  app=await _electron.launch({args:[path.join(__dirname,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'跳过开场'}).click();await page.getByRole('button',{name:'以图鉴动效身份进入牌厅'}).click();await page.locator('.app[data-page=menu]').waitFor();
  for(const id of ['high','balanced','smooth']){
   if(id!=='high'){
    await page.getByRole('button',{name:'设置 S',exact:true}).click();await page.getByRole('button',{name:'画面 GRAPHICS',exact:true}).click();
    await page.getByRole('combobox',{name:'画面预设',exact:true}).selectOption(id);await page.locator('.settings-save').click();await page.locator('.app[data-page=menu]').waitFor();
   }
   await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);w.focus();});
   const entrySampling=frames();await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();const entry=await entrySampling;await page.mouse.move(0,0);
   const s=await state();evidence.push({id,state:s,entry});
   check(entry.some(f=>f.opacity>0&&f.opacity<1),'foreground entrance '+id);
   check(s.port.mask==='none'&&s.content.mask.includes('linear-gradient')===(id==='high'),'content mask leaves scrollbar clear '+id);
   check(s.pane.glass===(id==='high'?'blur(22px) saturate(1.2)':id==='balanced'?'blur(6px) saturate(1.1)':'none'),'archive glass '+id+' '+s.pane.glass);
   check(id==='high'?s.world.filter.includes('blur(3px)'):!s.world.filter.includes('blur'),'background depth '+id);
   check(id==='high'?s.character.filter.includes('drop-shadow'):s.character.filter==='none','character shadow '+id);
   check(id==='high'?s.cards.some(f=>/blur\((?!0px)/.test(f)):s.cards.every(f=>f==='none'),'progressive card depth '+id);
   check(s.loops.every(s=>id==='high'?s.animation!=='none'&&s.play==='running':s.play==='paused'),'four ambient loops '+id);
   if(id==='high'){
    check(s.world.transition.includes('transform')&&new Set(entry.filter(f=>f.route==='manual').map(f=>f.world)).size>2,'camera actually interpolates on entry');
    check(s.sheen.animation==='archive-card-glint','selected sheen restored');
    for(const selector of ['.archive-stack','.archive-detail-scroll']){
     await page.locator(selector).evaluate(n=>n.scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(selector=>document.querySelector(selector).scrollTop===0,selector);await page.locator(selector).hover();
     await page.evaluate(()=>{window.__archiveFrames=[];window.__archiveSampling=true;const f=t=>{window.__archiveFrames.push(t);if(window.__archiveSampling)requestAnimationFrame(f);};requestAnimationFrame(f);});
     const top=await page.locator(selector).evaluate(n=>n.scrollTop);
     const wheels=[];for(let i=0;i<8;i++){const before=await page.locator(selector).evaluate(n=>n.scrollTop);await page.mouse.wheel(0,i<4?500:-500);await page.waitForTimeout(180);wheels.push({i,before,after:await page.locator(selector).evaluate(n=>n.scrollTop)});}await page.waitForTimeout(800);
     const samples=await page.evaluate(()=>{window.__archiveSampling=false;return window.__archiveFrames;});evidence.push({selector,raf:samples,wheels,top,end:await page.locator(selector).evaluate(n=>n.scrollTop),focused:await page.evaluate(()=>document.hasFocus())});
     check(wheels.some(w=>w.i<4&&w.after>w.before),'native wheel moves scroll '+selector);check(samples.length>0&&await page.locator(selector).evaluate((n,top)=>Math.abs(n.scrollTop-top)<1,top),'eight native wheel inputs return to start '+selector);
    }
    await page.locator('.archive-stack').evaluate(n=>n.scrollTop=0);await page.waitForTimeout(250);const r=await page.locator('.archive-stack').boundingBox();
    await page.mouse.move(r.x+r.width-6,r.y+12);await page.mouse.down();await page.mouse.move(r.x+r.width-6,r.y+100,{steps:10});await page.mouse.up();check(await page.locator('.archive-stack').evaluate(n=>n.scrollTop>0),'unmasked native thumb drags');
    await page.locator('.archive-stack').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.locator('.archive-card-detail[data-entry=Bi]').waitFor();
    check(await page.locator('.archive-stack').evaluate(n=>getComputedStyle(n,'::-webkit-scrollbar').width)==='12px','shared scrollbar retained');
    await page.getByRole('button',{name:'切换为图标显示'}).click();await page.locator('.archive-icon-tile[data-entry=Bi]').click();await page.getByRole('button',{name:'切换为卡牌显示'}).click();
    const layoutCdp=await page.context().newCDPSession(page);
    for(const [width,height] of [[1000,650],[1366,768],[1366,900],[1366,1100],[1366,1330],[1366,1100],[1366,900],[1366,768],[1920,1080]]){
     await layoutCdp.send('Emulation.clearDeviceMetricsOverride');await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setContentSize(width,height),{width,height});await page.waitForTimeout(250);
     const native=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),emulated=native.width!==width||native.height!==height;
     // macOS may clamp an oversized window to the current display; record the native size and emulate the requested layout separately.
     if(emulated){await layoutCdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:native.dpr,mobile:false});await page.waitForTimeout(250);}
     evidence.push({requested:[width,height],native,emulated});check(await page.evaluate(({width,height})=>innerWidth===width&&innerHeight===height,{width,height}),'requested layout size is actually tested');
     check(await page.locator('.archive-workspace').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),'archive fits resized viewport '+width+'x'+height);
     const layout=await page.locator('.archive-stack').evaluate(n=>{const cards=[...n.querySelectorAll('.archive-stack-item')].filter(c=>c.style.visibility==='visible'&&Number(c.style.opacity)>.1),port=n.getBoundingClientRect(),boxes=cards.map(c=>c.firstElementChild.getBoundingClientRect()).filter(r=>r.bottom>port.top+28&&r.top<port.bottom-56);return {maxGap:Math.max(0,...boxes.slice(1).map((r,i)=>r.top-boxes[i].bottom)),height:n.clientHeight,scroll:n.scrollTop,bottom:Math.max(...cards.map(c=>parseFloat(c.style.top)+parseFloat(c.style.height))),visible:cards.length,front:parseFloat(n.querySelector('[data-entry=Bi]').style.top)};});evidence.push({size:[width,height],layout});
     check(layout.bottom>=layout.height-80&&await page.locator('.archive-card-detail').getAttribute('data-entry')==='Bi','fan fills resized height and preserves selection '+height);
     check(layout.maxGap<=1,'adjacent card faces overlap at '+width+'x'+height);
     await page.screenshot({path:path.join(output,'high-'+width+'x'+height+'.png')});
     if(height===1330){check(layout.visible>14,'tall window shows more cards than previous wide spacing');await page.locator('.archive-stack').evaluate(n=>n.scrollTo({top:27*148,behavior:'instant'}));await page.waitForTimeout(250);check(await page.locator('.archive-stack-item[data-entry=ZengRewardBigBi]').evaluate(n=>n.style.visibility==='visible'&&Number(n.style.opacity)>.1),'sixth remaining card is visible at the end');await page.screenshot({path:path.join(output,'high-tall-tail.png')});await page.locator('.archive-stack').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('.archive-stack').scrollTop===148);}
    }
    await layoutCdp.send('Emulation.clearDeviceMetricsOverride');await layoutCdp.detach();
    await page.getByRole('textbox',{name:'搜索招式',exact:true}).fill('E33');check(await page.locator('.archive-stack').getAttribute('data-count')==='1','single search result');await page.getByRole('textbox',{name:'搜索招式',exact:true}).fill('没有这张卡');await page.locator('.archive-no-match').waitFor();check(await page.locator('.archive-stack').getAttribute('data-count')==='0','empty search result');await page.getByRole('textbox',{name:'搜索招式',exact:true}).fill('');await page.locator('.archive-stack').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.waitForTimeout(600);
    await page.getByRole('button',{name:'完整规则',exact:true}).click();await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});check(await page.locator('.archive-card-detail').getAttribute('data-entry')==='Bi','selection survives modes and dialog');
   }
   await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());await page.screenshot({path:path.join(output,id+'.png')});
   const exitSampling=frames(true);await page.locator('.archive-heading .settings-back').click();const exit=await exitSampling;evidence.push({id,exit});
   check(exit.some(f=>f.route==='manual'&&f.opacity<.9)&&exit.at(-1).route==='menu','foreground fades before unmount '+id);
   if(id==='high'){await page.waitForFunction(()=>getComputedStyle(document.querySelector('.scene-world')).transform==='none');check(new Set(exit.map(f=>f.world)).size>2,'camera smoothly returns to hall');}
  }
  await page.getByRole('button',{name:'设置 S',exact:true}).click();await page.getByRole('button',{name:'画面 GRAPHICS',exact:true}).click();await page.getByRole('combobox',{name:'画面预设',exact:true}).selectOption('high');await page.locator('.settings-save').click();await page.locator('.app[data-page=menu]').waitFor();
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();const reduced=await state();
  check(reduced.screen.animation==='none'&&reduced.world.transition==='none','system reduced motion wins over high');check(reduced.pane.glass==='none','system reduced transparency wins over high');check(reduced.loops.every(s=>s.animation==='none'),'system preference stops ambient loops');
  await page.locator('.archive-heading .settings-back').click();await page.locator('.app[data-page=menu]').waitFor();check(errors.length===0,'renderer errors');
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors,evidence,reduced},null,2));console.log(`PASS archive effects ${checks} checks`);
 }catch(e){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({checks,errors,evidence,error:e.message},null,2));if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
 finally{if(app)await app.close();await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
