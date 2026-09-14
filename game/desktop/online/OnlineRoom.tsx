import React, { useEffect, useRef, useState } from 'react';
import type { Manual, Option } from '../types';
import type { CorePlayer, Member, OnlineState, Role } from './types';
import { canSelect, canSetTurnLimit, hostRecoveryText, describeError, optionsFor, publicPlayers, remainingAt, startReason, turnSummary } from './model';
import { groups, orderedOptions, shortcutEntry } from '../interaction';
import { ddText } from '../view-loop';
const api=window.desktop.online;
const initial:OnlineState={source:'online',status:'idle',hello:null,snapshot:null,pending:false,membership_end:null,host_remaining_ms:null,error:null,confirmed:null,remaining_ms:null,revision:0};
const groupName={attack:'攻击',defense:'防御',skill:'技能'};
const reasons:Record<string,string>={INSUFFICIENT_DD:'DD 不足',INSUFFICIENT_LIGHTNING:'雷电不足',INSUFFICIENT_CHARGE:'充能不足',INSUFFICIENT_BOMBS:'成熟层不足',ALREADY_USED:'本局已用',NO_COPY_RECORD:'没有复制记录',NO_REWARD:'奖励未就绪',FORCED_RECOVERY:'强制休整',NOT_ACTIVE:'已不在场'};
type Props={manual:Manual;onExit:()=>void;Avatar:React.ComponentType<{id?:string}>;Modal:React.ComponentType<{title:string;children:React.ReactNode;onClose:()=>void;closeDisabled?:boolean}>};
export function OnlineRoom({manual,onExit,Avatar,Modal}:Props) {
 const [state,setState]=useState(initial),[form,setForm]=useState<'entry'|'create'|'join'>('entry'),[error,setError]=useState('');
 const [code,setCode]=useState(''),[password,setPassword]=useState(''),[role,setRole]=useState<Role>('player');
 const [turnMs,setTurnMs]=useState(10000),[early,setEarly]=useState(true),[cap,setCap]=useState(6);
 const [limitOpen,setLimitOpen]=useState(false),[limitMs,setLimitMs]=useState(10000),[limitRevision,setLimitRevision]=useState('1');
 const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<Option|null>(null),[resource,setResource]=useState<Member|null>(null),[leaveConfirm,setLeaveConfirm]=useState(false),[notice,setNotice]=useState('');
 const [now,setNow]=useState(performance.now()),[busy,setBusy]=useState(false);
 const receipt=useRef(performance.now()),lock=useRef(false),alive=useRef(true),leaving=useRef(false),lastRevision=useRef(-1),lastPlayers=useRef('');
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
  return()=>{alive.current=false;unsub();clearInterval(tick);};
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
