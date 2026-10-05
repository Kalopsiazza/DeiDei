// Owned disposable profile; real Electron UI, existing MOCK room transport.
const {_electron}=require('playwright-core'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {closeApplication}=require('./smoke-performance.cjs');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-input-focus-'));
 const output=path.resolve(process.env.DEIDEI_SMOKE_OUTPUT||path.join(__dirname,'../../.local-outputs/input-focus'));
 await fs.mkdir(output,{recursive:true});const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 let app,page,checks=0;const errors=[],fields={};
 const check=(ok,message)=>{assert.ok(ok,message);checks++;};
 const menu=()=>page.locator('.app[data-page=menu]').waitFor();
 const inspect=async(name,label)=>{
  const input=page.getByRole('textbox',{name:label,exact:true});fields[name]={};
  for(const state of ['idle','hover','pointer','keyboard']){
   await input.blur();await page.mouse.move(0,0);
   if(state==='hover')await input.hover();
   if(state==='pointer')await input.click();
   if(state==='keyboard'){await input.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');}
   await page.waitForTimeout(350);
   const sample=await input.evaluate(n=>{const s=getComputedStyle(n),w=getComputedStyle(n.parentElement),edge=getComputedStyle(n.parentElement,'::after');return {focused:document.activeElement===n,outline:s.outlineStyle,border:s.borderWidth,shadow:s.boxShadow,glass:s.backdropFilter,surface:{background:w.backgroundImage,border:w.borderColor,radius:w.borderRadius,height:w.height,shadow:w.boxShadow,edgeOpacity:edge.opacity,edgeTransform:edge.transform}};});
   fields[name][state]=sample;
   check(sample.outline==='none'&&sample.border==='0px'&&sample.shadow==='none'&&sample.glass==='none',`${name}/${state}: no second frame or inner glass`);
   if(state==='pointer'||state==='keyboard')check(sample.focused&&sample.surface.edgeOpacity==='1',`${name}/${state}: retains visible bottom-edge focus`);
  }
  await page.screenshot({path:path.join(output,name+'.png'),scale:'css'});
 };
 try{
  app=await _electron.launch({args:[path.join(__dirname,'tests-online/smoke-main.cjs')],env});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'跳过开场',exact:true}).click();await page.getByRole('button',{name:'进入牌厅',exact:true}).click();await page.getByRole('textbox',{name:'昵称',exact:true}).waitFor();await inspect('welcome','昵称');
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('输入验收');await page.getByRole('button',{name:'确认名字',exact:true}).click();await page.getByRole('radio',{name:'熟悉',exact:true}).check();await page.getByRole('button',{name:'进入牌厅',exact:true}).click();await menu();
  await page.getByRole('button',{name:'经典规则手册 R',exact:true}).click();await inspect('archive','搜索招式');await page.getByRole('textbox',{name:'搜索招式',exact:true}).fill('bi');await page.getByRole('button',{name:'清空搜索',exact:true}).click();check(await page.getByRole('textbox',{name:'搜索招式',exact:true}).inputValue()==='','search clear remains functional');await page.getByRole('button',{name:/返回主菜单/}).click();await menu();
  await page.getByRole('button',{name:'设置 S',exact:true}).click();await page.getByRole('button',{name:'昵称头像 PROFILE',exact:true}).click();await inspect('settings','昵称');await page.getByRole('button',{name:'关闭',exact:true}).click();await menu();
  await page.getByRole('button',{name:'好友联机 创建 / 加入房间 02',exact:true}).click();await page.getByRole('button',{name:'创建房间',exact:true}).click();await inspect('create-password','房间密码');check(await page.getByRole('textbox',{name:'房间密码',exact:true}).getAttribute('type')==='password','create password remains masked');await page.getByRole('button',{name:'返回联机前厅',exact:true}).click();
  await page.getByRole('button',{name:'加入房间',exact:true}).click();await inspect('join-code','房间号');await inspect('join-password','房间密码');check(await page.getByRole('textbox',{name:'房间号',exact:true}).getAttribute('maxlength')==='16','room code retains length limit');check(await page.getByRole('textbox',{name:'房间密码',exact:true}).getAttribute('type')==='password','join password remains masked');
  for(const [name,states] of Object.entries(fields))for(const state of Object.keys(states)){const {edgeTransform,...skin}=states[state].surface,{edgeTransform:ignored,...baseline}=fields.archive[state].surface;assert.deepEqual(skin,baseline,`${name}/${state}: matches archive surface`);checks++;}
  await page.emulateMedia({reducedMotion:'reduce',reducedTransparency:'reduce'});await inspect('join-password-reduced','房间密码');check(await page.getByRole('textbox',{name:'房间密码',exact:true}).evaluate(n=>getComputedStyle(n.parentElement,'::after').transitionDuration.split(',').every(v=>parseFloat(v)===0)),'system reduced motion keeps focus static');
  check(errors.length===0,'no renderer errors');await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors,fields},null,2));console.log(`PASS input focus ${checks} checks, ${output}`);
 }catch(e){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({checks,errors,fields,error:e.message},null,2));if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw e;}
 finally{if(app){const cleanup=await closeApplication(app);await fs.writeFile(path.join(output,'cleanup.json'),JSON.stringify(cleanup,null,2));assert.ok(cleanup.normalExit,'owned Electron must exit normally');}await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
