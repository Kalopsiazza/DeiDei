// Actual Electron return surfaces: run against this checkout or pass another desktop directory.
const {_electron}=require('playwright-core'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const root=path.resolve(process.argv[2]||__dirname),{ProfileStore}=require(path.join(root,'profile.cjs')),{graphicsForPreset}=require(path.join(root,'graphics.cjs')),{closeApplication}=require(path.join(root,'smoke-performance.cjs'));
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-return-glass-')),output=path.resolve(process.env.DEIDEI_SMOKE_OUTPUT||path.join(root,'../../.local-outputs/return-glass'));
 await fs.mkdir(output,{recursive:true});const store=new ProfileStore(path.join(dir,'local-profile')),profile=await store.save('create',{nickname:'玻璃检查',avatar_id:'leaf'});
 const env={...process.env,DEIDEI_TEST_DATA_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_DEV_RELOAD;let app,page,checks=0;const evidence={},errors=[];
 const check=(ok,message)=>{assert.ok(ok,message);checks++;};
 const surface=async(selector)=>page.locator(selector).evaluate(n=>{
  const css=(e,pseudo)=>{const s=getComputedStyle(e,pseudo);return {blur:s.backdropFilter,filter:s.filter,color:s.color,background:s.backgroundColor,image:s.backgroundImage,border:s.borderTopColor,shadow:s.boxShadow};};
  const ancestors=[];for(let e=n.parentElement;e;e=e.parentElement)ancestors.push({class:e.className,...css(e)});
  const s=getComputedStyle(n),r=n.getBoundingClientRect();
  return {geometry:{shared:n.classList.contains('ui-back'),width:r.width,height:r.height,labelLength:Array.from(n.textContent).length,fontSize:s.fontSize,fontWeight:s.fontWeight,padding:s.padding},surface:css(n),parts:[css(n,'::before'),css(n,'::after'),...Array.from(n.children,e=>css(e))],ancestors};
 });
 const sample=async(name,selector,reference)=>{
  const button=page.locator(selector);await page.mouse.move(900,500);await page.waitForTimeout(1250);const normal=await surface(selector);
  const g=normal.geometry;check(g.shared&&Math.abs(g.width-(75+g.labelLength*15))<.1&&g.height===48&&g.fontSize==='15px'&&g.fontWeight==='700'&&g.padding==='9px 25px',name+' uses shared return geometry and typography');
  if(name.startsWith('high-'))await page.screenshot({path:path.join(output,name+'-page.png'),scale:'css'});
  await button.screenshot({path:path.join(output,name+'-normal.png'),scale:'css'});await button.hover();await page.waitForTimeout(500);const hover=await surface(selector);await button.screenshot({path:path.join(output,name+'-hover.png'),scale:'css'});
  for(const value of [normal,hover])check([...value.parts,...value.ancestors].every(s=>s.blur==='none'&&s.filter==='none'),name+' no second blur on ancestors, arrow, sweep or text');
  if(reference){assert.deepEqual(normal.surface,reference.normal.surface,name+' normal equals archive');assert.deepEqual(hover.surface,reference.hover.surface,name+' hover equals archive');checks+=2;}
  evidence[name]={normal,hover};return evidence[name];
 };
 const probe=async(name,selector)=>{
  const button=page.locator(selector);await page.mouse.move(900,500);
  // Put the probe inside the nav, behind the button: page dimming must not determine a component test.
  await button.evaluate(n=>{const r=n.getBoundingClientRect(),stripe=document.createElement('div');stripe.id='return-glass-probe';Object.assign(stripe.style,{position:'fixed',left:r.x-20+'px',top:r.y-20+'px',width:r.width+40+'px',height:r.height+40+'px',background:'repeating-linear-gradient(90deg,#fff 0 4px,#000 4px 8px)',zIndex:'0',pointerEvents:'none'});n.before(stripe);});
  const contrast=async(suffix)=>{const bytes=await button.screenshot({path:path.join(output,name+'-'+suffix+'.png'),scale:'css'});return app.evaluate(({nativeImage},bytes)=>{const image=nativeImage.createFromBuffer(Buffer.from(bytes)),{width,height}=image.getSize(),data=image.getBitmap();let sum=0;const row=Math.min(height-8,40);for(let x=9;x<width-9;x++){const a=(row*width+x)*4,b=a-4;sum+=(Math.abs(data[a]-data[b])+Math.abs(data[a+1]-data[b+1])+Math.abs(data[a+2]-data[b+2]))/3;}return sum/(width-18);},Array.from(bytes));};
  const blurred=await contrast('probe');await button.evaluate(n=>n.style.setProperty('backdrop-filter','none','important'));const sharp=await contrast('control');await button.evaluate(n=>{n.style.removeProperty('backdrop-filter');document.getElementById('return-glass-probe').remove();});
  check(blurred<sharp*.25&&sharp>4,name+' actually blurs the background');evidence[name]={blurred,sharp};
 };
 try{
  app=await _electron.launch({args:[path.join(root,'tests-online/smoke-main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const media=await page.context().newCDPSession(page);
  for(const preset of ['high','balanced','smooth']){
   await store.save('settings',{nickname:profile.nickname,avatar_id:profile.avatar_id,settings:{...profile.settings,graphics:graphicsForPreset(preset)}});await page.reload();
   const skip=page.getByRole('button',{name:'跳过开场',exact:true});if(await skip.count())await skip.click();await page.getByRole('button',{name:'以玻璃检查身份进入牌厅',exact:true}).click();
   await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();const reference=await sample(preset+'-archive','.archive-heading .settings-back');
   check(reference.normal.surface.blur===({high:'blur(12px) saturate(1.35)',balanced:'blur(6px) saturate(1.1)',smooth:'none'})[preset],preset+' standard quality mapping');
   await page.locator('.archive-heading .settings-back').click();
   await page.getByRole('button',{name:'设置 S',exact:true}).click();await sample(preset+'-settings','.settings-heading .settings-back',reference);await page.locator('.settings-heading .settings-back').click();
   await page.getByRole('button',{name:'单人对局',exact:false}).click();await sample(preset+'-solo','.prepare-back',reference);await page.locator('.prepare-back').click();
   await page.getByRole('button',{name:'好友联机',exact:false}).click();await sample(preset+'-front','.online-portal-nav .settings-back',reference);
   await page.getByRole('button',{name:'创建房间',exact:true}).click();await sample(preset+'-create','.online-portal-nav .settings-back',reference);
   await page.locator('.online-portal-nav .settings-back').click();await page.getByRole('button',{name:'加入房间',exact:true}).click();await sample(preset+'-join','.online-portal-nav .settings-back',reference);await page.locator('.online-portal-nav .settings-back').click();
   await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.locator('.online-room').waitFor();
   for(const height of [650,900]){
    await app.evaluate(({BrowserWindow},h)=>BrowserWindow.getAllWindows()[0].setContentSize(1366,h),height);await page.waitForFunction(h=>innerHeight===h,height);await sample(preset+'-room-'+height,'.online-room-nav .settings-back',reference);
    if(preset==='high')await probe('room-'+height,'.online-room-nav .settings-back');
   }
   await page.screenshot({path:path.join(output,preset+'-room-actual.png'),scale:'css'});
   if(preset==='balanced'){
    await media.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});await page.waitForFunction(()=>matchMedia('(prefers-reduced-transparency:reduce)').matches);await page.mouse.move(900,500);let s=await surface('.online-room-nav .settings-back');check(s.surface.blur==='none'&&s.surface.background==='rgb(16, 28, 39)','system reduced transparency removes glass');await page.locator('.online-room-nav .settings-back').hover();s=await surface('.online-room-nav .settings-back');check(s.surface.background==='rgb(28, 48, 61)','system hover remains opaque');await media.send('Emulation.setEmulatedMedia',{features:[]});
   }
   await page.getByRole('button',{name:'退出房间',exact:true}).click();await page.getByRole('button',{name:'确认结束房间',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
  }
  check(errors.length===0,'no renderer errors');await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({root,checks,errors,evidence},null,2));console.log('PASS return surface '+checks+' '+root);
 }catch(e){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({root,checks,errors,evidence,error:e.message},null,2));throw e;}
 finally{if(app){const cleanup=await closeApplication(app);await fs.writeFile(path.join(output,'cleanup.json'),JSON.stringify(cleanup,null,2));assert.ok(cleanup.normalExit);}await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
