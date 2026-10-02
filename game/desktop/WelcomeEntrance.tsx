import React, { useEffect, useRef, useState } from 'react';

export function WelcomeEntrance({children,ready,preview,identityName,entering=false,onEnter,onExit,onPreview,disabled=false}:{children:React.ReactNode;ready:boolean;preview:boolean;identityName?:string;entering?:boolean;onEnter:()=>void;onExit:()=>void;onPreview?:()=>void;disabled?:boolean}) {
 const [stage,setStage]=useState<'opening'|'title'|'flip'|'name'>(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?'title':'opening');
 const film=useRef<HTMLVideoElement>(null);
 const [sound,setSound]=useState(false);
 const scene=useRef<HTMLElement>(null);
 const finishOpening=()=>{film.current?.pause();setStage('title');};
 useEffect(()=>{
  if(!entering)return;
  const timer=window.setTimeout(onExit,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1400);
  return()=>window.clearTimeout(timer);
 },[entering]);
 useEffect(()=>{
  if(stage!=='opening')return;
  const video=film.current!;
  video.currentTime=0;
  video.play().catch(finishOpening);
  return()=>video.pause();
 },[stage]);
 useEffect(()=>{
  if(stage!=='flip')return;
  const timer=window.setTimeout(()=>setStage('name'),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1400);
  return()=>window.clearTimeout(timer);
 },[stage]);
 useEffect(()=>{
  if(stage==='title')scene.current?.querySelector<HTMLButtonElement>('.welcome-action')?.focus();
  if(stage==='name')scene.current?.querySelector<HTMLElement>(ready?'.welcome-card-front .welcome-action':'input')?.focus();
 },[stage,ready]);
 const shortName=identityName&&([...identityName].length>6?[...identityName].slice(0,6).join('')+'…':identityName);
 return <main ref={scene} className="welcome-scene" data-stage={entering?'entering':stage} data-from={stage} data-ready={ready} inert={entering}>
  <div className="welcome-glass" aria-hidden="true"/>
  <video ref={film} className="welcome-film" src="assets/menu/welcome-opening-v1.mp4" muted={!sound} playsInline preload="auto" onEnded={finishOpening} onError={finishOpening} aria-hidden="true"/>
  {stage==='opening'&&<nav className="welcome-film-controls" aria-label="开场播放操作"><button aria-label={sound?'关闭开场声音':'开启开场声音'} aria-pressed={sound} onClick={()=>setSound(!sound)}>{sound?'♫':'♪'}</button><button onClick={finishOpening}>跳过开场 <span aria-hidden="true">→</span></button></nav>}
  <header className="welcome-tools"><nav aria-label="欢迎界面操作">{stage==='title'&&<button onClick={()=>setStage('opening')}>重播开场</button>}{onPreview&&<button disabled={disabled} onClick={onPreview}>开发预览</button>}{preview&&<button disabled={disabled} onClick={onExit}>结束预览，返回主菜单</button>}</nav></header>
  <section className="welcome-title" inert={stage!=='title'} aria-label="进入牌厅">
   <h1>DeiDei</h1><i/><p>攒一拍，再出招。</p><button className="welcome-action" aria-label={identityName?`以${identityName}身份进入牌厅`:undefined} disabled={disabled} onClick={()=>identityName?onEnter():setStage('flip')}><span>{identityName?`以 ${shortName} 身份进入牌厅`:'进入牌厅'}</span><b aria-hidden="true">→</b></button>
  </section>
  <section className="welcome-card" aria-label={stage==='title'?'悬浮卡牌':'你的第一张牌'} inert={stage!=='name'}>
   <div className="welcome-card-turn">
    <div className="welcome-face welcome-card-back" aria-hidden="true"><img src="assets/menu/welcome-card-back-v1.png" alt=""/></div>
    <div className="welcome-face welcome-card-front">
     {stage==='name'&&<div className="welcome-card-content" key={ready?'ready':'name'}><span className="welcome-card-kicker">你的第一张牌</span><h2>{ready?'你的牌，已就位。':'这张牌，属于你。'}</h2>{children}</div>}
    </div>
   </div>
  </section>
 </main>;
}
