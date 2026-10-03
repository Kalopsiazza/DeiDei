import { useEffect, useRef, useState } from 'react';
import type { OnlineState, Role } from './types';
import { describeError, remainingAt } from './model';
const api=window.desktop.online;
const initial:OnlineState={source:'online',status:'idle',hello:null,snapshot:null,pending:false,membership_end:null,host_remaining_ms:null,error:null,confirmed:null,remaining_ms:null,revision:0};

export function useOnlineSession(onExit:()=>void) {
 const [state,setState]=useState(initial),[form,setForm]=useState<'entry'|'create'|'join'>('entry'),[error,setError]=useState('');
 const [code,setCode]=useState(''),[password,setPassword]=useState(''),[role,setRole]=useState<Role>('player');
 const [turnMs,setTurnMs]=useState(10000),[early,setEarly]=useState(true),[cap,setCap]=useState(6);
 const [limitMs,setLimitMs]=useState(10000),[limitRevision,setLimitRevision]=useState('1'),[selected,setSelected]=useState<string|null>(null);
 const [now,setNow]=useState(performance.now()),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const receipt=useRef(performance.now()),lock=useRef(false),alive=useRef(true),leaving=useRef(false),lastRevision=useRef(-1),lastPlayers=useRef(''),commandGeneration=useRef(0),currentState=useRef(state);
 const snapshot=state.snapshot,v=snapshot?.view,me=v?.members.find(p=>p.player_id===v.self.player_id);
 const activeRoom=!!v&&v.phase!=='closed'&&state.status!=='unavailable',connected=state.status==='connected';
 const blocked=busy||state.pending||!connected,exitBlocked=connected&&(busy||state.pending);
 const matchKey=snapshot?`${snapshot.room_id}/${v?.match?.match_id}/${v?.match?.turn_id}/${v?.self.role}/${me?.participation}`:'';
 const accept=(next:OnlineState)=>{
  if(!alive.current||next.revision<lastRevision.current)return;
  lastRevision.current=next.revision;currentState.current=next;receipt.current=performance.now();setNow(receipt.current);setState(next);
  if((next.error&&!next.pending)||next.status==='reconnecting'||next.status==='unavailable')leaving.current=false;
  if(leaving.current&&!next.pending&&!next.snapshot){leaving.current=false;onExit();}
 };
 useEffect(()=>{
  alive.current=true;
  const unsub=api.onChange(accept);
  void api.openLobby().then(reply=>{if(!alive.current)return;if(reply.ok)accept(reply.data);else setError(describeError(reply.error));}).catch(()=>{if(alive.current)setError('连接未完成，请重试。');});
  const tick=setInterval(()=>setNow(performance.now()),100);
  return()=>{alive.current=false;++commandGeneration.current;leaving.current=false;unsub();clearInterval(tick);};
 },[]);
 useEffect(()=>{if(state.hello){setTurnMs(state.hello.policy_defaults.turn_ms);setEarly(state.hello.policy_defaults.early_reveal);setCap(state.hello.policy_defaults.spectator_cap);}},[state.hello?.policy_defaults.turn_ms,state.hello?.policy_defaults.early_reveal,state.hello?.policy_defaults.spectator_cap]);
 useEffect(()=>{if(state.membership_end){setForm('entry');setError('');}},[state.membership_end?.event_id]);
 useEffect(()=>{setSelected(null);},[matchKey]);
 useEffect(()=>{if(activeRoom){setPassword('');setError('');}},[snapshot?.room_id]);
 useEffect(()=>{
  const players=v?.members.filter(p=>p.role==='player').map(p=>p.player_id).sort().join(',')||'';
  if(v?.phase==='lobby'&&lastPlayers.current&&players!==lastPlayers.current)setNotice('参战席位有变化，请大家重新准备。');
  lastPlayers.current=players;
 },[v?.members]);
 const run=async(action:()=>ReturnType<typeof api.read>,offlineExit=false):Promise<boolean>=>{
  if(lock.current&&!offlineExit)return false;
  const token=++commandGeneration.current;lock.current=true;setBusy(true);setError('');
  try{
   const reply=await action();
   if(!alive.current||token!==commandGeneration.current)return false;
   if(reply.ok){accept(reply.data);return true;}
   leaving.current=false;setError(describeError(reply.error));return false;
  }catch{if(alive.current&&token===commandGeneration.current){leaving.current=false;setError('操作未完成，请重试。');}return false;}
  finally{if(token===commandGeneration.current){lock.current=false;if(alive.current)setBusy(false);}}
 };
 const leave=async():Promise<boolean>=>{
  if(leaving.current)return false;
  const offline=currentState.current.status!=='connected';
  if(lock.current&&!offline)return false;
  leaving.current=true;
  const ok=await run(()=>api.leave(),offline);
  if(!ok)leaving.current=false;
  return ok;
 };
 const reconnect=()=>{leaving.current=false;void run(()=>api.openLobby());};
 return {state,currentState,form,setForm,error,setError,code,setCode,password,setPassword,role,setRole,turnMs,setTurnMs,early,setEarly,cap,setCap,limitMs,setLimitMs,limitRevision,setLimitRevision,selected,setSelected,notice,setNotice,now,busy,activeRoom,connected,blocked,exitBlocked,run,leave,reconnect,
  remaining:remainingAt(state,receipt.current,now),hostRemaining:state.host_remaining_ms===null?null:Math.max(0,state.host_remaining_ms-Math.max(0,now-receipt.current))};
}
