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
    const layout = await page.evaluate(() => {
      const arena=document.querySelector('.battle-arena').getBoundingClientRect();
      const selection=document.querySelector('.selection-card').getBoundingClientRect();
      const identity=document.querySelector('.selection-identity').getBoundingClientRect();
      const resources=document.querySelector('.battle-resources .resources');
      return {
        body:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
        viewport:[innerWidth,innerHeight],
        rows:new Set([...document.querySelectorAll('.card')].map(card=>Math.round(card.getBoundingClientRect().y))).size,
        cards:document.querySelectorAll('.card').length,
        icons:document.querySelectorAll('.card-pick > img').length,
        extra:document.querySelectorAll('.card-pick > :not(img):not(strong)').length,
        arenaHeight:arena.height,
        operationHeight:document.querySelector('.battle-operation').getBoundingClientRect().height,
        resourceHeight:document.querySelector('.battle-resources').getBoundingClientRect().height,
        resourceSingleLine:getComputedStyle(resources).flexWrap==='nowrap',
        resourceAvatars:document.querySelectorAll('.battle-resources .avatar').length,
        tableLoaded:document.querySelector('.arena-surface img').naturalWidth>0,
        selectionCenterDelta:Math.abs(selection.x+selection.width/2-arena.x-arena.width/2),
        identityBelowCard:identity.top>=selection.bottom-2,
        identityCenterDelta:Math.abs(identity.x+identity.width/2-arena.x-arena.width/2),
        identityTop:identity.top,
        selfProfileOpacity:Number(getComputedStyle(document.querySelector('.self-seat .seat-profile')).opacity),
        namesStaySingleLine:[...document.querySelectorAll('.card-name')].every(name=>getComputedStyle(name).whiteSpace==='nowrap'),
        modifiers:[...document.querySelectorAll('[data-entry="BombFlipVolvo"] .card-tags em')].map(tag=>tag.textContent),
        rewardModifier:[...document.querySelectorAll('[data-entry="ZengRewardBigBi"] .card-tags em')].map(tag=>tag.textContent),
      };
    });
    assert.deepEqual(layout.body,layout.viewport);
    assert.deepEqual([layout.cards,layout.icons,layout.extra,layout.rows],[33,33,0,3]);
    assert.ok(layout.arenaHeight>=320,'selection arena must retain room for the centered showcase');
    assert.ok(layout.operationHeight>=340,'the three-row card selection area must be taller');
    assert.ok(layout.resourceHeight>=66,'the selecting resource strip must remain comfortably readable');
    assert.equal(layout.resourceSingleLine,true,'resources must not wrap into a second row');
    assert.equal(layout.resourceAvatars,0,'identity belongs below the showcase card, not in the resource strip');
    assert.equal(layout.tableLoaded,true);
    assert.ok(layout.selectionCenterDelta<2,'selected showcase card must be centered in the arena');
    assert.equal(layout.identityBelowCard,true);
    assert.ok(layout.identityCenterDelta<2,'local identity must sit directly below the showcase card');
    assert.equal(layout.selfProfileOpacity,0,'the destination identity must stay hidden until commit');
    assert.equal(layout.namesStaySingleLine,true);
    assert.deepEqual(layout.modifiers,['炸药','翻转']);
    assert.deepEqual(layout.rewardModifier,['赠送']);
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
      identityTop:document.querySelector('.selection-identity').getBoundingClientRect().top,
      selfProfileOpacity:Number(getComputedStyle(document.querySelector('.self-seat .seat-profile')).opacity),
    }));
    assert.ok(exiting.arenaHeight>layout.arenaHeight+120,'arena must expand while the operation area leaves');
    assert.ok(exiting.operationOpacity<.5,'operation area must fade as one unit');
    assert.match(exiting.operationFilter,/blur/);
    assert.equal(exiting.operationHidden,'true');
    assert.ok(exiting.identityTop>layout.identityTop+80,'local identity must travel toward the bottom seat during commit');
    assert.ok(exiting.selfProfileOpacity<.7,'bottom identity must cross-fade in instead of appearing instantly');
    await page.locator('.battle-table[data-phase="revealed"]').waitFor();
    const revealedAt=Date.now();
    await page.locator('.self-seat .move-card.current').waitFor();
    await page.waitForTimeout(700);
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
        topIdentityAboveCard:seats.filter(seat=>seat.dataset.seatEdge==='top').every(seat=>seat.querySelector('.seat-profile').getBoundingClientRect().bottom<=seat.querySelector('.move-card.current').getBoundingClientRect().top+1),
        bottomCardAboveIdentity:seats.filter(seat=>seat.dataset.seatEdge==='bottom').every(seat=>seat.querySelector('.move-card.current').getBoundingClientRect().bottom<=seat.querySelector('.seat-profile').getBoundingClientRect().top+1),
        socialButtons:document.querySelectorAll('.seat-social').length,
        disabledSocialButtons:document.querySelectorAll('.seat-social:disabled').length,
      };
    });
    assert.ok(revealLayout.card[0]>=90&&revealLayout.card[1]>=120,'revealed cards must be large enough to read across the table');
    assert.equal(revealLayout.cardsInside,true,'revealed cards must not be clipped by the arena');
    assert.equal(revealLayout.topIdentityAboveCard,true,'top players must place identity above their played card');
    assert.equal(revealLayout.bottomCardAboveIdentity,true,'the local played card must sit above the bottom identity strip');
    assert.deepEqual([revealLayout.socialButtons,revealLayout.disabledSocialButtons],[2,2]);
    assert.equal(await page.locator('.reveal-countdown').count(),0);
    await page.locator('.battle-table[data-phase="selecting"]').waitFor();
    assert.ok(Date.now()-revealedAt>=2700,'local reveal ended before its three-second hold');
    assert.equal(await page.locator('.selection-history > span').count(),1);
    const historyCard=page.locator('.selection-history > span').first();
    const historyTransform=await historyCard.evaluate(node=>getComputedStyle(node).transform);
    assert.equal(await historyCard.getAttribute('tabindex'),'0');
    await historyCard.hover();
    await page.waitForTimeout(350);
    const hoveredHistory=await historyCard.evaluate(node=>({transform:getComputedStyle(node).transform,outline:getComputedStyle(node).outlineStyle}));
    assert.notEqual(hoveredHistory.transform,historyTransform);
    assert.equal(hoveredHistory.outline,'solid');
    assert.equal(await page.locator('.self-seat .move-card[data-turn="1"]').evaluate(node=>getComputedStyle(node).getPropertyValue('--stack-index').trim()),'1');
    await page.getByRole('button',{name:'退出牌桌',exact:true}).click();
    await page.getByRole('button',{name:'离开',exact:true}).click();
    await page.locator('.app[data-page="menu"]').waitFor();
    await page.getByRole('button',{name:'开发预览',exact:true}).click();
    await page.getByRole('button',{name:'P07 · 初始 A / 12 可用',exact:true}).click();
    await page.locator('.battle-arena[data-seat-count="6"]').waitFor();
    await page.locator('[data-entry="Charge"] .card-pick').click();
    await page.getByRole('button',{name:'确认出招',exact:true}).click();
    await page.locator('.battle-table[data-phase="revealed"]').waitFor();
    await page.waitForTimeout(700);
    const sixSeatLayout=await page.evaluate(()=>{
      const arena=document.querySelector('.battle-arena').getBoundingClientRect();
      const seats=[...document.querySelectorAll('.arena-seat')];
      const edges=seats.map(seat=>seat.dataset.seatEdge);
      const parts=seats.flatMap((seat,index)=>[seat.querySelector('.move-card.current'),seat.querySelector('.seat-profile')].map(node=>({index,rect:node.getBoundingClientRect()})));
      const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>4&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>4;
      return {
        edges,
        inside:parts.every(({rect})=>rect.left>=arena.left-1&&rect.right<=arena.right+1&&rect.top>=arena.top-1&&rect.bottom<=arena.bottom+1),
        separated:parts.every((part,index)=>parts.slice(index+1).every(other=>part.index===other.index||!overlaps(part.rect,other.rect))),
        oriented:seats.every(seat=>{const edge=seat.dataset.seatEdge,card=seat.querySelector('.move-card.current').getBoundingClientRect(),profile=seat.querySelector('.seat-profile').getBoundingClientRect();return edge==='top'?profile.bottom<=card.top+1:edge==='left'?profile.right<=card.left+1:edge==='right'?card.right<=profile.left+1:card.bottom<=profile.top+1;}),
      };
    });
    assert.deepEqual(sixSeatLayout.edges.sort(),['bottom','left','right','top','top','top']);
    assert.equal(sixSeatLayout.inside,true,'all six-player seat content must stay inside the arena');
    assert.equal(sixSeatLayout.separated,true,'six-player cards and identity strips must not overlap each other');
    assert.equal(sixSeatLayout.oriented,true,'every seat must face its card toward the arena center');
    console.log('PASS taller selection; modifier chips; identity handoff; hover history; directional 2/6-player reveal seats; local reveal >=3s');
  } finally {
    if (app) app.process().kill('SIGKILL');
    await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
