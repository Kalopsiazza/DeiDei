const path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os'),assert=require('node:assert/strict');
const desktop=path.resolve(__dirname,'../../../../game/desktop');
const {_electron:electron}=require(path.join(desktop,'node_modules/playwright-core'));
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-prepare-'));
 const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[path.join(desktop,'smoke-live-main.cjs')],env});
 const results=[],errors=[];
 try{
  const page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'跳过开场'}).click();
  await page.getByRole('button',{name:'进入牌厅',exact:true}).click();
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('布局验收');
  await page.getByRole('button',{name:'确认名字',exact:true}).click();
  await page.getByRole('button',{name:'进入主菜单',exact:true}).click();
  await page.getByRole('button',{name:'单人对局'}).click();
  for(const size of [[1000,650],[1366,768],'fullscreen']){
   await app.evaluate(({BrowserWindow},size)=>{const w=BrowserWindow.getAllWindows()[0];if(size==='fullscreen')w.setFullScreen(true);else w.setContentSize(...size);},size);
   if(size==='fullscreen')await page.waitForFunction(()=>innerWidth>=1400&&innerHeight>768);
   await page.waitForTimeout(1000);
   const layout=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    return {viewport:[innerWidth,innerHeight],console:rect('.difficulty-console'),overview:rect('.prepare-overview'),back:rect('.prepare-back'),start:rect('.prepare-start'),scroll:[document.scrollingElement.scrollWidth,document.scrollingElement.scrollHeight]};
   });
   const [width,height]=layout.viewport;
   assert.ok(Math.abs(layout.console.y+layout.console.height/2-height/2)<=2,'AI console centered: '+JSON.stringify(layout));
   for(const key of ['console','overview','back','start'])assert.ok(layout[key].y>=0&&layout[key].bottom<=height&&layout[key].x>=0&&layout[key].right<=width,key+' fits');
   assert.deepEqual(layout.scroll,layout.viewport,'no overflow');
   for(const name of ['见习：观察节奏','高压：主动争拍','练手：攻守均衡']){const b=page.getByRole('button',{name,exact:true});await b.click();assert.equal(await b.getAttribute('aria-pressed'),'true');}
   await page.getByRole('button',{name:'10 秒',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'10 秒',exact:true}).getAttribute('aria-pressed'),'true');
   await page.screenshot({path:path.join(__dirname,`prepare-${size==='fullscreen'?'fullscreen':size[0]}.png`),scale:'css'});
   results.push(layout);
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(__dirname,'layout.json'),JSON.stringify(results,null,2));
  console.log('PASS: 3 window sizes including native fullscreen, vertical centering, bounds, AI/time controls; '+JSON.stringify(results));
 }finally{await app.close();await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
