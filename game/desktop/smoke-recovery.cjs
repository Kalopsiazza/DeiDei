// Isolated ordinary main; fixture public UI scenes, no real network claim.
const {_electron:electron}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-recovery-'));
 const output=path.resolve(process.env.DEIDEI_RECOVERY_OUTPUT||path.join(__dirname,'../../.local-outputs/recovery'));
 await fs.mkdir(output,{recursive:true});
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 let app,page,checks=0;const errors=[];
 const check=(value,message)=>{assert.ok(value,message);checks++;};
 try{
  app=await electron.launch({args:[path.join(__dirname,'main.cjs')],env});
  page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'跳过开场',exact:true}).click();
  await page.getByRole('button',{name:'进入牌厅',exact:true}).click();
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('恢复检查');
  await page.getByRole('button',{name:'确认名字',exact:true}).click();
  await page.getByRole('button',{name:'进入主菜单',exact:true}).click();
  await page.locator('.app[data-page=menu]').waitFor();
  await page.getByRole('button',{name:'开发预览',exact:true}).click();
  await page.getByRole('button',{name:'P07 · 初始 A / 12 可用',exact:true}).click();
  await page.locator('.battle-table[data-ready=true]').waitFor();
  await page.locator('[data-entry="Charge"] .card-pick').click();
  const table=await page.locator('.battle-table').elementHandle();
  for(const [selector,title] of [['.battle-pause','游戏暂停'],['.battle-situation','本局态势']]){
   await page.locator(selector).focus();await page.keyboard.press('Enter');
   await page.getByRole('dialog',{name:title,exact:true}).waitFor();
   check((await page.evaluate(()=>window.desktop.port.getView())).data.phase==='selecting','ordinary button Enter does not submit');
   await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
   check(await page.locator(selector).evaluate(n=>n===document.activeElement),'dialog restores ordinary control focus');
  }
  check(await page.locator('.battle-freeze').isDisabled(),'six-seat fixture keeps unsupported freeze disabled');
  check(await table.evaluate(n=>n===document.querySelector('.battle-table')),'pause keeps the same stage DOM');
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await page.setViewportSize({width,height});
   const copy=await page.evaluate(()=>[...document.querySelectorAll('.card')].map(e=>{const label=e.querySelector('.card-name'),strong=e.querySelector('.card-pick strong').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(label);const text=range.getBoundingClientRect();return {font:parseFloat(getComputedStyle(label).fontSize),fits:text.left>=strong.left-1&&text.right<=strong.right+1&&text.top>=strong.top-1&&text.bottom<=strong.bottom+1};}));
   check(copy.length===33&&copy.every(c=>c.font>=12&&c.font<=16&&c.fits),'all 33 complete card names follow DESIGN 12–16px at '+width+': '+JSON.stringify(copy));
  }
  await page.setViewportSize({width:1366,height:768});
  await page.screenshot({path:path.join(output,'local-table.png')});
  await page.locator('.battle-pause').click();
  check((await page.getByRole('dialog').innerText()).includes('运行时计时继续'),'pause honestly describes runtime clock');
  await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();
  await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
  await page.locator('.app[data-page=menu]').waitFor();
  await page.getByRole('button',{name:'开发预览',exact:true}).click();
  await page.getByRole('button',{name:'P09 · 唯一赢家',exact:true}).click();
  await page.locator('.match-outro').waitFor();
  check(await page.getByRole('main',{name:'整场结果：胜利',exact:true}).isVisible(),'shared result keeps local role and label');
  check(await page.locator('.match-outro .cinematic-backdrop img').evaluate(n=>n.complete&&n.naturalWidth>0),'shared result has a decoded backdrop');
  await page.screenshot({path:path.join(output,'local-result.png')});
  await page.getByRole('button',{name:/返回主菜单/}).click();await page.locator('.app[data-page=menu]').waitFor();
  check(errors.length===0,'no renderer errors: '+errors.join(';'));
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({checks,errors,source:'ordinary main; fixture public UI scenes, no network claim'},null,2));
  console.log('PASS recovery',checks,output);
 }catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
 finally{if(app){await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
