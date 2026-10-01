import React, { useEffect, useRef, useState } from 'react';
import type { Manual, Option } from '../types';
import type { CorePlayer, Member, OnlineState, Role } from './types';
import { canSelect, canSetTurnLimit, hostRecoveryText, describeError, onlineBattleView, optionsFor, publicPlayers, remainingAt, startReason, turnSummary } from './model';
import { groups, orderedOptions, shortcutEntry } from '../interaction';
import { ddText } from '../view-loop';
import { BattleStage, MatchResult, SituationDialog, type ModalComponent, type PlayedMove } from '../BattleStage';
const api=window.desktop.online;
const initial:OnlineState={source:'online',status:'idle',hello:null,snapshot:null,pending:false,membership_end:null,host_remaining_ms:null,error:null,confirmed:null,remaining_ms:null,revision:0};
const groupName={attack:'攻击',defense:'防御',skill:'技能'};
const reasons:Record<string,string>={INSUFFICIENT_DD:'DD 不足',INSUFFICIENT_LIGHTNING:'雷电不足',INSUFFICIENT_CHARGE:'充能不足',INSUFFICIENT_BOMBS:'成熟层不足',ALREADY_USED:'本局已用',NO_COPY_RECORD:'没有复制记录',NO_REWARD:'奖励未就绪',FORCED_RECOVERY:'强制休整',NOT_ACTIVE:'已不在场'};
type Props={manual:Manual;onExit:()=>void;Avatar:React.ComponentType<{id?:string}>;Modal:ModalComponent};
export function OnlineRoom({manual,onExit,Avatar,Modal}:Props) {
 const [state,setState]=useState(initial),[form,setForm]=useState<'entry'|'create'|'join'>('entry'),[error,setError]=useState('');
 const [code,setCode]=useState(''),[password,setPassword]=useState(''),[role,setRole]=useState<Role>('player');
 const [turnMs,setTurnMs]=useState(10000),[early,setEarly]=useState(true),[cap,setCap]=useState(6);
 const [limitOpen,setLimitOpen]=useState(false),[limitMs,setLimitMs]=useState(10000),[limitRevision,setLimitRevision]=useState('1');
 const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<Option|null>(null),[resource,setResource]=useState<Member|null>(null),[leaveConfirm,setLeaveConfirm]=useState(false),[notice,setNotice]=useState('');
 const [matchMenu,setMatchMenu]=useState(false),[situationOpen,setSituationOpen]=useState(false),[moveHistory,setMoveHistory]=useState<Record<string,PlayedMove[]>>({});
 const [enteredMatch,setEnteredMatch]=useState(''),[arenaReady,setArenaReady]=useState(false),[resultLeaving,setResultLeaving]=useState(false);
 const [now,setNow]=useState(performance.now()),[busy,setBusy]=useState(false);
 const receipt=useRef(performance.now()),lock=useRef(false),alive=useRef(true),leaving=useRef(false),lastRevision=useRef(-1),lastPlayers=useRef(''),historyMatch=useRef(''),historyTurn=useRef(''),resultTimer=useRef<number|null>(null);
 const snapshot=state.snapshot,v=snapshot?.view,me=v?.members.find(p=>p.player_id===v.self.player_id),host=!!v&&v.host_id===v.self.player_id;
 const hostRemaining=state.host_remaining_ms===null?null:Math.max(0,state.host_remaining_ms-Math.max(0,now-receipt.current));
 const remaining=remainingAt(state,receipt.current,now),editable=canSelect(state,remaining)&&!busy;
 const options=optionsFor(snapshot,manual),ordered=orderedOptions(options),picked=options.find(o=>o.entry_id===selected);
 const matchKey=snapshot?`${snapshot.room_id}/${v?.match?.match_id}/${v?.match?.turn_id}/${v?.self.role}/${me?.participation}`:'';
 const activeRoom=!!v&&v.phase!=='closed'&&state.status!=='unavailable',blocked=busy||state.pending||state.status!=='connected';
 const accept=(next:OnlineState)=>{
  if(!alive.current||next.revision<lastRevision.current)return;
  lastRevision.current=next.revision;receipt.current=performance.now();setNow(receipt.current);setState(next);
  if(leaving.current&&!next.pending&&!next.snapshot){onExit();}
 };
 useEffect(()=>{
  alive.current=true;
  const unsub=api.onChange(accept);
  void api.openLobby().then(r=>{if(!alive.current)return;if(r.ok)accept(r.data);else setError(describeError(r.error));});
  const tick=setInterval(()=>setNow(performance.now()),100);
  return()=>{alive.current=false;unsub();clearInterval(tick);if(resultTimer.current!==null)window.clearTimeout(resultTimer.current);};
 },[]);
 useEffect(()=>{if(state.hello){setTurnMs(state.hello.policy_defaults.turn_ms);setEarly(state.hello.policy_defaults.early_reveal);setCap(state.hello.policy_defaults.spectator_cap);}},[state.hello?.policy_defaults.turn_ms,state.hello?.policy_defaults.early_reveal,state.hello?.policy_defaults.spectator_cap]);
 useEffect(()=>{if(state.membership_end){setForm('entry');setError('');setLimitOpen(false);setLeaveConfirm(false);}},[state.membership_end?.event_id]);
 useEffect(()=>{setSelected(null);setDetail(null);setResource(null);},[matchKey]);
 useEffect(()=>{if(activeRoom){setPassword('');setError('');}},[snapshot?.room_id]);
 useEffect(()=>{
  const players=v?.members.filter(p=>p.role==='player').map(p=>p.player_id).sort().join(',')||'';
  if(v?.phase==='lobby'&&lastPlayers.current&&players!==lastPlayers.current)setNotice('参战席位有变化，请大家重新准备。');
  lastPlayers.current=players;
 },[v?.members]);
 const run=async(action:()=>ReturnType<typeof api.read>)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const r=await action();if(alive.current){if(r.ok)accept(r.data);else setError(describeError(r.error));}}
  catch{if(alive.current)setError('操作未完成，请重试。');}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 };
 const submit=()=>{if(!snapshot||!v?.match||!picked?.available||!editable||picked.forced)return;void run(()=>api.submit({room_id:snapshot.room_id,match_id:v.match!.match_id,turn_id:v.match!.turn_id,entry_id:picked.entry_id}));};
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||detail||resource||leaveConfirm||limitOpen||!editable||(e.target as HTMLElement).closest('input,textarea,select,dialog,button:not(.card-pick),[contenteditable="true"]'))return;
   const id=shortcutEntry(options,e.key,false);if(id){e.preventDefault();setSelected(id);}else if(e.key==='Enter'){e.preventDefault();submit();}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 const leave=()=>{leaving.current=true;void run(()=>api.leave());setLeaveConfirm(false);};
 const join=(chosen:Role)=>{setRole(chosen);void run(()=>api.join({room_code:code.trim().toUpperCase(),password:password||null,role:chosen}));};
 const players=snapshot?publicPlayers(snapshot):{};
 const compact=(p:CorePlayer)=>`DD ${ddText(p.dd6)} · 雷 ${p.lightning} · 充 ${p.nx_charge} · 弹 ${p.mature_bombs} · 奖 ${p.zeng_state==='ready'?'1':'0'}`;
 const seat=(member:Member|undefined,index:number)=> <section key={index} className={`online-seat ${member?.player_id===v?.self.player_id?'my-seat':''}`}>
  {member?<><Avatar id={member.avatar_id}/><div><b>{member.nickname}{member.player_id===v?.self.player_id?' · 本人':''}{member.player_id===v?.host_id?' · 房主':''}</b><small>席位 {index+1} · {member.connected?'在线':'掉线'} · {v?.phase==='lobby'?(member.ready?'已准备':'未准备'):member.participation==='eliminated'?'本场已淘汰':member.participation==='departing'?'离房待结算':({submitted:'已提交 · 牌背',forced:'强制休整',thinking:'思考中',out:'已淘汰',none:'等待'}[member.submission_state])}</small>{players[member.player_id]&&<button className="seat-resources" aria-label={`${member.nickname}的公开资源`} title={compact(players[member.player_id])} onClick={()=>setResource(member)}>{compact(players[member.player_id])}</button>}</div></>:<><span className="empty-seat">{index+1}</span><small>等一位朋友</small></>}
 </section>;
 const summary=snapshot?turnSummary(snapshot,manual):[];
 const recoveryText=snapshot?hostRecoveryText(snapshot,hostRemaining):'';
 const closingText=v?.pending_close?`房主已离开，${v.pending_close.after==='current_turn'?'本拍结算后':'本拍揭晓结束后'}关闭房间。`:'';
 const futureText=v?.current_turn_ms&&v.current_turn_ms!==v.policy.turn_ms?`本拍按原时限 ${v.current_turn_ms/1000} 秒结束；之后每拍 ${v.policy.turn_ms/1000} 秒。`:'';
 const onlineError=error||(state.error?describeError(state.error.code):'');
 const connected=state.status==='connected';
 const selfResources=me&&players[me.player_id];
 const adapted=onlineBattleView(state,manual,remaining);
 const battleView=adapted?{...adapted,selected_entry_id:selected||adapted.selected_entry_id}:null;
 useEffect(()=>{
  if(!adapted)return;
  const currentMatch=`${adapted.match_id}/${adapted.game_id}`,turn=`${currentMatch}/${adapted.turn_index}`;
  const fresh=historyMatch.current!==currentMatch;
  if(fresh){historyMatch.current=currentMatch;historyTurn.current='';setMoveHistory({});}
  if(!['revealed','result'].includes(adapted.phase)||historyTurn.current===turn)return;
  historyTurn.current=turn;
  setMoveHistory(previous=>adapted.participants.reduce<Record<string,PlayedMove[]>>((next,player)=>{
   const prefix=`${player.nickname}：`,name=adapted.summary.find(line=>line.startsWith(prefix))?.slice(prefix.length).split(' → ',1)[0].replace(/[。.]$/,'')||'';
   const entry=manual.entries.find(item=>name===item.name||name.startsWith(item.name));
   return name&&entry?{...next,[player.player_id]:[...(next[player.player_id]||[]),{turn:adapted.turn_index,name,entryId:entry.entry_id}].slice(-8)}:next;
  },fresh?{}:previous));
 },[adapted?.phase,adapted?.turn_index,adapted?.match_id,adapted?.game_id,adapted?.summary,manual]);
 useEffect(()=>{
  if(!adapted||adapted.phase==='result'||enteredMatch===adapted.match_id)return;
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?150:2600;
  const timer=window.setTimeout(()=>setEnteredMatch(adapted.match_id),delay);
  return()=>window.clearTimeout(timer);
 },[adapted?.match_id,adapted?.phase,enteredMatch]);
 useEffect(()=>{
  if(!adapted||enteredMatch!==adapted.match_id){setArenaReady(false);return;}
  setArenaReady(false);
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?30:650;
  const timer=window.setTimeout(()=>setArenaReady(true),delay);
  return()=>window.clearTimeout(timer);
 },[adapted?.match_id,enteredMatch]);
 useEffect(()=>{if(adapted?.phase==='result')setResultLeaving(false);},[adapted?.match_id,adapted?.phase]);
 const transitionResult=(action:()=>void)=>{
  if(resultLeaving)return;
  setResultLeaving(true);
  const delay=window.matchMedia('(prefers-reduced-motion: reduce)').matches?150:720;
  resultTimer.current=window.setTimeout(action,delay);
 };
 if(!activeRoom){
  const allowed=state.hello?.capabilities.allowed_turn_ms||[turnMs],scene=form==='entry'?'front':form;
  const status=({idle:'尚未连接',connecting:'连接中…',connected:'已连接',reconnecting:'网络暂断 · 重连中…',unavailable:'服务不可用'})[state.status];
  const nearestTurn=(value:number)=>allowed.reduce((best,next)=>Math.abs(next-value)<Math.abs(best-value)?next:best,allowed[0]);
  return <main className="online online-portal" data-online-scene={scene} data-source={state.source} data-pending={busy||state.pending?'true':'false'}>
   <div className="online-portal-world" aria-hidden="true"/>
   <nav className="online-portal-nav" aria-label="联机导航">
    <button type="button" disabled={busy||(state.pending&&connected)} onClick={()=>form==='entry'?leave():(setForm('entry'),setError(''))}>{form==='entry'?'返回主菜单':'返回联机前厅'}</button>
    <div><span className="online-signal" aria-hidden="true"/><span role="status">{status}{state.pending?' · 操作确认中…':''}</span>{state.source==='fixture'&&<b>MOCK</b>}</div>
   </nav>
   <section className="online-portal-copy">
    <span className="eyebrow">{form==='entry'?'MULTIPLAYER / ATRIUM':form==='create'?'HOST / DEPLOY':'ACCESS / LINK'}</span>
    <h1>{form==='entry'?'联机前厅':form==='create'?'房间部署':'房间接入'}</h1>
    <p>{form==='entry'?'从同一个中庭出发：部署自己的房间，或凭房间号接入朋友的牌局。':form==='create'?'设定这一间房的节奏与开放程度，然后把房间号交给朋友。':'输入朋友给你的房间号；参战席位已满时，仍可转为观战接入。'}</p>
   </section>
   {onlineError&&<p className="online-portal-error" role="alert">{onlineError}</p>}
   {state.membership_end&&<p className="online-portal-notice" role="status">已离开房间 {state.membership_end.room_code||state.membership_end.room_id}：{state.membership_end.reason==='three_absences'?'连续三拍缺席，已在当拍结算后移除。':'断线恢复时间已过，席位已释放。'}</p>}
   {form==='entry'?<section className="online-front-actions" aria-label="选择联机方式">
    <button type="button" className="online-route online-route-create" aria-label="创建房间" disabled={!connected||busy} onClick={()=>setForm('create')}><small>01 / HOST</small><strong>创建房间</strong><span>部署规则与开放席位</span></button>
    <button type="button" className="online-route online-route-join" aria-label="加入房间" disabled={!connected||busy} onClick={()=>setForm('join')}><small>02 / JOIN</small><strong>加入房间</strong><span>用房间号接入牌局</span></button>
    {(state.status==='unavailable'||state.status==='idle')&&<button type="button" className="online-retry" disabled={busy} onClick={()=>{leaving.current=false;void run(()=>api.openLobby());}}>重新连接</button>}
   </section>:<form className={`online-deploy online-deploy-${form}`} onSubmit={e=>{e.preventDefault();if(blocked)return;if(form==='join')join(role);else void run(()=>api.create({password:password||null,options:{turn_ms:turnMs,early_reveal:early,spectator_cap:cap}}));}}>
    <fieldset disabled={blocked}>
     {form==='create'?<>
      <label className="online-control online-turn"><span>每拍时间</span><b>{turnMs/1000} 秒</b><input type="range" aria-label="每拍时间" min={allowed[0]} max={allowed.at(-1)} step="1000" list="online-turn-values" value={turnMs} onChange={e=>setTurnMs(nearestTurn(Number(e.target.value)))}/><datalist id="online-turn-values">{allowed.map(ms=><option key={ms} value={ms}/>)}</datalist><small>{allowed.map(ms=>`${ms/1000}s`).join(' · ')}</small></label>
      <label className="online-switch"><input type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/><span>全员提交后提前揭晓</span></label>
      <label className="online-control"><span>观战容量</span><b>{cap} 人</b><input type="range" aria-label="观众容量" min="0" max={state.hello?.capabilities.spectator_max||0} value={cap} onChange={e=>setCap(Number(e.target.value))}/></label>
     </>:<>
      <label className="online-control online-code"><span>房间号</span><input aria-label="房间号" value={code} maxLength={16} onChange={e=>setCode(e.target.value)} autoComplete="off" placeholder="ABCD2345" required/></label>
      <fieldset className="online-role"><legend>加入身份</legend><label><input type="radio" name="online-role" value="player" checked={role==='player'} onChange={()=>setRole('player')}/><span>参战</span></label><label><input type="radio" name="online-role" value="spectator" checked={role==='spectator'} onChange={()=>setRole('spectator')}/><span>观战</span></label></fieldset>
     </>}
     <label className="online-control online-password"><span>房间密码 <small>可选</small></span><input type="password" aria-label="房间密码" value={password} maxLength={64} onChange={e=>setPassword(e.target.value)} autoComplete="off"/></label>
     {form==='join'&&['ROOM_FULL','MATCH_IN_PROGRESS'].includes(state.error?.code||'')&&<button type="button" className="online-spectate" onClick={()=>join('spectator')}>以观众身份尝试加入</button>}
     <button type="submit" className="primary online-deploy-submit">{state.pending?'确认中…':form==='create'?'创建并进入':'加入房间'}</button>
    </fieldset>
   </form>}
  </main>;
 }
 if(v?.phase==='lobby'&&snapshot&&me){
  const roster=Array.from({length:6},(_,index)=>v.members.find(member=>member.role==='player'&&member.seat===index));
  const spectators=v.members.filter(member=>member.role==='spectator'),reason=startReason(snapshot);
  return <main className="online online-room" data-phase="lobby" data-source={state.source} data-pending={busy||state.pending?'true':'false'}>
   <div className="online-room-world" aria-hidden="true"/>
   <nav className="online-room-nav" aria-label="房间操作">
    <button type="button" disabled={blocked} onClick={()=>setLeaveConfirm(true)}>退出房间</button>
    <div><span className="online-signal" aria-hidden="true"/><span role="status">{state.status==='reconnecting'?'网络暂断 · 重连中…':'房间已连接'}</span>{state.source==='fixture'&&<b>MOCK</b>}</div>
   </nav>
   <section className="online-lobby" data-player-count={roster.filter(Boolean).length} aria-label="六人参战席位">
    <div className="online-beacon"><small>{v.has_password?'已加密房间':'开放房间'}</small><strong>{v.room_code}</strong><button type="button" onClick={()=>void navigator.clipboard.writeText(v.room_code).then(()=>setNotice('房间号已复制。')).catch(()=>setNotice(`请手动复制房间号：${v.room_code}`))}>复制房号</button></div>
    {roster.map((member,index)=><article className="online-room-seat" key={index} data-seat={index} data-self={member?.player_id===v.self.player_id?'true':'false'} data-host={member?.player_id===v.host_id?'true':'false'} data-ready={member?.ready?'true':'false'} data-connected={member?.connected?'true':'false'}>
     {member?<><Avatar id={member.avatar_id}/><div><strong title={member.nickname}>{member.nickname}</strong><span>{member.player_id===v.self.player_id?'本人 · ':''}{member.player_id===v.host_id?'房主 · ':''}{member.connected?(member.ready?'已准备':'未准备'):'掉线'}</span></div></>:<><i>{String(index+1).padStart(2,'0')}</i><span>等待接入</span></>}
    </article>)}
   </section>
   <aside className="online-room-tools"><span>每拍 {v.policy.turn_ms/1000} 秒</span><span>{v.policy.early_reveal?'全员提交即揭晓':'到时揭晓'}</span>{canSetTurnLimit(state)&&<button type="button" disabled={blocked} onClick={()=>{setLimitMs(v.policy.turn_ms);setLimitRevision(v.policy_revision);setLimitOpen(true);}}>调整时限</button>}</aside>
   <aside className="online-spectators"><small>观战席 {spectators.length} / {v.policy.spectator_cap}</small>{spectators.length?<ul>{spectators.map(member=><li key={member.player_id}><Avatar id={member.avatar_id}/><span title={member.nickname}>{member.nickname}</span>{!member.connected&&<small>掉线</small>}</li>)}</ul>:<span>暂无观众</span>}</aside>
   {(onlineError||recoveryText||notice)&&<p className={onlineError?'online-room-message is-error':'online-room-message'} role={onlineError?'alert':'status'}>{onlineError||recoveryText||notice}</p>}
   <footer className="online-room-actions">
    {me.role==='player'&&<button type="button" disabled={blocked} onClick={()=>void run(()=>api.ready({room_id:snapshot.room_id,ready:!me.ready}))}>{me.ready?'取消准备':'准备'}</button>}
    {!host&&<button type="button" disabled={blocked||(me.role==='spectator'?roster.filter(Boolean).length>=6:spectators.length>=v.policy.spectator_cap)} onClick={()=>void run(()=>api.changeRole({room_id:snapshot.room_id,role:me.role==='player'?'spectator':'player'}))}>{me.role==='player'?'转为观众':'申请参战'}</button>}
    {host&&!v.pending_close&&<><button type="button" className="primary" disabled={blocked||!!reason} onClick={()=>void run(()=>api.start({room_id:snapshot.room_id}))}>开始对局</button><span>{reason||'全员就绪，可以开局。'}</span></>}
   </footer>
   {limitOpen&&canSetTurnLimit(state)&&<Modal title="调整之后每拍时限" onClose={()=>setLimitOpen(false)} closeDisabled={busy}><label>之后每拍时限<select aria-label="之后每拍时限" value={limitMs} onChange={e=>setLimitMs(Number(e.target.value))}>{state.hello?.capabilities.allowed_turn_ms.map(ms=><option key={ms} value={ms}>{ms/1000} 秒</option>)}</select></label>{error&&<p role="alert">{error}</p>}<button disabled={blocked} className="primary" onClick={()=>void run(async()=>{const result=await api.setTurnLimit({room_id:snapshot.room_id,turn_ms:limitMs,expected_policy_revision:limitRevision});if(result.ok)setLimitOpen(false);return result;})}>应用到之后每拍</button></Modal>}
   {leaveConfirm&&<Modal title={host?'结束整个房间？':'退出房间？'} onClose={()=>setLeaveConfirm(false)}><p>{host?'退出将结束房间，并让所有人离开。':'离开后将结束本次参战或观战；本机档案保留。'}</p><button onClick={()=>setLeaveConfirm(false)}>留在房间</button><button className="primary" onClick={leave}>{host?'确认结束房间':'确认退出房间'}</button></Modal>}
  </main>;
 }
 if(v?.match&&snapshot&&battleView){
  const canAdjust=canSetTurnLimit(state),showIntro=battleView.phase!=='result'&&enteredMatch!==battleView.match_id;
  return <div className="online-match" data-source={state.source} data-room={v.room_code} data-arena-ready={arenaReady}>
   {showIntro
    ?<main className="online-intro" data-player-count={battleView.participants.length} aria-label="多人对局入场"><div className="online-intro-world" aria-hidden="true"><span/></div><header><span>MULTIPLAYER MATCH</span><h1>进入擂台</h1><p>经典规则 · 每拍 {v.policy.turn_ms/1000} 秒 · {v.policy.early_reveal?'全员提交即揭晓':'到时揭晓'}</p></header><section className="online-intro-roster" aria-label="本场参战席位">{battleView.participants.map((player,index)=><article className="online-intro-player" key={player.player_id} data-seat={index} data-self={player.player_id===battleView.self_id} style={{'--intro-seat':String(index)} as React.CSSProperties}><Avatar id={player.avatar_id}/><span><small>{player.player_id===battleView.self_id?'你 · 本机席位':`席位 ${index+1}`}</small><strong>{player.nickname}</strong></span></article>)}</section><button className="cinematic-skip" onClick={()=>setEnteredMatch(battleView.match_id)}>立即入场 <small>SKIP</small></button></main>
    :battleView.phase==='result'
     ?<MatchResult view={battleView} moveHistory={moveHistory} leaving={resultLeaving} Avatar={Avatar} onReview={()=>setSituationOpen(true)} onPrimary={()=>transitionResult(()=>{void run(()=>api.returnLobby({room_id:snapshot.room_id}));})} onExit={()=>transitionResult(leave)} primaryLabel={host&&!v.pending_close?'准备下一局':'等待房主开启下一局'} primaryDisabled={!host||!!v.pending_close||blocked}/>
     :<BattleStage view={battleView} manual={manual} moveHistory={moveHistory} mode="online" ready={arenaReady} exiting={false} suspended={false} frozen={false} busy={blocked||(!editable&&battleView.phase==='selecting'&&!!battleView.options.length)} revealSeconds={Math.max(0,Math.ceil((remaining||0)/1000))} Avatar={Avatar} onSelect={setSelected} onSubmit={submit} onPause={()=>setMatchMenu(true)} onFreeze={()=>{}} onSituation={()=>setSituationOpen(true)}/>}
   <aside className="online-match-controls" aria-label="联机房间状态"><span>房间 {v.room_code}</span><span>每拍 {v.policy.turn_ms/1000} 秒</span><span>{state.status==='reconnecting'?'网络暂断 · 重连中…':'房间已连接'}</span>{canAdjust&&<button type="button" disabled={blocked} onClick={()=>{setLimitMs(v.policy.turn_ms);setLimitRevision(v.policy_revision);setLimitOpen(true);}}>调整时限</button>}</aside>
   {(onlineError||recoveryText||closingText||futureText)&&<p className={onlineError?'online-match-notice is-error':'online-match-notice'} role={onlineError?'alert':'status'}>{onlineError||closingText||recoveryText} {futureText}</p>}
   {matchMenu&&<Modal className="battle-dialog pause-dialog" title="对局菜单" onClose={()=>setMatchMenu(false)}><section className="pause-state"><span>ONLINE MENU</span><h3>牌局仍在继续</h3><p>多人模式打开菜单不会暂停牌局，返回后以服务端当前状态为准。</p></section><div className="pause-actions"><button className="primary" onClick={()=>setMatchMenu(false)}>继续游戏<small>RESUME</small></button><button disabled={!canAdjust} onClick={()=>{setMatchMenu(false);setLimitMs(v.policy.turn_ms);setLimitRevision(v.policy_revision);setLimitOpen(true);}}>房间游戏设置<small>ROOM SETTINGS</small></button><button className="danger" onClick={()=>{setMatchMenu(false);setLeaveConfirm(true);}}>退出游戏<small>LEAVE MATCH</small></button></div></Modal>}
   {situationOpen&&<SituationDialog view={battleView} manual={manual} moveHistory={moveHistory} Modal={Modal} Avatar={Avatar} onClose={()=>setSituationOpen(false)}/>}
   {limitOpen&&canAdjust&&<Modal title="调整之后每拍时限" onClose={()=>setLimitOpen(false)} closeDisabled={busy}><p>{futureText||'从下一次选择阶段开始生效，本拍截止时间和已交牌保持不变。'}</p><label>之后每拍时限<select aria-label="之后每拍时限" value={limitMs} onChange={e=>setLimitMs(Number(e.target.value))}>{state.hello?.capabilities.allowed_turn_ms.map(ms=><option key={ms} value={ms}>{ms/1000} 秒</option>)}</select></label>{error&&<p role="alert">{error}</p>}<button disabled={blocked} className="primary" onClick={()=>void run(async()=>{const result=await api.setTurnLimit({room_id:snapshot.room_id,turn_ms:limitMs,expected_policy_revision:limitRevision});if(result.ok)setLimitOpen(false);return result;})}>应用到之后每拍</button></Modal>}
   {leaveConfirm&&<Modal title={host?'结束整个房间？':'退出房间？'} onClose={()=>setLeaveConfirm(false)}><p>{host?'退出将按服务策略在当前拍后或立即结束房间，并让所有人离开。':'离开后将结束本次参战或观战；本机档案保留。'}{!connected?' 当前网络已断开，离开将停止重连；服务按掉线策略处理原席位。':''}</p><button onClick={()=>setLeaveConfirm(false)}>留在房间</button><button className="primary" onClick={leave}>{host?'确认结束房间':'确认退出房间'}</button></Modal>}
  </div>;
 }
 return <main className={`online ${v?.match?'online-table':''}`} data-phase={v?.phase||'entry'} data-source={state.source}>
  <header className="online-header"><div><span className="eyebrow">{state.source==='fixture'?'开发预览 · MOCK · 脚本化 socket':'好友房 · 本机开发服务'}</span><h2>{activeRoom?`房间 ${v.room_code}`:'叫上朋友，一起出招。'}</h2></div><span role="status">{({idle:'尚未连接',connecting:'连接中…',connected:'已连接',reconnecting:'网络暂断 · 重连中…',unavailable:'服务不可用'})[state.status]}{state.pending?' · 操作确认中…':''}</span><button disabled={busy||(state.pending&&connected)} onClick={()=>activeRoom?setLeaveConfirm(true):leave()}>{activeRoom?'退出房间':'返回主菜单'}</button></header>
  {onlineError&&<p className="online-error" role="alert">{onlineError}</p>}
  {state.status==='reconnecting'&&<p className="online-notice">正在尝试恢复原席位，暂时不能出牌。已公开的结果保留；离开将停止重连。</p>}
  {!activeRoom&&state.membership_end&&<p className="online-notice" role="alert">已离开房间 {state.membership_end.room_code||state.membership_end.room_id}：{state.membership_end.reason==='three_absences'?'连续三拍缺席，已在当拍结算后移除。':'断线恢复时间已过，席位已释放。'} 可以创建或加入其他房间。</p>}
  {!activeRoom?<section className="paper online-entry">
   {(state.status==='unavailable'||state.status==='idle')&&<button className="primary" disabled={busy} onClick={()=>{leaving.current=false;void run(()=>api.openLobby());}}>重新连接</button>}
   {form==='entry'?<><p>使用本机昵称和头像进入临时会话。</p><div className="online-choices"><button className="primary" disabled={!connected||busy} onClick={()=>setForm('create')}>创建房间</button><button disabled={!connected||busy} onClick={()=>setForm('join')}>加入房间</button></div></>:<form onSubmit={e=>{e.preventDefault();if(blocked)return;if(form==='join')join(role);else void run(()=>api.create({password:password||null,options:{turn_ms:turnMs,early_reveal:early,spectator_cap:cap}}));}}>
    <h2>{form==='create'?'创建房间':'加入房间'}</h2><fieldset disabled={blocked}>
     {form==='create'?<><label>每拍时间<select aria-label="每拍时间" value={turnMs} onChange={e=>setTurnMs(Number(e.target.value))}>{state.hello?.capabilities.allowed_turn_ms.map(ms=><option key={ms} value={ms}>{ms/1000} 秒</option>)}</select></label><label className="checkbox"><input type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/>全员提交后提前揭晓</label><label>观众容量<select aria-label="观众容量" value={cap} onChange={e=>setCap(Number(e.target.value))}>{Array.from({length:(state.hello?.capabilities.spectator_max||0)+1},(_,i)=><option key={i} value={i}>{i} 位</option>)}</select></label></>:<><label>房间号<input aria-label="房间号" value={code} maxLength={16} onChange={e=>setCode(e.target.value)} autoComplete="off" required/></label><label>加入身份<select aria-label="加入身份" value={role} onChange={e=>setRole(e.target.value as Role)}><option value="player">参战</option><option value="spectator">观战</option></select></label></>}
     <label>房间密码（可选）<input type="password" aria-label="房间密码" value={password} maxLength={64} onChange={e=>setPassword(e.target.value)} autoComplete="off"/><small>最多 32 个字；空格保留。</small></label>
     <button type="submit" className="primary">{state.pending?'确认中…':form==='create'?'创建并进入':'加入'}</button><button type="button" onClick={()=>{setForm('entry');setError('');}}>返回联机入口</button>
     {form==='join'&&['ROOM_FULL','MATCH_IN_PROGRESS'].includes(state.error?.code||'')&&<button type="button" onClick={()=>join('spectator')}>以观众身份尝试加入</button>}
    </fieldset></form>}
  </section>:<>
   <div className="online-policy"><span>{v.has_password?'已设置密码':'无密码'} · 每拍 {v.policy.turn_ms/1000} 秒 · {v.policy.early_reveal?'全员交牌提前揭晓':'到时揭晓'}</span><button onClick={()=>void navigator.clipboard.writeText(v.room_code).then(()=>setNotice('房间号已复制。')).catch(()=>setNotice(`请手动复制房间号：${v.room_code}`))}>复制房号</button>{canSetTurnLimit(state)&&<button disabled={blocked} onClick={()=>{setLimitMs(v.policy.turn_ms);setLimitRevision(v.policy_revision);setLimitOpen(true);}}>调整时限</button>}<span>观众 {v.members.filter(p=>p.role==='spectator').length} / {v.policy.spectator_cap}</span></div>
   {v.phase==='lobby'&&recoveryText&&<p className="online-notice" role="status">{recoveryText}</p>}
   {v.phase==='lobby'?<><div className="lobby-seats">{Array.from({length:6},(_,i)=>seat(v.members.find(p=>p.seat===i),i))}</div><p className="online-notice" role="status">{notice||'参战者全部准备后，由房主开始。'}</p><footer className="online-actions">
    {me?.role==='player'&&<button disabled={blocked} onClick={()=>void run(()=>api.ready({room_id:snapshot.room_id,ready:!me.ready}))}>{me.ready?'取消准备':'准备'}</button>}
    {!host&&<button disabled={blocked||(me?.role==='spectator'?v.members.filter(p=>p.role==='player').length>=6:v.members.filter(p=>p.role==='spectator').length>=v.policy.spectator_cap)} onClick={()=>void run(()=>api.changeRole({room_id:snapshot.room_id,role:me?.role==='player'?'spectator':'player'}))}>{me?.role==='player'?'转为观众':'申请参战'}</button>}
    {host&&!v.pending_close&&<><button className="primary" disabled={blocked||!!startReason(snapshot)} onClick={()=>void run(()=>api.start({room_id:snapshot.room_id}))}>开始对局</button><span>{startReason(snapshot)||'大家准备好了。'}</span></>}
   </footer><p className="spectator-list">观众：{v.members.filter(p=>p.role==='spectator').map(p=>`${p.nickname}${p.connected?'':'（掉线）'}`).join('、')||'暂无'}</p></>:<>
    <div className="online-public"><div className="online-opponents">{Array.from({length:6},(_,i)=>i===v.self.seat?null:seat(v.members.find(p=>p.seat===i),i))}</div><section className="summary"><span className="eyebrow">本场 · 第 {v.match?.public_state.game_index} 局 · 第 {v.match?.public_state.turn_index} 拍</span><h2>{v.phase==='result'?(v.match?.effective_outcome?.winner_id?`${v.match.roster_profiles.find(p=>p.player_id===v.match?.effective_outcome?.winner_id)?.nickname} 获胜`:'无人获胜'):v.phase==='revealing'?'本拍共同揭晓':me?.participation==='eliminated'?'本场已淘汰，等待下一场':me?.role==='spectator'?'你正在观战':'选择你的下一拍'}</h2>{(recoveryText||closingText||futureText)&&<p className="room-progress" role="status">{closingText||recoveryText} {futureText}</p>}<details><summary>展开已揭晓摘要</summary>{summary.map((s,i)=><p key={i}>{s}</p>)}<small>本场标识：{v.match?.match_id}</small></details></section></div>
    {me?.role==='player'&&<section className="self-strip"><Avatar id={me.avatar_id}/><div><b>{me.nickname} · 席位 {(me.seat||0)+1}</b><small>{me.participation==='eliminated'?'本场已淘汰，等待下一场':'本人'}</small></div>{selfResources&&<button className="online-self-resources" onClick={()=>setResource(me)} title={compact(selfResources)}>{compact(selfResources)}<small>点击查看次数、状态与待成熟炸药</small></button>}</section>}
    {!!options.length?<><div className="turn-strip"><span>本拍剩余 {Math.ceil((remaining||0)/1000)} 秒</span><progress max={v.current_turn_ms||v.policy.turn_ms} value={remaining||0}/><span>{v.self.accepted_entry_id||state.confirmed?`已确认：${manual.entries.find(o=>o.entry_id===(v.self.accepted_entry_id||state.confirmed?.entry_id))?.name}`:state.pending?'提交确认中…':picked?`已选：${picked.name}`:'先选一张牌'}</span></div><div className="card-groups">{groups.map(group=><section className={`card-group ${group}`} key={group}><h3>{groupName[group]}</h3><div className="cards">{ordered.filter(o=>o.ui_group===group).map(o=><article className={`card ${o.available?'':'unavailable'} ${selected===o.entry_id?'selected':''}`} key={o.entry_id} data-entry={o.entry_id}><button className="card-pick" disabled={!editable||!o.available||o.forced} aria-label={`选择 ${o.name}`} aria-pressed={selected===o.entry_id} onClick={()=>setSelected(o.entry_id)}><span className="card-code">{o.doc_id}</span><strong>{o.name}</strong><span className="card-cost">实付 {o.cost_text}</span><span className="card-require">{o.requirement_text}</span><span className="card-state">{o.forced?'强制休整':o.available?'可用':reasons[o.reason_code||'']||'不可用'}</span></button><button className="card-info" aria-label={`${o.name}：详情与原因`} onClick={()=>setDetail(o)}>?</button></article>)}</div></section>)}</div><footer className="table-actions"><small>数字键 1–0 选择 · Enter 提交 · 确认后不可更换</small><span>{options.filter(o=>o.available&&!o.forced).length} / 33 可用</span><button className="primary" disabled={!editable||!picked?.available||picked.forced} onClick={submit}>提交所选</button></footer></>:<section className="online-wait"><p>{v.phase==='revealing'?'招式已公开，等待下一拍。':v.phase==='result'?'本场已结束。':me?.participation==='eliminated'?'你已淘汰，保留原席位观看本场。':'观战只显示公开状态，不参与选牌。'}</p>{v.phase==='result'&&(host&&!v.pending_close?<button className="primary" disabled={blocked} onClick={()=>void run(()=>api.returnLobby({room_id:snapshot.room_id}))}>准备下一场</button>:<p>等待房主开启下一场准备。</p>)}{v.phase==='result'&&<p>本场成员：{v.match?.roster_profiles.map(p=>p.nickname).join('、')}</p>}</section>}
   </>}
  </>}
  {limitOpen&&snapshot&&canSetTurnLimit(state)&&<Modal title="调整之后每拍时限" onClose={()=>setLimitOpen(false)} closeDisabled={busy}><p>{futureText||'从下一次选择阶段开始生效，本拍截止时间和已交牌保持不变。'}</p><label>之后每拍时限<select aria-label="之后每拍时限" value={limitMs} onChange={e=>setLimitMs(Number(e.target.value))}>{state.hello?.capabilities.allowed_turn_ms.map(ms=><option key={ms} value={ms}>{ms/1000} 秒</option>)}</select></label>{error&&<p role="alert">{error}</p>}<button disabled={blocked} className="primary" onClick={()=>void run(async()=>{const result=await api.setTurnLimit({room_id:snapshot.room_id,turn_ms:limitMs,expected_policy_revision:limitRevision});if(result.ok)setLimitOpen(false);return result;})}>应用到之后每拍</button></Modal>}
  {leaveConfirm&&<Modal title={host?'结束整个房间？':'退出房间？'} onClose={()=>setLeaveConfirm(false)}><p>{host?'退出将按服务策略在当前拍后或立即结束房间，并让所有人离开。':'离开后将结束本次参战或观战；本机档案保留。'}{!connected?' 当前网络已断开，离开将停止重连；服务按掉线策略处理原席位。':''}</p><button onClick={()=>setLeaveConfirm(false)}>留在房间</button><button className="primary" onClick={leave}>{host?'确认结束房间':'确认退出房间'}</button></Modal>}
  {detail&&<Modal title={detail.name} onClose={()=>setDetail(null)}><p>{manual.entries.find(e=>e.entry_id===detail.entry_id)?.description}</p><p>{detail.requirement_text}；实付 {detail.cost_text}</p><p>{detail.forced?'强制休整':detail.available?'当前可用':reasons[detail.reason_code||'']||'当前不可用'}</p>{manual.sections.filter(s=>detail.detail_rule_ids.includes(s.id)).map(s=><details key={s.id}><summary>{s.id}</summary><pre>{s.text}</pre></details>)}</Modal>}
  {resource&&players[resource.player_id]&&<Modal title={`${resource.nickname} · 公开资源`} onClose={()=>setResource(null)}><p>{compact(players[resource.player_id])}</p><dl>{Object.entries({云次数:players[resource.player_id].cloud_uses,田利军次数:players[resource.player_id].tian_uses,炸药放置次数:players[resource.player_id].bomb_placement_count,待成熟炸药:players[resource.player_id].pending_bombs.length,强化削:players[resource.player_id].enhanced_xiao?'有':'无',张新伟:players[resource.player_id].zhang_used?'已用':'未用',复制记录:manual.entries.find(e=>e.entry_id===players[resource.player_id].latest_copyable_move)?.name||'无',历强:players[resource.player_id].liq_used?'已用':'未用',曾义:({unused:'未用',recovery:'休整',waiting:'等待奖励',ready:'奖励可用',spent:'奖励已用'} as Record<string,string>)[players[resource.player_id].zeng_state]}).map(([k,value])=><React.Fragment key={k}><dt>{k}</dt><dd>{value}</dd></React.Fragment>)}</dl></Modal>}
 </main>;
}
