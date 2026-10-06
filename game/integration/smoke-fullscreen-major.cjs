// Ordinary product main and native fullscreen events; temporary synthetic profile only.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const desktop=path.resolve(__dirname,'../desktop'),root=path.resolve(__dirname,'../..');
const {_electron}=require(path.join(desktop,'node_modules/playwright-core'));
const {ProfileStore}=require(path.join(desktop,'profile.cjs'));
const {closeApplication}=require(path.join(desktop,'smoke-performance.cjs'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-major-fullscreen-'));
 const output=path.resolve(process.env.DEIDEI_SMOKE_OUTPUT||path.join(root,'.local-outputs/R05-T01-a/fullscreen-major'));
 await fs.mkdir(output,{recursive:true});const store=new ProfileStore(path.join(directory,'local-profile'));
 await store.save('create',{nickname:'全屏结果夹具',avatar_id:'leaf'});
 let app,page,checks=0;const errors=[],evidence={source:'ordinary game/desktop/main.cjs',profile:'synthetic disposable',collector:'unconfigured; local only',snapshots:[],events:[]};
 for(const file of ['main.cjs','build/ui/renderer.js']){try{evidence[file+'Sha256']=crypto.createHash('sha256').update(await fs.readFile(path.join(desktop,file))).digest('hex');}catch{evidence[file+'Sha256']=null;}}
 const check=(value,message)=>{assert.ok(value,message);checks++;};
 const menu=()=>page.locator('.app[data-page=menu]').waitFor();
 const open=async()=>{await page.getByRole('button',{name:'设置 S',exact:true}).click();await page.locator('.settings-content').waitFor();await page.locator('.settings-layout>nav').getByRole('button',{name:'窗口',exact:false}).click();};
 const state=async()=>{const reply=await page.evaluate(()=>window.desktop.settings.windowState());assert.equal(reply.ok,true);return reply.data;};
 // Poll from Node: Playwright waitForFunction does not await an async predicate.
 const result=async requested=>{const end=Date.now()+25000;let latest;while(Date.now()<end){latest=await state();if(latest.requested===requested&&latest.actual===requested&&!latest.pending)return latest;await pause(100);}throw Error('native fullscreen result did not settle: '+JSON.stringify(latest));};
 const snap=async label=>{const data=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,page:document.querySelector('.app')?.getAttribute('data-page'),warnings:[...document.querySelectorAll('.error')].map(node=>node.textContent),windowText:[...document.querySelectorAll('.settings-content [role=status]')].map(node=>node.textContent)}));evidence.snapshots.push({label,state:await state(),...data});return data;};
 const shot=async name=>{if(await page.locator('.settings-layout').count())await page.waitForFunction(()=>['.settings-layout','.settings-tab-panel'].every(selector=>{const node=document.querySelector(selector);return !node||Number(getComputedStyle(node).opacity)>=.999;}));await page.screenshot({path:path.join(output,name+'.png')});};
 try{
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({args:[desktop],env});page=await app.firstWindow();page.setDefaultTimeout(25000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].show();BrowserWindow.getAllWindows()[0].focus();});await page.waitForFunction(()=>document.hasFocus()&&document.visibilityState==='visible');
  await page.evaluate(()=>{window.__fullscreenSmoke=[];window.desktop.settings.onWindowChange(state=>window.__fullscreenSmoke.push({state,time:performance.now()}));});
  await page.getByRole('button',{name:'跳过开场',exact:true}).click();await page.getByRole('button',{name:'以全屏结果夹具身份进入牌厅',exact:true}).click();await menu();await open();
  const initial=await result(false);check(initial.requested===false&&initial.actual===false,'saved and actual initial window are separate authoritative fields');
  await page.getByText('已保存窗口：窗口 · 实际窗口：窗口 · 系统结果已确认',{exact:true}).waitFor();check(true,'initial product window result is visible');await snap('initial-window');
  await page.getByRole('checkbox',{name:'保存后切换全屏',exact:false}).check();check((await store.read()).settings.fullscreen===false,'unsaved fullscreen draft does not change profile');check((await state()).requested===false,'unsaved draft does not change applied window request');
  await page.getByRole('button',{name:'保存并关闭',exact:true}).click();await menu();check((await store.read()).settings.fullscreen===true,'normal save commits fullscreen preference');await result(true);
  const full=await snap('native-fullscreen-completed');check(!full.warnings.some(text=>text.includes('全屏切换正在等待系统完成')),'native completion removes only the pending fullscreen warning');
  await open();await page.getByText('已保存窗口：全屏 · 实际窗口：全屏 · 系统结果已确认',{exact:true}).waitFor();check(true,'product reports actual completed fullscreen');await shot('fullscreen-completed');
  await page.getByRole('checkbox',{name:'保存后切换全屏',exact:false}).uncheck();check((await store.read()).settings.fullscreen===true,'unsaved exit fullscreen draft keeps committed value');
  await page.getByRole('button',{name:'保存并关闭',exact:true}).click();await menu();check((await store.read()).settings.fullscreen===false,'normal save commits window preference');await result(false);
  const normal=await snap('native-window-completed');check(!normal.warnings.some(text=>text.includes('全屏切换正在等待系统完成')),'leave fullscreen completion removes pending warning');
  await open();await page.getByText('已保存窗口：窗口 · 实际窗口：窗口 · 系统结果已确认',{exact:true}).waitFor();check(true,'product reports actual completed window mode');await shot('window-completed');
  evidence.events=await page.evaluate(()=>window.__fullscreenSmoke);check(evidence.events.some(event=>event.state.requested===true&&event.state.actual===true&&!event.state.pending),'actual native enter event delivered through fixed bridge');check(evidence.events.some(event=>event.state.requested===false&&event.state.actual===false&&!event.state.pending),'actual native leave event delivered through fixed bridge');
  const privacy=await page.evaluate(()=>window.desktop.privacy.read());check(privacy.ok&&privacy.data.configured===false&&privacy.data.pendingReports===0,'fullscreen route has no collector or outgoing report');check(errors.length===0,'ordinary renderer has no errors');
  const cleanup=await closeApplication(app);app=null;check(cleanup.normalExit,'owned ordinary main exits normally');await fs.writeFile(path.join(output,'cleanup.json'),JSON.stringify(cleanup,null,2));
  await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors,evidence},null,2));console.log('PASS fullscreen major '+checks+' checks '+output);
 }catch(error){if(page){evidence.events=await page.evaluate(()=>window.__fullscreenSmoke||[]).catch(()=>[]);await snap('failure').catch(()=>{});await shot('failure').catch(()=>{});}await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({checks,errors,evidence,error:error.message},null,2));throw error;}
 finally{if(app){const cleanup=await closeApplication(app);await fs.writeFile(path.join(output,'cleanup.json'),JSON.stringify(cleanup,null,2));}await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
