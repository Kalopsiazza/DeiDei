import React, { useEffect, useRef, useState } from 'react';

const avatarName={leaf:'叶子',sun:'太阳',moon:'月亮',star:'星星'};
export function Avatar({id='leaf'}:{id?:string}) {return <span className={`avatar ${id}`} aria-label={avatarName[id as keyof typeof avatarName]||'占位头像'}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 35 Q4 12 24 8 Q45 12 38 35 Q24 44 10 35Z"/><path d={id==='sun'?'M18 6 L17 1 M32 7 L35 2 M41 17 L47 15':id==='leaf'?'M24 9 Q13 0 12 9 Q13 15 24 9':id==='moon'?'M32 9 Q22 19 36 23':'M22 2 L24 7 L30 7 L26 11'}/><path d="M15 24 L17 24 M30 24 L32 24 M20 31 Q24 34 28 30"/></svg></span>;}
export function Identity({nickname,avatar,onName,onAvatar,disabled=false}:{nickname:string;avatar:string;onName:(s:string)=>void;onAvatar:(s:string)=>void;disabled?:boolean}) {
 return <fieldset disabled={disabled}><label>你的昵称<input aria-label="昵称" autoComplete="off" value={nickname} onChange={e=>onName(e.target.value)}/><small>1—20 个字，仅保存在这台电脑。</small></label><span className="label">选一个纸上头像</span><div className="avatars">{Object.entries(avatarName).map(([id,name])=><button key={id} type="button" aria-label={`头像：${name}`} aria-pressed={avatar===id} onClick={()=>onAvatar(id)}><Avatar id={id}/></button>)}</div></fieldset>;
}
export function Modal({title,children,onClose,closeDisabled=false,className='',requestCloseRef}:{title:string;children:React.ReactNode;onClose:()=>void;closeDisabled?:boolean;className?:string;requestCloseRef?:React.RefObject<(()=>void)|null>}) {
 const ref=useRef<HTMLDialogElement>(null),timer=useRef<number|null>(null),closingRef=useRef(false);
 const [closing,setClosing]=useState(false);
 useEffect(()=>{
  const dialog=ref.current,previous=document.activeElement;
  dialog?.showModal();
  return()=>{if(timer.current!==null)window.clearTimeout(timer.current);dialog?.close();if(previous instanceof HTMLElement&&previous.isConnected&&!document.querySelector('dialog[open]'))previous.focus();};
 },[]);
 const requestClose=()=>{
  if(closeDisabled||closingRef.current)return;
  closingRef.current=true;setClosing(true);
  timer.current=window.setTimeout(()=>{ref.current?.close();onClose();},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:240);
 };
 useEffect(()=>{if(requestCloseRef)requestCloseRef.current=requestClose;return()=>{if(requestCloseRef)requestCloseRef.current=null;};},[requestCloseRef,closeDisabled,onClose]);
 return <dialog ref={ref} className={`tech-dialog ${className}`.trim()} data-closing={closing} onCancel={e=>{e.preventDefault();requestClose();}} aria-label={title}><header className="dialog-head"><span className="dialog-index">SYSTEM // DIALOG</span><h2>{title}</h2><button className="dialog-close" disabled={closeDisabled||closing} onClick={requestClose} aria-label="关闭弹窗"><i/><i/><small>ESC</small></button></header>{children}</dialog>;
}
