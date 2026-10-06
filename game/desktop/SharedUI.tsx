import React, { useEffect, useId, useRef, useState } from 'react';

export function BackButton({children,className='',style,...props}:Omit<React.ComponentProps<'button'>,'children'>&{children:string}) {
 return <button type="button" aria-label={children} {...props} className={`ui-back ${className}`.trim()} style={{...style,'--back-label-length':Array.from(children).length} as React.CSSProperties}><span>{children}</span></button>;
}

export function Select({options,...props}:React.ComponentProps<'select'>&{options:readonly {value:string;label:string;icon?:React.ReactNode;disabled?:boolean}[]}) {
 // ponytail: Electron's customizable select keeps native keyboard, focus and top-layer behavior.
 const selected=options.find(option=>option.value===String(props.value));
 return <span className="ui-select-field" data-has-icon={!!selected?.icon}><select {...props} className={`ui-select ${props.className||''}`.trim()}>{options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.icon&&<span className="ui-option-icon" aria-hidden="true">{option.icon}</span>}<span>{option.label}</span></option>)}</select>{selected?.icon&&<span className="ui-select-current-icon ui-option-icon" aria-hidden="true">{selected.icon}</span>}</span>;
}
export function TurnTimeSelector({label,value,options,onChange,disabled=false,disabledValues=[]}:{label:string;value:number;options:readonly number[];onChange:(ms:number)=>void;disabled?:boolean;disabledValues?:readonly number[]}) {
 const name=useId(),index=Math.max(0,options.indexOf(value));
 return <fieldset className="ui-time" disabled={disabled}><legend>{label}</legend><div className="ui-time-stops" style={{'--time-position':`${(index+.5)/options.length*100}%`,gridTemplateColumns:`repeat(${options.length},minmax(0,1fr))`} as React.CSSProperties}>
  <i className="ui-time-marker" aria-hidden="true"/>{options.map(ms=><label key={ms} className="ui-time-stop"><input type="radio" name={name} aria-label={ms===0?'不限时':`${ms/1000} 秒`} checked={ms===value} disabled={disabledValues.includes(ms)} onChange={()=>onChange(ms)}/><span><strong>{ms===0?'∞':ms/1000}</strong>{ms!==0&&<small>秒</small>}</span><i aria-hidden="true"/></label>)}
 </div></fieldset>;
}
export function RuleButton({disabled=false,label='经典',onClick}:{disabled?:boolean;label?:string;onClick?:()=>void}) {
 return <div className="ui-rule"><span className="ui-control-label">规则选择</span><button type="button" className="rule-choice" disabled={disabled} aria-label={`选择规则：${label}`} onClick={onClick}><span><strong>{label}</strong><small>RULES</small></span><em>查看 / 选择</em></button></div>;
}

const avatarName={leaf:'叶子',sun:'太阳',moon:'月亮',star:'星星'};
export function Avatar({id='leaf'}:{id?:string}) {return <span className={`avatar ${id}`} aria-label={avatarName[id as keyof typeof avatarName]||'占位头像'}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 35 Q4 12 24 8 Q45 12 38 35 Q24 44 10 35Z"/><path d={id==='sun'?'M18 6 L17 1 M32 7 L35 2 M41 17 L47 15':id==='leaf'?'M24 9 Q13 0 12 9 Q13 15 24 9':id==='moon'?'M32 9 Q22 19 36 23':'M22 2 L24 7 L30 7 L26 11'}/><path d="M15 24 L17 24 M30 24 L32 24 M20 31 Q24 34 28 30"/></svg></span>;}
export function TextInput({search=false,onClear,...props}:React.ComponentProps<'input'>&{search?:boolean;onClear?:()=>void}) {
 return <span className={`ui-input-field${search?' ui-input-search archive-search-field':''}`}>
  {search&&<i aria-hidden="true"/>}<input {...props} className={`ui-text-input ${props.className||''}`.trim()}/>
  {onClear&&<button type="button" aria-label="清空搜索" disabled={props.disabled} onClick={onClear}>×</button>}
 </span>;
}
export function Identity({nickname,avatar,onName,onAvatar,disabled=false,hint='1—20 个字，仅保存在这台电脑。',error=''}:{nickname:string;avatar:string;onName:(s:string)=>void;onAvatar:(s:string)=>void;disabled?:boolean;hint?:string;error?:string}) {
 return <fieldset disabled={disabled}><label>你的昵称<TextInput aria-label="昵称" aria-invalid={!!error} aria-describedby={error||hint?"identity-note":undefined} autoComplete="off" value={nickname} onChange={e=>onName(e.target.value)}/>{(error||hint)&&<small id="identity-note" className={error?"identity-error":undefined} role={error?"alert":undefined}>{error||hint}</small>}</label><span className="label">选一个纸上头像</span><div className="avatars">{Object.entries(avatarName).map(([id,name])=><button key={id} type="button" aria-label={`头像：${name}`} aria-pressed={avatar===id} onClick={()=>onAvatar(id)}><Avatar id={id}/></button>)}</div></fieldset>;
}
export function Modal({title,children,onClose,closeDisabled=false,className='',requestCloseRef}:{title:string;children:React.ReactNode;onClose:()=>void;closeDisabled?:boolean;className?:string;requestCloseRef?:React.RefObject<(()=>void)|null>}) {
 const ref=useRef<HTMLDialogElement>(null),timer=useRef<number|null>(null),closingRef=useRef(false);
 const latest=useRef({onClose,closeDisabled});latest.current={onClose,closeDisabled};
 const [closing,setClosing]=useState(false);
 useEffect(()=>{
  const dialog=ref.current,previous=document.activeElement;
  dialog?.showModal();
  return()=>{if(timer.current!==null)window.clearTimeout(timer.current);dialog?.close();if(previous instanceof HTMLElement&&previous.isConnected&&!document.querySelector('dialog[open]'))previous.focus();};
 },[]);
 const requestClose=()=>{
  if(latest.current.closeDisabled||closingRef.current)return;
  closingRef.current=true;if(ref.current)ref.current.inert=true;setClosing(true);
  timer.current=window.setTimeout(()=>{
   timer.current=null;
   if(latest.current.closeDisabled){closingRef.current=false;if(ref.current)ref.current.inert=false;setClosing(false);return;}
   ref.current?.close();latest.current.onClose();
  },window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:240);
 };
 useEffect(()=>{if(requestCloseRef)requestCloseRef.current=requestClose;return()=>{if(requestCloseRef)requestCloseRef.current=null;};},[requestCloseRef,closeDisabled,onClose]);
 return <dialog ref={ref} className={`tech-dialog ${className}`.trim()} data-closing={closing} onKeyDownCapture={e=>{if(e.key==='Escape'||closingRef.current){e.preventDefault();e.stopPropagation();if(e.key==='Escape')requestClose();}}} onClickCapture={e=>{if(closingRef.current){e.preventDefault();e.stopPropagation();}}} onCancel={e=>{e.preventDefault();requestClose();}} aria-label={title}><header className="dialog-head"><span className="dialog-index">SYSTEM // DIALOG</span><h2>{title}</h2><button className="dialog-close" disabled={closeDisabled||closing} onClick={requestClose} aria-label="关闭弹窗"><i/><i/><small>ESC</small></button></header>{children}</dialog>;
}
