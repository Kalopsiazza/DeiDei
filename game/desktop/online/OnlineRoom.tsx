import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DesktopView, Manual } from '../types';
import type { Role } from './types';
import { useOnlineSession } from './useOnlineSession';
import { canSelect, canSetTurnLimit, hostRecoveryText, describeError, onlineBattleView, optionsFor, startReason } from './model';
import { shortcutEntry } from '../interaction';
import { emptyHistory, historyGaps, recordPublicRound } from '../view-loop';
import { BattleStage, MatchResult, SituationDialog, type ModalComponent } from '../BattleStage';
const api=window.desktop.online;
type Props={manual:Manual;onExit:()=>void;onScene:(scene:string)=>void;Avatar:React.ComponentType<{id?:string}>;Modal:ModalComponent};
export function OnlineRoom({manual,onExit,onScene,Avatar,Modal}:Props) {
 const {state,currentState,form,setForm,error,setError,code,setCode,password,setPassword,role,setRole,turnMs,setTurnMs,early,setEarly,cap,setCap,limitMs,setLimitMs,limitRevision,setLimitRevision,selected,setSelected,notice,setNotice,now,busy,activeRoom,connected,blocked,exitBlocked,run,leave:leaveRoom,reconnect,remaining,hostRemaining}=useOnlineSession(onExit);
 const [limitOpen,setLimitOpen]=useState(false),[leaveConfirm,setLeaveConfirm]=useState(false);
 const [matchMenu,setMatchMenu]=useState(false),[situationOpen,setSituationOpen]=useState(false),[history,setHistory]=useState(emptyHistory);
 const [enteredMatch,setEnteredMatch]=useState(''),[arenaReady,setArenaReady]=useState(false),[resultLeaving,setResultLeaving]=useState(false),[resultVisible,setResultVisible]=useState(''),[introUntil,setIntroUntil]=useState(0);
 const lastBattle=useRef<DesktopView|null>(null),resultTimer=useRef<number|null>(null),resultLock=useRef(false),resultAlive=useRef(true);
 const snapshot=state.snapshot,v=snapshot?.view,me=v?.members.find(p=>p.player_id===v.self.player_id),host=!!v&&v.host_id===v.self.player_id;
 const editable=canSelect(state,remaining)&&!busy&&arenaReady&&enteredMatch===v?.match?.match_id;
 const options=optionsFor(snapshot,manual),picked=options.find(o=>o.entry_id===selected);
 useEffect(()=>{if(state.membership_end){setLimitOpen(false);setLeaveConfirm(false);}},[state.membership_end?.event_id]);
 const submit=()=>{if(!snapshot||!v?.match||!picked?.available||!editable||picked.forced)return;void run(()=>api.submit({room_id:snapshot.room_id,match_id:v.match!.match_id,turn_id:v.match!.turn_id,entry_id:picked.entry_id}));};
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||leaveConfirm||limitOpen||!editable||(e.target as HTMLElement).closest('input,textarea,select,dialog,button:not(.card-pick),[contenteditable="true"]'))return;
   const id=shortcutEntry(options,e.key,false);if(id){e.preventDefault();setSelected(id);}else if(e.key==='Enter'){e.preventDefault();submit();}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 const leave=async()=>{setLeaveConfirm(false);return leaveRoom();};
 const confirmLeave=()=>{setLeaveConfirm(false);if(v?.phase==='result'&&connected)transitionResult(leave);else void leave();};
 const join=(chosen:Role)=>{setRole(chosen);void run(()=>api.join({room_code:code.trim().toUpperCase(),password:password||null,role:chosen}));};
 const recoveryText=snapshot?hostRecoveryText(snapshot,hostRemaining):'';
 const closingText=v?.pending_close?`房主已离开，${v.pending_close.after==='current_turn'?'本拍结算后':'本拍揭晓结束后'}关闭房间。`:'';
 const futureText=v?.current_turn_ms&&v.current_turn_ms!==v.policy.turn_ms?`本拍按原时限 ${v.current_turn_ms/1000} 秒结束；之后每拍 ${v.policy.turn_ms/1000} 秒。`:'';
 const onlineError=error||(state.error?describeError(state.error.code):'');
 const moveHistory=history.moves;
 const adapted=onlineBattleView(state,manual,remaining);
 const battleView=adapted?{...adapted,selected_entry_id:selected||adapted.selected_entry_id}:null;
 useEffect(()=>{if(adapted)setHistory(previous=>recordPublicRound(previous,adapted,manual));},[state.snapshot,manual]);
 const introMatch=adapted&&adapted.phase!=='result'?adapted.match_id:'';
 useEffect(()=>{
  if(!introMatch||enteredMatch===introMatch)return;
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?300:2600;
  setIntroUntil(performance.now()+delay);
  const timer=window.setTimeout(()=>setEnteredMatch(introMatch),delay);
  return()=>window.clearTimeout(timer);
 },[introMatch,enteredMatch]);
 // Keep only the last public table while glass masks the result handoff.
 useEffect(()=>{if(battleView&&battleView.phase!=='result')lastBattle.current=battleView;});
 useEffect(()=>{
  if(adapted?.phase!=='result'){setResultVisible('');return;}
  const timer=window.setTimeout(()=>setResultVisible(adapted.match_id),window.matchMedia('(prefers-reduced-motion: reduce)').matches?100:650);
  return()=>window.clearTimeout(timer);
 },[adapted?.phase,adapted?.match_id]);
 const camera=!activeRoom?(form==='entry'?'front':form):v?.phase==='lobby'||!adapted?'lobby':adapted?.phase==='result'?(resultLeaving?'leaving':resultVisible===adapted.match_id?'result':'result-cover'):enteredMatch===adapted?.match_id?'table':'intro';
 useLayoutEffect(()=>{onScene(camera);},[camera,onScene]);
 useEffect(()=>{
  if(!adapted||enteredMatch!==adapted.match_id){setArenaReady(false);return;}
  setArenaReady(false);
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?30:650;
  const timer=window.setTimeout(()=>setArenaReady(true),delay);
  return()=>window.clearTimeout(timer);
 },[adapted?.match_id,enteredMatch]);
 const resultKey=snapshot?`${snapshot.room_id}/${v?.match?.match_id}/${v?.phase}`:'';
 const cancelResult=()=>{if(resultTimer.current!==null)window.clearTimeout(resultTimer.current);resultTimer.current=null;resultLock.current=false;setResultLeaving(false);};
 useEffect(()=>{cancelResult();return()=>{if(resultTimer.current!==null)window.clearTimeout(resultTimer.current);resultTimer.current=null;resultLock.current=false;};},[resultKey]);
 useEffect(()=>{resultAlive.current=true;return()=>{resultAlive.current=false;};},[]);
 useEffect(()=>{if((state.error&&!state.pending)||state.status!=='connected')cancelResult();},[state.error,state.pending,state.status]);
 const transitionResult=(action:()=>Promise<boolean>)=>{
  if(resultLock.current||v?.phase!=='result'||!connected)return;
  const key=resultKey;resultLock.current=true;setResultLeaving(true);
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?150:720;
  resultTimer.current=window.setTimeout(async()=>{
   resultTimer.current=null;
   const latest=currentState.current,s=latest.snapshot,currentKey=s?`${s.room_id}/${s.view.match?.match_id}/${s.view.phase}`:'';
   if(!resultLock.current||currentKey!==key||latest.status!=='connected'){if(resultAlive.current)cancelResult();return;}
   const ok=await action();
   const after=currentState.current.snapshot,afterKey=after?`${after.room_id}/${after.view.match?.match_id}/${after.view.phase}`:'';
   if(!ok&&resultAlive.current&&afterKey===key)cancelResult();
  },delay);
 };
 if(!activeRoom){
  const allowed=state.hello?.capabilities.allowed_turn_ms||[turnMs],scene=form==='entry'?'front':form;
  const status=({idle:'尚未连接',connecting:'连接中…',connected:'已连接',reconnecting:'网络暂断 · 重连中…',unavailable:'服务不可用'})[state.status];
  const nearestTurn=(value:number)=>allowed.reduce((best,next)=>Math.abs(next-value)<Math.abs(best-value)?next:best,allowed[0]);
  return <main className="online online-portal" data-online-scene={scene} data-source={state.source} data-pending={busy||state.pending?'true':'false'}>
   <nav className="online-portal-nav" aria-label="联机导航">
    <button type="button" className="settings-back" aria-label={form==='entry'?'返回主菜单':'返回联机前厅'} disabled={exitBlocked} onClick={()=>form==='entry'?leave():(setForm('entry'),setError(''))}><span>{form==='entry'?'返回主菜单':'返回联机前厅'}</span></button>
    <div><span className="online-signal" aria-hidden="true"/><span role="status">{status}{state.pending?' · 操作确认中…':''}</span>{state.source==='fixture'&&<b>MOCK</b>}</div>
   </nav>
   <section className="online-portal-copy">
    <span className="eyebrow">{form==='entry'?'MULTIPLAYER / ATRIUM':form==='create'?'HOST / DEPLOY':'ACCESS / LINK'}</span>
    <h1>{form==='entry'?'联机前厅':form==='create'?'房间部署':'房间接入'}</h1>
    <p>{form==='entry'?'叫上朋友，一起出招。':form==='create'?'定好节奏，等朋友入席。':'凭房间号，接入朋友的牌局。'}</p>
   </section>
   {onlineError&&<p className="online-portal-error" role="alert">{onlineError}</p>}
   {state.membership_end&&<p className="online-portal-notice" role="status">已离开房间 {state.membership_end.room_code||state.membership_end.room_id}：{state.membership_end.reason==='three_absences'?'连续三拍缺席，已在当拍结算后移除。':'断线恢复时间已过，席位已释放。'}</p>}
   {form==='entry'?<section className="online-front-actions" aria-label="选择联机方式">
    <button type="button" className="menu-option menu-option-primary" aria-label="创建房间" disabled={!connected||busy} onClick={()=>setForm('create')}><span><b>创建房间</b><small>部署规则与开放席位</small></span><em>01</em></button>
    <button type="button" className="menu-option menu-option-secondary" aria-label="加入房间" disabled={!connected||busy} onClick={()=>setForm('join')}><span><b>加入房间</b><small>用房间号接入牌局</small></span><em>02</em></button>
    {(state.status==='unavailable'||state.status==='idle')&&<button type="button" className="settings-action online-retry" aria-label="重新连接" disabled={busy} onClick={reconnect}>重新连接</button>}
   </section>:<form className={`online-deploy online-deploy-${form}`} onSubmit={e=>{e.preventDefault();if(blocked)return;if(form==='join')join(role);else void run(()=>api.create({password:password||null,options:{turn_ms:turnMs,early_reveal:early,spectator_cap:cap}}));}}>
    <fieldset disabled={blocked}>
     {form==='create'?<>
      <label className="online-control online-turn settings-range"><span>每拍时间</span><b>{turnMs/1000} 秒</b><input type="range" aria-label="每拍时间" min={allowed[0]} max={allowed.at(-1)} step="1000" list="online-turn-values" value={turnMs} onChange={e=>setTurnMs(nearestTurn(Number(e.target.value)))}/><datalist id="online-turn-values">{allowed.map(ms=><option key={ms} value={ms}/>)}</datalist><small>{allowed.map(ms=>`${ms/1000}s`).join(' · ')}</small></label>
      <label className="online-switch"><input type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/><span>全员提交后提前揭晓</span></label>
      <label className="online-control settings-range"><span>观战容量</span><b>{cap} 人</b><input type="range" aria-label="观众容量" min="0" max={state.hello?.capabilities.spectator_max||0} value={cap} onChange={e=>setCap(Number(e.target.value))}/></label>
     </>:<>
      <label className="online-control online-code"><span>房间号</span><input aria-label="房间号" value={code} maxLength={16} onChange={e=>setCode(e.target.value)} autoComplete="off" placeholder="ABCD2345" required/></label>
      <fieldset className="online-role"><legend>加入身份</legend><label><input type="radio" name="online-role" value="player" checked={role==='player'} onChange={()=>setRole('player')}/><span>参战</span></label><label><input type="radio" name="online-role" value="spectator" checked={role==='spectator'} onChange={()=>setRole('spectator')}/><span>观战</span></label></fieldset>
     </>}
     <label className="online-control online-password"><span>房间密码 <small>可选</small></span><input type="password" aria-label="房间密码" value={password} maxLength={64} onChange={e=>setPassword(e.target.value)} autoComplete="off"/></label>
     {form==='join'&&['ROOM_FULL','MATCH_IN_PROGRESS'].includes(state.error?.code||'')&&<button type="button" className="settings-action online-spectate" aria-label="以观众身份尝试加入" onClick={()=>join('spectator')}>以观众身份尝试加入</button>}
     <button type="submit" className="primary prepare-start online-deploy-submit" aria-label={state.pending?'确认中…':form==='create'?'创建并进入':'加入房间'}><span>{state.pending?'确认中…':form==='create'?'创建并进入':'加入房间'}</span><small>{form==='create'?'CREATE ROOM':'JOIN ROOM'}</small></button>
    </fieldset>
   </form>}
  </main>;
 }
 if(v?.phase==='lobby'&&snapshot&&me){
  const roster=Array.from({length:6},(_,index)=>v.members.find(member=>member.role==='player'&&member.seat===index));
  const spectators=v.members.filter(member=>member.role==='spectator'),reason=startReason(snapshot);
  return <main className="online online-room" data-phase="lobby" data-source={state.source} data-pending={busy||state.pending?'true':'false'}>
   <nav className="online-room-nav" aria-label="房间操作">
    <button type="button" className="settings-back" aria-label="退出房间" disabled={exitBlocked} onClick={()=>setLeaveConfirm(true)}><span>退出房间</span></button>
    <div><span className="online-signal" aria-hidden="true"/><span role="status">{state.status==='reconnecting'?'网络暂断 · 重连中…':'房间已连接'}</span>{state.source==='fixture'&&<b>MOCK</b>}</div>
   </nav>
   <section className="online-lobby" data-player-count={roster.filter(Boolean).length} aria-label="六人参战席位">
    <div className="online-beacon"><small>{v.has_password?'已加密房间':'开放房间'}</small><strong>{v.room_code}</strong><button type="button" className="settings-action" aria-label="复制房号" onClick={()=>void navigator.clipboard.writeText(v.room_code).then(()=>setNotice('房间号已复制。')).catch(()=>setNotice(`请手动复制房间号：${v.room_code}`))}>复制房号</button></div>
    {roster.map((member,index)=><article className="online-room-seat" key={index} data-seat={index} data-self={member?.player_id===v.self.player_id?'true':'false'} data-host={member?.player_id===v.host_id?'true':'false'} data-ready={member?.ready?'true':'false'} data-connected={member?.connected?'true':'false'}>
     {member?<><Avatar id={member.avatar_id}/><div><strong title={member.nickname}>{member.nickname}</strong><span>{member.player_id===v.self.player_id?'本人 · ':''}{member.player_id===v.host_id?'房主 · ':''}{member.connected?(member.ready?'已准备':'未准备'):'掉线'}</span></div></>:<><i>{String(index+1).padStart(2,'0')}</i><span>等待接入</span></>}
    </article>)}
   </section>
   <aside className="online-room-tools"><span>每拍 {v.policy.turn_ms/1000} 秒</span><span>{v.policy.early_reveal?'全员提交即揭晓':'到时揭晓'}</span>{canSetTurnLimit(state)&&<button type="button" className="settings-action" aria-label="调整时限" disabled={blocked} onClick={()=>{setLimitMs(v.policy.turn_ms);setLimitRevision(v.policy_revision);setLimitOpen(true);}}>调整时限</button>}</aside>
   <aside className="online-spectators"><small>观战席 {spectators.length} / {v.policy.spectator_cap}</small>{spectators.length?<ul>{spectators.map(member=><li key={member.player_id}><Avatar id={member.avatar_id}/><span title={member.nickname}>{member.nickname}</span>{!member.connected&&<small>掉线</small>}</li>)}</ul>:<span>暂无观众</span>}</aside>
   {(onlineError||recoveryText||notice)&&<p className={onlineError?'online-room-message is-error':'online-room-message'} role={onlineError?'alert':'status'}>{onlineError||recoveryText||notice}</p>}
   <footer className="online-room-actions">
    {me.role==='player'&&<button type="button" className="settings-action" aria-label={me.ready?'取消准备':'准备'} disabled={blocked} onClick={()=>void run(()=>api.ready({room_id:snapshot.room_id,ready:!me.ready}))}>{me.ready?'取消准备':'准备'}</button>}
    {!host&&<button type="button" className="settings-action" aria-label={me.role==='player'?'转为观众':'申请参战'} disabled={blocked||(me.role==='spectator'?roster.filter(Boolean).length>=6:spectators.length>=v.policy.spectator_cap)} onClick={()=>void run(()=>api.changeRole({room_id:snapshot.room_id,role:me.role==='player'?'spectator':'player'}))}>{me.role==='player'?'转为观众':'申请参战'}</button>}
    {host&&!v.pending_close&&<><button type="button" className="primary prepare-start" aria-label="开始对局" disabled={blocked||!!reason} onClick={()=>void run(()=>api.start({room_id:snapshot.room_id}))}><span>开始对局</span><small>ENTER MATCH</small></button><span>{reason||'全员就绪，可以开局。'}</span></>}
   </footer>
   {limitOpen&&canSetTurnLimit(state)&&<Modal title="调整之后每拍时限" onClose={()=>setLimitOpen(false)} closeDisabled={busy}><label>之后每拍时限<select aria-label="之后每拍时限" value={limitMs} onChange={e=>setLimitMs(Number(e.target.value))}>{state.hello?.capabilities.allowed_turn_ms.map(ms=><option key={ms} value={ms}>{ms/1000} 秒</option>)}</select></label>{error&&<p role="alert">{error}</p>}<button disabled={blocked} className="primary" onClick={()=>void run(async()=>{const result=await api.setTurnLimit({room_id:snapshot.room_id,turn_ms:limitMs,expected_policy_revision:limitRevision});if(result.ok)setLimitOpen(false);return result;})}>应用到之后每拍</button></Modal>}
   {leaveConfirm&&<Modal title={host?'结束整个房间？':'退出房间？'} onClose={()=>setLeaveConfirm(false)} closeDisabled={busy&&connected}><p>{host?'退出将结束房间，并让所有人离开。':'离开后将结束本次参战或观战；本机档案保留。'}{!connected?' 当前网络已断开，离开将停止重连；服务按掉线策略处理原席位。':''}</p><button onClick={()=>setLeaveConfirm(false)}>留在房间</button><button className="primary" disabled={exitBlocked} onClick={confirmLeave}>{host?'确认结束房间':'确认退出房间'}</button></Modal>}
  </main>;
 }
 if(v?.match&&snapshot&&battleView){
  const canAdjust=canSetTurnLimit(state),showIntro=battleView.phase!=='result'&&enteredMatch!==battleView.match_id;
  return <div className="online-match" data-source={state.source} data-room={v.room_code} data-arena-ready={arenaReady}>
   {showIntro
    ?<main className="online-intro" data-player-count={battleView.participants.length} aria-label="多人对局入场"><header><span>MULTIPLAYER MATCH</span><h1>进入擂台</h1><p>经典规则 · 每拍 {v.policy.turn_ms/1000} 秒 · {v.policy.early_reveal?'全员提交即揭晓':'到时揭晓'}</p></header><section className="online-intro-roster" aria-label="本场参战席位">{battleView.participants.map((player,index)=><article className="online-intro-player" key={player.player_id} data-seat={index} data-self={player.player_id===battleView.self_id} style={{'--intro-seat':String(index)} as React.CSSProperties}><Avatar id={player.avatar_id}/><span><small>{player.player_id===battleView.self_id?'你 · 本机席位':`席位 ${index+1}`}</small><strong>{player.nickname}</strong></span></article>)}</section><button className="cinematic-skip" onClick={()=>setEnteredMatch(battleView.match_id)}>立即入场（{Math.max(0,Math.ceil((introUntil-now)/1000))}s） <small>SKIP</small></button></main>
    :battleView.phase==='result'&&resultVisible===battleView.match_id
     ?<MatchResult view={battleView} moveHistory={moveHistory} leaving={resultLeaving} Avatar={Avatar} onReview={()=>setSituationOpen(true)} onPrimary={()=>transitionResult(()=>run(()=>api.returnLobby({room_id:snapshot.room_id})))} onExit={()=>setLeaveConfirm(true)} exitDisabled={exitBlocked} primaryLabel={host&&!v.pending_close?'准备下一局':'等待房主开启下一局'} primaryDisabled={!host||!!v.pending_close||blocked}/>
     :<BattleStage view={battleView.phase==='result'&&lastBattle.current?.match_id===battleView.match_id?lastBattle.current:battleView} manual={manual} moveHistory={moveHistory} mode="online" ready={arenaReady} exiting={battleView.phase==='result'} suspended={false} frozen={false} busy={blocked||(!editable&&battleView.phase==='selecting'&&!!battleView.options.length)} revealSeconds={Math.max(0,Math.ceil((remaining||0)/1000))} Avatar={Avatar} onSelect={setSelected} onSubmit={submit} onPause={()=>setMatchMenu(true)} onFreeze={()=>{}} onSituation={()=>setSituationOpen(true)}/>}
   <aside className="online-match-controls" aria-label="联机房间状态"><span>房间 {v.room_code}</span><span>每拍 {v.policy.turn_ms/1000} 秒</span><span>{state.status==='reconnecting'?'网络暂断 · 重连中…':'房间已连接'}</span>{canAdjust&&<button type="button" className="settings-action" aria-label="调整时限" disabled={blocked} onClick={()=>{setLimitMs(v.policy.turn_ms);setLimitRevision(v.policy_revision);setLimitOpen(true);}}>调整时限</button>}</aside>
   {(onlineError||recoveryText||closingText||futureText)&&<p className={onlineError?'online-match-notice is-error':'online-match-notice'} role={onlineError?'alert':'status'}>{onlineError||closingText||recoveryText} {futureText}</p>}
   {matchMenu&&<Modal className="battle-dialog pause-dialog" title="对局菜单" onClose={()=>setMatchMenu(false)}><section className="pause-state"><span>ONLINE MENU</span><h3>牌局仍在继续</h3><p>多人模式打开菜单不会暂停牌局，返回后以服务端当前状态为准。</p></section><div className="pause-actions"><button className="primary" onClick={()=>setMatchMenu(false)}>继续游戏<small>RESUME</small></button><button disabled={!canAdjust} onClick={()=>{setMatchMenu(false);setLimitMs(v.policy.turn_ms);setLimitRevision(v.policy_revision);setLimitOpen(true);}}>房间游戏设置<small>ROOM SETTINGS</small></button><button className="danger" onClick={()=>{setMatchMenu(false);setLeaveConfirm(true);}}>退出游戏<small>LEAVE MATCH</small></button></div></Modal>}
   {situationOpen&&<SituationDialog view={battleView} manual={manual} moveHistory={moveHistory} gaps={historyGaps(history,battleView)} Modal={Modal} Avatar={Avatar} onClose={()=>setSituationOpen(false)}/>}
   {limitOpen&&canAdjust&&<Modal title="调整之后每拍时限" onClose={()=>setLimitOpen(false)} closeDisabled={busy}><p>{futureText||'从下一次选择阶段开始生效，本拍截止时间和已交牌保持不变。'}</p><label>之后每拍时限<select aria-label="之后每拍时限" value={limitMs} onChange={e=>setLimitMs(Number(e.target.value))}>{state.hello?.capabilities.allowed_turn_ms.map(ms=><option key={ms} value={ms}>{ms/1000} 秒</option>)}</select></label>{error&&<p role="alert">{error}</p>}<button disabled={blocked} className="primary" onClick={()=>void run(async()=>{const result=await api.setTurnLimit({room_id:snapshot.room_id,turn_ms:limitMs,expected_policy_revision:limitRevision});if(result.ok)setLimitOpen(false);return result;})}>应用到之后每拍</button></Modal>}
   {leaveConfirm&&<Modal title={host?'结束整个房间？':'退出房间？'} onClose={()=>setLeaveConfirm(false)} closeDisabled={busy&&connected}><p>{host?'退出将按服务策略在当前拍后或立即结束房间，并让所有人离开。':'离开后将结束本次参战或观战；本机档案保留。'}{!connected?' 当前网络已断开，离开将停止重连；服务按掉线策略处理原席位。':''}</p><button onClick={()=>setLeaveConfirm(false)}>留在房间</button><button className="primary" disabled={exitBlocked} onClick={confirmLeave}>{host?'确认结束房间':'确认退出房间'}</button></Modal>}
  </div>;
 }
 return <main className="online online-room" data-phase="syncing" data-source={state.source}>
  <nav className="online-room-nav" aria-label="房间操作"><button type="button" className="settings-back" aria-label="退出房间" disabled={exitBlocked} onClick={()=>setLeaveConfirm(true)}><span>退出房间</span></button><div><span className="online-signal" aria-hidden="true"/><span role="status">{state.status==='reconnecting'?'网络暂断 · 重连中…':'同步房间状态…'}</span>{state.source==='fixture'&&<b>MOCK</b>}</div></nav>
  <p className="online-room-message is-error" role="alert">{onlineError||'房间状态尚未就绪，正在等待服务端同步。'}</p>
  {leaveConfirm&&<Modal title={host?'结束整个房间？':'退出房间？'} onClose={()=>setLeaveConfirm(false)} closeDisabled={busy&&connected}><p>{host?'退出将按服务策略结束房间，并让所有人离开。':'离开后将结束本次参战或观战；本机档案保留。'}{!connected?' 当前网络已断开，离开将停止重连；服务按掉线策略处理原席位。':''}</p><button onClick={()=>setLeaveConfirm(false)}>留在房间</button><button className="primary" disabled={exitBlocked} onClick={confirmLeave}>{host?'确认结束房间':'确认退出房间'}</button></Modal>}
 </main>;
}
