// Seeded test launcher calls the real core; the second launch is explicitly a MOCK room.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {_electron:electron}=require('playwright-core');
const {ProfileStore}=require('./profile.cjs');
const {sourceInput,closeApplication}=require('./smoke-performance.cjs');
async function main(){
 assert.ok(process.argv[2],'Pass a fresh evidence directory');const output=path.resolve(process.argv[2]);await fs.mkdir(output,{recursive:true});await assert.rejects(fs.access(path.join(output,'checks.json')));
 const report={input:sourceInput(),checks:[],screenshots:[],errors:[],cleanup:[],protocol:'real seeded local worker ZengYi → forced recovery; native resize after UI freeze; separate six-player MOCK'};
 const check=(condition,message,evidence)=>{assert.ok(condition,message);report.checks.push({message,evidence});};
 let app,page,directory;
 const shot=async name=>{await page.screenshot({path:path.join(output,`${name}.png`),scale:'css'});report.screenshots.push(name);};
 async function launch(main){
  const env={...process.env,DEIDEI_TEST_DATA_DIR:directory};delete env.ELECTRON_RUN_AS_NODE;delete env.DEIDEI_ROOM_URL;delete env.DEIDEI_DEV_RELOAD;
  app=await electron.launch({args:[path.join(__dirname,main)],env});page=await app.firstWindow();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e)));
  await app.evaluate(({app,BrowserWindow})=>{app.focus({steal:true});BrowserWindow.getAllWindows()[0].focus();});
  await page.locator('.welcome-scene').waitFor();const skip=page.getByRole('button',{name:'跳过开场',exact:true});if(await skip.count())await skip.click();
  await page.getByRole('button',{name:'以牌面尺寸验收身份进入牌厅',exact:true}).click();await page.locator('.app[data-page=menu]').waitFor();
 }
 async function close(){const state=await closeApplication(app);report.cleanup.push(state);app=null;page=null;check(state.normalExit&&!state.forced,'owned window exits normally',state);}
 async function geometry(label){
  await page.waitForFunction(()=>[...document.querySelectorAll('.move-card.current img')].length>0&&[...document.querySelectorAll('.move-card.current img')].every(n=>n.complete&&n.naturalWidth>0));
  const values=await page.locator('.move-card:has(.full-card-face)').evaluateAll(nodes=>nodes.map(n=>{
   const face=n.querySelector('img'),rect=n.getBoundingClientRect(),image=face.getBoundingClientRect(),style=getComputedStyle(n),text=n.querySelector('strong');
   return {src:face.getAttribute('src'),rect:rect.toJSON(),image:image.toJSON(),padding:style.padding,border:style.borderWidth,background:style.backgroundImage,shadow:style.boxShadow,clip:style.clipPath,before:getComputedStyle(n,'::before').display,after:getComputedStyle(n,'::after').display,text:text?.textContent,textClip:text&&getComputedStyle(text).clipPath};
  }));
  report[label]=values;
  check(values.length>0&&values.every(v=>Math.abs(v.rect.width-v.image.width)<1&&Math.abs(v.rect.height-v.image.height)<1),`${label}: complete faces fill the played-card bounds`,values);
  check(values.every(v=>Math.abs(v.image.width/v.image.height-.75)<.01),`${label}: no square icon sizing`);
  check(values.every(v=>v.padding==='0px'&&v.border==='0px'&&v.background==='none'&&v.shadow==='none'&&v.clip==='none'&&v.before==='none'&&v.after==='none'),`${label}: no outer card shell`);
  check(values.every(v=>v.textClip==='inset(50%)'),`${label}: native titles and recovery notes stay visually hidden`);
  const overlap=await page.evaluate(()=>{const timer=document.querySelector('.arena-countdown>span').getBoundingClientRect();return [...document.querySelectorAll('.move-card.current')].some(n=>{const r=n.getBoundingClientRect();return r.left<timer.right&&r.right>timer.left&&r.top<timer.bottom&&r.bottom>timer.top;});});
  check(!overlap,`${label}: played cards do not cover the countdown`);
 }
 try{
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-card-reveal-'));const store=new ProfileStore(path.join(directory,'local-profile'));await store.save('create',{nickname:'牌面尺寸验收',avatar_id:'leaf'});
  await launch('smoke-live-main.cjs');await page.getByRole('button',{name:/^单人对局/}).click();await page.locator('.prepare-start').click();await page.getByRole('button',{name:/立即进入/}).click();await page.locator('.battle-table[data-ready=true]').waitFor();
  await page.locator('[data-entry=ZengYi] .card-pick').click();await page.getByRole('button',{name:'确认出招',exact:true}).click();await page.locator('.battle-table[data-phase=revealed]').waitFor();await page.waitForTimeout(650);await shot('real-zeng-round-one');
  await page.waitForFunction(()=>document.querySelector('.battle-table')?.dataset.phase==='revealed'&&document.querySelector('.battle-status>span')?.textContent==='第 2 回合');await page.waitForTimeout(650);
  const view=(await page.evaluate(()=>window.desktop.port.getView())).data;check(view.source==='live'&&view.public_round.actions[view.self_id].is_recovery,'real worker enters automatic recovery without another submit',view.public_round);
  await shot('real-recovery-before-resize');await page.getByRole('button',{name:'冻结',exact:true}).click();await geometry('real-two-player');
  for(const size of [[1000,650],[1366,768],[1366,900]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),size);await page.waitForTimeout(300);const viewport=await page.evaluate(()=>[innerWidth,innerHeight]);assert.deepEqual(viewport,size);
   await geometry(`native-${size.join('x')}`);
   const gaps=await page.locator('.arena-seat').evaluateAll(nodes=>nodes.map(n=>{const card=n.querySelector('.move-card.current').getBoundingClientRect(),name=n.querySelector('.seat-profile').getBoundingClientRect();return {edge:n.dataset.seatEdge,gap:n.dataset.seatEdge==='bottom'?name.top-card.bottom:card.top-name.bottom};}));
   report[`gaps-${size.join('x')}`]=gaps;check(gaps.every(g=>g.gap>=6&&g.gap<=20),'two-player cards retain clear identity spacing',gaps);await shot(`real-recovery-${size.join('x')}`);
  }
  await close();await fs.copyFile(path.join(directory,'ledger.jsonl'),path.join(output,'real-local-ledger.jsonl'));
  await launch('tests-online/smoke-main.cjs');await page.getByRole('button',{name:/^好友联机/}).click();await page.getByText('已连接',{exact:true}).waitFor();await page.getByRole('button',{name:'创建房间',exact:true}).click();await page.getByRole('button',{name:'创建并进入',exact:true}).click();await page.getByRole('button',{name:'准备',exact:true}).click();await page.getByRole('button',{name:'开始对局',exact:true}).click();await page.locator('.online-intro').waitFor();await page.getByRole('button',{name:/立即入场/}).click();await page.locator('.online-match[data-arena-ready=true]').waitFor();
  check(await page.locator('[data-entry=ZengRewardBigBi] .card-tags').count()===0,'gift has no extra hand-card badge');
  await app.evaluate(()=>{const ctl=global.__onlineTest,{snapshot}=global.__onlineSamples,next=snapshot('revealing',String(BigInt(ctl.view.seq)+1n));next.view.timer.remaining_ms=30000;next.view.timer.deadline_at_ms=130000;const actions=next.view.match.last_turn.core_resolution.ledger.actions;Object.assign(actions.p1,{entry_id:'ZengYi',is_recovery:true});Object.assign(actions.p2,{entry_id:'ZengRewardBigBi',is_recovery:false});ctl.view=next;ctl.socket.message(next);});
  await page.locator('.battle-table[data-phase=revealed]').waitFor();await page.waitForTimeout(650);await geometry('mock-six-player');await shot('mock-six-player-recovery');
  for(const size of [[1000,650],[1366,900]]){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),size);await page.waitForTimeout(300);await geometry(`mock-six-${size.join('x')}`);await shot(`mock-six-${size.join('x')}`);}
  await close();let profile=await store.read();await store.save('settings',{nickname:profile.nickname,avatar_id:profile.avatar_id,settings:{...profile.settings,cardStyle:'classic'}});
  await launch('smoke-live-main.cjs');await page.getByRole('button',{name:/^单人对局/}).click();await page.locator('.prepare-start').click();await page.getByRole('button',{name:/立即进入/}).click();await page.locator('.battle-table[data-ready=true]').waitFor();await page.locator('[data-entry=ZengYi] .card-pick').click();await page.getByRole('button',{name:'确认出招',exact:true}).click();await page.locator('.battle-table[data-phase=revealed]').waitFor();await page.waitForTimeout(650);
  const original=await page.locator('.move-card.current').first().evaluate(n=>({src:n.querySelector('img').getAttribute('src'),clip:getComputedStyle(n).clipPath,text:n.querySelector('strong').textContent,textClip:getComputedStyle(n.querySelector('strong')).clipPath}));
  check(original.src.startsWith('assets/moves-classic/')&&original.clip.startsWith('polygon')&&original.textClip==='none','classic retains its original icon frame and title',original);await shot('classic-revealed');
  check(report.errors.length===0,'no renderer errors');report.status='PASS';
 }catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;if(page&&!page.isClosed())await shot('failure').catch(()=>{});}
 finally{if(app)try{await close();}catch(error){report.status='FAIL';report.failure??=String(error);process.exitCode=1;}if(directory)await fs.rm(directory,{recursive:true,force:true});await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(`${report.status}: ${report.checks.length} checks; ${output}`);if(report.failure)console.error(report.failure);}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
