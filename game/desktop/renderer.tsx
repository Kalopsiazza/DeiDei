import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DesktopView, Manual, Option, Participant, Profile, ProfileInput, Reply, Scene, Settings } from './types';
import { shortcutEntry } from './interaction';
import { pollViews } from './view-loop';
import { OnlineRoom } from './online/OnlineRoom';
import { ManualArchive } from './ManualArchive';
import { TutorialCoach } from './TutorialCoach';
import { WelcomeEntrance } from './WelcomeEntrance';
import { BattleStage, SituationDialog, type PlayedMove } from './BattleStage';
const api=window.desktop;
const avatarName={leaf:'叶子',sun:'太阳',moon:'月亮',star:'星星'};
const soloLevels=[
 {id:'rookie',name:'见习',tag:'观察节奏',icon:'Charge',description:'目标：留出更多观察窗口，适合第一次熟悉招式。'},
 {id:'standard',name:'练手',tag:'攻守均衡',icon:'Reflect',description:'目标：按常规频率施压，保持攻守节奏平衡。'},
 {id:'pressure',name:'高压',tag:'主动争拍',icon:'Pragon',description:'目标：更主动争夺节奏，减少连续攒拍的空间。'},
] as const;
const soloTurnTimes=[{id:'unlimited',label:'自由',value:'∞'},{id:'3',label:'3 秒',value:'3s'},{id:'10',label:'10 秒',value:'10s'},{id:'30',label:'30 秒',value:'30s'}] as const;
const summaryMove=(summary:string[],nickname:string)=>{const prefix=`${nickname}：`;return summary.find(line=>line.startsWith(prefix))?.slice(prefix.length).split('（',1)[0].replace(/[。.]$/,'')||'';};
const errors:Record<string,string>={TUTORIAL_TRY_TARGET:'先试一下提示中的招式；还没有提交，也不会扣资源。',NOT_REVEALED:'等双方揭晓后再继续。',PACKAGE_INCOMPLETE:'游戏文件不完整，请重新取得完整测试包。',INVALID_PROFILE:'昵称须为 1—20 个字，不能包含控制字符；请选择内置头像。',INVALID_INPUT:'输入格式无效，请检查后重试。',SAVE_FAILED:'保存失败，请检查本机目录权限后重试。输入和旧档案已保留。',PROFILE_BUSY:'正在保存，请稍后重试。',PROFILE_DAMAGED:'本机档案损坏，原文件已保留。',PROFILE_UNREADABLE:'暂时无法读取档案，请检查目录权限后重试。',UNAVAILABLE_MOVE:'这张牌暂不可用，请查看原因。',STALE_VIEW:'场景已更新，请重新选择。',ALREADY_SUBMITTED:'已经提交，请等待揭晓。',MATCH_INTERRUPTED:'本场中断，可重新开始。',GET_VIEW_FAILED:'读取对局失败，请重新读取或退出。',REQUEST_CONFLICT:'本拍已提交另一张牌，请重新读取。',SESSION_CLOSED:'本场已结束，请返回菜单重新开始。'};
const reasons:Record<string,string>={INSUFFICIENT_DD:'DD 不足',INSUFFICIENT_LIGHTNING:'雷电不足',INSUFFICIENT_CHARGE:'充能不足',INSUFFICIENT_BOMBS:'成熟层不足',ALREADY_USED:'本局已用',NO_COPY_RECORD:'没有复制记录',NO_REWARD:'奖励未就绪',FORCED_RECOVERY:'正在休整',NOT_ACTIVE:'已不在场'};
const message=(code:string)=>errors[code]||`操作未完成（${code}），请重试。`;
function Avatar({id='leaf'}:{id?:string}) {return <span className={`avatar ${id}`} aria-label={avatarName[id as keyof typeof avatarName]||'占位头像'}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 35 Q4 12 24 8 Q45 12 38 35 Q24 44 10 35Z"/><path d={id==='sun'?'M18 6 L17 1 M32 7 L35 2 M41 17 L47 15':id==='leaf'?'M24 9 Q13 0 12 9 Q13 15 24 9':id==='moon'?'M32 9 Q22 19 36 23':'M22 2 L24 7 L30 7 L26 11'}/><path d="M15 24 L17 24 M30 24 L32 24 M20 31 Q24 34 28 30"/></svg></span>;}
function Modal({title,children,onClose,closeDisabled=false,className=''}:{title:string;children:React.ReactNode;onClose:()=>void;closeDisabled?:boolean;className?:string}) {
 const ref=useRef<HTMLDialogElement>(null);
 const timer=useRef<number|null>(null),[closing,setClosing]=useState(false);
 useEffect(()=>{ref.current?.showModal();return()=>{if(timer.current!==null)window.clearTimeout(timer.current);ref.current?.close();};},[]);
 const requestClose=()=>{if(closeDisabled||closing)return;setClosing(true);timer.current=window.setTimeout(()=>{ref.current?.close();onClose();},240);};
 return <dialog ref={ref} className={`tech-dialog ${className}`.trim()} data-closing={closing} onCancel={e=>{e.preventDefault();requestClose();}} aria-label={title}><header className="dialog-head"><span className="dialog-index">SYSTEM // DIALOG</span><h2>{title}</h2><button className="dialog-close" disabled={closeDisabled||closing} onClick={requestClose} aria-label="关闭弹窗"><i/><i/><small>ESC</small></button></header>{children}</dialog>;
}
function Identity({nickname,avatar,onName,onAvatar,disabled=false}:{nickname:string;avatar:string;onName:(s:string)=>void;onAvatar:(s:string)=>void;disabled?:boolean}) {
 return <fieldset disabled={disabled}><label>你的昵称<input aria-label="昵称" autoComplete="off" value={nickname} onChange={e=>onName(e.target.value)}/><small>1—20 个字，仅保存在这台电脑。</small></label><span className="label">选一个纸上头像</span><div className="avatars">{Object.entries(avatarName).map(([id,name])=><button key={id} type="button" aria-label={`头像：${name}`} aria-pressed={avatar===id} onClick={()=>onAvatar(id)}><Avatar id={id}/></button>)}</div></fieldset>;
}
function App() {
 const [profile,setProfile]=useState<Profile|null>(null),[page,setPage]=useState('loading'),[error,setError]=useState('');
 const [onlineCamera,setOnlineCamera]=useState('front'),[onlineReturning,setOnlineReturning]=useState(false);
 useEffect(()=>{if(!onlineReturning)return;const timer=window.setTimeout(()=>setOnlineReturning(false),1100);return()=>window.clearTimeout(timer);},[onlineReturning]);
 const [welcomePreview,setWelcomePreview]=useState(false),[welcomeReady,setWelcomeReady]=useState(false),[welcomeVisit,setWelcomeVisit]=useState(0),[welcomeToMenu,setWelcomeToMenu]=useState(false);
 const [nickname,setNickname]=useState(''),[avatar,setAvatar]=useState('leaf'),[saving,setSaving]=useState(false),[damaged,setDamaged]=useState(false);
 const [view,setView]=useState<DesktopView|null>(null),[manual,setManual]=useState<Manual|null>(null),[scene,setScene]=useState<Scene>('initial');
 const [modal,setModal]=useState(''),[detail,setDetail]=useState<Option|null>(null),[rule,setRule]=useState('');
 const [settings,setSettings]=useState<Settings>({music:60,effects:70,fullscreen:false}),[settingsTab,setSettingsTab]=useState('声音'),[returnPage,setReturnPage]=useState('menu'),[soloLevel,setSoloLevel]=useState('standard'),[soloTurnTime,setSoloTurnTime]=useState('unlimited');
 const [moveHistory,setMoveHistory]=useState<Record<string,PlayedMove[]>>({});
 const submitLock=useRef(false), generation=useRef(0), readSlot=useRef(false), sceneChangePending=useRef(false);
 const historyMatch=useRef(''), historyTurn=useRef('');
 const [readError,setReadError]=useState(false),[readAttempt,setReadAttempt]=useState(0),[busy,setBusy]=useState(false),[frozen,setFrozen]=useState(false),[arenaReady,setArenaReady]=useState(false),[arenaExiting,setArenaExiting]=useState(false),[pendingResult,setPendingResult]=useState<DesktopView|null>(null),[introSeconds,setIntroSeconds]=useState(5),[resultLeaving,setResultLeaving]=useState(false);
 const take=<T,>(r:Reply<T>):T=>{if(!r.ok)throw new Error(r.error);return r.data;};
 const run=async(action:()=>Promise<void>)=>{setError('');try{await action();}catch(e){setError(message((e as Error).message));}};
 const load=async()=>{await run(async()=>{try{const p=take(await api.profile.read());setProfile(p);setNickname(p?.nickname||'');setAvatar(p?.avatar_id||'leaf');setWelcomeToMenu(false);setPage('profile');setDamaged(false);}catch(e){setDamaged((e as Error).message==='PROFILE_DAMAGED');setPage('profile');throw e;}});};
 useEffect(()=>{void load();void api.manual().then(r=>{if(r.ok)setManual(r.data);});},[]);
 const selected=view?.options.find(o=>o.entry_id===view.selected_entry_id);
 const tutorial=view?.tutorial;
 const tutorialTarget=view?.phase==='selecting'?tutorial?.target_entry_id:null;
 const isMultiplayer=(view?.participants.length||0)>2;
 const suspended=page==='table'&&!isMultiplayer&&(frozen||['pause','leave'].includes(modal));
 const editable=arenaReady && !arenaExiting && !readError && !busy && !suspended && !!view && ['selecting','error'].includes(view.phase) && !view.submitted && view.options.length>0;
 const choose=(id:string)=>{if(editable){if(tutorial)setError('');setView(v=>v?{...v,selected_entry_id:id}:v);}};
 const submit=async()=>{
   if(!view||!selected||!editable||submitLock.current||sceneChangePending.current)return;
   if(tutorial?.target_entry_id&&selected.entry_id!==tutorial.target_entry_id){setError('先试一下提示中的招式；还没有提交，也不会扣资源。');return;}
   submitLock.current=true;setBusy(true);const token=++generation.current;setError('');
   try {const next=take(await api.port.submit(view.view_id,selected.entry_id));if(token===generation.current)setView(next);}
   catch(e){if(token===generation.current){setError(message((e as Error).message));if((e as Error).message==='MATCH_INTERRUPTED')setReadError(true);}}
   finally {submitLock.current=false;if(token===generation.current){setBusy(false);setReadAttempt(n=>n+1);}}
 };
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   const t=e.target as HTMLElement;
   if(e.repeat||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||modal||detail||rule||page!=='table'||!editable||t.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
   const entry=shortcutEntry(view!.options,e.key,false);
   if(entry){e.preventDefault();choose(entry);}else if(e.key==='Enter'){e.preventDefault();void submit();}
  };
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 });
 useEffect(()=>{
  if(page!=='table'||!view||view.phase==='result'||view.tutorial?.stage==='complete'||readError||suspended||arenaExiting)return;
  const token=generation.current, match=view.match_id, source=view.source;
  return pollViews(()=>api.port.getView(),readSlot,next=>{
    if(token!==generation.current||next.match_id!==match||next.source!==source||submitLock.current)return;
    if(next.phase==='result'){setPendingResult(next);setArenaExiting(true);return;}
    setView(previous=>next.phase==='selecting'&&previous?.view_id===next.view_id
      ? {...next,selected_entry_id:previous.selected_entry_id} : next);
  },code=>{if(token===generation.current){setReadError(true);setError(message(code));}});
 },[page,view?.match_id,view?.source,readError,readAttempt,suspended,arenaExiting,view?.tutorial?.stage]);
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
 useEffect(()=>{
  if(!view||!manual)return;
  const matchKey=`${view.match_id}/${view.game_id}`,turnKey=`${matchKey}/${view.turn_index}`;
  const fresh=historyMatch.current!==matchKey;
  if(fresh){historyMatch.current=matchKey;historyTurn.current='';}
  if(!['revealed','result'].includes(view.phase)){if(fresh)setMoveHistory({});return;}
  if(historyTurn.current===turnKey)return;
  const moves=view.participants.flatMap(player=>{
   const name=summaryMove(view.summary,player.nickname);
   const entry=manual.entries.find(item=>name===item.name||name.startsWith(item.name));
   return name&&entry?[{playerId:player.player_id,move:{turn:view.turn_index,name,entryId:entry.entry_id}}]:[];
  });
  historyTurn.current=turnKey;
  setMoveHistory(previous=>moves.reduce<Record<string,PlayedMove[]>>((next,{playerId,move})=>({...next,[playerId]:[...(next[playerId]||[]),move].slice(-8)}),fresh?{}:previous));
 },[view?.phase,view?.turn_index,view?.match_id,view?.game_id,view?.summary,manual]);
 const navigate=(action:()=>void)=>{if(!sceneChangePending.current)action();};
 const dismissModal=()=>document.querySelector<HTMLButtonElement>('dialog[open] .dialog-close')?.click();
 const changeScene=async(action:()=>Promise<DesktopView>,nextPage:string)=>{
  if(sceneChangePending.current||busy)return;sceneChangePending.current=true;const token=++generation.current;setBusy(true);setError('');setReadError(false);
  try {const next=await action();if(token===generation.current){setView(next);setWelcomePreview(false);setArenaExiting(false);setPendingResult(null);if(nextPage==='intro')setIntroSeconds(5);setPage(nextPage);setModal('');setFrozen(false);}}
  catch(e){if(token===generation.current){setError(message((e as Error).message));setReadError(true);}}
  finally {sceneChangePending.current=false;if(token===generation.current)setBusy(false);}
 };
 const start=()=>profile?changeScene(async()=>take(await api.port.startSolo(profile.local_id)),'intro'):Promise.resolve();
 const startTutorial=()=>profile?changeScene(async()=>take(await api.port.startTutorial(profile.local_id)),'table'):Promise.resolve();
 const tutorialNext=()=>view&&!suspended?changeScene(async()=>take(await api.port.tutorialNext(view.view_id)),'table').then(()=>setReadAttempt(n=>n+1)):Promise.resolve();
 const preview=(s:Scene)=>{if(sceneChangePending.current)return;setScene(s);return changeScene(async()=>take(await api.preview(s)),['winner','defeat','draw'].includes(s)?'result':'table');};
 const leave=async()=>{
  if(sceneChangePending.current)return;
  ++generation.current;setBusy(false);setView(null);setArenaExiting(false);setPendingResult(null);setPage('menu');setModal('');setReadError(false);setFrozen(false);
  await run(async()=>{take(await api.port.leave());});
 };
 useEffect(()=>{
  if(!resultLeaving)return;
  const timer=window.setTimeout(()=>void leave(),720);
  return()=>window.clearTimeout(timer);
 },[resultLeaving]);
 useEffect(()=>{if(page==='result')setResultLeaving(false);},[page,view?.match_id]);
 const openSettings=()=>{if(!profile||sceneChangePending.current)return;setNickname(profile.nickname);setAvatar(profile.avatar_id);setSettings({...profile.settings});setReturnPage(page);setError('');setPage('settings');};
 const dirty=profile&&(nickname!==profile.nickname||avatar!==profile.avatar_id||JSON.stringify(settings)!==JSON.stringify(profile.settings));
 const closeSettings=()=>{if(saving||sceneChangePending.current)return;if(dirty)setModal('settings-close');else{setPage(returnPage);setError('');}};
 const save=async(recover=false)=>{
  if(welcomePreview||saving)return;setSaving(true);
  await run(async()=>{const input:ProfileInput={nickname,avatar_id:avatar};const p=take(await (page==='settings'?api.settings.apply({...input,settings}):recover?api.profile.recover({...input,confirmed:true}):api.profile.create(input)));setProfile(p);setDamaged(false);setModal('');if(page==='settings')setPage(returnPage);else setWelcomeReady(true);});
  setSaving(false);
 };
 const showWelcome=async()=>{
  if(sceneChangePending.current||busy)return;
  if(view)await leave();
  setWelcomeVisit(v=>v+1);setWelcomeToMenu(false);setWelcomeReady(false);setWelcomePreview(true);setNickname('');setAvatar('leaf');setError('');setModal('');setPage('profile');
 };
 const closeWelcome=()=>{if(saving||busy||sceneChangePending.current)return;setWelcomeReady(false);setWelcomePreview(false);setNickname(profile?.nickname||'');setAvatar(profile?.avatar_id||'leaf');setError('');setPage('menu');};
 const enterWelcomeMenu=()=>{if(saving||busy||sceneChangePending.current)return;setWelcomeToMenu(true);};
 useEffect(()=>{if(page==='menu'&&welcomeToMenu)document.querySelector<HTMLButtonElement>('.menu-option')?.focus();},[page,welcomeToMenu]);
 const quit=async()=>{if(busy)return;setBusy(true);await run(async()=>{take(await api.quit());});setBusy(false);};
 const live=view?.source==='live';
 const currentSoloLevel=soloLevels.find(level=>level.id===soloLevel)!;
 const timelineTurns=[...new Set(Object.values(moveHistory).flat().map(move=>move.turn))].sort((a,b)=>Number(b)-Number(a));
 const resultPlayers=view?[...view.participants].sort((a,b)=>Number(b.player_id===view.self_id)-Number(a.player_id===view.self_id)):[];
 const winner=view?.participants.find(player=>player.player_id===view.outcome?.winner_id);
 const resultTone=!view?.outcome?.winner_id?'draw':view.self_id===view.outcome.winner_id?'victory':'defeat';
 const resultCopy=resultTone==='victory'
  ? {kicker:'TRAINING COMPLETE',title:'胜利',detail:`${winner?.nickname||'你'} 留到了最后。`}
  : resultTone==='defeat'
   ? {kicker:'COMBAT ENDED',title:'阵亡',detail:`${winner?.nickname||'对手'} 留到了最后。`}
   : {kicker:'NO SURVIVORS',title:'同归于尽',detail:'这一局没有留下胜者。'};
 const lastTurn=timelineTurns[0]||view?.turn_index||'0';
 const finalMove=(player:Participant)=>(moveHistory[player.player_id]||[]).find(move=>move.turn===lastTurn);
 const detailEntry=detail&&manual?.entries.find(o=>o.entry_id===detail.entry_id);
 const pageTitle:Record<string,string>={online:'好友房',profile:'初次见面',menu:'课间开始了',prepare:'单人准备',intro:'单人入场',table:view?.options.length?(view.participants.length===2?'双人牌桌':'六人开发预览'):'观战开发预览',result:'整场结果',settings:'本机设置',manual:'经典手册',loading:'正在打开'};
 return <div className="app" data-page={page} data-welcome-entering={page==='profile'&&welcomeToMenu}>
  {!['profile','menu','settings','manual','prepare','intro','table','result','online'].includes(page)&&<header className="topbar"><button className="brand" disabled={sceneChangePending.current||page==='online'} onClick={()=>navigate(()=>welcomePreview?closeWelcome():page==='table'?setModal('leave'):(setPage(profile?'menu':'profile'),setError('')))}>叠叠<span>DeiDei</span></button><span className="page-title">{pageTitle[page]}</span><strong className="demo-label">{page==='online'?'好友房 · 开发连接':view?(live?'本地实算 · 临时随机对手':'演示数据 · 固定脚本'):'本地单人 · 经典规则 1.0.1'}</strong>{profile&&<button disabled={page==='online'||busy} onClick={()=>navigate(()=>setModal('preview'))}>开发预览</button>}</header>}
  <div className="size-warning">当前内容区较小，建议调大窗口或降低系统显示缩放；牌区保持可读字号。</div>
  {error&&page!=='profile'&&!(page==='table'&&tutorial&&!readError)&&<div className="error" role="alert">{error}{readError&&<span><button onClick={()=>{setError('');setReadError(false);setReadAttempt(n=>n+1);}}>重新读取对局</button><button disabled={sceneChangePending.current} onClick={()=>void leave()}>退出本场</button></span>}<button onClick={()=>setError('')} aria-label="收起错误">×</button></div>}
  {['profile','menu','settings','manual','prepare','table','online'].includes(page)&&<div className={`front-stage front-stage-${page==='profile'&&welcomeToMenu?'menu':page}${page==='online'&&onlineCamera==='table'?' front-stage-table':''}`} data-online-camera={page==='online'?onlineCamera:onlineReturning?'returning':undefined}><div className="scene-plane scene-world" aria-hidden="true"><img className="menu-layer menu-environment" src="assets/menu/menu-environment.webp" alt=""/></div><div className="scene-plane scene-arena" aria-hidden="true"><img className="menu-layer" src="assets/battle/battle-arena-approach-v1.webp" alt=""/></div><span key={page==='online'?onlineCamera:onlineReturning?'returning':'idle'} className="scene-glass" aria-hidden="true"/><span className="menu-aura" aria-hidden="true"/><span className="menu-particles" aria-hidden="true"/><span className="menu-grid" aria-hidden="true"/><section className="menu-copy" aria-hidden={page!=='menu'&&!welcomeToMenu}><h1>DeiDei</h1><p className="menu-tagline"><span>攒一拍，</span><strong>再出招。</strong></p></section><div className="scene-plane scene-atmosphere" aria-hidden="true"><img className="menu-layer menu-atmosphere" src="assets/menu/menu-atmosphere.png" alt=""/></div><div className="scene-plane scene-character" aria-hidden="true"><img className="menu-layer menu-character" src="assets/menu/menu-character.png" alt=""/></div></div>}
  {page==='loading'&&<main className="center"><p>正在读取本机档案…</p></main>}
  {page==='profile'&&<WelcomeEntrance key={welcomeVisit} disabled={saving||busy} ready={welcomeReady} preview={welcomePreview} identityName={!welcomePreview?profile?.nickname:undefined} entering={welcomeToMenu} onEnter={enterWelcomeMenu} onExit={closeWelcome} onPreview={profile?()=>setModal('preview'):undefined}>
   {welcomeReady?<><div className="welcome-identity"><Avatar id={avatar}/><strong>{nickname.trim()}</strong></div><button className="welcome-action" disabled={busy} onClick={()=>void startTutorial()}>{busy?'正在入场…':'开始新手实战'}<b aria-hidden="true">→</b></button><button className="welcome-secondary" disabled={busy} onClick={enterWelcomeMenu}>进入主菜单</button>{welcomePreview&&<p>预览未保存，实战使用现有本机档案。</p>}</>:<form onSubmit={e=>{e.preventDefault();if(welcomePreview){if(!nickname.trim()||[...nickname.trim()].length>20||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(nickname))setError(message('INVALID_PROFILE'));else{setError('');setWelcomeReady(true);}}else if(!damaged)void save();}}><Identity nickname={nickname} avatar={avatar} onName={setNickname} onAvatar={setAvatar} disabled={saving}/>{error&&<p className="welcome-error" role="alert">{error}</p>}{damaged&&!welcomePreview?<><p>原档案已保留。重建前会先备份原文件。</p><button className="welcome-action" type="button" disabled={saving} onClick={()=>setModal('recover')}>备份原文件并重建档案</button></>:<button className="welcome-action" type="submit" disabled={saving}>{saving?'保存中…':welcomePreview?'确认名字 · 仅预览':'确认名字'}<b aria-hidden="true">→</b></button>}{!welcomePreview&&<button className="welcome-reload" type="button" disabled={saving} onClick={()=>void load()}>重新读取</button>}</form>}
  </WelcomeEntrance>}
  {(page==='menu'||page==='profile'&&welcomeToMenu)&&profile&&<main className={`menu-layout${welcomeToMenu?' welcome-menu-entry':''}`} inert={page!=='menu'}><nav className="menu-rail" aria-label="开始菜单"><header><div className="menu-kicker"><span>START MENU</span><em>01 / 05</em></div><strong>选择你的下一场</strong><small>SELECT OPERATION</small></header><div className="menu-options"><button className="menu-option menu-option-primary" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setPage('prepare');setError('');})}><span><b>单人对局</b><small>本机实算 · 练习模式</small></span><em>01</em></button><button className="menu-option menu-option-secondary" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setView(null);setPage('online');setError('');})}><span><b>好友联机</b><small>创建 / 加入房间</small></span><em>02</em></button><button className="menu-option menu-option-minor" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setReturnPage('menu');setPage('manual');})}><b>经典规则手册</b><em>R</em></button><button className="menu-option menu-option-minor" disabled={sceneChangePending.current} onClick={openSettings}><b>设置</b><em>S</em></button><button className="menu-option menu-option-minor" disabled={busy||sceneChangePending.current} onClick={()=>setModal('quit')}><b>退出</b><em>Q</em></button></div><footer><span><b>LOCAL</b><small>READY</small></span><i/><span><b>R04</b><small>FRONTEND</small></span><button className="menu-preview" disabled={busy||sceneChangePending.current} onClick={()=>navigate(()=>setModal('preview'))}>开发预览</button></footer></nav></main>}
  {page==='online'&&manual&&<OnlineRoom manual={manual} Avatar={Avatar} Modal={Modal} onScene={setOnlineCamera} onExit={()=>{setOnlineReturning(true);setPage('menu');setView(null);setError('');}}/>}
  {page==='prepare'&&profile&&<main className="prepare-screen"><button className="settings-back prepare-back" disabled={sceneChangePending.current||busy} onClick={()=>navigate(()=>setPage('menu'))}><span>返回主菜单</span></button><section className="prepare-overview"><header className="prepare-intro"><span>单人训练</span><h1>挑一个对手的手感。</h1><p>先决定这一局想承受多大的压力，再进入真实规则牌局。</p></header><section className="prepare-self" aria-label="本机玩家"><Avatar id={profile.avatar_id}/><span><small>本机席位</small><strong>{profile.nickname}</strong></span></section><section className="prepare-config" aria-label="练习设置"><section className="prepare-setting"><header><span>规则选择</span><small>01 / 01</small></header><div className="rule-choice" aria-label="当前规则：经典规则 1.0.1"><span><strong>经典规则</strong><small>CLASSIC</small></span><em>1.0.1</em></div></section><section className="prepare-setting prepare-time"><header><span>每回合时间</span><small>TURN LIMIT</small></header><div role="group" aria-label="选择每回合时间">{soloTurnTimes.map(time=><button key={time.id} type="button" aria-label={time.label} aria-pressed={soloTurnTime===time.id} onClick={()=>setSoloTurnTime(time.id)}><strong>{time.value}</strong></button>)}</div></section></section></section><section className="difficulty-console" data-level={soloLevel} aria-labelledby="difficulty-title"><header><span>AI 强度</span><h2 id="difficulty-title">训练对手</h2></header><div className="prepare-signal" data-level={soloLevel}><span aria-hidden="true"/><span aria-hidden="true"/><span aria-hidden="true"/><i aria-hidden="true"/><div className="difficulty-emblem" key={soloLevel} aria-hidden="true"><img src={`assets/moves/${currentSoloLevel.icon}.png`} alt=""/></div></div><div className="difficulty-selector" role="group" aria-label="选择 AI 强度">{soloLevels.map((level,index)=><button key={level.id} aria-label={`${level.name}：${level.tag}`} aria-pressed={soloLevel===level.id} onClick={()=>setSoloLevel(level.id)}><span className="difficulty-stop"><strong>{level.name}</strong><small>{String(index+1).padStart(2,'0')}</small></span></button>)}</div><div className="difficulty-readout" key={soloLevel}><span>{currentSoloLevel.tag}</span><p>{currentSoloLevel.description}</p></div></section><footer className="prepare-actions"><button className="prepare-start" disabled={busy} onClick={()=>void start()}><span>{busy?'正在开场':'开始对局'}</span><small>{busy?'LOADING':'ENTER MATCH'}</small></button></footer></main>}
  {page==='intro'&&view&&<main className="match-cinematic match-intro" aria-label="单人对局开场动画"><div className="cinematic-backdrop" aria-hidden="true"><img src="assets/battle/battle-arena-approach-v1.webp" alt=""/><span/></div><header className="intro-heading"><span>SOLO MATCH · {currentSoloLevel.name}</span><h1>进入擂台</h1><p>经典规则 · {soloTurnTimes.find(time=>time.id===soloTurnTime)?.value}</p></header><section className="intro-versus" aria-label="本局对阵">{view.participants.map((player,index)=><article key={player.player_id} className={player.player_id===view.self_id?'intro-self':'intro-opponent'}><Avatar id={player.avatar_id}/><span><small>{player.player_id===view.self_id?'本机席位':'训练对手'}</small><strong>{player.nickname}</strong></span><em>{String(index+1).padStart(2,'0')}</em></article>)}</section><button className="cinematic-skip" onClick={()=>setPage('table')}>立即进入（{introSeconds}s） <small>SKIP</small></button></main>}
  {page==='table'&&view&&<BattleStage view={view} manual={manual!} moveHistory={moveHistory} mode="local" ready={arenaReady} exiting={arenaExiting} suspended={suspended} frozen={frozen} busy={busy||readError} revealSeconds={Math.max(0,Math.ceil((view.timer.remaining_ms||0)/1000))} coach={tutorial?<TutorialCoach view={view} busy={busy} suspended={suspended} error={readError?'':error} onNext={()=>void tutorialNext()} onSolo={()=>void start()} onExit={()=>void leave()}/>:undefined} Avatar={Avatar} onSelect={choose} onSubmit={()=>void submit()} onPause={()=>navigate(()=>setModal('pause'))} onFreeze={()=>setFrozen(value=>!value)} onSituation={()=>setModal('situation')}/>}
  {page==='result'&&view?.outcome&&<main className={`match-cinematic match-outro result-${resultTone}`} data-leaving={resultLeaving} aria-label={`整场结果：${resultCopy.title}`}><div className="cinematic-backdrop" aria-hidden="true"><img src="assets/battle/battle-arena-approach-v1.webp" alt=""/><span/></div><header className="result-heading"><span>{resultCopy.kicker} · ROUND {String(view.turn_index).padStart(2,'0')}</span><h1>{resultCopy.title}</h1><p>{resultCopy.detail}</p></header><section className="result-players" aria-label="本场玩家结果">{resultPlayers.map(player=><article key={player.player_id} tabIndex={0} aria-label={`${player.nickname}${player.player_id===view.self_id?'，你':''}${player.player_id===view.outcome!.winner_id?'，存活':'，离场'}`} data-result={player.player_id===view.outcome!.winner_id?'winner':'out'} data-self={player.player_id===view.self_id}><Avatar id={player.avatar_id}/><strong>{player.nickname}</strong></article>)}</section><section className="result-last-turn" aria-label="最后一拍"><header><span>最后一拍</span><strong>第 {Number(lastTurn)} 回合</strong></header><div>{resultPlayers.map(player=>{const move=finalMove(player);return <article key={player.player_id} data-self={player.player_id===view.self_id}><header><Avatar id={player.avatar_id}/><span>{player.player_id===view.self_id?`你 · ${player.nickname}`:player.nickname}</span></header><div className="result-move-art">{move?<img src={`assets/moves/${move.entryId}.png`} alt=""/>:<span>?</span>}</div><strong>{move?.name||'招式记录未载入'}</strong></article>;})}</div></section><nav className="result-actions" aria-label="终场操作"><button disabled={resultLeaving} onClick={()=>setModal('situation')}>局势回顾<small>REVIEW</small></button><button className="primary" disabled={busy||resultLeaving} onClick={()=>view.participants.length===2&&profile?void start():void preview('initial')}>再来一场<small>REMATCH</small></button><button disabled={sceneChangePending.current||resultLeaving} onClick={()=>setResultLeaving(true)}>返回主菜单<small>EXIT</small></button></nav></main>}
  {page==='settings'&&<main className="settings-layout"><header className="settings-heading"><button className="settings-back" disabled={saving} onClick={closeSettings}><span>返回主菜单</span></button><span>CONFIGURATION</span><h1>设置</h1><p>调整这台电脑上的游戏体验。</p></header><nav aria-label="设置分类">{([['声音','AUDIO'],['窗口','DISPLAY'],['昵称头像','PROFILE'],['关于','ABOUT']] as const).map(([t,en])=><button key={t} aria-pressed={settingsTab===t} onClick={()=>setSettingsTab(t)}><span>{t}</span><small>{en}</small></button>)}</nav><section className="settings-content"><header><span>LOCAL PREFERENCES</span><h2>{settingsTab}</h2></header><fieldset disabled={saving}><div className="settings-tab-panel" key={settingsTab}>{settingsTab==='声音'?<><p>音源尚未加入。音量会真实保存，当前没有试听声音。</p>{(['music','effects'] as const).map(k=><label className="settings-range" key={k}><span>{k==='music'?'音乐':'音效'}<b>{settings[k]}%</b></span><input type="range" aria-label={k==='music'?'音乐音量':'音效音量'} min="0" max="100" value={settings[k]} style={{'--range-value':`${settings[k]}%`} as React.CSSProperties} onChange={e=>setSettings({...settings,[k]:Number(e.target.value)})}/></label>)}</>:settingsTab==='窗口'?<><label className="checkbox"><input type="checkbox" checked={settings.fullscreen} onChange={e=>setSettings({...settings,fullscreen:e.target.checked})}/><span>保存后使用全屏<small>下次启动时应用</small></span></label><p>窗口模式可拖动边缘调整大小。目标内容区 1366×768 / 1920×1080。</p></>:settingsTab==='昵称头像'?<Identity nickname={nickname} avatar={avatar} onName={setNickname} onAvatar={setAvatar}/>:<><h3>DeiDei 桌面原型</h3><p>经典规则 1.0.1</p><p>本机档案和设置可以保存。单人对局已接入真实规则和临时随机对手，好友房支持本机开发服务连接。</p><p>当前使用原创分层美术与系统字体。</p></>}</div></fieldset><footer><span>{dirty?'有未保存的修改':'已与本机档案同步'}</span><button className="settings-action settings-close" disabled={saving} onClick={closeSettings}><span>关闭</span></button><button className="settings-action settings-save primary" aria-busy={saving} disabled={saving||!dirty} onClick={()=>void save()}><span>{saving?'保存中…':'保存并关闭'}</span></button></footer></section></main>}
  {page==='manual'&&<ManualArchive manual={manual} onBack={()=>navigate(()=>setPage(returnPage))} onTutorial={()=>void startTutorial()} busy={busy||frozen} Dialog={Modal}/> }
  {['preview','settings-close','recover','leave'].includes(modal)&&<Modal title={modal==='preview'?'开发场景':modal==='settings-close'?'还有未保存的修改':modal==='recover'?'备份并重建档案':'离开当前对局'} closeDisabled={sceneChangePending.current||saving} onClose={()=>navigate(()=>{if(!saving)setModal('');})}>
   {error&&<p role="alert">{error}</p>}{modal==='preview'?<><p>首次进入仅预览界面，不写入档案；其余牌局场景使用固定脚本。切换场景将结束当前对局，进度不会保存。</p><div className="scene-grid"><button disabled={busy} onClick={()=>void showWelcome()}>P01 · 首次进入／欢迎建档</button>{([['initial','P07 · 初始 A / 12 可用'],['midgame','P07 · 中局 B / 26 可用'],['spectator','P08 · 普通观众'],['eliminated','P08 · 本人已淘汰'],['restart','P08 · 淘汰后存活者新局'],['winner','P09 · 唯一赢家'],['defeat','P09 · 本人阵亡'],['draw','P09 · 全员淘汰'],['invalid','P07 · 提交失败后重试']] as [Scene,string][]).map(([s,label])=><button key={s} disabled={busy} aria-pressed={scene===s} onClick={()=>void preview(s)}>{label}</button>)}</div></>:modal==='settings-close'?<><p>可以继续编辑，也可以保存或放弃这次修改。</p><button onClick={dismissModal}>继续编辑</button><button disabled={saving} onClick={()=>{setModal('');setPage(returnPage);setError('');}}>不保存关闭</button><button className="primary" disabled={saving} onClick={()=>void save()}>保存关闭</button></>:modal==='recover'?<><p>先备份损坏的原文件，再创建新档案。原昵称和设置不会自动迁移。</p><button disabled={saving} onClick={dismissModal}>继续检查</button><button className="primary" disabled={saving} onClick={()=>void save(true)}>确认备份并重建</button></>:<><p>本次对局进度不会保存。本机档案和设置仍保留。</p><button onClick={dismissModal}>继续{live?'对局':'演示'}</button><button className="primary" disabled={sceneChangePending.current} onClick={()=>void leave()}>离开</button></>}
  </Modal>}
  {modal==='quit'&&<Modal title="退出游戏？" closeDisabled={busy} onClose={()=>setModal('')}><p>确定关闭游戏吗？本机档案和已保存的设置会保留。</p>{error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={dismissModal}>继续留在游戏</button><button className="danger" disabled={busy} onClick={()=>void quit()}>{busy?'正在退出…':'确认退出'}</button></Modal>}
  {modal==='pause'&&<Modal className="battle-dialog pause-dialog" title={isMultiplayer?'对局菜单':'游戏暂停'} closeDisabled={sceneChangePending.current} onClose={()=>setModal('')}><section className="pause-state"><span>{isMultiplayer?'ONLINE MENU':'LOCAL PAUSE'}</span><h3>{isMultiplayer?'牌局仍在继续':'时间停在这一拍'}</h3><p>{isMultiplayer?'多人模式打开菜单不会暂停牌局，返回后以服务端当前状态为准。':'出牌、倒计时与场景动画暂时冻结。'}</p></section><div className="pause-actions"><button className="primary" onClick={dismissModal}>继续游戏<small>RESUME</small></button>{isMultiplayer&&<button onClick={()=>setModal('room-settings')}>房间游戏设置<small>ROOM SETTINGS</small></button>}<button className="danger" disabled={sceneChangePending.current} onClick={()=>setModal('leave')}>退出游戏<small>LEAVE MATCH</small></button></div></Modal>}
  {modal==='room-settings'&&<Modal className="battle-dialog room-settings-dialog" title="房间游戏设置" onClose={()=>setModal('pause')}><p className="dialog-kicker">界面预览 · 后端能力接入后开放修改</p><div className="room-setting-list"><section><span>规则模式</span><strong>经典规则 1.0.1</strong><small>CLASSIC</small></section><section><span>每回合时间</span><strong>{soloTurnTimes.find(time=>time.id===soloTurnTime)?.label}</strong><small>TURN LIMIT</small></section><section><span>揭晓停留</span><strong>5 秒</strong><small>RESULT HOLD</small></section></div><button className="primary" onClick={()=>setModal('pause')}>返回对局菜单</button></Modal>}
  {modal==='situation'&&view&&<SituationDialog view={view} manual={manual!} moveHistory={moveHistory} Modal={Modal} Avatar={Avatar} onClose={()=>setModal('')}/>}
  {detail&&<Modal title={`${detail.doc_id} · ${detail.name}`} onClose={()=>setDetail(null)}><p>{detailEntry?.description}</p><dl><dt>需要持有 / 资格</dt><dd>{detail.requirement_text}</dd><dt>实际花费</dt><dd>{detail.cost_text}</dd><dt>{page==='manual'?'开局示例状态':live?'本拍真实资格':'此静态样例的状态'}</dt><dd>{detail.available?'可用':reasons[detail.reason_code||'']||'不可用'}</dd></dl>{detail.entry_id==='ZhangXinWei'&&<p>复制聂湘也不需充能，实际充能支出为 0；仍须本局未用且有有效复制记录。</p>}<button onClick={()=>{setRule(detail.detail_rule_ids[0]);setDetail(null);}}>阅读条款 {detail.detail_rule_ids.join(' / ')}</button></Modal>}
  {rule&&<Modal title="本地完整条款 · 经典规则 1.0.1" onClose={()=>setRule('')}><nav className="rule-nav">{manual?.sections.map(s=><button key={s.id} aria-pressed={rule===s.id} onClick={()=>setRule(s.id)}>{s.id}</button>)}</nav>{manual?.sections.filter(s=>rule==='all'||rule===s.id).map(s=><section key={s.id}><h3>{s.id}</h3><pre>{s.text}</pre></section>)}</Modal>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
