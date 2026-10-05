import React, { useEffect, useRef, useState } from 'react';
import {CardStyleContext,CardSettingsPanel,MoveArt} from './CardArt';
import { createRoot } from 'react-dom/client';
import type { DesktopView, Manual, Profile, ProfileInput, Reply, Scene, Settings } from './types';
import { emptyHistory, historyGaps, recordPublicRound } from './view-loop';
import { OnlineRoom } from './online/OnlineRoom';
import { ManualArchive } from './ManualArchive';
import { TutorialCoach } from './TutorialCoach';
import { WelcomeEntrance } from './WelcomeEntrance';
import { BattleStage, MatchResult, SituationDialog } from './BattleStage';
import { Avatar, BackButton, Identity, Modal, RuleButton, TurnTimeSelector } from './SharedUI';
import { useSoloSession } from './useSoloSession';
import { GraphicsSettingsPanel } from './GraphicsSettingsPanel';
import { graphicsForPreset, sameGraphics } from './graphics.cjs';
const api=window.desktop;
const errors:Record<string,string>={TUTORIAL_TRY_TARGET:'先试一下提示中的招式；还没有提交，也不会扣资源。',NOT_REVEALED:'等双方揭晓后再继续。',PACKAGE_INCOMPLETE:'游戏文件不完整，请重新取得完整测试包。',INVALID_PROFILE:'昵称须为 1—20 个字，不能包含控制字符。',INVALID_INPUT:'输入格式无效，请检查后重试。',SAVE_FAILED:'保存失败，请检查本机目录权限后重试。输入和旧档案已保留。',PROFILE_BUSY:'正在保存，请稍后重试。',PROFILE_DAMAGED:'本机档案损坏，原文件已保留。',PROFILE_UNREADABLE:'暂时无法读取档案，请检查目录权限后重试。',UNAVAILABLE_MOVE:'这张牌暂不可用，请查看原因。',STALE_VIEW:'场景已更新，请重新选择。',ALREADY_SUBMITTED:'已经提交，请等待揭晓。',MATCH_INTERRUPTED:'本场中断，可重新开始。',GET_VIEW_FAILED:'读取对局失败，请重新读取或退出。',REQUEST_CONFLICT:'本拍已提交另一张牌，请重新读取。',SESSION_CLOSED:'本场已结束，请返回菜单重新开始。'};
const message=(code:string)=>errors[code]||`操作未完成（${code}），请重试。`;
function App() {
 useEffect(()=>{
  const timers=new Map<HTMLElement,number>();
  const reveal=(event:Event)=>{
   const node=event.target===document?document.scrollingElement:event.target;
   if(!(node instanceof HTMLElement))return;
   window.clearTimeout(timers.get(node));if(!timers.has(node))node.dataset.scrollActive='true';
   timers.set(node,window.setTimeout(()=>{delete node.dataset.scrollActive;timers.delete(node);},800));
  };
  // ponytail: one native scroll listener covers dynamic pages without wrapping or polling them.
  document.addEventListener('scroll',reveal,true);
  return()=>{document.removeEventListener('scroll',reveal,true);timers.forEach((timer,node)=>{window.clearTimeout(timer);delete node.dataset.scrollActive;});};
 },[]);
 const [profile,setProfile]=useState<Profile|null>(null),[page,setPage]=useState('loading'),[error,setError]=useState('');
 const [onlineCamera,setOnlineCamera]=useState('front'),[onlineReturning,setOnlineReturning]=useState(false);
 useEffect(()=>{if(!onlineReturning)return;const timer=window.setTimeout(()=>setOnlineReturning(false),1100);return()=>window.clearTimeout(timer);},[onlineReturning]);
 const [welcomePreview,setWelcomePreview]=useState(false),[welcomeReady,setWelcomeReady]=useState(false),[welcomeVisit,setWelcomeVisit]=useState(0),[welcomeToMenu,setWelcomeToMenu]=useState(false);
 const [welcomeLevel,setWelcomeLevel]=useState('beginner');
 const [nickname,setNickname]=useState(''),[avatar,setAvatar]=useState('leaf'),[saving,setSaving]=useState(false),[damaged,setDamaged]=useState(false);
 const [manual,setManual]=useState<Manual|null>(null),[scene,setScene]=useState<Scene>('initial');
 const [modal,setModal]=useState('');
 const modalClose=useRef<(()=>void)|null>(null);
 const [settings,setSettings]=useState<Settings>({music:60,effects:70,fullscreen:false,graphics:graphicsForPreset('balanced'),cardStyle:'illustrated'}),[settingsTab,setSettingsTab]=useState('声音'),[returnPage,setReturnPage]=useState('menu');
 const settingsScroll=useRef<HTMLFieldSetElement>(null);
 useEffect(()=>{
  const node=settingsScroll.current;if(page!=='settings'||!node)return;
  node.scrollTop=0;
  const edges=()=>{node.dataset.edgeTop=String(node.scrollTop>1);node.dataset.edgeBottom=String(node.scrollHeight-node.clientHeight-node.scrollTop>1);};
  const observer=new ResizeObserver(edges);observer.observe(node);if(node.firstElementChild)observer.observe(node.firstElementChild);
  node.addEventListener('scroll',edges);edges();
  return()=>{observer.disconnect();node.removeEventListener('scroll',edges);};
 },[page,settingsTab]);
 const [history,setHistory]=useState(emptyHistory);
 const moveHistory=history.moves;
 const [frozen,setFrozen]=useState(false),[arenaReady,setArenaReady]=useState(false),[arenaExiting,setArenaExiting]=useState(false),[pendingResult,setPendingResult]=useState<DesktopView|null>(null),[introSeconds,setIntroSeconds]=useState(5),[resultLeaving,setResultLeaving]=useState(false),[quitBusy,setQuitBusy]=useState(false);
 const session=useSoloSession({page,modal,frozen,arenaReady,arenaExiting,message,setError,
  onResult:next=>{setPendingResult(next);setArenaExiting(true);},
  onViewReady:(nextPage)=>{setWelcomePreview(false);setArenaExiting(false);setPendingResult(null);if(nextPage==='intro')setIntroSeconds(5);setPage(nextPage);setModal('');setFrozen(false);},
  onLeave:()=>{setArenaExiting(false);setPendingResult(null);setPage('menu');setModal('');setFrozen(false);}});
 const {view,setView,readError,setReadError,setReadAttempt,sceneChangePending,choose,submit,changeScene,navigate,leave}=session;
 const busy=session.busy||quitBusy;
 const take=<T,>(r:Reply<T>):T=>{if(!r.ok)throw new Error(r.error);return r.data;};
 const run=async(action:()=>Promise<void>)=>{setError('');try{await action();}catch(e){setError(message((e as Error).message));}};
 const load=async()=>{await run(async()=>{try{const p=take(await api.profile.read());setProfile(p);setNickname(p?.nickname||'');setAvatar(p?.avatar_id||'leaf');setWelcomeToMenu(false);setPage('profile');setDamaged(false);}catch(e){setDamaged((e as Error).message==='PROFILE_DAMAGED');setPage('profile');throw e;}});};
 useEffect(()=>{void load();void api.manual().then(r=>{if(r.ok)setManual(r.data);});},[]);
 const tutorial=view?.tutorial;
 const tutorialTarget=view?.phase==='selecting'?tutorial?.target_entry_id:null;
 const isMultiplayer=view?.mode==='multiplayer';
 const suspended=page==='table'&&!isMultiplayer&&(frozen||['pause','leave'].includes(modal));
 useEffect(()=>{
  if(page!=='intro'||!view)return;
  const end=Date.now()+5000;
  setIntroSeconds(5);
  const timer=window.setInterval(()=>{
   const remaining=Math.max(0,Math.ceil((end-Date.now())/1000));
   setIntroSeconds(remaining);
   if(!remaining){window.clearInterval(timer);setPage('table');}
  },100);
  return()=>window.clearInterval(timer);
 },[page,view?.match_id]);
 useEffect(()=>{
  if(!arenaExiting||!pendingResult)return;
  const timeout=window.setTimeout(()=>{setView(pendingResult);setPage('result');setArenaExiting(false);setPendingResult(null);},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:650);
  return()=>window.clearTimeout(timeout);
 },[arenaExiting,pendingResult]);
 useEffect(()=>{
  if(page!=='table'){setArenaReady(false);return;}
  setArenaReady(false);
  const timeout=window.setTimeout(()=>setArenaReady(true),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:720);
  return()=>window.clearTimeout(timeout);
 },[page,view?.match_id]);
 useEffect(()=>{if(view&&manual)setHistory(previous=>recordPublicRound(previous,view,manual));},[view,manual]);
 const dismissModal=()=>modalClose.current?.();
 const start=()=>profile?changeScene(async()=>take(await api.port.startSolo(profile.local_id)),'intro'):Promise.resolve();
 const startTutorial=()=>profile?changeScene(async()=>take(await api.port.startTutorial(profile.local_id)),'table'):Promise.resolve();
 const tutorialNext=()=>view&&!suspended?changeScene(async()=>take(await api.port.tutorialNext(view.view_id)),'table').then(()=>setReadAttempt(n=>n+1)):Promise.resolve();
 const preview=(s:Scene)=>{if(sceneChangePending.current)return;setScene(s);return changeScene(async()=>take(await api.preview(s)),['winner','defeat','draw'].includes(s)?'result':'table');};
 useEffect(()=>{
  if(!resultLeaving)return;
  const timer=window.setTimeout(()=>void leave(),720);
  return()=>window.clearTimeout(timer);
 },[resultLeaving]);
 useEffect(()=>{if(page==='result')setResultLeaving(false);},[page,view?.match_id]);
 const openSettings=()=>{if(!profile||sceneChangePending.current)return;setNickname(profile.nickname);setAvatar(profile.avatar_id);setSettings({...profile.settings,graphics:{...profile.settings.graphics}});setReturnPage(page);setError('');setPage('settings');};
 const dirty=profile&&(nickname!==profile.nickname||avatar!==profile.avatar_id||settings.music!==profile.settings.music||settings.effects!==profile.settings.effects||settings.fullscreen!==profile.settings.fullscreen||settings.cardStyle!==profile.settings.cardStyle||!sameGraphics(settings.graphics,profile.settings.graphics));
 const cardStyle=page==='settings'?settings.cardStyle:profile?.settings.cardStyle||'illustrated';
 const graphics=page==='settings'?settings.graphics:profile?.settings.graphics||graphicsForPreset('balanced');
 const closeSettings=()=>{if(saving||sceneChangePending.current)return;if(dirty)setModal('settings-close');else{setPage(returnPage);setError('');}};
 const save=async(recover=false)=>{
  if(welcomePreview||saving)return;setSaving(true);
  await run(async()=>{const input:ProfileInput={nickname,avatar_id:avatar};const p=take(await (page==='settings'?api.settings.apply({...input,settings}):recover?api.profile.recover({...input,confirmed:true}):api.profile.create(input)));setProfile(p);setDamaged(false);setModal('');if(page==='settings')setPage(returnPage);else setWelcomeReady(true);});
  setSaving(false);
 };
 const showWelcome=async()=>{
  if(sceneChangePending.current||busy)return;
  if(view)await leave();
  setWelcomeVisit(v=>v+1);setWelcomeToMenu(false);setWelcomeReady(false);setWelcomeLevel('beginner');setWelcomePreview(true);setNickname('');setAvatar('leaf');setError('');setModal('');setPage('profile');
 };
 const closeWelcome=()=>{if(saving||busy||sceneChangePending.current)return;setWelcomeReady(false);setWelcomePreview(false);setNickname(profile?.nickname||'');setAvatar(profile?.avatar_id||'leaf');setError('');setPage('menu');};
 const enterWelcomeMenu=()=>{if(saving||busy||sceneChangePending.current)return;setWelcomeToMenu(true);};

 const quit=async()=>{if(busy)return;setQuitBusy(true);await run(async()=>{take(await api.quit());});setQuitBusy(false);};
 const live=view?.source==='live';
 const pageTitle:Record<string,string>={online:'好友房',profile:'初次见面',menu:'课间开始了',prepare:'单人准备',intro:'单人入场',table:view?.mode==='preview'?'开发预览':view?.self_role==='spectator'?'公开观战':'单人牌桌',result:'整场结果',settings:'本机设置',manual:'经典手册',loading:'正在打开'};
 return <CardStyleContext value={cardStyle}><div className="app" data-card-style={cardStyle} data-page={page} data-welcome-entering={page==='profile'&&welcomeToMenu} data-graphics-motion={graphics.ambientMotion} data-graphics-glass={graphics.glass} data-graphics-decoration={graphics.decoration}>
  {!['profile','menu','settings','manual','prepare','intro','table','result','online'].includes(page)&&<header className="topbar"><button className="brand" disabled={sceneChangePending.current||page==='online'} onClick={()=>navigate(()=>welcomePreview?closeWelcome():page==='table'?setModal('leave'):(setPage(profile?'menu':'profile'),setError('')))}>叠叠<span>DeiDei</span></button><span className="page-title">{pageTitle[page]}</span><strong className="demo-label">{page==='online'?'好友房 · 开发连接':view?(live?'本地实算 · 临时随机对手':'演示数据 · 固定脚本'):'本地单人 · 经典规则 1.0.1'}</strong>{profile&&<button disabled={page==='online'||busy} onClick={()=>navigate(()=>setModal('preview'))}>开发预览</button>}</header>}
  <div className="size-warning">当前内容区较小，建议调大窗口或降低系统显示缩放；牌区保持可读字号。</div>
  {error&&page!=='profile'&&!(page==='table'&&tutorial&&!readError)&&<div className="error" role="alert">{error}{readError&&<span><button onClick={()=>{setError('');setReadError(false);setReadAttempt(n=>n+1);}}>重新读取对局</button><button disabled={sceneChangePending.current} onClick={()=>void leave()}>退出本场</button></span>}<button onClick={()=>setError('')} aria-label="收起错误">×</button></div>}
  {['profile','menu','settings','manual','prepare','table','online'].includes(page)&&<div className={`front-stage front-stage-${page==='profile'&&welcomeToMenu?'menu':page}${page==='online'&&onlineCamera==='table'?' front-stage-table':''}`} data-online-camera={page==='online'?onlineCamera:onlineReturning?'returning':undefined}><div className="scene-plane scene-world" aria-hidden="true"><img className="menu-layer menu-environment" src="assets/menu/menu-environment.webp" alt=""/></div><div className="scene-plane scene-arena" aria-hidden="true"><img className="menu-layer" src="assets/battle/battle-arena-approach-v1.webp" alt=""/></div><span key={page==='online'?onlineCamera:onlineReturning?'returning':'idle'} className="scene-glass" aria-hidden="true"/><span className="menu-aura" aria-hidden="true"/><span className="menu-particles" aria-hidden="true"/><span className="menu-grid" aria-hidden="true"/><section className="menu-copy" aria-hidden={page!=='menu'&&!welcomeToMenu}><h1>DeiDei</h1><p className="menu-tagline"><span>攒一拍，</span><strong>再出招。</strong></p></section><div className="scene-plane scene-atmosphere" aria-hidden="true"><img className="menu-layer menu-atmosphere" src="assets/menu/menu-atmosphere.png" alt=""/></div><div className="scene-plane scene-character" aria-hidden="true"><img className="menu-layer menu-character" src="assets/menu/menu-character.png" alt=""/></div></div>}
  {page==='loading'&&<main className="center"><p>正在读取本机档案…</p></main>}
  {page==='profile'&&<WelcomeEntrance key={welcomeVisit} disabled={saving||busy} ready={welcomeReady} preview={welcomePreview} identityName={!welcomePreview?profile?.nickname:undefined} entering={welcomeToMenu} onEnter={enterWelcomeMenu} onExit={closeWelcome} onPreview={profile?()=>setModal('preview'):undefined}>
   {welcomeReady?<><div className="welcome-identity"><Avatar id={avatar}/><strong>{nickname.trim()}</strong></div>
    <fieldset className="welcome-levels" disabled={busy}><legend>你的水平</legend><div className="welcome-level-options">
     {[['beginner','新手','Charge'],['familiar','熟悉','Reflect'],['expert','高手','TianLiJun']].map(([id,label,icon])=><label className="welcome-level" key={id}><input type="radio" name="welcome-level" value={id} checked={welcomeLevel===id} onChange={()=>setWelcomeLevel(id)}/><span className="welcome-level-face"><MoveArt entryId={icon}/><strong>{label}</strong><i aria-hidden="true"/></span></label>)}
    </div></fieldset>
    <p className="welcome-level-note" role="status">{welcomeLevel==='beginner'?'从第一拍开始，跟着练。':'准备好了，直接开局。'}</p>
    <button className="welcome-action welcome-guide" disabled={busy} onClick={()=>welcomeLevel==='beginner'?void startTutorial():enterWelcomeMenu()}>{busy?'正在入场…':welcomeLevel==='beginner'?'开始新手指引':'进入牌厅'}<b aria-hidden="true">→</b></button>{welcomePreview&&<p>预览未保存，实战使用现有本机档案。</p>}</>:<form onSubmit={e=>{e.preventDefault();if(welcomePreview){if(!nickname.trim()||[...nickname.trim()].length>20||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(nickname))setError(message('INVALID_PROFILE'));else{setError('');setWelcomeReady(true);}}else if(!damaged)void save();}}><Identity nickname={nickname} avatar={avatar} onName={setNickname} onAvatar={setAvatar} disabled={saving} hint="" error={error}/>{damaged&&!welcomePreview?<><p>原档案已保留。重建前会先备份原文件。</p><button className="welcome-action" type="button" disabled={saving} onClick={()=>setModal('recover')}>备份原文件并重建档案</button></>:<button className="welcome-action" type="submit" disabled={saving}>{saving?'保存中…':welcomePreview?'确认名字 · 仅预览':'确认名字'}<b aria-hidden="true">→</b></button>}{!welcomePreview&&<button className="welcome-text-action welcome-reload" type="button" disabled={saving} onClick={()=>void load()}>重新读取</button>}</form>}
  </WelcomeEntrance>}
  {(page==='menu'||page==='profile'&&welcomeToMenu)&&profile&&<main className={`menu-layout${welcomeToMenu?' welcome-menu-entry':''}`} inert={page!=='menu'}><nav className="menu-rail" aria-label="开始菜单"><header><div className="menu-kicker"><span>START MENU</span><em>01 / 05</em></div><strong>选择你的下一场</strong><small>SELECT OPERATION</small></header><div className="menu-options"><button className="menu-option menu-option-primary" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setPage('prepare');setError('');})}><span><b>单人对局</b><small>本机实算 · 练习模式</small></span><em>01</em></button><button className="menu-option menu-option-secondary" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setView(null);setPage('online');setError('');})}><span><b>好友联机</b><small>创建 / 加入房间</small></span><em>02</em></button><button className="menu-option menu-option-minor" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setReturnPage('menu');setPage('manual');})}><b>经典规则手册</b><em>R</em></button><button className="menu-option menu-option-minor" disabled={sceneChangePending.current} onClick={openSettings}><b>设置</b><em>S</em></button><button className="menu-option menu-option-minor" disabled={busy||sceneChangePending.current} onClick={()=>setModal('quit')}><b>退出</b><em>Q</em></button></div><footer><span><b>LOCAL</b><small>READY</small></span><i/><span><b>R04</b><small>FRONTEND</small></span><button className="menu-preview" disabled={busy||sceneChangePending.current} onClick={()=>navigate(()=>setModal('preview'))}>开发预览</button></footer></nav></main>}
  {page==='online'&&manual&&<OnlineRoom manual={manual} Avatar={Avatar} Modal={Modal} onScene={setOnlineCamera} onExit={()=>{setOnlineReturning(true);setPage('menu');setView(null);setError('');}}/>}
  {page==='prepare'&&profile&&<main className="prepare-screen"><BackButton className="settings-back prepare-back" disabled={sceneChangePending.current||busy} onClick={()=>navigate(()=>setPage('menu'))}>返回主菜单</BackButton><section className="prepare-overview"><header className="prepare-intro"><span>单人训练</span><h1>随机合法对手。</h1><p>对手在每拍开始前随机选择合法招式；本场不限时。</p></header><section className="prepare-self" aria-label="本机玩家"><Avatar id={profile.avatar_id}/><span><small>本机席位</small><strong>{profile.nickname}</strong></span></section><section className="prepare-config" aria-label="练习设置"><section className="prepare-setting"><RuleButton disabled={busy}/></section><section className="prepare-setting"><TurnTimeSelector label="每回合时间" value={0} options={[0,5000,10000,20000,30000]} disabledValues={[5000,10000,20000,30000]} onChange={()=>{}}/></section></section></section><section className="difficulty-console" data-level="standard" aria-labelledby="difficulty-title"><header><span>当前对手</span><h2 id="difficulty-title">随机合法对手</h2></header><div className="prepare-signal" data-level="standard"><span aria-hidden="true"/><span aria-hidden="true"/><span aria-hidden="true"/><i aria-hidden="true"/><div className="difficulty-emblem" aria-hidden="true"><MoveArt entryId="Charge"/></div></div><div className="difficulty-readout"><span>每拍预先选择</span><p>暂未接入强度策略；所有正式单人场使用同一随机合法对手。</p></div></section><footer className="prepare-actions"><button className="prepare-start" disabled={busy} onClick={()=>void start()}><span>{busy?'正在开场':'开始对局'}</span><small>{busy?'LOADING':'ENTER MATCH'}</small></button></footer></main>}
  {page==='intro'&&view&&<main className="match-cinematic match-intro" aria-label="单人对局开场动画"><div className="cinematic-backdrop" aria-hidden="true"><img src="assets/battle/battle-arena-approach-v1.webp" alt=""/><span/></div><header className="intro-heading"><span>SOLO MATCH · 随机合法对手</span><h1>进入擂台</h1><p>经典规则 · 不限时</p></header><section className="intro-versus" aria-label="本局对阵">{view.participants.map((player,index)=><article key={player.player_id} className={player.player_id===view.self_id?'intro-self':'intro-opponent'}><Avatar id={player.avatar_id}/><span><small>{player.player_id===view.self_id?'本机席位':'训练对手'}</small><strong>{player.nickname}</strong></span><em>{String(index+1).padStart(2,'0')}</em></article>)}</section><button className="cinematic-skip" onClick={()=>setPage('table')}>立即进入（{introSeconds}s） <small>SKIP</small></button></main>}
  {page==='table'&&view&&<BattleStage view={view} manual={manual!} moveHistory={moveHistory} mode="local" ready={arenaReady} exiting={arenaExiting} suspended={suspended} frozen={frozen} busy={busy||readError} revealSeconds={Math.max(0,Math.ceil((view.timer.remaining_ms||0)/1000))} coach={tutorial?<TutorialCoach view={view} busy={busy} suspended={suspended} error={readError?'':error} onNext={()=>void tutorialNext()} onSolo={()=>void start()} onExit={()=>void leave()}/>:undefined} Avatar={Avatar} onSelect={choose} onSubmit={()=>void submit()} onPause={()=>navigate(()=>setModal('pause'))} onFreeze={()=>setFrozen(value=>!value)} onSituation={()=>setModal('situation')}/>}
  {page==='result'&&view?.outcome&&<MatchResult view={view} moveHistory={moveHistory} leaving={resultLeaving} Avatar={Avatar} onReview={()=>setModal('situation')} onPrimary={()=>view.participants.length===2&&profile?void start():void preview('initial')} onExit={()=>setResultLeaving(true)} primaryLabel="再来一场" exitLabel="返回主菜单" primaryDisabled={busy} exitDisabled={sceneChangePending.current}/> }
  {page==='settings'&&<main className="settings-layout"><header className="settings-heading"><BackButton className="settings-back" disabled={saving} onClick={closeSettings}>返回主菜单</BackButton><span>CONFIGURATION</span><h1>设置</h1><p>调整这台电脑上的游戏体验。</p></header><nav aria-label="设置分类">{([['声音','AUDIO'],['画面','GRAPHICS'],['卡牌','CARDS'],['窗口','DISPLAY'],['昵称头像','PROFILE'],['关于','ABOUT']] as const).map(([t,en])=><button key={t} aria-pressed={settingsTab===t} disabled={saving} onClick={()=>setSettingsTab(t)}><span>{t}</span><small>{en}</small></button>)}</nav><section className="settings-content" data-tab={settingsTab}><header><span>LOCAL PREFERENCES</span><h2>{settingsTab}</h2></header><fieldset className="settings-scroll" ref={settingsScroll} tabIndex={0} aria-label="设置选项" disabled={saving}><div className="settings-tab-panel" key={settingsTab}>{settingsTab==='声音'?<><p>音源尚未加入。音量会真实保存，当前没有试听声音。</p>{(['music','effects'] as const).map(k=><label className="settings-range" key={k}><span>{k==='music'?'音乐':'音效'}<b>{settings[k]}%</b></span><input type="range" aria-label={k==='music'?'音乐音量':'音效音量'} min="0" max="100" value={settings[k]} style={{'--range-value':`${settings[k]}%`} as React.CSSProperties} onChange={e=>setSettings({...settings,[k]:Number(e.target.value)})}/></label>)}</>:settingsTab==='画面'?<GraphicsSettingsPanel value={settings.graphics} onChange={graphics=>setSettings({...settings,graphics})} disabled={saving}/>:settingsTab==='卡牌'?<CardSettingsPanel value={settings.cardStyle} onChange={cardStyle=>setSettings({...settings,cardStyle})} manual={manual}/>:settingsTab==='窗口'?<><label className="checkbox"><input type="checkbox" checked={settings.fullscreen} onChange={e=>setSettings({...settings,fullscreen:e.target.checked})}/><span>保存后使用全屏<small>下次启动时应用</small></span></label><p>窗口模式可拖动边缘调整大小。目标内容区 1366×768 / 1920×1080。</p></>:settingsTab==='昵称头像'?<Identity nickname={nickname} avatar={avatar} onName={setNickname} onAvatar={setAvatar}/>:<><h3>DeiDei 桌面原型</h3><p>经典规则 1.0.1</p><p>本机档案和设置可以保存。单人对局已接入真实规则和临时随机对手，好友房支持本机开发服务连接。</p><p>当前使用原创分层美术与系统字体。</p></>}</div></fieldset><footer><span>{dirty?'有未保存的修改':'已与本机档案同步'}</span><button className="settings-action settings-close" disabled={saving} onClick={closeSettings}><span>关闭</span></button><button className="settings-action settings-save primary" aria-busy={saving} disabled={saving||!dirty} onClick={()=>void save()}><span>{saving?'保存中…':'保存并关闭'}</span></button></footer></section></main>}
  {page==='manual'&&<ManualArchive manual={manual} onBack={()=>navigate(()=>setPage(returnPage))} onTutorial={()=>void startTutorial()} busy={busy||frozen} Dialog={Modal}/> }
  {['preview','settings-close','recover','leave'].includes(modal)&&<Modal requestCloseRef={modalClose} title={modal==='preview'?'开发场景':modal==='settings-close'?'还有未保存的修改':modal==='recover'?'备份并重建档案':'离开当前对局'} closeDisabled={sceneChangePending.current||saving} onClose={()=>navigate(()=>{if(!saving)setModal('');})}>
   {error&&<p role="alert">{error}</p>}{modal==='preview'?<><p>首次进入仅预览界面，不写入档案；其余牌局场景使用固定脚本。切换场景将结束当前对局，进度不会保存。</p><div className="scene-grid"><button disabled={busy} onClick={()=>void showWelcome()}>P01 · 首次进入／欢迎建档</button>{([['initial','P07 · 初始 A / 12 可用'],['midgame','P07 · 中局 B / 26 可用'],['spectator','P08 · 普通观众'],['eliminated','P08 · 本人已淘汰'],['restart','P08 · 淘汰后存活者新局'],['winner','P09 · 唯一赢家'],['defeat','P09 · 本人阵亡'],['draw','P09 · 全员淘汰'],['invalid','P07 · 提交失败后重试']] as [Scene,string][]).map(([s,label])=><button key={s} disabled={busy} aria-pressed={scene===s} onClick={()=>void preview(s)}>{label}</button>)}</div></>:modal==='settings-close'?<><p>可以继续编辑，也可以保存或放弃这次修改。</p><button disabled={saving} onClick={dismissModal}>继续编辑</button><button disabled={saving} onClick={()=>{setModal('');setPage(returnPage);setError('');}}>不保存关闭</button><button className="primary" disabled={saving} onClick={()=>void save()}>保存关闭</button></>:modal==='recover'?<><p>先备份损坏的原文件，再创建新档案。原昵称和设置不会自动迁移。</p><button disabled={saving} onClick={dismissModal}>继续检查</button><button className="primary" disabled={saving} onClick={()=>void save(true)}>确认备份并重建</button></>:<><p>本次对局进度不会保存。本机档案和设置仍保留。</p><button onClick={dismissModal}>继续{live?'对局':'演示'}</button><button className="primary" disabled={sceneChangePending.current} onClick={()=>void leave()}>离开</button></>}
  </Modal>}
  {modal==='quit'&&<Modal requestCloseRef={modalClose} title="退出游戏？" closeDisabled={busy} onClose={()=>setModal('')}><p>确定关闭游戏吗？本机档案和已保存的设置会保留。</p>{error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={dismissModal}>继续留在游戏</button><button className="danger" disabled={busy} onClick={()=>void quit()}>{busy?'正在退出…':'确认退出'}</button></Modal>}
  {modal==='pause'&&<Modal requestCloseRef={modalClose} className="battle-dialog pause-dialog" title={isMultiplayer?'对局菜单':'游戏暂停'} closeDisabled={sceneChangePending.current} onClose={()=>setModal('')}><section className="pause-state"><span>{isMultiplayer?'ONLINE MENU':'LOCAL PAUSE'}</span><h3>{isMultiplayer?'牌局仍在继续':'暂时停止操作'}</h3><p>{isMultiplayer?'多人模式打开菜单不会暂停牌局，返回后以服务端当前状态为准。':'暂停输入与画面读取，运行时计时继续；恢复后以当前对局状态为准。'}</p></section><div className="pause-actions"><button className="primary" onClick={dismissModal}>继续游戏<small>RESUME</small></button><button className="danger" disabled={sceneChangePending.current} onClick={()=>setModal('leave')}>退出游戏<small>LEAVE MATCH</small></button></div></Modal>}
  {modal==='situation'&&view&&<SituationDialog view={view} manual={manual!} moveHistory={moveHistory} gaps={historyGaps(history,view)} Modal={Modal} Avatar={Avatar} onClose={()=>setModal('')}/>}
 </div></CardStyleContext>;
}
createRoot(document.getElementById('root')!).render(<App/>);
