// Real main and isolated synthetic profiles; failure injection intercepts only settings.apply.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {_electron:electron}=require('playwright-core');
const {sourceInput,closeApplication}=require('./smoke-performance.cjs');
const catalog=require('./catalog.json');

async function main(){
 assert.ok(process.argv[2],'Pass a fresh evidence directory');
 const output=path.resolve(process.argv[2]);await fs.mkdir(output,{recursive:true});
 await assert.rejects(fs.access(path.join(output,'checks.json')),'Keep previous evidence');
 const report={input:sourceInput(),checks:[],screenshots:[],rendererErrors:[],cleanup:[],protocol:'ordinary main, synthetic v2 profile, real save/restart and native resize; final controlled save delay/failure'};
 const check=(condition,message,evidence)=>{assert.ok(condition,message);report.checks.push({message,evidence});};
 let app,page,directory;
 const shot=async label=>{await page.waitForTimeout(650);await page.screenshot({path:path.join(output,`${label}.png`),scale:'css'});report.screenshots.push(label);};
 const style=()=>page.locator('.app').getAttribute('data-card-style');
 const profile=async()=>{const reply=await page.evaluate(()=>window.desktop.profile.read());assert.ok(reply.ok);return reply.data;};
 async function launch(wrapper){
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;delete env.DEIDEI_DEV_RELOAD;
  app=await electron.launch({args:[wrapper||path.join(__dirname,'main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(12000);
  page.on('pageerror',error=>report.rendererErrors.push(String(error)));
  await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].focus();});
  await page.locator('.welcome-scene').waitFor();const skip=page.getByRole('button',{name:'跳过开场',exact:true});if(await skip.count())await skip.click();
  await page.getByRole('button',{name:'以换牌验收身份进入牌厅',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
 }
 async function close(){const record=await closeApplication(app);report.cleanup.push(record);app=null;page=null;check(record.normalExit&&!record.forced,'owned Electron exits normally',record);}
 async function settings(){await page.getByRole('button',{name:'设置 S',exact:true}).click();await page.getByRole('button',{name:'卡牌 CARDS',exact:true}).click();await page.locator('.card-style-panel').waitFor();}
 async function resize(width,height){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);await page.waitForTimeout(300);
  const state=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth,save:document.querySelector('.settings-save')?.getBoundingClientRect().toJSON()}));
  assert.deepEqual(state.viewport,[width,height]);check(!state.overflow&&(!state.save||state.save.bottom<=height),'native resize keeps save visible without horizontal overflow',state);
  if(await page.locator('.card-style-panel').count()){
   const reading=await page.locator('.settings-content>fieldset').evaluate(n=>{const note=n.querySelector('.card-style-note').getBoundingClientRect(),box=n.getBoundingClientRect();n.scrollLeft=10000;const horizontal=n.scrollLeft;n.scrollLeft=0;return {horizontal,noteBottom:note.bottom,bottom:box.bottom};});
   check(reading.horizontal===0&&reading.noteBottom<=reading.bottom,'both choices and save guidance fit the reading area',reading);
  }
 }
 async function images(selector,kind){
  await page.waitForFunction(selector=>{const nodes=[...document.querySelectorAll(selector)];return nodes.length>0&&nodes.every(n=>n.complete&&n.naturalWidth>0);},selector);
  const sources=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')));
  check(sources.every(src=>src.startsWith(`assets/${kind}/`)),`all ${selector} use ${kind}`,sources);
 }
 async function leave(){await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();}
 async function surfaces(theme){
  const kind=theme==='classic'?'moves-classic':'cards';
  await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:'P07 · 中局 B / 26 可用',exact:true}).click();await page.locator('.battle-table[data-ready=true]').waitFor();
  await page.locator('[data-entry=Bi] .card-pick').click();await images('.selection-card img',kind);await images('.battle-cards img',theme==='classic'?'moves-classic':'moves');
  const face=await page.locator('.selection-card').evaluate(n=>({clip:getComputedStyle(n).clipPath,title:getComputedStyle(n.querySelector('footer')).clipPath,image:n.querySelector('img').className}));
  check(theme==='classic'?face.clip.startsWith('polygon')&&face.title==='none':face.clip==='none'&&face.image==='full-card-face','original frame/text or illustrated complete face',face);
  await shot(`battle-${theme}`);await page.locator('[data-entry=Xiao] .card-pick').click();
  const enhanced=await page.locator('.selection-card').evaluate(n=>({tag:getComputedStyle(n.querySelector('.card-state-tag')).display,name:n.querySelector('footer').textContent}));
  check(theme==='classic'?enhanced.tag==='none'&&enhanced.name.includes('强化'):enhanced.tag!=='none','enhanced state uses the original title or illustrated badge',enhanced);
  await page.locator('[data-entry=Bi] .card-pick').click();await page.getByRole('button',{name:'确认出招',exact:true}).click();await page.locator('.battle-table[data-phase=revealed]').waitFor();await images('.move-card.current img',kind);await leave();
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();await page.locator('.archive-card-detail').waitFor();await images('.archive-card-title img',kind);await shot(`archive-${theme}`);
  await page.getByRole('button',{name:'2 · 同时揭晓',exact:true}).click();await images('.archive-card-face img',kind);
  await page.getByRole('button',{name:'切换为图标显示',exact:true}).click();await images('.archive-icon-tile img',theme==='classic'?'moves-classic':'moves');check(await page.locator('.archive-icon-tile').count()===33,'manual retains all 33 moves');
  await page.locator('.archive-heading .settings-back').click();await page.locator('.app[data-page=menu]').waitFor();
  await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:'P09 · 唯一赢家',exact:true}).click();await page.locator('.match-outro').waitFor();await images('.result-move-art img',kind);await page.waitForTimeout(1600);await shot(`result-${theme}`);
  await page.getByRole('button',{name:'返回主菜单',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
 }
 try{
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-card-style-'));const file=path.join(directory,'local-profile/profile.json');await fs.mkdir(path.dirname(file));
  const v2={profile_version:2,local_id:'12345678-1234-4234-8234-123456789abc',nickname:'换牌验收',avatar_id:'moon',settings:{music:23,effects:47,fullscreen:false,graphics:{ambientMotion:'reduced',glass:'light',decoration:'simple'}}};
  const bytes=JSON.stringify(v2,null,3)+'\n';await fs.writeFile(file,bytes);await launch();
  check(await style()==='classic'&&await fs.readFile(file,'utf8')===bytes,'v2 opens in classic without disk migration');
  const decoded=await page.evaluate(async ids=>Promise.all(ids.flatMap(id=>['moves-classic','moves','cards'].map(kind=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({id,kind,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>resolve({id,kind,error:true});image.src=`assets/${kind}/${id}.${kind==='cards'?'webp':'png'}`;})))),catalog.entries.map(e=>e.entry_id));
  check(decoded.length===99&&decoded.every(i=>!i.error),'all 99 original/new card and icon assets decode',decoded);
  await settings();check(await page.getByRole('radio',{name:'原版卡牌',exact:true}).isChecked(),'saved classic is selected');
  await page.getByRole('radio',{name:'原版卡牌',exact:true}).focus();await page.keyboard.press('ArrowLeft');
  check(await page.getByRole('radio',{name:'绘画牌面',exact:true}).isChecked()&&await style()==='illustrated','native keyboard selection previews illustrated theme');
  check(await fs.readFile(file,'utf8')===bytes,'preview has not written the profile');
  const focus=await page.locator('[data-style=illustrated] .card-style-choice').evaluate(n=>getComputedStyle(n).outlineStyle);check(focus==='solid','radio retains visible keyboard focus');
  for(const size of [[1366,768],[1000,650],[1366,900],[1366,768]]){await resize(...size);await shot(`settings-${size.join('x')}`);}
  await page.locator('.settings-back').click();await page.getByRole('button',{name:'不保存关闭',exact:true}).click();check(await style()==='classic'&&await fs.readFile(file,'utf8')===bytes,'discard restores saved classic and old bytes');
  await settings();await page.getByRole('radio',{name:'绘画牌面',exact:true}).check();await page.getByRole('button',{name:'画面 GRAPHICS',exact:true}).click();check(await page.getByRole('combobox',{name:'画面预设',exact:true}).inputValue()==='balanced','card style does not change graphics preset');
  await page.locator('.settings-save').click();await page.locator('.app[data-page=menu]').waitFor();const saved=await profile();
  check(saved.profile_version===3&&saved.local_id===v2.local_id&&saved.settings.cardStyle==='illustrated','save writes v3 with stable identity');assert.deepEqual(saved.settings,{...v2.settings,cardStyle:'illustrated'});
  await close();await launch();check(await style()==='illustrated','illustrated survives a real restart');await surfaces('illustrated');
  await settings();await page.getByRole('radio',{name:'原版卡牌',exact:true}).check();await page.locator('.settings-save').click();await page.locator('.app[data-page=menu]').waitFor();await close();await launch();check(await style()==='classic','classic survives a real restart');await surfaces('classic');
  await page.getByRole('button',{name:/^单人对局/}).click();await images('.difficulty-emblem img','moves-classic');await page.getByRole('button',{name:/^开始对局/}).click();await page.locator('.battle-table[data-ready=true]').waitFor();await page.locator('[data-entry=Charge] .card-pick').click();await page.getByRole('button',{name:'确认出招',exact:true}).click();await page.locator('.battle-table[data-phase=revealed]').waitFor();await images('.move-card.current img','moves-classic');await shot('classic-real-worker');await close();
  const wrapper=path.join(output,'controlled-main.cjs');await fs.writeFile(wrapper,`const {ipcMain}=require('electron');global.__cardSave={fail:true,delay:700};const handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(channel,fn)=>handle(channel,async(...args)=>{if(channel==='settings.apply'){await new Promise(r=>setTimeout(r,global.__cardSave.delay));if(global.__cardSave.fail)return {ok:false,error:'SAVE_FAILED'};}return fn(...args);});require(${JSON.stringify(path.join(__dirname,'main.cjs'))});\n`);
  await launch(wrapper);const before=await fs.readFile(file);await settings();await page.getByRole('radio',{name:'绘画牌面',exact:true}).check();await page.locator('.settings-save').click();
  check(await page.getByRole('radio',{name:'原版卡牌',exact:true}).isDisabled(),'saving disables theme inputs');await page.getByRole('alert').filter({hasText:'保存失败'}).waitFor();
  check(await style()==='illustrated'&&await page.getByRole('radio',{name:'绘画牌面',exact:true}).isChecked(),'failure retains editable draft');assert.deepEqual(await fs.readFile(file),before);check((await profile()).settings.cardStyle==='classic','failure preserves saved classic');await shot('settings-save-failure');
  await app.evaluate(()=>{global.__cardSave.fail=false;});await page.locator('.settings-save').click();await page.locator('.app[data-page=menu]').waitFor();check((await profile()).settings.cardStyle==='illustrated','retry saves through the real store');
  await settings();const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
  check(await page.locator('.card-style-choice').first().evaluate(n=>getComputedStyle(n).transitionDuration==='0s'),'system reduced motion applies to the theme selector');check(await page.locator('.settings-content').evaluate(n=>getComputedStyle(n).backdropFilter==='none'),'system reduced transparency still applies');await shot('settings-system-preferences');
  await close();
  for(const theme of ['illustrated','classic']){
   await launch(path.join(__dirname,'tests-online/smoke-main.cjs'));
   if(await style()!==theme){await settings();await page.getByRole('radio',{name:theme==='classic'?'原版卡牌':'绘画牌面',exact:true}).check();await page.locator('.settings-save').click();await page.locator('.app[data-page=menu]').waitFor();}
   await page.getByRole('button',{name:/^好友联机/}).click();await page.getByText('已连接',{exact:true}).waitFor();await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.locator('.online-lobby').waitFor();
   await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始对局',exact:true}).click();await page.locator('.online-intro').waitFor();await page.getByRole('button',{name:/立即入场/}).click();await page.locator('.online-match[data-arena-ready=true]').waitFor();
   await page.locator('[data-entry=Bi] .card-pick').click();await images('.selection-card img',theme==='classic'?'moves-classic':'cards');await images('.battle-cards img',theme==='classic'?'moves-classic':'moves');await shot(`online-mock-${theme}`);
   check(await style()===theme,'MOCK six-player scene inherits the saved local preference');await close();
  }
  check(report.rendererErrors.length===0,'no renderer errors');report.status='PASS';
 }catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;if(page&&!page.isClosed())await shot('failure').catch(()=>{});}
 finally{
  if(app)try{await close();}catch(error){report.status='FAIL';report.failure??=String(error);process.exitCode=1;}
  if(directory)await fs.rm(directory,{recursive:true,force:true});await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${report.status}: ${report.checks.length} card-style checks; ${output}`);if(report.failure)console.error(report.failure);
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
