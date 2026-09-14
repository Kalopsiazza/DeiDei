const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const output = process.env.DEIDEI_SMOKE_OUTPUT ? path.resolve(process.env.DEIDEI_SMOKE_OUTPUT) : path.resolve(__dirname, '../../docs/results/R02-T04-a');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deidei-t04-live-'));
  const env = {...process.env, DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;
  const evidence = {platform:process.platform, arch:process.arch, seed:2, token_seed:999, checks:[], screenshots:[]};
  let app;
  const passed = text => {evidence.checks.push(text);console.log('PASS',text);};
  await fs.mkdir(output,{recursive:true});
  try {
    app = await electron.launch({args:[path.join(__dirname,'smoke-live-main.cjs')],env});
    const page = await app.firstWindow();page.setDefaultTimeout(10000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    evidence.native = await app.evaluate(({BrowserWindow,screen})=>({bounds:BrowserWindow.getAllWindows()[0].getContentBounds(),displays:screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor})),versions:process.versions}));
    const shot = async name => {await page.screenshot({path:path.join(output,`${name}.png`),scale:'css'});evidence.screenshots.push({name,viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),method:'Real Electron renderer screenshot; explicit development viewport'});};
    await page.getByRole('textbox',{name:'昵称',exact:true}).fill('本机验收');
    await page.getByRole('button',{name:'保存，进入课间 →'}).click();
    await page.getByRole('button',{name:'设置',exact:true}).click();
    await page.getByRole('slider',{name:'音乐音量'}).fill('25');
    await page.getByRole('button',{name:'保存并关闭',exact:true}).click();
    await page.getByRole('button',{name:'单人对局'}).click();
    await shot('live-prepare');
    await page.getByRole('button',{name:'开始单人对局',exact:true}).click();
    await page.locator('.table[data-phase="selecting"]').waitFor();
    let start=(await page.evaluate(()=>window.desktop.port.getView())).data;
    assert.equal(start.source,'live');assert.equal(start.participants.length,2);
    assert.equal(start.participants[1].nickname==='临时随机对手'||start.participants[0].nickname==='临时随机对手',true);
    assert.ok(start.participants.every(p=>!('selected_entry_id' in p)));
    for (const [width,height] of [[1366,768],[1920,1080]]) {
      await page.setViewportSize({width,height});
      const layout=await page.evaluate(()=>({size:[innerWidth,innerHeight],body:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],cards:[...document.querySelectorAll('.card')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,nameSize:parseFloat(getComputedStyle(e.querySelector('strong')).fontSize)};})}));
      assert.equal(layout.cards.length,33);assert.equal(new Set(layout.cards.map(c=>Math.round(c.y))).size,3);
      assert.ok(layout.cards.every(c=>c.x>=0&&c.right<=width&&c.bottom<=height&&c.nameSize>=16));
      assert.ok(layout.body[0]<=width&&layout.body[1]<=height,JSON.stringify(layout.body));
      evidence[`layout_${width}`]=layout;await shot(`live-table-${width}x${height}`);
    }
    passed('33 real-core cards, categories and three rows visible at both target viewports');
    await page.setViewportSize({width:1366,height:768});
    await page.locator('[data-entry="Charge"] .card-pick').click();
    // Wait over multiple ordinary polls: the local selection must survive them.
    await page.waitForTimeout(450);assert.equal(await page.locator('[data-entry="Charge"]').getAttribute('class'),'card  selected');
    await page.getByRole('button',{name:'临时随机对手的公开资源',exact:true}).click();
    assert.ok((await page.getByRole('dialog').innerText()).includes('DD'));
    await page.keyboard.press('Enter');assert.equal((await page.evaluate(()=>window.desktop.port.getView())).data.submitted,false);
    await shot('live-public-resources');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'提交所选',exact:true}).click();
    await page.locator('[data-phase="revealed"]').waitFor();await shot('live-charge-revealed');
    await page.getByText('公开战况 · 第 2 拍',{exact:true}).waitFor();
    assert.match(await page.locator('.seat-resources').innerText(),/DD 1/);
    assert.equal(await page.locator('[data-entry="Bi"] .card-pick').isEnabled(),true);
    await page.locator('[data-entry="Bi"] .card-pick').click();await page.keyboard.press('Enter');
    await page.locator('[data-phase="revealed"]').waitFor();
    await page.locator('.summary details').evaluate(e=>{e.open=true;});
    assert.match(await page.locator('.summary').innerText(),/普通防御/);await shot('live-bi-defense-revealed');
    for (let i=0;i<20;i++) {
      if(await page.locator('.results').count())break;
      await page.waitForFunction(()=>!!document.querySelector('.results')||document.querySelector('.table')?.getAttribute('data-phase')==='selecting');
      if(await page.locator('.results').count())break;
      const attack=page.locator('[data-entry="Bi"] .card-pick');
      await (await attack.isEnabled()?attack:page.locator('[data-entry="Charge"] .card-pick')).click();
      await page.getByRole('button',{name:'提交所选',exact:true}).click();
      await page.waitForTimeout(100);
    }
    await page.locator('.results').waitFor();await shot('live-result');
    const result=(await page.evaluate(()=>window.desktop.port.getView())).data;
    assert.equal(result.source,'live');assert.equal(result.phase,'result');
    await page.getByRole('button',{name:'再来一场',exact:true}).click();
    await page.locator('.table[data-phase="selecting"]').waitFor();
    const restarted=(await page.evaluate(()=>window.desktop.port.getView())).data;
    assert.notEqual(restarted.match_id,start.match_id);assert.equal(restarted.turn_index,'1');
    assert.ok(restarted.participants.every(p=>p.alive&&p.resources.dd6==='0'));
    await shot('live-again');
    for(let i=0;i<20;i++) {
      await page.waitForFunction(()=>!!document.querySelector('.results')||document.querySelector('.table')?.getAttribute('data-phase')==='selecting');
      if(await page.locator('.results').count())break;
      const attack=page.locator('[data-entry="Bi"] .card-pick');
      await (await attack.isEnabled()?attack:page.locator('[data-entry="Charge"] .card-pick')).click();
      await page.getByRole('button',{name:'提交所选',exact:true}).click();await page.waitForTimeout(100);
    }
    await page.locator('.results').waitFor();await shot('live-second-result');
    passed('Two complete actual matches: Charge → Bi/Def → result → fresh match, with ledger evidence');
    await page.getByRole('button',{name:'再来一场',exact:true}).click();await page.locator('.table[data-phase="selecting"]').waitFor();
    await app.evaluate(()=>{const port=global.__testPort, original=port.getView;let once=true;port.getView=function(){if(once){once=false;throw new Error('GET_VIEW_FAILED');}return original.call(this);};});
    await page.getByText('读取对局失败，请重新读取或退出。',{exact:false}).first().waitFor();
    assert.equal(await page.locator('[data-entry="Charge"] .card-pick').isDisabled(),true);await shot('live-read-failure');
    await page.getByRole('button',{name:'重新读取对局',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('[data-entry="Charge"] .card-pick').disabled);
    passed('Visible read failure disables submission and supports explicit re-read of the same match');
    // Real worker exit, never another OS process; verify the renderer surfaces the failure.
    const profileFile=path.join(directory,'local-profile/profile.json');const profileBytes=await fs.readFile(profileFile);
    await app.evaluate(()=>global.__testWorker.kill('SIGTERM'));
    await page.getByText('本场中断，可重新开始。',{exact:false}).first().waitFor();
    await shot('live-worker-interrupted');assert.equal(await page.locator('[data-entry="Charge"] .card-pick').isDisabled(),true);
    await page.getByRole('button',{name:'重新读取对局',exact:true}).click();
    await page.getByText('本场中断，可重新开始。',{exact:false}).first().waitFor();
    assert.deepEqual(await fs.readFile(profileFile),profileBytes);
    await page.getByRole('button',{name:'退出本场',exact:true}).click();
    await page.getByRole('button',{name:'单人对局'}).click();await page.getByRole('button',{name:'开始单人对局',exact:true}).click();
    await page.locator('.table[data-phase="selecting"]').waitFor();
    assert.deepEqual(await fs.readFile(profileFile),profileBytes);
    passed('Real worker termination interrupts current match; retry never silently restarts; profile preserved');
    // Recovery follows the same live flow without clicking a disabled card.
    await page.locator('[data-entry="ZengYi"] .card-pick').click();await page.getByRole('button',{name:'提交所选',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.summary')?.textContent.includes('第 2 拍'));
    await page.locator('[data-phase="revealed"]').waitFor();await shot('live-auto-recovery');
    await page.getByText('公开战况 · 第 3 拍',{exact:true}).waitFor();
    passed('ZengYi round 2 automatically submits and reveals recovery, then round 3 becomes selectable');
    await page.getByRole('button',{name:'开发预览',exact:true}).click();
    await page.getByRole('button',{name:'P07 · 中局 B / 26 可用',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.match(await page.locator('.demo-label').innerText(),/演示数据/);
    assert.equal(await page.locator('.card:not(.unavailable)').count(),26);
    await shot('fixture-retained');
    for (const label of ['P08 · 普通观众','P08 · 本人已淘汰','P08 · 淘汰后存活者新局']) {
      await page.getByRole('button',{name:'开发预览',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.card').count(),0);
      await page.keyboard.press('1');await page.keyboard.press('Enter');
      assert.equal((await page.evaluate(()=>window.desktop.port.getView())).data.submitted,false);
    }
    passed('Explicit fixture and spectator previews retained, correctly labeled, no selection shortcuts');
    assert.deepEqual(errors,[]);evidence.console_errors=errors;evidence.status='PASS';
  } catch(error) {
    evidence.status='FAIL';evidence.error=error.stack;
    if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(output,'live-smoke-failure.png')}).catch(()=>{});}
    throw error;
  } finally {
    if(app){await app.evaluate(async()=>{await global.__testPort?.close();}).catch(()=>{});await app.close();}
    await fs.copyFile(path.join(directory,'ledger.jsonl'),path.join(output,'live-window-ledger.jsonl')).catch(()=>{});
    await fs.writeFile(path.join(output,'live-smoke.json'),JSON.stringify(evidence,null,2)+'\n');
    await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
