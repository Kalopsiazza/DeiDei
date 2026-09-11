// Native macOS/Windows window automation; never labels this as human/offline acceptance.
const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
(async () => {
  const executablePath = path.resolve(process.argv[2]);
  const output = path.resolve(process.argv[3]); await fs.mkdir(output, {recursive:true});
  const results = [];
  for (let n=1;n<=10;n++) {
    const start=performance.now();
    const instance=await _electron.launch({executablePath, env:{...process.env,PATH:process.platform==='win32'?process.env.SystemRoot:' /usr/bin:/bin'.trim()}});
    let workerPid;
    try {
      const page=await instance.firstWindow(); await page.getByRole('heading',{name:'桌面技术验证',exact:true}).waitFor();
      const launchMs=performance.now()-start;
      const healthStart=performance.now();
      await page.getByRole('button',{name:'Health / 重试',exact:true}).click();
      await page.getByRole('status').filter({hasText:'ready'}).waitFor();
      const healthMs=performance.now()-healthStart;
      const measurements=await instance.evaluate(async ({app})=>({metrics:app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,memory:m.memory})),version:process.versions}));
      if (process.platform!=='win32') {
        const rows=execFileSync('/bin/ps',['-axo','pid=,ppid=,rss=,comm='],{encoding:'utf8'}).split('\n');
        const found=rows.map(r=>r.trim().split(/\s+/)).find(r=>Number(r[1])===instance.process().pid && r.slice(3).join(' ').endsWith('/worker'));
        assert.ok(found,'Python child visible'); workerPid=Number(found[0]); measurements.workerRssKiB=Number(found[2]);
      }
      const times=[];
      for (const name of ['双方攒','Bi 对攒','Bi 对防御','反弹对 Bi','请求简单 AI']) {
        const t=performance.now(); await page.getByRole('button',{name,exact:true}).click();
        await page.getByRole('status').filter({hasText:name==='请求简单 AI'?'Easy heuristic':name}).waitFor();
        assert.match(await page.getByRole('status').innerText(),/"ok": true/); times.push({name,ms:performance.now()-t});
      }
      await page.getByLabel('测试昵称').fill('测试档案 <b>纯文本</b>');
      await page.getByRole('button',{name:'写入档案',exact:true}).click();
      await page.getByRole('status').filter({hasText:'档案写入'}).waitFor(); assert.match(await page.getByRole('status').innerText(),/"ok": true/);
      await page.getByRole('button',{name:'读取档案',exact:true}).click(); await page.getByRole('status').filter({hasText:'档案读取'}).waitFor();
      assert.match(await page.getByRole('status').innerText(),/测试档案 <b>纯文本<\/b>/);
      assert.equal(await page.locator('pre b').count(),0);
      assert.equal(await page.locator('.seats > div').count(),6);
      assert.equal(await page.locator('img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),true);
      assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
      const invalid=await page.evaluate(()=>window.experiment.chooseEasy(-1)); assert.equal(invalid.ok,false);
      const prefs=await instance.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return {sandbox:p.sandbox,contextIsolation:p.contextIsolation,nodeIntegration:p.nodeIntegration,webSecurity:p.webSecurity};});
      assert.deepEqual(prefs,{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true});
      if(n===1){
        await page.getByRole('button',{name:'请求简单 AI',exact:true}).click();await page.getByRole('status').filter({hasText:'Easy heuristic'}).waitFor();
        await page.screenshot({path:path.join(output,'macos-packaged-window.png')});
      }
      results.push({iteration:n,launchMs,healthMs,times,measurements,workerPid,security:prefs});
    } finally { await instance.close(); }
    if(workerPid){
      let alive=true;
      for(let i=0;i<20;i++){try{process.kill(workerPid,0);await new Promise(r=>setTimeout(r,100));}catch{alive=false;break;}}
      assert.equal(alive,false,'Worker must exit with window');
    }
    results.at(-1).workerReaped=true;
    console.log(`cycle ${n}: PASS`);
  }
  await fs.writeFile(path.join(output,'desktop-smoke.json'),JSON.stringify({platform:process.platform,arch:process.arch,mode:'native window automation, network connected, restricted PATH',results},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
