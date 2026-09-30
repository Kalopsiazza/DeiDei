import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DesktopView, Manual, Option, Participant, Profile, ProfileInput, Reply, Scene, Settings } from './types';
import { groups, orderedOptions, shortcutEntry } from './interaction';
import { ddText, pollViews } from './view-loop';
import { OnlineRoom } from './online/OnlineRoom';
const api=window.desktop;
const groupName={attack:'攻击',defense:'防御',skill:'技能'};
const avatarName={leaf:'叶子',sun:'太阳',moon:'月亮',star:'星星'};
const soloLevels=[
 {id:'rookie',name:'见习',tag:'观察节奏',icon:'Charge',description:'目标：留出更多观察窗口，适合第一次熟悉招式。'},
 {id:'standard',name:'练手',tag:'攻守均衡',icon:'Reflect',description:'目标：按常规频率施压，保持攻守节奏平衡。'},
 {id:'pressure',name:'高压',tag:'主动争拍',icon:'Pragon',description:'目标：更主动争夺节奏，减少连续攒拍的空间。'},
] as const;
const soloTurnTimes=[{id:'unlimited',label:'自由',value:'自由'},{id:'3',label:'3 秒',value:'3s'},{id:'10',label:'10 秒',value:'10s'},{id:'30',label:'30 秒',value:'30s'}] as const;
type PlayedMove={turn:string;name:string;entryId:string};
const arenaPositions:Record<number,[number,number][]>={
 1:[[50,9]],2:[[29,12],[71,12]],3:[[19,42],[50,8],[81,42]],
 4:[[13,50],[36,9],[64,9],[87,50]],5:[[9,55],[27,12],[50,6],[73,12],[91,55]],
 6:[[8,57],[23,18],[42,6],[58,6],[77,18],[92,57]],
};
const compactMoveName=(name:string)=>{
 const tags:string[]=[];let label=name;
 for(const prefix of ['炸药','雷电'])if(label.startsWith(`${prefix}·`)){tags.push(prefix);label=label.slice(prefix.length+1);}
 if(label.startsWith('曾义赠送·')){tags.push('赠送');label=label.slice(5);}
 for(const modifier of ['翻转','旋转'])if(label.startsWith(modifier)){tags.push(modifier);label=label.slice(modifier.length);}
 return {tags,label};
};
const summaryMove=(summary:string[],nickname:string)=>{const prefix=`${nickname}：`;return summary.find(line=>line.startsWith(prefix))?.slice(prefix.length).split('（',1)[0].replace(/[。.]$/,'')||'';};
const errors:Record<string,string>={PACKAGE_INCOMPLETE:'游戏文件不完整，请重新取得完整测试包。',INVALID_PROFILE:'昵称须为 1—20 个字，不能包含控制字符；请选择内置头像。',INVALID_INPUT:'输入格式无效，请检查后重试。',SAVE_FAILED:'保存失败，请检查本机目录权限后重试。输入和旧档案已保留。',PROFILE_BUSY:'正在保存，请稍后重试。',PROFILE_DAMAGED:'本机档案损坏，原文件已保留。',PROFILE_UNREADABLE:'暂时无法读取档案，请检查目录权限后重试。',UNAVAILABLE_MOVE:'这张牌暂不可用，请查看原因。',STALE_VIEW:'场景已更新，请重新选择。',ALREADY_SUBMITTED:'已经提交，请等待揭晓。',MATCH_INTERRUPTED:'本场中断，可重新开始。',GET_VIEW_FAILED:'读取对局失败，请重新读取或退出。',REQUEST_CONFLICT:'本拍已提交另一张牌，请重新读取。',SESSION_CLOSED:'本场已结束，请返回菜单重新开始。'};
const reasons:Record<string,string>={INSUFFICIENT_DD:'DD 不足',INSUFFICIENT_LIGHTNING:'雷电不足',INSUFFICIENT_CHARGE:'充能不足',INSUFFICIENT_BOMBS:'成熟层不足',ALREADY_USED:'本局已用',NO_COPY_RECORD:'没有复制记录',NO_REWARD:'奖励未就绪',FORCED_RECOVERY:'正在休整',NOT_ACTIVE:'已不在场'};
const message=(code:string)=>errors[code]||`操作未完成（${code}），请重试。`;
function Avatar({id='leaf'}:{id?:string}) {return <span className={`avatar ${id}`} aria-label={avatarName[id as keyof typeof avatarName]||'占位头像'}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 35 Q4 12 24 8 Q45 12 38 35 Q24 44 10 35Z"/><path d={id==='sun'?'M18 6 L17 1 M32 7 L35 2 M41 17 L47 15':id==='leaf'?'M24 9 Q13 0 12 9 Q13 15 24 9':id==='moon'?'M32 9 Q22 19 36 23':'M22 2 L24 7 L30 7 L26 11'}/><path d="M15 24 L17 24 M30 24 L32 24 M20 31 Q24 34 28 30"/></svg></span>;}
function Modal({title,children,onClose,closeDisabled=false}:{title:string;children:React.ReactNode;onClose:()=>void;closeDisabled?:boolean}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
 return <dialog ref={ref} onCancel={e=>{e.preventDefault();onClose();}} aria-label={title}><header><h2>{title}</h2><button disabled={closeDisabled} onClick={onClose} aria-label="关闭弹窗">×</button></header>{children}</dialog>;
}
function Identity({nickname,avatar,onName,onAvatar,disabled=false}:{nickname:string;avatar:string;onName:(s:string)=>void;onAvatar:(s:string)=>void;disabled?:boolean}) {
 return <fieldset disabled={disabled}><label>你的昵称<input aria-label="昵称" autoComplete="off" value={nickname} onChange={e=>onName(e.target.value)}/><small>1—20 个字，仅保存在这台电脑。</small></label><span className="label">选一个纸上头像</span><div className="avatars">{Object.entries(avatarName).map(([id,name])=><button key={id} type="button" aria-label={`头像：${name}`} aria-pressed={avatar===id} onClick={()=>onAvatar(id)}><Avatar id={id}/></button>)}</div></fieldset>;
}
function App() {
 const [profile,setProfile]=useState<Profile|null>(null),[page,setPage]=useState('loading'),[error,setError]=useState('');
 const [nickname,setNickname]=useState(''),[avatar,setAvatar]=useState('leaf'),[saving,setSaving]=useState(false),[damaged,setDamaged]=useState(false);
 const [view,setView]=useState<DesktopView|null>(null),[manual,setManual]=useState<Manual|null>(null),[scene,setScene]=useState<Scene>('initial');
 const [modal,setModal]=useState(''),[detail,setDetail]=useState<Option|null>(null),[rule,setRule]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState('all');
 const [settings,setSettings]=useState<Settings>({music:60,effects:70,fullscreen:false}),[settingsTab,setSettingsTab]=useState('声音'),[returnPage,setReturnPage]=useState('menu'),[soloLevel,setSoloLevel]=useState('standard'),[soloTurnTime,setSoloTurnTime]=useState('unlimited');
 const [moveHistory,setMoveHistory]=useState<Record<string,PlayedMove[]>>({});
 const submitLock=useRef(false), generation=useRef(0), readSlot=useRef(false), sceneChangePending=useRef(false);
 const historyMatch=useRef(''), historyTurn=useRef('');
 const [readError,setReadError]=useState(false),[readAttempt,setReadAttempt]=useState(0),[busy,setBusy]=useState(false),[resourcePlayer,setResourcePlayer]=useState('');
 const take=<T,>(r:Reply<T>):T=>{if(!r.ok)throw new Error(r.error);return r.data;};
 const run=async(action:()=>Promise<void>)=>{setError('');try{await action();}catch(e){setError(message((e as Error).message));}};
 const load=async()=>{await run(async()=>{try{const p=take(await api.profile.read());setProfile(p);setPage(p?'menu':'profile');setDamaged(false);}catch(e){setDamaged((e as Error).message==='PROFILE_DAMAGED');setPage('profile');throw e;}});};
 useEffect(()=>{void load();void api.manual().then(r=>{if(r.ok)setManual(r.data);});},[]);
 const selected=view?.options.find(o=>o.entry_id===view.selected_entry_id);
 const editable=!readError && !busy && !!view && ['selecting','error'].includes(view.phase) && !view.submitted && view.options.length>0;
 const choose=(id:string)=>{if(editable)setView(v=>v?{...v,selected_entry_id:id}:v);};
 const submit=async()=>{
   if(!view||!selected||!editable||submitLock.current||sceneChangePending.current)return;
   submitLock.current=true;setBusy(true);const token=++generation.current;setError('');
   try {const next=take(await api.port.submit(view.view_id,selected.entry_id));if(token===generation.current)setView(next);}
   catch(e){if(token===generation.current){setError(message((e as Error).message));if((e as Error).message==='MATCH_INTERRUPTED')setReadError(true);}}
   finally {submitLock.current=false;if(token===generation.current){setBusy(false);setReadAttempt(n=>n+1);}}
 };
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   const t=e.target as HTMLElement;
   if(e.repeat||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||modal||detail||rule||resourcePlayer||page!=='table'||!editable||t.closest('input,textarea,select,[contenteditable="true"],dialog'))return;
   const entry=shortcutEntry(view!.options,e.key,false);
   if(entry){e.preventDefault();choose(entry);}else if(e.key==='Enter'){e.preventDefault();void submit();}
  };
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 });
 useEffect(()=>{
  if(page!=='table'||!view||view.phase==='result'||readError)return;
  const token=generation.current, match=view.match_id, source=view.source;
  return pollViews(()=>api.port.getView(),readSlot,next=>{
    if(token!==generation.current||next.match_id!==match||next.source!==source||submitLock.current)return;
    setView(previous=>next.phase==='selecting'&&previous?.view_id===next.view_id
      ? {...next,selected_entry_id:previous.selected_entry_id} : next);
    if(next.phase==='result')setPage('result');
  },code=>{if(token===generation.current){setReadError(true);setError(message(code));}});
 },[page,view?.match_id,view?.source,readError,readAttempt]);
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
 const changeScene=async(action:()=>Promise<DesktopView>,nextPage:string)=>{
  if(sceneChangePending.current||busy)return;sceneChangePending.current=true;const token=++generation.current;setBusy(true);setError('');setReadError(false);
  try {const next=await action();if(token===generation.current){setView(next);setPage(nextPage);setModal('');}}
  catch(e){if(token===generation.current){setError(message((e as Error).message));setReadError(true);}}
  finally {sceneChangePending.current=false;if(token===generation.current)setBusy(false);}
 };
 const start=()=>profile?changeScene(async()=>take(await api.port.startSolo(profile.local_id)),'table'):Promise.resolve();
 const preview=(s:Scene)=>{if(sceneChangePending.current)return;setScene(s);return changeScene(async()=>take(await api.preview(s)),['winner','draw'].includes(s)?'result':'table');};
 const leave=async()=>{
  if(sceneChangePending.current)return;
  ++generation.current;setBusy(false);setView(null);setPage('menu');setModal('');setReadError(false);
  await run(async()=>{take(await api.port.leave());});
 };
 const openSettings=()=>{if(!profile||sceneChangePending.current)return;setNickname(profile.nickname);setAvatar(profile.avatar_id);setSettings({...profile.settings});setReturnPage(page);setError('');setPage('settings');};
 const dirty=profile&&(nickname!==profile.nickname||avatar!==profile.avatar_id||JSON.stringify(settings)!==JSON.stringify(profile.settings));
 const closeSettings=()=>{if(saving||sceneChangePending.current)return;if(dirty)setModal('settings-close');else{setPage(returnPage);setError('');}};
 const save=async(recover=false)=>{
  if(saving)return;setSaving(true);
  await run(async()=>{const input:ProfileInput={nickname,avatar_id:avatar};const p=take(await (page==='settings'?api.settings.apply({...input,settings}):recover?api.profile.recover({...input,confirmed:true}):api.profile.create(input)));setProfile(p);setDamaged(false);setModal('');setPage(page==='settings'?returnPage:'menu');});
  setSaving(false);
 };
 const live=view?.source==='live';
 const resourceDetail=view?.participants.find(p=>p.player_id===resourcePlayer);
 const self=view?.participants.find(p=>p.player_id===view.self_id);
 const currentSoloLevel=soloLevels.find(level=>level.id===soloLevel)!;
 const ordered=view?orderedOptions(view.options):[];
 const opponents=view?.participants.filter(p=>p.player_id!==view.self_id)||[];
 const seatPosition=arenaPositions[opponents.length]||arenaPositions[6];
 const moveTrail=(player:Participant)=>{
  const history=(moveHistory[player.player_id]||[]).slice(-3).reverse();
  const showingCurrent=['revealed','result'].includes(view?.phase||'')&&history[0]?.turn===view?.turn_index;
  const pending=player.player_id===view?.self_id&&!view?.submitted?selected:null;
  return <div className="move-trail" aria-label={`${player.nickname}的出牌记录`}>
   {history.map((move,index)=><span key={`${move.turn}-${move.entryId}`} className={`move-card ${showingCurrent&&index===0?'current':''}`} data-turn={move.turn} style={{'--stack-index':String(index+(showingCurrent?0:1))} as React.CSSProperties}><img src={`assets/moves/${move.entryId}.png`} alt=""/><strong>{move.name}</strong></span>)}
   {!showingCurrent&&view?.phase!=='submitting'&&<span className={`move-card active ${pending?'pending':'hidden-move'}`} style={{'--stack-index':'0'} as React.CSSProperties}>{pending?<><img src={`assets/moves/${pending.entry_id}.png`} alt=""/><strong>{pending.name}</strong></>:<strong>{player.submission_state==='submitted'?'已锁定':'等待'}</strong>}</span>}
  </div>;
 };
 const selectingUi=!!view&&['selecting','error'].includes(view.phase)&&!view.submitted;
 const selfHistory=self?(moveHistory[self.player_id]||[]).slice().reverse():[];
 const showcaseCard=(option:Option|undefined,className:string)=><article key={option?.entry_id||'empty'} className={`showcase-card ${className} ${option?.ui_group||'empty'}`}><i className="showcase-foil" aria-hidden="true"/><header><span>{option?.doc_id||'TACTICAL'}</span><em>{option?groupName[option.ui_group]:'READY'}</em></header><div className="showcase-art">{option?<img src={`assets/moves/${option.entry_id}.png`} alt=""/>:<span aria-hidden="true">?</span>}</div><footer><strong>{option?.name||'待选择'}</strong><small>{option?'本拍战术已载入':'从下方牌组选择招式'}</small></footer></article>;
 const detailEntry=detail&&manual?.entries.find(o=>o.entry_id===detail.entry_id);
 const pageTitle:Record<string,string>={online:'好友房',profile:'初次见面',menu:'课间开始了',prepare:'单人准备',table:view?.options.length?(view.participants.length===2?'双人牌桌':'六人开发预览'):'观战开发预览',result:'整场结果',settings:'本机设置',manual:'经典手册',loading:'正在打开'};
 return <div className="app" data-page={page}>
  {!['menu','settings','prepare','table'].includes(page)&&<header className="topbar"><button className="brand" disabled={sceneChangePending.current||page==='online'} onClick={()=>navigate(()=>page==='table'?setModal('leave'):(setPage(profile?'menu':'profile'),setError('')))}>叠叠<span>DeiDei</span></button><span className="page-title">{pageTitle[page]}</span><strong className="demo-label">{page==='online'?'好友房 · 开发连接':view?(live?'本地实算 · 临时随机对手':'演示数据 · 固定脚本'):'本地单人 · 经典规则 1.0.1'}</strong>{profile&&<button disabled={page==='online'||busy} onClick={()=>navigate(()=>setModal('preview'))}>开发预览</button>}</header>}
  <div className="size-warning">当前内容区较小，建议调大窗口或降低系统显示缩放；牌区保持可读字号。</div>
  {error&&<div className="error" role="alert">{error}{readError&&<span><button onClick={()=>{setError('');setReadError(false);setReadAttempt(n=>n+1);}}>重新读取对局</button><button disabled={sceneChangePending.current} onClick={()=>void leave()}>退出本场</button></span>}<button onClick={()=>setError('')} aria-label="收起错误">×</button></div>}
  {['menu','settings','prepare','table'].includes(page)&&<div className={`front-stage front-stage-${page}`}><div className="scene-plane scene-world" aria-hidden="true"><img className="menu-layer menu-environment" src="assets/menu/menu-environment.webp" alt=""/></div><span className="menu-aura" aria-hidden="true"/><span className="menu-particles" aria-hidden="true"/><span className="menu-grid" aria-hidden="true"/><section className="menu-copy" aria-hidden={page!=='menu'}><h1>DeiDei</h1><p className="menu-tagline"><span>攒一拍，</span><strong>再出招。</strong></p></section><div className="scene-plane scene-atmosphere" aria-hidden="true"><img className="menu-layer menu-atmosphere" src="assets/menu/menu-atmosphere.png" alt=""/></div><div className="scene-plane scene-character" aria-hidden="true"><img className="menu-layer menu-character" src="assets/menu/menu-character.png" alt=""/></div></div>}
  {page==='loading'&&<main className="center"><p>正在读取本机档案…</p></main>}
  {page==='profile'&&<main className="center"><section className="paper profile"><span className="eyebrow">P01 · 本机档案</span><h1>先写下你的名字。</h1><p>不用注册。下一次打开，还会在这里遇见你。</p><Identity nickname={nickname} avatar={avatar} onName={setNickname} onAvatar={setAvatar} disabled={saving}/>{damaged?<><p>原档案不会自动覆盖。确认重建前，会先备份原文件。</p><button className="primary" disabled={saving} onClick={()=>setModal('recover')}>备份原文件并重建档案</button></>:<button className="primary" disabled={saving} onClick={()=>void save()}>{saving?'保存中…':'保存，进入课间 →'}</button>}<button onClick={()=>void load()}>重新读取</button></section></main>}
  {page==='menu'&&profile&&<main className="menu-layout"><nav className="menu-rail" aria-label="开始菜单"><header><div className="menu-kicker"><span>START MENU</span><em>01 / 05</em></div><strong>选择你的下一场</strong><small>SELECT OPERATION</small></header><div className="menu-options"><button className="menu-option menu-option-primary" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setPage('prepare');setError('');})}><span><b>单人对局</b><small>本机实算 · 练习模式</small></span><em>01</em></button><button className="menu-option menu-option-secondary" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setView(null);setPage('online');setError('');})}><span><b>好友联机</b><small>创建 / 加入房间</small></span><em>02</em></button><button className="menu-option menu-option-minor" disabled={sceneChangePending.current} onClick={()=>navigate(()=>{setReturnPage('menu');setPage('manual');})}><b>经典规则手册</b><em>R</em></button><button className="menu-option menu-option-minor" disabled={sceneChangePending.current} onClick={openSettings}><b>设置</b><em>S</em></button><button className="menu-option menu-option-minor" onClick={()=>void api.quit()}><b>退出</b><em>Q</em></button></div><footer><span><b>LOCAL</b><small>READY</small></span><i/><span><b>R04</b><small>FRONTEND</small></span><button className="menu-preview" disabled={busy||sceneChangePending.current} onClick={()=>navigate(()=>setModal('preview'))}>开发预览</button></footer></nav></main>}
  {page==='online'&&manual&&<OnlineRoom manual={manual} Avatar={Avatar} Modal={Modal} onExit={()=>{setPage('menu');setView(null);setError('');}}/>}
  {page==='prepare'&&profile&&<main className="prepare-screen"><button className="settings-back prepare-back" disabled={sceneChangePending.current||busy} onClick={()=>navigate(()=>setPage('menu'))}><span>返回主菜单</span></button><section className="prepare-overview"><header className="prepare-intro"><span>单人训练</span><h1>挑一个对手的手感。</h1><p>先决定这一局想承受多大的压力，再进入真实规则牌局。</p></header><section className="prepare-self" aria-label="本机玩家"><Avatar id={profile.avatar_id}/><span><small>本机席位</small><strong>{profile.nickname}</strong></span></section><section className="prepare-config" aria-label="练习设置"><section className="prepare-setting"><header><span>规则选择</span><small>01 / 01</small></header><div className="rule-choice" aria-label="当前规则：经典规则 1.0.1"><span><strong>经典规则</strong><small>CLASSIC</small></span><em>1.0.1</em></div></section><section className="prepare-setting prepare-time"><header><span>每回合时间</span><small>TURN LIMIT</small></header><div role="group" aria-label="选择每回合时间">{soloTurnTimes.map(time=><button key={time.id} type="button" aria-label={time.label} aria-pressed={soloTurnTime===time.id} onClick={()=>setSoloTurnTime(time.id)}><strong>{time.value}</strong></button>)}</div></section></section></section><section className="difficulty-console" data-level={soloLevel} aria-labelledby="difficulty-title"><header><span>AI 强度</span><h2 id="difficulty-title">训练对手</h2></header><div className="prepare-signal" data-level={soloLevel}><span aria-hidden="true"/><span aria-hidden="true"/><span aria-hidden="true"/><i aria-hidden="true"/><div className="difficulty-emblem" key={soloLevel} aria-hidden="true"><img src={`assets/moves/${currentSoloLevel.icon}.png`} alt=""/></div></div><div className="difficulty-selector" role="group" aria-label="选择 AI 强度">{soloLevels.map((level,index)=><button key={level.id} aria-label={`${level.name}：${level.tag}`} aria-pressed={soloLevel===level.id} onClick={()=>setSoloLevel(level.id)}><span className="difficulty-stop"><strong>{level.name}</strong><small>{String(index+1).padStart(2,'0')}</small></span></button>)}</div><div className="difficulty-readout" key={soloLevel}><span>{currentSoloLevel.tag}</span><p>{currentSoloLevel.description}</p></div></section><footer className="prepare-actions"><button className="prepare-start" disabled={busy} onClick={()=>void start()}><span>{busy?'正在开场':'开始对局'}</span><small>{busy?'LOADING':'ENTER MATCH'}</small></button></footer></main>}
  {page==='table'&&view&&<main className="table battle-table" data-phase={view.phase}>
   <header className="battle-hud"><button className="battle-leave" disabled={sceneChangePending.current} onClick={()=>navigate(()=>setModal('leave'))}>退出牌桌</button><span>ROUND {view.turn_index.padStart(2,'0')}</span><strong>{soloTurnTimes.find(time=>time.id===soloTurnTime)?.value}</strong></header>
   <section className="battle-arena" data-seat-count={view.participants.length} aria-live="polite">
    <div className="arena-surface" aria-hidden="true"><img src="assets/battle/battle-table-v1.webp" alt=""/></div>
    {opponents.map((player,index)=>{const position=seatPosition[index]||[50,9];const edge=position[0]<25?'left':position[0]>75?'right':'top';return <article key={player.player_id} className={`arena-seat opponent-seat seat-${edge} ${player.alive?'':'out'}`} data-seat-edge={edge} style={{'--seat-x':`${position[0]}%`,'--seat-y':`${position[1]}%`} as React.CSSProperties}>{moveTrail(player)}<footer className="seat-profile"><header><Avatar id={player.avatar_id}/><span><strong>{player.nickname}</strong><small>{player.alive?(player.submission_state==='submitted'?'已出牌':'等待出牌'):'已淘汰'}</small></span></header><div className="seat-tools"><button type="button" className="seat-resources" onClick={()=>setResourcePlayer(player.player_id)} aria-label={`${player.nickname}的公开资源`}>DD {ddText(player.resources.dd6)}<small>雷 {player.resources.lightning} · 充 {player.resources.nx_charge} · 弹 {player.resources.mature_bombs}</small></button><button type="button" className="seat-social" disabled title="互动功能稍后开放" aria-label={`${player.nickname}的互动功能尚未开放`}>通信</button></div></footer></article>;})}
    {self&&<article className="arena-seat self-seat seat-bottom" data-seat-edge="bottom">{moveTrail(self)}<footer className="seat-profile"><header><Avatar id={self.avatar_id}/><span><strong>{self.nickname}</strong><small>{view.submitted?'已出牌':'你的席位'}</small></span></header><div className="seat-tools"><button type="button" className="seat-resources" onClick={()=>setResourcePlayer(self.player_id)} aria-label={`${self.nickname}的资源`}>DD {ddText(self.resources.dd6)}<small>雷 {self.resources.lightning} · 充 {self.resources.nx_charge} · 弹 {self.resources.mature_bombs}</small></button><button type="button" className="seat-social" disabled title="互动功能稍后开放" aria-label="本机互动功能尚未开放">通信</button></div></footer></article>}
    <section className="arena-center summary"><span className="eyebrow">第 {view.turn_index} 拍 · {view.phase==='revealed'?'共同揭晓':view.submitted?'等待揭晓':'选择出招'}</span><p>{view.summary[0]}</p><details><summary>查看本拍记录</summary>{view.summary.map((s,i)=><p key={i}>{s}</p>)}<small>局号：{view.game_id}</small></details></section>
    {selectingUi&&<section className="selection-stage" aria-label="本拍待选择卡牌"><div className="selection-history" aria-label="最近出牌记录">{selfHistory.map((move,index)=><span key={`${move.turn}-${move.entryId}`} tabIndex={0} aria-label={`第 ${move.turn} 拍：${move.name}`} style={{'--history-index':String(index)} as React.CSSProperties}><img src={`assets/moves/${move.entryId}.png`} alt=""/><strong>{move.name}</strong><small>R{move.turn.padStart(2,'0')}</small></span>)}</div>{showcaseCard(selected,'selection-card')}</section>}
    {self&&['selecting','error','submitting'].includes(view.phase)&&<div className="selection-identity" aria-label="本机玩家"><Avatar id={self.avatar_id}/><span><strong>{self.nickname}</strong><small>本机席位</small></span></div>}
    {view.phase==='submitting'&&selected&&showcaseCard(selected,'commit-flight')}
   </section>
   {!!view.options.length?<section className="battle-operation" aria-label="出牌操作区" aria-hidden={!selectingUi}>
    {self&&<section className="self-strip battle-resources"><div className="resource-kicker"><b>本拍资源</b><small>{self.alive?'实时可用':'等待下一场'}</small></div><div className="resources"><b title={`DD ${ddText(self.resources.dd6)}`}>DD <em>{ddText(self.resources.dd6)}</em></b><span>雷 {self.resources.lightning}</span><span>充 {self.resources.nx_charge}</span><span>弹 {self.resources.mature_bombs}</span><span>奖 {self.resources.reward_stock}</span><button className="resource-more" disabled={!selectingUi} onClick={()=>setResourcePlayer(self.player_id)}>资源详情</button></div></section>}
    <div className="turn-strip battle-turn"><span>{soloTurnTimes.find(time=>time.id===soloTurnTime)?.value} 回合</span><progress max={view.timer.total_ms||1} value={view.timer.remaining_ms??1}/><span>{selected?`已选 ${selected.name}`:'选择本拍招式'}</span></div>
    <div className="card-groups battle-cards">{groups.map(group=><section className={`card-group ${group}`} key={group}><h3>{groupName[group]} <span>{view.options.filter(o=>o.ui_group===group).length}</span></h3><div className="cards">{ordered.filter(o=>o.ui_group===group).map(o=>{const label=compactMoveName(o.name);return <article key={o.entry_id} className={`card ${o.available?'':'unavailable'} ${selected?.entry_id===o.entry_id?'selected':''}`} data-entry={o.entry_id}><button className="card-pick" disabled={!o.available||!editable} aria-pressed={selected?.entry_id===o.entry_id} aria-label={`${o.available?'选择':'不可用'} ${o.name}${o.available?'':`：${reasons[o.reason_code||'']||'条件不足'}`}`} onClick={()=>choose(o.entry_id)}><img src={`assets/moves/${o.entry_id}.png`} alt=""/><strong>{!!label.tags.length&&<span className="card-tags">{label.tags.map(tag=><em key={tag}>{tag}</em>)}</span>}<span className="card-name">{label.label}</span></strong></button></article>;})}</div></section>)}</div>
    <footer className="table-actions battle-actions"><small>数字键 1–0 选择 · Enter 提交</small><span>{ordered.filter(o=>o.available).length} / 33 可用</span><button className="primary" disabled={!editable||!selected} onClick={()=>void submit()}>{view.submitted?'已提交':view.phase==='error'?'重试提交':'确认出招'}</button></footer>
   </section>:<section className="spectating"><h2>{self?'你已淘汰，等待下一场。':'你正在观看公开演示。'}</h2><p>观战不显示手牌，也不接受选招快捷键。</p><button disabled={sceneChangePending.current} onClick={()=>void leave()}>退出观战</button></section>}
  </main>}
  {page==='result'&&view?.outcome&&<main className="center"><section className="paper results"><span className="eyebrow">P09 · 整场结果 · {live?'真实规则结算':'固定演示脚本'}</span><h1>{view.outcome.winner_id?'这一场，有人留下。':'全员淘汰，无人获胜。'}</h1>{view.outcome.winner_id&&<div className="winner"><Avatar id={view.participants.find(p=>p.player_id===view.outcome!.winner_id)?.avatar_id}/><h2>{view.participants.find(p=>p.player_id===view.outcome!.winner_id)?.nickname}</h2><p>唯一赢家</p></div>}<p>{live?'本场参赛名单':'演示参赛名单'} · {view.participants.length} 人</p><ul className="roster">{view.participants.map(p=><li key={p.player_id}>{p.nickname}<span>{p.player_id===view.outcome!.winner_id?'获胜':'已淘汰'}</span></li>)}</ul>{live?<details className="result-summary"><summary>查看最后一拍账目</summary>{view.summary.map((line,i)=><p key={i}>{line}</p>)}</details>:<p>这是脚本结果，未运行真实胜负逻辑。</p>}<button className="primary" disabled={busy} onClick={()=>view.participants.length===2?void start():void preview('initial')}>再来一场{view.participants.length===6?'预览':''}</button><button disabled={sceneChangePending.current} onClick={()=>void leave()}>返回主菜单</button></section></main>}
  {page==='settings'&&<main className="settings-layout"><header className="settings-heading"><button className="settings-back" disabled={saving} onClick={closeSettings}><span>返回主菜单</span></button><span>CONFIGURATION</span><h1>设置</h1><p>调整这台电脑上的游戏体验。</p></header><nav aria-label="设置分类">{([['声音','AUDIO'],['窗口','DISPLAY'],['昵称头像','PROFILE'],['关于','ABOUT']] as const).map(([t,en])=><button key={t} aria-pressed={settingsTab===t} onClick={()=>setSettingsTab(t)}><span>{t}</span><small>{en}</small></button>)}</nav><section className="settings-content"><header><span>LOCAL PREFERENCES</span><h2>{settingsTab}</h2></header><fieldset disabled={saving}><div className="settings-tab-panel" key={settingsTab}>{settingsTab==='声音'?<><p>音源尚未加入。音量会真实保存，当前没有试听声音。</p>{(['music','effects'] as const).map(k=><label className="settings-range" key={k}><span>{k==='music'?'音乐':'音效'}<b>{settings[k]}%</b></span><input type="range" aria-label={k==='music'?'音乐音量':'音效音量'} min="0" max="100" value={settings[k]} style={{'--range-value':`${settings[k]}%`} as React.CSSProperties} onChange={e=>setSettings({...settings,[k]:Number(e.target.value)})}/></label>)}</>:settingsTab==='窗口'?<><label className="checkbox"><input type="checkbox" checked={settings.fullscreen} onChange={e=>setSettings({...settings,fullscreen:e.target.checked})}/><span>保存后使用全屏<small>下次启动时应用</small></span></label><p>窗口模式可拖动边缘调整大小。目标内容区 1366×768 / 1920×1080。</p></>:settingsTab==='昵称头像'?<Identity nickname={nickname} avatar={avatar} onName={setNickname} onAvatar={setAvatar}/>:<><h3>DeiDei 桌面原型</h3><p>经典规则 1.0.1</p><p>本机档案和设置可以保存。单人对局已接入真实规则和临时随机对手，好友房支持本机开发服务连接。</p><p>当前使用原创分层美术与系统字体。</p></>}</div></fieldset><footer><span>{dirty?'有未保存的修改':'已与本机档案同步'}</span><button className="settings-action settings-close" disabled={saving} onClick={closeSettings}><span>关闭</span></button><button className="settings-action settings-save primary" aria-busy={saving} disabled={saving||!dirty} onClick={()=>void save()}><span>{saving?'保存中…':'保存并关闭'}</span></button></footer></section></main>}
  {page==='manual'&&<main className="manual"><header><div><span className="eyebrow">TACTICAL ARCHIVE · 经典规则 1.0.1</span><h1>招式图鉴</h1><p>把每一种出招，当成一件可以拆读的战术器物。</p></div><button disabled={sceneChangePending.current} onClick={()=>navigate(()=>setPage(returnPage))}>返回</button></header><section className="manual-banner"><span>ARCHIVE / 33</span><strong>攒一拍，再出招。</strong><p>先看轮廓，再读代价。点击任意招式查看资格、实付与对应条款。</p></section><div className="manual-tools"><input aria-label="搜索招式" placeholder="搜索招式名称、说明…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="manual-categories" aria-label="招式分类">{([['all','全部'],...groups.map(g=>[g,groupName[g]])] as [string,string][]).map(([id,name])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{name}</button>)}</div><button onClick={()=>setRule('all')}>打开完整条款</button></div><p className="manual-note">特殊记录：强化削需持有 1/3 DD，实付 0；张新伟复制聂湘时不要求、也不扣聂湘充能。</p><div className="manual-list">{manual?.entries.filter(o=>(category==='all'||o.ui_group===category)&&`${o.name}${o.description}`.toLowerCase().includes(search.toLowerCase())).map(o=><button className={`manual-card ${o.ui_group}`} key={o.entry_id} onClick={()=>setDetail(o)}><img className="manual-icon" src={`assets/moves/${o.entry_id}.png`} alt="" loading="lazy"/><span className="manual-card-copy"><small>{o.doc_id} · {groupName[o.ui_group]}</small><h3>{o.name}</h3><p>{o.description}</p><em>实付 {o.cost_text}</em></span><i aria-hidden="true">›</i></button>)}</div>{manual&&!manual.entries.some(o=>(category==='all'||o.ui_group===category)&&`${o.name}${o.description}`.toLowerCase().includes(search.toLowerCase()))&&<p className="manual-empty">没有匹配的招式。换一个关键词，或切回全部图鉴。</p>}</main>}
  {modal&&<Modal title={modal==='preview'?'开发场景':modal==='settings-close'?'还有未保存的修改':modal==='recover'?'备份并重建档案':'离开当前对局'} closeDisabled={sceneChangePending.current||saving} onClose={()=>navigate(()=>{if(!saving)setModal('');})}>
   {error&&<p role="alert">{error}</p>}{modal==='preview'?<><p>这里是固定脚本演示，尚未开放多人对战。切换场景将结束当前对局，进度不会保存。</p><div className="scene-grid">{([['initial','P07 · 初始 A / 12 可用'],['midgame','P07 · 中局 B / 26 可用'],['spectator','P08 · 普通观众'],['eliminated','P08 · 本人已淘汰'],['restart','P08 · 淘汰后存活者新局'],['winner','P09 · 唯一赢家'],['draw','P09 · 全员淘汰'],['invalid','P07 · 提交失败后重试']] as [Scene,string][]).map(([s,label])=><button key={s} disabled={busy} aria-pressed={scene===s} onClick={()=>void preview(s)}>{label}</button>)}</div></>:modal==='settings-close'?<><p>可以继续编辑，也可以保存或放弃这次修改。</p><button onClick={()=>setModal('')}>继续编辑</button><button disabled={saving} onClick={()=>{setModal('');setPage(returnPage);setError('');}}>不保存关闭</button><button className="primary" disabled={saving} onClick={()=>void save()}>保存关闭</button></>:modal==='recover'?<><p>先备份损坏的原文件，再创建新档案。原昵称和设置不会自动迁移。</p><button disabled={saving} onClick={()=>setModal('')}>继续检查</button><button className="primary" disabled={saving} onClick={()=>void save(true)}>确认备份并重建</button></>:<><p>本次对局进度不会保存。本机档案和设置仍保留。</p><button onClick={()=>setModal('')}>继续{live?'对局':'演示'}</button><button className="primary" disabled={sceneChangePending.current} onClick={()=>void leave()}>离开</button></>}
  </Modal>}
  {detail&&<Modal title={`${detail.doc_id} · ${detail.name}`} onClose={()=>setDetail(null)}><p>{detailEntry?.description}</p><dl><dt>需要持有 / 资格</dt><dd>{detail.requirement_text}</dd><dt>实际花费</dt><dd>{detail.cost_text}</dd><dt>{page==='manual'?'开局示例状态':live?'本拍真实资格':'此静态样例的状态'}</dt><dd>{detail.available?'可用':reasons[detail.reason_code||'']||'不可用'}</dd></dl>{detail.entry_id==='ZhangXinWei'&&<p>复制聂湘也不需充能，实际充能支出为 0；仍须本局未用且有有效复制记录。</p>}<button onClick={()=>{setRule(detail.detail_rule_ids[0]);setDetail(null);}}>阅读条款 {detail.detail_rule_ids.join(' / ')}</button></Modal>}
  {resourceDetail&&<Modal title={`${resourceDetail.nickname} · 公开资源`} onClose={()=>setResourcePlayer('')}><dl>{Object.entries({DD:ddText(resourceDetail.resources.dd6),雷电:resourceDetail.resources.lightning,聂湘充能:resourceDetail.resources.nx_charge,成熟炸药:resourceDetail.resources.mature_bombs,奖励:resourceDetail.resources.reward_stock,强化削:resourceDetail.resources.enhanced_xiao?'有':'无',云使用次数:resourceDetail.resources.cloud_uses,田利军使用次数:resourceDetail.resources.tian_uses,炸药放置次数:resourceDetail.resources.bomb_placement_count}).map(([key,value])=><React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl><p>{view?.summary.find(line=>line.startsWith(resourceDetail.player_id===view.self_id?'本人进度：':`${resourceDetail.nickname}进度：`))}</p></Modal>}
  {rule&&<Modal title="本地完整条款 · 经典规则 1.0.1" onClose={()=>setRule('')}><nav className="rule-nav">{manual?.sections.map(s=><button key={s.id} aria-pressed={rule===s.id} onClick={()=>setRule(s.id)}>{s.id}</button>)}</nav>{manual?.sections.filter(s=>rule==='all'||rule===s.id).map(s=><section key={s.id}><h3>{s.id}</h3><pre>{s.text}</pre></section>)}</Modal>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
