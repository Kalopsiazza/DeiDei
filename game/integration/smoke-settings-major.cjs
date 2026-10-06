// Ordinary product main; all profiles/output belong to this harness. Collector is intentionally unconfigured.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const desktop=path.resolve(__dirname,'../desktop'),root=path.resolve(__dirname,'../..');
const {_electron}=require(path.join(desktop,'node_modules/playwright-core'));
const {ProfileStore}=require(path.join(desktop,'profile.cjs'));
const {closeApplication}=require(path.join(desktop,'smoke-performance.cjs'));
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-major-settings-'));
 const output=path.resolve(process.env.DEIDEI_SMOKE_OUTPUT||path.join(root,'.local-outputs/R05-T01-a/settings-major'));
 await fs.mkdir(output,{recursive:true});const store=new ProfileStore(path.join(directory,'local-profile'));
 const original=await store.save('create',{nickname:'设置体验夹具',avatar_id:'leaf'});
 let app,page,checks=0;const errors=[],evidence={source:'ordinary game/desktop/main.cjs',profile:'synthetic disposable',collector:'unconfigured; local only',sizes:[],hardware:null};
 const check=(value,message)=>{assert.ok(value,message);checks++;};
 const tab=name=>page.locator('.settings-layout>nav').getByRole('button',{name,exact:false}).click();
 const menu=()=>page.locator('.app[data-page=menu]').waitFor();
 const open=async()=>{await page.getByRole('button',{name:'设置 S',exact:true}).click();await page.locator('.settings-content').waitFor();};
 const shot=async name=>{await page.waitForTimeout(450);await page.screenshot({path:path.join(output,name+'.png')});};
 const state=()=>page.evaluate(()=>window.desktop.privacy.read());
 const focus=async()=>{await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].show();BrowserWindow.getAllWindows()[0].focus();});await page.waitForFunction(()=>document.hasFocus()&&document.visibilityState==='visible');await page.waitForTimeout(150);};
 try{
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
  app=await _electron.launch({args:[desktop],env});page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await focus();
  await page.getByRole('button',{name:'跳过开场',exact:true}).click();await page.getByRole('button',{name:'以设置体验夹具身份进入牌厅',exact:true}).click();await menu();await open();
  check((await state()).data.configured===false,'ordinary main stats has no collector');check((await state()).data.pendingReports===0,'default has no outgoing report');
  await page.getByRole('slider',{name:'音乐音量',exact:true}).fill('23');await tab('昵称头像');await page.getByRole('textbox',{name:'昵称',exact:true}).fill('跨分类草稿');await tab('卡牌');await page.getByRole('radio',{name:'原版卡牌',exact:false}).check();
  await tab('声音');check(await page.getByRole('slider',{name:'音乐音量',exact:true}).inputValue()==='23','music draft survives category switches');await tab('昵称头像');check(await page.getByRole('textbox',{name:'昵称',exact:true}).inputValue()==='跨分类草稿','identity draft survives');
  await tab('隐私');check(await page.getByRole('checkbox',{name:'上传游戏与外观偏好',exact:false}).isDisabled(),'unconfigured collector prevents new consent');
  await page.getByRole('checkbox',{name:'记录本机使用摘要',exact:false}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.privacy-panel .checkbox input')][0].checked===false);check((await state()).data.recordLocal===false,'privacy change immediately persists');
  await page.getByRole('button',{name:'立即停止全部上传',exact:true}).click();await page.getByRole('button',{name:'查看待上传内容',exact:false}).click();check((await page.locator('.settings-json').innerText()).trim()==='[]','preview exposes actual empty queue');
  await tab('更新');await page.getByRole('checkbox',{name:'自动检查更新',exact:false}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.updates-panel .checkbox input')][0].checked===false);await page.getByRole('combobox',{name:'更新渠道',exact:true}).selectOption('beta');await page.waitForFunction(()=>document.querySelector('.updates-panel select').value==='beta');
  await tab('声音');await tab('更新');check(await page.getByRole('checkbox',{name:'自动检查更新',exact:false}).isChecked()===false,'update immediate preference survives switching');check(await page.getByRole('combobox',{name:'更新渠道',exact:true}).inputValue()==='beta','channel immediately persisted');
  await page.getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'不保存关闭',exact:true}).click();await menu();const discarded=await store.read();check(JSON.stringify(discarded)===JSON.stringify(original),'discard preserves exact old profile');
  const privacyFile=JSON.parse(await fs.readFile(path.join(directory,'privacy/privacy-state.json'),'utf8'));check(privacyFile.record_local===false&&privacyFile.scopes.preferences===false&&privacyFile.scopes.performance===false,'discard never reverses privacy stop');
  const updateFile=JSON.parse(await fs.readFile(path.join(directory,'update-preferences.json'),'utf8'));check(updateFile.autoCheck===false&&updateFile.channel==='beta','discard never reverses update preferences');
  await open();await tab('声音');await page.getByRole('slider',{name:'音乐音量',exact:true}).fill('31');await tab('昵称头像');await page.getByRole('textbox',{name:'昵称',exact:true}).fill('保存后的夹具');await tab('画面');
  evidence.hardware=(await page.evaluate(()=>window.desktop.hardware.read())).data;check(evidence.hardware.hardware.memoryGiB>0,'actual local RAM whitelist');check(!JSON.stringify(evidence.hardware).includes('vendorId'),'raw GPU object absent');
  await page.getByRole('button',{name:'应用到草稿',exact:true}).click();await page.getByRole('button',{name:'保存并关闭',exact:true}).click();await menu();const saved=await store.read();check(saved.nickname==='保存后的夹具'&&saved.settings.music===31,'normal save commits complete cross-category draft');
  await open();await tab('画面');await focus();await page.getByRole('button',{name:'在本机测一测',exact:true}).click();await page.getByRole('button',{name:'取消短测',exact:false}).click();await page.getByText('已取消短测，临时逐帧样本已丢弃。',{exact:true}).waitFor();check(true,'explicit short sample cancel');
  await page.getByRole('button',{name:'在本机测一测',exact:true}).click();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1000,650));await page.getByText('本次短测因窗口、焦点或系统偏好变化而失效，请保持窗口可见后重测。',{exact:true}).waitFor();check(true,'actual native resize invalidates sample');
  for(const [width,height] of [[1366,768],[1000,650],[1000,1000],[1366,768]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);await page.waitForTimeout(250);
   const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,left:[document.querySelector('.settings-layout>nav').clientHeight,document.querySelector('.settings-layout>nav').scrollHeight],leftWidth:[document.querySelector('.settings-layout>nav').clientWidth,document.querySelector('.settings-layout>nav').scrollWidth],right:[document.querySelector('.settings-scroll').clientHeight,document.querySelector('.settings-scroll').scrollHeight]}));
   evidence.sizes.push({requested:[width,height],actual:size});check(size.docWidth<=size.width&&size.docHeight<=size.height,'native settings frame fits '+width+'x'+height);
   await page.locator('.settings-scroll').focus();await page.keyboard.press('End');check(await page.getByRole('button',{name:'在本机测一测',exact:true}).isVisible(),'right controls accessible after keyboard scroll');
  }
  await focus();
  await page.waitForTimeout(1000);await page.getByRole('button',{name:'在本机测一测',exact:true}).click();await page.waitForTimeout(10500);const sampleText=await page.locator('.hardware-panel').innerText();evidence.shortSample=sampleText;
  check(/有效 \d+ 个 rAF 间隔/.test(sampleText),'actual focused visible 2+8s sample completes');await page.locator('.settings-scroll').focus();await page.keyboard.press('End');await shot('graphics-short-sample');
  await tab('隐私');await page.getByRole('button',{name:'立即停止全部上传',exact:true}).waitFor();await shot('privacy-local-only');await tab('更新');await shot('updates-source-status');
  check(errors.length===0,'ordinary renderer has no errors');await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors,evidence},null,2));console.log('PASS settings major '+checks+' checks '+output);
 }catch(error){if(page)evidence.currentPanel=await page.locator('.settings-content').innerText().catch(()=>null);await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({checks,errors,evidence,error:error.message},null,2));if(page)await shot('failure').catch(()=>{});throw error;}
 finally{if(app){const cleanup=await closeApplication(app);await fs.writeFile(path.join(output,'cleanup.json'),JSON.stringify(cleanup,null,2));check(cleanup.normalExit,'owned ordinary main exits normally');}await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
