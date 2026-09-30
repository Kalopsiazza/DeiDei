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
      arenaHeight:document.querySelector('.battle-arena').getBoundingClientRect().height,
      operationHeight:document.querySelector('.battle-operation').getBoundingClientRect().height,
      resourceHeight:document.querySelector('.battle-resources').getBoundingClientRect().height,
      tableLoaded:document.querySelector('.arena-surface img').naturalWidth>0,
      selectionCenterDelta:Math.abs(document.querySelector('.selection-card').getBoundingClientRect().x+document.querySelector('.selection-card').getBoundingClientRect().width/2-document.querySelector('.battle-arena').getBoundingClientRect().x-document.querySelector('.battle-arena').getBoundingClientRect().width/2),
    }));
    assert.deepEqual(layout.body,layout.viewport);
    assert.deepEqual([layout.cards,layout.icons,layout.extra,layout.rows],[33,33,0,3]);
    assert.ok(layout.arenaHeight>=390,'selection arena must take visual priority over the operation area');
    assert.ok(layout.operationHeight<310,'operation area must remain compact');
    assert.ok(layout.resourceHeight>=60,'the selecting resource strip must remain comfortably readable');
    assert.equal(layout.tableLoaded,true);
    assert.ok(layout.selectionCenterDelta<2,'selected showcase card must be centered in the arena');
    await page.locator('.selection-card.empty').waitFor();
    await page.locator('.battle-resources').waitFor();
    await page.locator('.battle-turn').waitFor();

    await page.locator('[data-entry="Charge"] .card-pick').click();
    assert.match(await page.locator('.selection-card').innerText(),/攒/);
    assert.match(await page.locator('.self-seat .move-card.active').innerText(),/攒/);
    await page.getByRole('button',{name:'确认出招',exact:true}).click();
    await page.locator('.commit-flight').waitFor();
    await page.waitForTimeout(450);
    const exiting=await page.evaluate(()=>({
      arenaHeight:document.querySelector('.battle-arena').getBoundingClientRect().height,
      operationOpacity:Number(getComputedStyle(document.querySelector('.battle-operation')).opacity),
      operationFilter:getComputedStyle(document.querySelector('.battle-operation')).filter,
      operationHidden:document.querySelector('.battle-operation').getAttribute('aria-hidden'),
    }));
    assert.ok(exiting.arenaHeight>layout.arenaHeight+120,'arena must expand while the operation area leaves');
    assert.ok(exiting.operationOpacity<.5,'operation area must fade as one unit');
    assert.match(exiting.operationFilter,/blur/);
    assert.equal(exiting.operationHidden,'true');
    await page.locator('.battle-table[data-phase="revealed"]').waitFor();
    const revealedAt=Date.now();
    await page.locator('.self-seat .move-card.current').waitFor();
    await page.locator('.opponent-seat .move-card.current').waitFor();
    assert.match(await page.locator('.self-seat .move-card.current').innerText(),/攒/);
    const revealLayout=await page.evaluate(()=>{
      const arena=document.querySelector('.battle-arena').getBoundingClientRect();
      const seats=[...document.querySelectorAll('.arena-seat')];
      const cards=[...document.querySelectorAll('.arena-seat .move-card.current')];
      const selfCard=document.querySelector('.self-seat .move-card.current').getBoundingClientRect();
      return {
        card:[selfCard.width,selfCard.height],
        cardsInside:cards.every(card=>{const rect=card.getBoundingClientRect();return rect.top>=arena.top-1&&rect.bottom<=arena.bottom+1;}),
        cardsAboveIdentity:seats.every(seat=>{const card=seat.querySelector('.move-card.current');const profile=seat.querySelector('.seat-profile');return !card||card.getBoundingClientRect().bottom<=profile.getBoundingClientRect().top+1;}),
        socialButtons:document.querySelectorAll('.seat-social').length,
        disabledSocialButtons:document.querySelectorAll('.seat-social:disabled').length,
      };
    });
    assert.ok(revealLayout.card[0]>=90&&revealLayout.card[1]>=120,'revealed cards must be large enough to read across the table');
    assert.equal(revealLayout.cardsInside,true,'revealed cards must not be clipped by the arena');
    assert.equal(revealLayout.cardsAboveIdentity,true,'played cards must sit above the bottom identity strip');
    assert.deepEqual([revealLayout.socialButtons,revealLayout.disabledSocialButtons],[2,2]);
    assert.equal(await page.locator('.reveal-countdown').count(),0);
    await page.locator('.battle-table[data-phase="selecting"]').waitFor();
    assert.ok(Date.now()-revealedAt>=2700,'local reveal ended before its three-second hold');
    assert.equal(await page.locator('.selection-history > span').count(),1);
    assert.equal(await page.locator('.self-seat .move-card[data-turn="1"]').evaluate(node=>getComputedStyle(node).getPropertyValue('--stack-index').trim()),'1');
    await page.getByRole('button',{name:'退出牌桌',exact:true}).click();
    await page.getByRole('button',{name:'离开',exact:true}).click();
    await page.locator('.app[data-page="menu"]').waitFor();
    console.log('PASS generated raster arena; centered selection; readable resources; large unclipped reveal cards above seat identity; local reveal >=3s');
  } finally {
    if (app) await app.close();
    await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
