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
    const page = await app.firstWindow();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    page.setDefaultTimeout(10000);
    await page.getByRole('button',{name:'跳过开场',exact:true}).click();
    await page.getByRole('button',{name:'进入牌厅',exact:true}).click();
  await page.getByRole('textbox',{name:'昵称',exact:true}).fill('本机验收');
    await page.getByRole('button',{name:'确认名字',exact:true}).click();await page.getByRole('button',{name:'进入主菜单',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.app')?.getAttribute('data-page')==='menu');
    await page.getByRole('button',{name:'开发预览',exact:true}).click();
    await page.evaluate(() => {
      window.__firstResultFrame = new Promise(resolve => {
        const observer = new MutationObserver(() => {
          const image=document.querySelector('.match-outro .cinematic-backdrop img');
          if (!image) return;
          observer.disconnect();
          requestAnimationFrame(() => resolve({loaded:image.complete&&image.naturalWidth>0}));
        });
        observer.observe(document.querySelector('#root'),{childList:true,subtree:true});
      });
    });
    await page.getByRole('button',{name:'P09 · 本人阵亡',exact:true}).click();
    assert.equal((await page.evaluate(() => window.__firstResultFrame)).loaded,true,'the first result frame must not render before its background is ready');
    await page.getByRole('button',{name:/返回主菜单/}).click({force:true});
    await page.locator('.app[data-page="menu"]').waitFor();
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
    assert.match(await page.locator('.prepare-time').innerText(),/∞/,'unlimited time must use the infinity symbol');

    await page.setViewportSize({width:1366,height:768});
    await page.getByRole('button',{name:/开始对局/}).click();
    await page.locator('.match-intro').waitFor();
    const introStarted=Date.now();
    const intro = await page.evaluate(() => ({
      players:document.querySelectorAll('.intro-versus article').length,
      backgroundLoaded:document.querySelector('.match-intro .cinematic-backdrop img').naturalWidth>0,
      copy:document.querySelector('.match-intro').innerText,
      button:document.querySelector('.cinematic-skip').innerText,
      genericPanels:[...document.querySelectorAll('.intro-versus article')].some(node=>getComputedStyle(node).backgroundImage!=='none'||getComputedStyle(node).borderLeftWidth!=='0px'),
      avatarSize:parseFloat(getComputedStyle(document.querySelector('.intro-versus .avatar')).width),
    }));
    assert.deepEqual([intro.players,intro.backgroundLoaded],[2,true]);
    for (const text of ['进入擂台','本机席位','训练对手']) assert.match(intro.copy,new RegExp(text));
    assert.match(intro.copy,/经典规则 · ∞/);
    assert.match(intro.button,/立即进入（5s）/);
    assert.equal(intro.genericPanels,false,'intro identities must not fall back to generic rectangular bars');
    assert.ok(intro.avatarSize>=78,'intro identities need a strong avatar focal point');
    await page.locator('.battle-table[data-phase="selecting"]').waitFor();
    assert.ok(Date.now()-introStarted>=4800,'intro must hold for five seconds before automatic entry');
    const landing = await page.evaluate(() => ({
      ready:document.querySelector('.battle-table').getAttribute('data-ready'),
      selection:document.querySelectorAll('.selection-stage').length,
      center:document.querySelectorAll('.arena-center').length,
      operationOpacity:Number(getComputedStyle(document.querySelector('.battle-operation')).opacity),
      glassOpacity:Number(getComputedStyle(document.querySelector('.battle-table'),'::after').opacity),
      glassBlur:getComputedStyle(document.querySelector('.battle-table'),'::after').backdropFilter,
    }));
    assert.deepEqual([landing.ready,landing.selection,landing.center],['false',0,0],'the arena must land before cards or center copy appear');
    assert.ok(landing.operationOpacity<.05,'the operation deck must not flash during the arena landing frame');
    assert.ok(landing.glassOpacity>.9&&landing.glassBlur.includes('blur'),'arena entry must begin behind deep glass');
    await page.locator('.battle-table[data-ready="true"]').waitFor();
    await page.waitForTimeout(800);
    await page.waitForFunction(() => document.querySelector('.arena-surface img')?.naturalWidth > 0);
    const layout = await page.evaluate(() => {
      const arena=document.querySelector('.battle-arena').getBoundingClientRect();
      const selection=document.querySelector('.selection-card').getBoundingClientRect();
      const resources=document.querySelector('.battle-resources');
      return {
        body:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
        viewport:[innerWidth,innerHeight],
        rows:[...document.querySelectorAll('.card-group .cards')].map(group=>getComputedStyle(group).gridTemplateRows.trim().split(/\s+/).length),
        cards:document.querySelectorAll('.card').length,
        icons:document.querySelectorAll('.card-pick > img').length,
        extra:document.querySelectorAll('.card-pick > :not(img):not(strong)').length,
        arenaHeight:arena.height,
        operationHeight:document.querySelector('.battle-operation').getBoundingClientRect().height,
        resourceHeight:resources.getBoundingClientRect().height,
        resourceBackground:getComputedStyle(resources).backgroundImage,
        resourceBorder:getComputedStyle(resources).borderTopWidth,
        resourceTokens:resources.querySelectorAll('.resource-token').length,
        resourceIcons:resources.querySelectorAll('.resource-token img').length,
        resourceAvatars:document.querySelectorAll('.battle-resources .avatar').length,
        tableLoaded:document.querySelector('.arena-surface img').naturalWidth>0,
        arenaInset:[getComputedStyle(document.querySelector('.arena-surface')).left,getComputedStyle(document.querySelector('.arena-surface')).right],
        glassOpacity:Number(getComputedStyle(document.querySelector('.battle-table'),'::after').opacity),
        selectionCenterDelta:Math.abs(selection.x+selection.width/2-arena.x-arena.width/2),
        selectionSize:[selection.width,selection.height],
        selectionIdentity:document.querySelectorAll('.selection-identity').length,
        selectionExtraCopy:document.querySelectorAll('.selection-card footer small').length,
        selfProfileOpacity:Number(getComputedStyle(document.querySelector('.self-seat .seat-profile')).opacity),
        namesStaySingleLine:[...document.querySelectorAll('.card-name')].every(name=>getComputedStyle(name).whiteSpace==='nowrap'),
        modifiers:[...document.querySelectorAll('[data-entry="BombFlipVolvo"] .card-tags em')].map(tag=>tag.textContent),
        rewardModifier:[...document.querySelectorAll('[data-entry="ZengRewardBigBi"] .card-tags em')].map(tag=>tag.textContent),
        readableType:[
          document.querySelector('.battle-status>strong'),
          document.querySelector('.battle-turn'),
          document.querySelector('.resource-token small'),
          document.querySelector('.battle-cards .card-pick strong'),
          document.querySelector('.battle-actions small'),
        ].map(node=>parseFloat(getComputedStyle(node).fontSize)),
      };
    });
    assert.deepEqual(layout.body,layout.viewport);
    assert.deepEqual([layout.cards,layout.icons,layout.extra,layout.rows],[33,33,0,[3,3,3]]);
    assert.ok(layout.arenaHeight>=320,'selection arena must retain room for the centered showcase');
    assert.ok(layout.operationHeight>=340,'the three-row card selection area must be taller');
    assert.ok(layout.resourceHeight>=60,'resource tokens must remain comfortably readable');
    assert.deepEqual([layout.resourceTokens,layout.resourceIcons],[5,5]);
    assert.equal(layout.resourceBackground,'none','resource tokens must not sit inside another large card');
    assert.equal(layout.resourceBorder,'0px','resource tokens must not sit inside a bordered strip');
    assert.equal(layout.resourceAvatars,0,'identity belongs below the showcase card, not in the resource strip');
    assert.equal(layout.tableLoaded,true);
    assert.deepEqual(layout.arenaInset,['0px','0px'],'arena art must fill the stage inside the HUD safe area');
    assert.ok(layout.glassOpacity<.05,'entry glass must clear before normal play');
    assert.ok(layout.selectionCenterDelta<2,'selected showcase card must be centered in the arena');
    assert.ok(layout.selectionSize[0]>=156&&layout.selectionSize[1]>=210,'the central selection card must remain the arena focal point');
    assert.deepEqual([layout.selectionIdentity,layout.selectionExtraCopy],[0,0],'selection stage must not repeat local identity or card filler copy');
    assert.equal(layout.selfProfileOpacity,0,'the destination identity must stay hidden until commit');
    assert.equal(layout.namesStaySingleLine,true);
    assert.deepEqual(layout.modifiers,['炸药','翻转']);
    assert.deepEqual(layout.rewardModifier,['赠送']);
    assert.ok(layout.readableType.every((size,index)=>size>=[17,11,10,11,11][index]),`essential selection copy is too small: ${layout.readableType}`);
    await page.locator('.selection-card.empty').waitFor();
    await page.locator('.battle-resources').waitFor();
    await page.locator('.battle-turn').waitFor();

    await page.getByRole('button',{name:'冻结',exact:true}).click();
    assert.equal(await page.locator('.battle-table').getAttribute('data-suspended'),'true');
    assert.equal(await page.getByRole('button',{name:'选择 自 bi',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'恢复',exact:true}).click();
    await page.getByRole('button',{name:'暂停',exact:true}).click();
    const pauseDialog=page.getByRole('dialog',{name:'游戏暂停'});
    await pauseDialog.waitFor();
    assert.match(await pauseDialog.evaluate(node=>getComputedStyle(node).animationName),/tech-dialog-in/);
    assert.match(await pauseDialog.evaluate(node=>getComputedStyle(node,'::backdrop').backdropFilter),/blur/);
    await page.getByRole('button',{name:/继续游戏/}).click();
    await pauseDialog.waitFor({state:'detached'});
    await page.getByRole('button',{name:'局势',exact:true}).click();
    const situationDialog=page.getByRole('dialog',{name:'本局态势'});
    await situationDialog.waitFor();
    assert.equal(await page.locator('.situation-player-list>article').count(),2);
    assert.equal(await page.locator('.elimination-log').count(),0,'solo situation must not show room elimination history');
    await page.getByRole('button',{name:'关闭弹窗'}).click();
    await situationDialog.waitFor({state:'detached'});

    await page.locator('[data-entry="Charge"] .card-pick').click();
    assert.match(await page.locator('.selection-card').innerText(),/攒/);
    assert.match(await page.locator('.self-seat .move-card.active').innerText(),/攒/);
    await page.getByRole('button',{name:'确认出招',exact:true}).click();
    await page.locator('.commit-flight').waitFor();
    await page.waitForTimeout(650);
    const exiting=await page.evaluate(()=>({
      phase:document.querySelector('.battle-table').getAttribute('data-phase'),
      ready:document.querySelector('.battle-table').getAttribute('data-ready'),
      arenaHeight:document.querySelector('.battle-arena').getBoundingClientRect().height,
      operationOpacity:Number(getComputedStyle(document.querySelector('.battle-operation')).opacity),
      operationFilter:getComputedStyle(document.querySelector('.battle-operation')).filter,
      operationHidden:document.querySelector('.battle-operation').getAttribute('aria-hidden'),
      selfProfileOpacity:Number(getComputedStyle(document.querySelector('.self-seat .seat-profile')).opacity),
    }));
    assert.ok(exiting.arenaHeight>layout.arenaHeight+120,'arena must expand while the operation area leaves');
    assert.ok(exiting.operationOpacity<.5,`operation area must fade as one unit: ${JSON.stringify(exiting)}`);
    assert.match(exiting.operationFilter,/blur/);
    assert.equal(exiting.operationHidden,'true');
    assert.ok(exiting.selfProfileOpacity<.99,`bottom identity must cross-fade in instead of appearing instantly: ${JSON.stringify(exiting)}`);
    await page.locator('.battle-table[data-phase="revealed"]').waitFor();
    const revealedAt=Date.now();
    await page.locator('.self-seat .move-card.current').waitFor();
    await page.waitForTimeout(700);
    await page.locator('.opponent-seat .move-card.current').waitFor();
    await page.evaluate(()=>Promise.all([...document.querySelectorAll('.move-card.current')].flatMap(node=>node.getAnimations().map(animation=>animation.finished))));
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
	        bottomGap:Math.round(document.querySelector('.seat-bottom .seat-profile').getBoundingClientRect().top-document.querySelector('.seat-bottom .move-card.current').getBoundingClientRect().bottom),
        seatButtons:document.querySelectorAll('.seat-profile button').length,
        hardBorders:[...document.querySelectorAll('.seat-profile')].some(profile=>getComputedStyle(profile).borderLeftWidth!=='0px'),
        backgroundPanels:[...document.querySelectorAll('.seat-profile')].some(profile=>getComputedStyle(profile).backgroundImage!=='none'||getComputedStyle(profile,'::before').content!=='none'),
	        identityOnly:[...document.querySelectorAll('.seat-profile')].every(profile=>profile.children.length===1&&profile.querySelector('header')?.children.length===2),
	        centerDeltas:seats.filter(seat=>['top','bottom'].includes(seat.dataset.seatEdge)).map(seat=>{const identity=seat.querySelector('.seat-profile>header').getBoundingClientRect(),card=seat.querySelector('.move-card.current').getBoundingClientRect();return [seat.dataset.seatEdge,Math.round((identity.left+identity.width/2-(card.left+card.width/2))*10)/10];}),
	        cardTextSize:parseFloat(getComputedStyle(document.querySelector('.self-seat .move-card.current strong')).fontSize),
        statusLines:document.querySelector('.battle-status').children.length,
      };
    });
    assert.ok(revealLayout.card[0]>=90&&revealLayout.card[1]>=120,'revealed cards must be large enough to read across the table');
    assert.equal(revealLayout.cardsInside,true,'revealed cards must not be clipped by the arena');
    assert.equal(revealLayout.topIdentityAboveCard,true,'top players must place identity above their played card');
	    assert.equal(revealLayout.bottomCardAboveIdentity,true,'the local played card must sit above the bottom identity strip');
	    assert.ok(revealLayout.bottomGap<=18,`the local identity must stay close to its played card: ${revealLayout.bottomGap}px`);
    assert.equal(revealLayout.seatButtons,0,'arena identities must not include action buttons');
    assert.equal(revealLayout.hardBorders,false,'seat identity glass must not have a hard rectangular border');
	    assert.equal(revealLayout.backgroundPanels,false,'arena identities must not render a panel background');
	    assert.equal(revealLayout.identityOnly,true,'arena identities must contain only avatar and nickname');
	    assert.ok(revealLayout.centerDeltas.every(([,delta])=>Math.abs(delta)<=2),`each avatar and nickname group must share its played card axis: ${JSON.stringify(revealLayout.centerDeltas)}`);
    assert.ok(revealLayout.cardTextSize>=12,'played card labels must remain readable across the arena');
    assert.equal(revealLayout.statusLines,2,'battle status must contain only the round and current phase');
    assert.match(await page.locator('.battle-status').innerText(),/擂台结算/);
    assert.doesNotMatch(await page.locator('.battle-status').innerText(),/共同揭晓完成|请选择本回合招式/);
    const seatProfile=page.locator('.self-seat .seat-profile');
    const seatAvatar=seatProfile.locator('.avatar');
    const seatTransform=await seatAvatar.evaluate(node=>getComputedStyle(node).transform);
    await seatProfile.hover();
    await page.waitForTimeout(250);
    assert.notEqual(await seatAvatar.evaluate(node=>getComputedStyle(node).transform),seatTransform,'seat avatar needs a visible hover response');
    const arenaCountdown=page.locator('.arena-countdown');
    assert.match(await arenaCountdown.innerText(),/\d+[\s\S]*秒后进入第 2 回合/);
    assert.ok(await arenaCountdown.evaluate(node=>parseFloat(getComputedStyle(node.querySelector('span')).fontSize)>=44),'reveal countdown must be the arena center focal point');
    assert.deepEqual(await page.locator('.arena-center').evaluate(node=>[getComputedStyle(node).backgroundImage,getComputedStyle(node).borderTopWidth,node.children.length]),['none','0px',1],'the arena center must keep only a borderless countdown');
    await page.locator('.battle-table[data-phase="selecting"]').waitFor();
    assert.ok(Date.now()-revealedAt>=2700,'local reveal ended before its three-second hold');
    assert.equal(await page.locator('.selection-history > span').count(),1);
    const historyCard=page.locator('.selection-history > span').first();
    await page.mouse.move(10,10);
    await historyCard.evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished)));
    const historyTransform=await historyCard.evaluate(node=>getComputedStyle(node).transform);
    assert.equal(await historyCard.getAttribute('tabindex'),'0');
    await historyCard.hover();
    await page.waitForTimeout(350);
    const hoveredHistory=await historyCard.evaluate(node=>({transform:getComputedStyle(node).transform,outline:getComputedStyle(node).outlineStyle}));
    assert.notEqual(hoveredHistory.transform,historyTransform);
    assert.equal(hoveredHistory.outline,'solid');
    assert.equal(await page.locator('.self-seat .move-card[data-turn="1"]').evaluate(node=>getComputedStyle(node).getPropertyValue('--stack-index').trim()),'1');
    await page.getByRole('button',{name:'暂停',exact:true}).click();
    await page.getByRole('button',{name:/退出游戏/}).click();
    await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
    await page.locator('.app[data-page="menu"]').waitFor();
    await page.getByRole('button',{name:'开发预览',exact:true}).click();
    await page.getByRole('button',{name:'P07 · 初始 A / 12 可用',exact:true}).click();
    await page.locator('.battle-arena[data-seat-count="6"]').waitFor();
    assert.equal(await page.getByRole('button',{name:'冻结',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'暂停',exact:true}).click();
    await page.getByRole('dialog',{name:'对局菜单'}).waitFor();
    await page.getByRole('button',{name:/房间游戏设置/}).click();
    await page.getByRole('dialog',{name:'房间游戏设置'}).waitFor();
    await page.getByRole('button',{name:'返回对局菜单',exact:true}).click();
    await page.getByRole('button',{name:/继续游戏/}).click();
    await page.getByRole('dialog',{name:'对局菜单'}).waitFor({state:'detached'});
    await page.getByRole('button',{name:'局势',exact:true}).click();
    assert.equal(await page.locator('.situation-player-list>article').count(),6);
    assert.equal(await page.locator('.situation-resources > .elimination-log').count(),1,'multiplayer elimination history must share the resource column');
    await page.getByRole('button',{name:'关闭弹窗'}).click();
    await page.getByRole('dialog',{name:'本局态势'}).waitFor({state:'detached'});
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
	        bottomGap:(()=>{const seat=document.querySelector('.seat-bottom');return Math.round(seat.querySelector('.seat-profile').getBoundingClientRect().top-seat.querySelector('.move-card.current').getBoundingClientRect().bottom);})(),
	        centerDeltas:seats.filter(seat=>['top','bottom'].includes(seat.dataset.seatEdge)).map(seat=>{const identity=seat.querySelector('.seat-profile>header').getBoundingClientRect(),card=seat.querySelector('.move-card.current').getBoundingClientRect();return [seat.dataset.seatEdge,Math.round((identity.left+identity.width/2-(card.left+card.width/2))*10)/10];}),
	      };
    });
    assert.deepEqual(sixSeatLayout.edges.sort(),['bottom','left','right','top','top','top']);
    assert.equal(sixSeatLayout.inside,true,'all six-player seat content must stay inside the arena');
	    assert.equal(sixSeatLayout.separated,true,'six-player cards and identity strips must not overlap each other');
	    assert.equal(sixSeatLayout.oriented,true,'every seat must face its card toward the arena center');
	    assert.ok(sixSeatLayout.bottomGap<=18,`six-player local identity must stay close to its played card: ${sixSeatLayout.bottomGap}px`);
	    assert.ok(sixSeatLayout.centerDeltas.every(([,delta])=>Math.abs(delta)<=2),`six-player identity groups must stay centered on their played cards: ${JSON.stringify(sixSeatLayout.centerDeltas)}`);
    await page.getByRole('button',{name:'暂停',exact:true}).click();
    await page.getByRole('button',{name:/退出游戏/}).click();
    await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
    await page.locator('.app[data-page="menu"]').waitFor();
    await page.getByRole('button',{name:'开发预览',exact:true}).click();
    await page.getByRole('button',{name:'P09 · 本人阵亡',exact:true}).click();
    await page.locator('.match-outro.result-defeat').waitFor();
    await page.locator('.result-last-turn img').first().waitFor();
    const defeat = await page.evaluate(() => ({
      players:document.querySelectorAll('.result-players article').length,
      cards:document.querySelectorAll('.result-last-turn>div>article').length,
      moveIcons:document.querySelectorAll('.result-move-art img').length,
      text:document.querySelector('.match-outro').innerText,
      backgroundLoaded:document.querySelector('.match-outro .cinematic-backdrop img').naturalWidth>0,
      inside:[...document.querySelectorAll('.result-heading,.result-players,.result-last-turn,.result-actions')].every(node=>{const rect=node.getBoundingClientRect();return rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight;}),
      selfFirst:document.querySelector('.result-players article:first-child').dataset.self,
      playerYs:[...document.querySelectorAll('.result-players article')].map(node=>Math.round(node.getBoundingClientRect().y)),
      avatarOnly:[...document.querySelectorAll('.result-players article')].every(node=>node.children.length===2&&Boolean(node.querySelector('.avatar'))&&Boolean(node.querySelector('strong'))),
      actionsRight:document.querySelector('.result-actions').getBoundingClientRect().left>innerWidth/2,
      readableType:[
        document.querySelector('.result-players strong'),
        document.querySelector('.result-last-turn article>strong'),
        document.querySelector('.result-actions button'),
      ].map(node=>parseFloat(getComputedStyle(node).fontSize)),
      glassAnimation:getComputedStyle(document.querySelector('.match-outro'),'::before').animationName,
      glassBlur:getComputedStyle(document.querySelector('.match-outro'),'::before').backdropFilter,
    }));
    assert.deepEqual([defeat.players,defeat.cards,defeat.moveIcons,defeat.backgroundLoaded,defeat.inside],[2,2,2,true,true]);
    assert.match(defeat.text,/阵亡[\s\S]*最后一拍[\s\S]*Pragon[\s\S]*局势回顾/);
    assert.doesNotMatch(defeat.text,/脚本示例|实付|本人进度/,'result must not expose internal settlement copy');
    assert.equal(defeat.selfFirst,'true');
    assert.equal(new Set(defeat.playerYs).size,1,'result participants must form a horizontal avatar rail');
    assert.equal(defeat.avatarOnly,true,'result participant rail must show only avatars until hover');
    assert.equal(defeat.actionsRight,true,'result actions must align to the right edge');
    assert.ok(defeat.readableType.every((size,index)=>size>=[15,15,16][index]),`essential result copy is too small: ${defeat.readableType}`);
    assert.match(defeat.glassAnimation,/arena-glass-release/);
    assert.match(defeat.glassBlur,/blur/,'result scene must emerge from the arena glass handoff');
    const resultAvatar=page.locator('.result-players article').first();
    assert.equal(await resultAvatar.locator('strong').evaluate(node=>getComputedStyle(node).opacity),'0');
    await resultAvatar.hover();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.result-players article strong')).opacity==='1');
	    const resultTooltip=await resultAvatar.evaluate(node=>{const avatar=node.querySelector('.avatar').getBoundingClientRect(),label=node.querySelector('strong'),rect=label.getBoundingClientRect(),style=getComputedStyle(label);return {opacity:style.opacity,below:rect.top>=avatar.bottom,gap:Math.round(rect.top-avatar.bottom),plain:style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.borderTopWidth==='0px'&&style.paddingTop==='0px'};});
	    assert.equal(resultTooltip.opacity,'1');
	    assert.equal(resultTooltip.below,true);
	    assert.ok(resultTooltip.gap<=4,`result nickname must stay close to its avatar: ${JSON.stringify(resultTooltip)}`);
	    assert.equal(resultTooltip.plain,true,'hovering a result avatar must reveal text without a tooltip panel');
    await page.getByRole('button',{name:/局势回顾/}).click();
    assert.equal(await page.locator('.situation-player-list>article').count(),2);
    assert.equal(await page.locator('.elimination-log').count(),0);
    assert.doesNotMatch(await page.getByRole('dialog',{name:'本局态势'}).innerText(),/正在查看|点击牌桌席位可直接定位|新记录在上/);
    const timeline=page.locator('.situation-timeline>ol');
    await timeline.evaluate(node=>{const item=node.querySelector('li');for(let i=0;item&&i<14;i++)node.append(item.cloneNode(true));});
    const timelineScroll=await timeline.evaluate(node=>{node.scrollTop=240;return {top:node.scrollTop,height:node.clientHeight,scrollHeight:node.scrollHeight,overflow:getComputedStyle(node).overflowY};});
    assert.ok(timelineScroll.scrollHeight>timelineScroll.height&&timelineScroll.top>0,'long situation history must own a working scroll port');
    assert.equal(timelineScroll.overflow,'auto');
    await page.getByRole('button',{name:'关闭弹窗'}).click();
    await page.getByRole('dialog',{name:'本局态势'}).waitFor({state:'detached'});
    await page.getByRole('button',{name:/再来一场/}).click();
    await page.locator('.match-intro').waitFor();
    await page.getByRole('button',{name:/立即进入/}).click();
    await page.getByRole('button',{name:'暂停',exact:true}).click();
    await page.getByRole('button',{name:/退出游戏/}).click();
    await page.getByRole('dialog',{name:'离开当前对局',exact:true}).getByRole('button',{name:'离开',exact:true}).click();
    await page.getByRole('button',{name:'开发预览',exact:true}).click();
    await page.getByRole('button',{name:'P09 · 唯一赢家',exact:true}).click();
    await page.locator('.match-outro.result-victory').waitFor();
    assert.match(await page.locator('.match-outro').innerText(),/胜利[\s\S]*最后一拍[\s\S]*再来一场/);
    await page.waitForTimeout(2300);
    const returnBefore=await page.evaluate(()=>{
      const image=document.querySelector('.match-outro .cinematic-backdrop img');
      const lastTurn=document.querySelector('.result-last-turn');
      return {imageScale:new DOMMatrixReadOnly(getComputedStyle(image).transform).a,lastTurnX:new DOMMatrixReadOnly(getComputedStyle(lastTurn).transform).e};
    });
    await page.getByRole('button',{name:/返回主菜单/}).click();
    assert.equal(await page.locator('.match-outro').getAttribute('data-leaving'),'true');
    assert.match(await page.locator('.match-outro').evaluate(node=>getComputedStyle(node).animationName),/result-screen-out/);
    await page.waitForTimeout(80);
    const returnMotion=await page.evaluate(()=>{
      const backdrop=document.querySelector('.match-outro .cinematic-backdrop');
      const image=backdrop.querySelector('img');
      const lastTurn=document.querySelector('.result-last-turn');
      const player=document.querySelector('.result-players article');
      const card=document.querySelector('.result-last-turn>div>article');
      return {
        backdropAnimation:getComputedStyle(backdrop).animationName,
        imageScale:new DOMMatrixReadOnly(getComputedStyle(image).transform).a,
        imageAnimationState:getComputedStyle(image).animationPlayState,
        lastTurnX:new DOMMatrixReadOnly(getComputedStyle(lastTurn).transform).e,
        playerAnimationState:getComputedStyle(player).animationPlayState,
        cardAnimationState:getComputedStyle(card).animationPlayState,
      };
    });
    assert.match(returnMotion.backdropAnimation,/result-return-camera/,'the return camera must animate a wrapper instead of resetting the image transform');
    assert.ok(Math.abs(returnMotion.imageScale-returnBefore.imageScale)<.01,`the result background snapped during return: ${JSON.stringify({returnBefore,returnMotion})}`);
    assert.ok(Math.abs(returnMotion.lastTurnX-returnBefore.lastTurnX)<1,`the centered last-turn panel drifted sideways: ${JSON.stringify({returnBefore,returnMotion})}`);
    assert.deepEqual([returnMotion.imageAnimationState,returnMotion.playerAnimationState,returnMotion.cardAnimationState],['paused','paused','paused'],'entry animations must freeze at their current frame while the result scene exits');
    await page.locator('.app[data-page="menu"]').waitFor();
    console.log('PASS solo intro/outro; victory/defeat review; token resources; pause/freeze/situation HUD; identity handoff; directional 2/6-player reveal seats; local reveal >=3s');
  } finally {
    if (app) app.process().kill('SIGKILL');
    await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
