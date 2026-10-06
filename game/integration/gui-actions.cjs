// Current public controls shared by the real socket and TLS Electron harnesses.
const assert=require('node:assert/strict');
async function enterHall(page,name){
 await page.bringToFront();
 await page.locator('.welcome-scene').waitFor();
 const skip=page.getByRole('button',{name:'跳过开场',exact:false});
 if(await skip.count())await skip.click({noWaitAfter:true});
 const existing=page.getByRole('button',{name:/^以.*身份进入牌厅$/});
 if(await existing.count())await existing.click();else{
  await page.getByRole('button',{name:'进入牌厅',exact:true}).click();
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill(name);
  await page.getByRole('button',{name:'确认名字',exact:true}).click();
  await page.getByRole('radio',{name:'熟悉',exact:false}).check();
  await page.getByRole('button',{name:'进入牌厅',exact:true}).click();
 }
 await page.locator('.menu-layout').waitFor();
}
async function enterArena(page){
 await page.bringToFront();
 await page.locator('.match-intro, .online-intro, .battle-table').waitFor();
 const skip=page.getByRole('button',{name:/立即进入|立即入场/});
 if(await skip.count())await skip.click({noWaitAfter:true});
 await page.locator('.battle-table[data-ready="true"]').waitFor();
}
async function leaveSolo(page){
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 await page.getByRole('button',{name:'退出游戏 LEAVE MATCH',exact:true}).click();
 await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
 await page.locator('.menu-layout').waitFor();
}
async function leaveOnlinePortal(page){
 const back=page.getByRole('button',{name:'返回联机前厅',exact:true});
 if(await back.count())await back.click();
 await page.getByRole('button',{name:'返回主菜单',exact:true}).click();
 await page.locator('.menu-layout').waitFor();
}
async function assertTargets(page,selector){
 const count=await page.locator(selector).count();
 assert.ok(count>0,`No matching UI targets: ${selector}`);
 return count;
}
module.exports={enterHall,enterArena,leaveSolo,leaveOnlinePortal,assertTargets};
