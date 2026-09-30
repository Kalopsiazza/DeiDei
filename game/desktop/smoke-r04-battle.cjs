const { _electron: electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deidei-r04-battle-'));
  const env = {...process.env, DEIDEI_TEST_DATA_DIR:directory};
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({args:[path.join(__dirname,'smoke-live-main.cjs')],env});
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    await page.getByRole('textbox',{name:'昵称',exact:true}).fill('本机验收');
    await page.getByRole('button',{name:'保存，进入课间 →'}).click();
    await page.getByRole('button',{name:'单人对局'}).click();

    for (const name of ['见习：观察节奏','高压：主动争拍','练手：攻守均衡']) {
      const button = page.getByRole('button',{name,exact:true});
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'),'true');
    }
    for (const name of ['3 秒','10 秒','30 秒','自由']) {
      const button = page.getByRole('button',{name,exact:true});
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'),'true');
    }

    await page.getByRole('button',{name:/开始对局/}).click();
    await page.locator('.battle-table[data-phase="selecting"]').waitFor();
    await page.setViewportSize({width:1366,height:768});
    const layout = await page.evaluate(() => ({
      body:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
      viewport:[innerWidth,innerHeight],
      rows:new Set([...document.querySelectorAll('.card')].map(card=>Math.round(card.getBoundingClientRect().y))).size,
      cards:document.querySelectorAll('.card').length,
      icons:document.querySelectorAll('.card-pick > img').length,
      extra:document.querySelectorAll('.card-pick > :not(img):not(strong)').length,
    }));
    assert.deepEqual(layout.body,layout.viewport);
    assert.deepEqual([layout.cards,layout.icons,layout.extra,layout.rows],[33,33,0,3]);

    await page.locator('[data-entry="Charge"] .card-pick').click();
    assert.match(await page.locator('.self-seat .move-card.active').innerText(),/攒/);
    await page.getByRole('button',{name:'确认出招',exact:true}).click();
    await page.locator('.battle-table[data-phase="revealed"]').waitFor();
    await page.locator('.self-seat .move-card.current').waitFor();
    await page.locator('.opponent-seat .move-card.current').waitFor();
    assert.match(await page.locator('.self-seat .move-card.current').innerText(),/攒/);
    const first=Number(await page.locator('.reveal-countdown progress').getAttribute('value'));
    await page.waitForTimeout(350);
    const second=Number(await page.locator('.reveal-countdown progress').getAttribute('value'));
    assert.ok(second<first,`reveal countdown did not move: ${first} -> ${second}`);
    await page.locator('.battle-table[data-phase="selecting"]').waitFor();
    assert.equal(await page.locator('.self-seat .move-card[data-turn="1"]').evaluate(node=>getComputedStyle(node).getPropertyValue('--stack-index').trim()),'1');
    await page.getByRole('button',{name:'退出牌桌',exact:true}).click();
    await page.getByRole('button',{name:'离开',exact:true}).click();
    await page.locator('.app[data-page="menu"]').waitFor();
    console.log('PASS 33 icon-name cards; seat moves reveal for >=3s; countdown moves; prior move stacks left');
  } finally {
    if (app) await app.close();
    await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
