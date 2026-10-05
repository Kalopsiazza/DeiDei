import { useEffect, useRef, useState } from 'react';
import type { DesktopView } from './types';
import { shortcutEntry } from './interaction';
import { pollViews } from './view-loop';

const api=window.desktop;
type Props={page:string;modal:string;frozen:boolean;arenaReady:boolean;arenaExiting:boolean;message:(code:string)=>string;setError:(error:string)=>void;onResult:(view:DesktopView)=>void;onViewReady:(page:string)=>void;onLeave:()=>void};
export function useSoloSession({page,modal,frozen,arenaReady,arenaExiting,message,setError,onResult,onViewReady,onLeave}:Props) {
 const [view,setView]=useState<DesktopView|null>(null),[readError,setReadError]=useState(false),[readAttempt,setReadAttempt]=useState(0),[busy,setBusy]=useState(false);
 const submitLock=useRef(false),generation=useRef(0),readSlot=useRef(false),sceneChangePending=useRef(false);
 const take=(r:Awaited<ReturnType<typeof api.port.getView>>):DesktopView=>{if(!r.ok)throw new Error(r.error);return r.data;};
 const selected=view?.options.find(o=>o.entry_id===view.selected_entry_id);
 const tutorial=view?.tutorial;
 const isMultiplayer=view?.mode==='multiplayer';
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
   if(e.repeat||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||modal||page!=='table'||!editable||t.closest('input,textarea,select,button:not(.card-pick),[contenteditable="true"],dialog'))return;
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
    if(next.phase==='result'){onResult(next);return;}
    setView(previous=>next.phase==='selecting'&&previous?.view_id===next.view_id
      ? {...next,selected_entry_id:previous.selected_entry_id} : next);
  },code=>{if(token===generation.current){setReadError(true);setError(message(code));}});
 },[page,view?.match_id,view?.source,readError,readAttempt,suspended,arenaExiting,view?.tutorial?.stage]);
 const navigate=(action:()=>void)=>{if(!sceneChangePending.current)action();};
 const changeScene=async(action:()=>Promise<DesktopView>,nextPage:string)=>{
  if(sceneChangePending.current||busy)return;sceneChangePending.current=true;const token=++generation.current;setBusy(true);setError('');setReadError(false);
  try {const next=await action();if(token===generation.current){setView(next);onViewReady(nextPage);}}
  catch(e){if(token===generation.current){setError(message((e as Error).message));setReadError(true);}}
  finally {sceneChangePending.current=false;if(token===generation.current)setBusy(false);}
 };
 const leave=async()=>{
  if(sceneChangePending.current)return;
  const token=++generation.current;setBusy(false);setView(null);setReadError(false);setError('');onLeave();
  try{take(await api.port.leave());}catch(e){if(token===generation.current)setError(message((e as Error).message));}
 };
 return {view,setView,busy,readError,setReadError,setReadAttempt,sceneChangePending,choose,submit,changeScene,navigate,leave};
}
