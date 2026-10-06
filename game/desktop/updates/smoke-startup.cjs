// External harness: runs the ordinary product main with two damaged optional files.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
const {_electron:electron}=require('playwright-core');
const desktop=path.resolve(__dirname,'..');
(async()=>{
 const output=path.resolve(process.argv[2]||path.join(os.tmpdir(),`deidei-update-startup-${Date.now()}`));
 await fs.mkdir(output,{recursive:false});const result={entry:'ordinary main.cjs',cases:[]};
 try {
  for(const [name,code] of [['update-preferences.json','UPDATE_PREFERENCES_INVALID'],['update-observations.json','UPDATE_CACHE_INVALID']]){
   const directory=path.join(output,name.replace('.json',''));await fs.mkdir(directory);
   const filename=path.join(directory,name),damaged=Buffer.from('damaged optional update state\n');await fs.writeFile(filename,damaged);
   const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;
   let app;
   try {
    app=await electron.launch({args:[path.join(desktop,'main.cjs')],env,timeout:15000});
    const page=await app.firstWindow();page.setDefaultTimeout(10000);
    await page.waitForFunction(()=>Boolean(document.querySelector('.app')));
    const state=await page.evaluate(()=>window.desktop.updates.read());assert.equal(state.ok,true);assert.equal(state.data.status,'error');assert.equal(state.data.error,code);
    assert.equal(state.data.preferences.autoCheck,false);assert.equal(state.data.preferences.autoDownload,false);
    for(const op of ['check','download']){const reply=await page.evaluate(op=>window.desktop.updates[op](),op);assert.equal(reply.ok,false);assert.equal(reply.error,code);}
    const save=await page.evaluate(()=>window.desktop.updates.setPreferences({autoCheck:true}));assert.equal(save.ok,false);assert.equal(save.error,code);
    assert.deepEqual(await fs.readFile(filename),damaged);
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),directory);
    await page.screenshot({path:path.join(output,`${name}.png`)});
    result.cases.push({file:name,status:'PASS',window:true,updateError:code,autoCheck:false,autoDownload:false,originalBytesPreserved:true,sha256:createHash('sha256').update(damaged).digest('hex')});
   }finally {await app?.close();}
  }
  result.status='PASS';
 }catch(error){result.status='FAIL';result.error={name:error.name,message:error.message};process.exitCode=1;}
 await fs.writeFile(path.join(output,'startup.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})();
