import React, { useEffect, useRef, useState } from 'react';
import {MoveArt} from './CardArt';
import content from '../../docs/results/R04-T01-b/manual-content/content.json';
import type { Manual } from './types';
import { TextInput } from './SharedUI';
import { ddText } from './view-loop';

const cards=content.cards;
type Card=typeof cards[number];
type Example=typeof content.examples[number];
const cardById=Object.fromEntries(cards.map(card=>[card.entry_id,card]));
const terms=Object.fromEntries(content.glossary.map(term=>[term.id,term]));
const examples=Object.fromEntries(content.examples.map(example=>[example.id,example]));
const groupNames:Record<string,string>={attack:'攻击',defense:'防御',skill:'技能'};
const resourceNames:Record<string,string>=Object.fromEntries(content.resources.map(resource=>[resource.id,resource.label]));
const amounts=(values:{resource:string;amount:string}[])=>values.map(value=>`${value.amount} ${resourceNames[value.resource]}`).join(' + ')||'0';
const aliases:Record<string,string[]>=content.presentation.search_aliases;
const normalize=(text:string)=>text.toLocaleLowerCase().replace(/[\s·／/]/g,'');

function ExamplePlayer({example,scene=1}:{example:Example;scene?:number}) {
 const [round,setRound]=useState(0),[beat,setBeat]=useState(0),[playing,setPlaying]=useState(false),[replay,setReplay]=useState(0);
 const [progress,setProgress]=useState(0),elapsed=useRef(0);
 const step=example.rounds[round],frame=step.playback;
 useEffect(()=>{
  if(!playing)return;
  let phase=Math.floor(elapsed.current/2500),started=performance.now()-elapsed.current%2500,request=0;
  const advance=(now:number)=>{
   const held=Math.min(2500,now-started);
   elapsed.current=phase*2500+held;setProgress(elapsed.current/10000);
   if(held===2500){
    if(phase===3){setPlaying(false);return;}
    // ponytail: advance once per frame so a delayed frame never skips a reading step.
    phase++;started=now;setBeat(phase);
   }
   request=window.requestAnimationFrame(advance);
  };
  request=window.requestAnimationFrame(advance);
  return()=>window.cancelAnimationFrame(request);
 },[playing]);
 const eventLabels:Record<string,string>={blocked:'格挡',cancelled:'抵消',hit:'命中',eliminated:'淘汰',applied:'命中',suppressed:'攻击未生效'};
 const events=[...new Set(frame.events.map(event=>event.kind==='direct_elimination'?'直接淘汰':event.kind==='return'?'回击':eventLabels[event.result]||'攻击结算'))];
 const outcome=step.expected.eliminated_ids.length?`本拍淘汰：${step.expected.eliminated_ids.map(id=>example.players[id as 'a'|'b']).join('、')}`:'双方仍在场';
 const selectBeat=(index:number)=>{setPlaying(false);setBeat(index);elapsed.current=index*2500;setProgress(index/4);};
 const nextRound=(index:number)=>{setRound(index);selectBeat(0);};
 const togglePlay=()=>{
  if(playing){setPlaying(false);return;}
  if(elapsed.current>=10000){elapsed.current=0;setProgress(0);setBeat(0);}
  if(elapsed.current===0)setReplay(n=>n+1);
  setPlaying(true);
 };
 const playLabel=playing?'暂停场景演示':progress===1?'重播场景演示':'播放场景演示';
 return <section className="archive-example" aria-label="两人预设示例" data-beat={beat} data-playing={playing}>
  <header><div><span>场景演示</span><strong>场景 {scene}：{example.scene_label}</strong></div><div className="archive-play-control"><span className="archive-play-ring" role="progressbar" aria-label="场景播放进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)} style={{'--progress':`${progress*360}deg`} as React.CSSProperties}/><button className="archive-play" aria-label={playLabel} title={playLabel} aria-pressed={playing} onClick={togglePlay}><i aria-hidden="true" data-playing={playing}/></button></div></header>
  {example.context_copy&&<p className="archive-example-context">{example.context_copy}</p>}
  {example.rounds.length>1&&<nav className="archive-rounds" aria-label="示例回合">{example.rounds.map((_,index)=><button key={index} aria-pressed={round===index} onClick={()=>nextRound(index)}>第 {index+1} 拍</button>)}</nav>}
  <div className="archive-demo-table" key={`${example.id}-${round}-${replay}`}>
   {(['a','b'] as const).map(pid=>{
    const action=frame.actions[pid],move=cardById[action.entry_id];
    const resource=beat===3?frame.after[pid]:frame.before[pid];
    const eliminated=beat>=2&&step.expected.eliminated_ids.some(id=>id===pid);
    return <article key={pid} className="archive-demo-player" data-eliminated={eliminated}>
     <span>{example.players[pid]}</span>
     <div className={`archive-demo-card ${move?.category||'skill'}`} data-revealed={beat>0}><div className="archive-card-back" aria-hidden="true">DD</div><div className="archive-card-face" data-recovery={action.is_recovery} aria-hidden={beat===0}><MoveArt entryId={action.entry_id} full/><strong>{action.is_recovery?'系统休整':move?.name}</strong></div></div>
     <div className="archive-demo-resources"><b>{ddText(resource.dd6)} DD</b>{Number(resource.lightning)>0&&<span>雷电 {resource.lightning}</span>}{Number(resource.nx_charge)>0&&<span>充能 {resource.nx_charge}</span>}{Number(resource.mature_bombs)>0&&<span>成熟炸药 {resource.mature_bombs}</span>}{Number(resource.waiting_bombs)>0&&<span>待成熟炸药 {resource.waiting_bombs}</span>}{resource.zeng_state==='recovery'&&<span>下一拍休整</span>}{resource.zeng_state==='waiting'&&<span>等待奖励</span>}{resource.enhanced_xiao&&<span>有强化削资格</span>}{resource.zeng_state==='ready'&&<span>奖励已就绪</span>}</div>
     {beat>0&&action.entry_id!==action.actual_move&&<small className="archive-demo-actual">实际招式：{cardById[action.actual_move]?.name||action.actual_move}</small>}
     {beat>=2&&<small className="archive-demo-state">{eliminated?'本拍淘汰':'仍在场'}{action.branch&&` · ${cardById[action.branch]?.name||action.branch}`}</small>}
    </article>;
   })}
   {beat>=2&&<div className="archive-demo-effects" aria-hidden="true">{frame.events.map((event,index)=><span key={index} className="archive-demo-trail" data-kind={event.kind} data-result={event.result} data-direction={event.actor_id==='a'?'right':'left'} style={{'--delay':`${index*180}ms`} as React.CSSProperties}/>)}</div>}
   <div className="archive-demo-center" aria-hidden="true"><span>{beat===0?'?':beat===1?'VS':events.includes('直接淘汰')?'直接淘汰':events.includes('回击')?'回击':events[0]||'结算'}</span></div>
  </div>
  <div className="archive-demo-beats" aria-label="演示步骤">{content.creative_brief.example_storyboard.map((item,index)=><button key={item.beat} aria-pressed={beat===index} onClick={()=>selectBeat(index)}>{index+1} · {item.copy}</button>)}</div>
  {beat>=2&&<p className="archive-example-result" role="status">{outcome}{events.length>0&&` · ${events.join(' / ')}`}</p>}
  {beat===3&&<p>{round===example.rounds.length-1?example.result_copy:'这一拍结束。切换到下一拍，继续看状态变化。'}</p>}
 </section>;
}

function Precision({card}:{card:Card}) {
 return <div className="archive-precision">
  <h3>属性按状态分别看</h3>
  {card.combat_modes.map(mode=><section className="archive-mode" key={mode.label}>
   <header><strong>{mode.label}</strong></header>
   <dl className="archive-stats"><div><dt>攻击强度</dt><dd>{mode.attack.value}</dd></div><div><dt>{mode.defense.match==='attack_collision'?'对撞防御':'防御强度'}</dt><dd>{mode.defense.value==='复制招式'?'复制招式':`${mode.defense.comparison==='equal'?'＝':'≤'} ${mode.defense.value}`}</dd></div></dl>
   <p>{mode.attack.scope}</p><p>{mode.defense.scope}</p><p>{mode.note}</p>
   {mode.defense.match==='attack_collision'&&<p className="archive-warning">对回击的防御为 0。对撞属性不能用于挡反弹回击。</p>}
   {'counterattack' in mode&&mode.counterattack&&<p>回击取原来袭强度，只返回原攻击者。</p>}
  </section>)}
  <h3>完整资格</h3><p>{card.qualification}</p>
  <h3>效果</h3><ul>{card.effects.map(text=><li key={text}>{text}</li>)}</ul>
  <h3>限制与例外</h3><ul>{card.cautions.map(text=><li key={text}>{text}</li>)}</ul>
  {card.timeline.length>0&&<><h3>什么时候发生</h3><ol className="archive-timeline">{card.timeline.map(step=><li key={step.at}><span>{step.at}</span><strong>{step.title}</strong><p>{step.text}</p></li>)}</ol></>}
 </div>;
}

export function ManualArchive({manual,onBack,onTutorial,busy,Dialog}:{manual:Manual|null;onBack:()=>void;onTutorial:()=>void;busy:boolean;Dialog:React.ComponentType<{title:string;children:React.ReactNode;onClose:()=>void;className?:string}>}) {
 const [selected,setSelected]=useState('Bi'),[search,setSearch]=useState(''),[category,setCategory]=useState('all');
 const [mode,setMode]=useState<'card'|'start'|'questions'|'rules'>('card'),[precision,setPrecision]=useState(false),[history,setHistory]=useState<string[]>([]);
 const [eggOpen,setEggOpen]=useState(false),[listMode,setListMode]=useState<'cards'|'icons'>('cards');
 const [exampleId,setExampleId]=useState('bi-charge'),[introStep,setIntroStep]=useState(0),[chapterId,setChapterId]=useState('start'),[leaving,setLeaving]=useState(false),[ruleFocus,setRuleFocus]=useState('');
 const guideRef=useRef<HTMLDivElement>(null);
 const detailRef=useRef<HTMLDivElement>(null),exitTimer=useRef<number|undefined>(undefined);
 const stackRef=useRef<HTMLDivElement>(null),sceneRef=useRef<HTMLDivElement>(null);
 const [stackScroll,setStackScroll]=useState(0),[stackHeight,setStackHeight]=useState(360);
 useEffect(()=>()=>window.clearTimeout(exitTimer.current),[]);
 useEffect(()=>{const node=stackRef.current;if(!node)return;const observer=new ResizeObserver(()=>setStackHeight(node.clientHeight));observer.observe(node);return()=>observer.disconnect();},[listMode]);
 const query=normalize(search.trim());
 const matches=cards.filter(card=>(category==='all'||card.category===category)&&normalize([card.name,card.doc_id,card.entry_id,card.beginner.summary,card.lead,...card.tags,...(aliases[card.entry_id]||[]),...card.beginner.glossary_ids.map(id=>terms[id].label)].join(' ')).includes(query));
 const index=matches.findIndex(card=>card.entry_id===selected),card=cardById[selected];
 const primaryExamples=card.beginner.primary_example_ids;
 const sceneIds=[...primaryExamples,...card.beginner.example_ids.filter(id=>!primaryExamples.includes(id))];
 useEffect(()=>{if(matches.length&&index<0)setSelected(matches[0].entry_id);},[search,category,selected]);
 useEffect(()=>{stackRef.current?.scrollTo({top:listMode==='cards'&&index>=0?index*148:0,behavior:'auto'});},[search,category,listMode]);
 useEffect(()=>{if(listMode==='cards'&&index>=0)stackRef.current?.scrollTo({top:index*148,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[selected,listMode]);
 useEffect(()=>{setPrecision(false);setEggOpen(false);setExampleId(card.beginner.primary_example_ids[0]);if(detailRef.current)detailRef.current.scrollTop=0;},[selected]);
 const selectCard=(id:string,related=false)=>{
  if(related){if(id!==selected)setHistory(previous=>[...previous,selected]);setSearch('');setCategory('all');}
  else{const position=matches.findIndex(item=>item.entry_id===id);if(listMode==='cards'&&position>=0)stackRef.current?.scrollTo({top:position*148,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  setSelected(id);setMode('card');
 };
 const previousCard=()=>{const id=history[history.length-1];if(id){setHistory(history.slice(0,-1));setSearch('');setCategory('all');setSelected(id);setMode('card');}};
 const browse=(delta:number)=>{if(matches.length){selectCard(matches[Math.max(0,Math.min(matches.length-1,index+delta))].entry_id);}};
 const readRule=(id:string)=>{const chapter=content.chapters.find(chapter=>chapter.sections.some(section=>section.rule_ids.includes(id)));setChapterId(chapter?.id||'start');setRuleFocus(id);setMode('rules');};
 const leave=()=>{if(leaving)return;setLeaving(true);exitTimer.current=window.setTimeout(onBack,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:380);};
 const activeExample=examples[card.beginner.example_ids.includes(exampleId)?exampleId:primaryExamples[0]];
 const chapter=content.chapters.find(chapter=>chapter.id===chapterId)||content.chapters[0];
 useEffect(()=>{if(mode==='rules'&&ruleFocus)guideRef.current?.querySelector<HTMLDetailsElement>(`[data-rule="${ruleFocus}"]`)?.scrollIntoView({block:'nearest'});},[mode,chapterId,ruleFocus]);
 useEffect(()=>{const node=sceneRef.current;if(!node)return;const wheel=(event:WheelEvent)=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&node.scrollWidth>node.clientWidth){event.preventDefault();node.scrollLeft+=event.deltaY;}};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[selected,precision,mode]);
 const intro=content.onboarding.steps[introStep];
 return <main className="archive-screen" data-leaving={leaving}>
  <header className="archive-heading"><button className="settings-back" onClick={leave} disabled={leaving}><span>返回主菜单</span></button><div><span>CLASSIC 1.0.1 / ARCHIVE</span><h1>招式图鉴</h1><p>{content.creative_brief.entry_copy.subtitle}</p></div><nav aria-label="图鉴阅读入口"><button className="archive-tutorial-entry" disabled={busy||leaving} onClick={onTutorial}>新手实战</button><button aria-pressed={mode==='start'} onClick={()=>setMode(mode==='start'?'card':'start')}>先看三张牌</button><button aria-pressed={mode==='questions'} onClick={()=>setMode(mode==='questions'?'card':'questions')}>常见问题</button><button aria-pressed={mode==='rules'} onClick={()=>setMode(mode==='rules'?'card':'rules')}>完整规则</button></nav></header>
  <div className="archive-workspace">
   <aside className="archive-browser" aria-label="招式选择">
    <div className="archive-search-tools"><label className="archive-search"><TextInput search aria-label="搜索招式" placeholder="搜索招式或编号" autoComplete="off" spellCheck={false} value={search} onChange={event=>{setSearch(event.target.value);setMode('card');}} onClear={search?()=>setSearch(''):undefined}/></label><button className="archive-view-toggle" aria-label={`切换为${listMode==='cards'?'图标':'卡牌'}显示`} onClick={()=>setListMode(listMode==='cards'?'icons':'cards')}><i aria-hidden="true" data-mode={listMode}/><span>{listMode==='cards'?'卡牌':'图标'}</span></button></div>
    <nav className="archive-categories" aria-label="招式分类">{[['all','全部'],['attack','攻击'],['defense','防御'],['skill','技能']].map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>{setCategory(id);setMode('card');}}>{label}</button>)}</nav>
    <div className={listMode==='cards'?'archive-stack':'archive-icon-grid'} data-count={matches.length} ref={stackRef} role="group" tabIndex={0} aria-label={listMode==='cards'?'层叠招式列表':'招式图标列表'} onScroll={event=>setStackScroll(event.currentTarget.scrollTop)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();browse(event.key==='ArrowDown'?1:-1);event.currentTarget.focus();}if(event.key==='Home'){event.preventDefault();if(matches.length)selectCard(matches[0].entry_id);event.currentTarget.focus();}if(event.key==='End'){event.preventDefault();if(matches.length)selectCard(matches[matches.length-1].entry_id);event.currentTarget.focus();}}}>
     {listMode==='cards'?<div className="archive-stack-track" style={{height:Math.max(0,matches.length-1)*148+stackHeight}}><div className="archive-stack-list" style={{height:stackHeight}}>
     {matches.map((item,position)=>{
      const offset=position*148-stackScroll,depth=Math.min(5,Math.max(0,offset/148));
      // ponytail: native sticky keeps the 33-card display stable between scroll and React frames.
      const reach=Math.max(160,stackHeight-84),y=offset<0?offset:reach*(1-Math.exp(-offset/reach));
      return <button className="archive-stack-item" key={item.entry_id} data-entry={item.entry_id} data-selected={item.entry_id===selected} aria-pressed={item.entry_id===selected} aria-label={`查看 ${item.name}`} style={{top:32+y,left:28+depth*7,width:`calc(100% - ${56+depth*14}px)`,height:128-depth*8,zIndex:matches.length-position,opacity:Math.min(1,Math.max(0,(offset+148)/48),Math.max(0,(740-offset)/148)),visibility:offset < -180||offset>740?'hidden':'visible','--depth':depth} as React.CSSProperties} onClick={()=>selectCard(item.entry_id)}><span className={`archive-stack-card ${item.category}`}><small>{item.doc_id} / {groupNames[item.category]}</small><MoveArt entryId={item.entry_id} full/><strong>{item.name}</strong></span></button>;
     })}
     </div></div>:matches.map(item=><button className={`archive-icon-tile ${item.category}`} key={item.entry_id} data-entry={item.entry_id} aria-pressed={item.entry_id===selected} aria-label={`查看 ${item.name}`} title={item.name} onClick={()=>selectCard(item.entry_id)}><MoveArt entryId={item.entry_id}/></button>)}
     {!matches.length&&<div className="archive-no-match"><strong>没有找到这张牌</strong><p>试试牌名、编号，或清空搜索。</p><button onClick={()=>{setSearch('');setCategory('all');}}>显示全部招式</button></div>}
    </div>

   </aside>
   <section className="archive-dossier" aria-label="当前档案">
    <div className="archive-detail-scroll" ref={detailRef}>
     {matches.length===0&&<div className="archive-guide"><h2>换一个关键词试试</h2><p>没有匹配的招式。清空搜索或切回全部即可继续浏览。</p></div>}
     {matches.length>0&&<article className="archive-card-detail" key={card.entry_id} data-entry={card.entry_id}>
      {history.length>0&&<button className="archive-related-back" onClick={previousCard}>‹ 回到 {cardById[history[history.length-1]].name}</button>}
      <header className={`archive-card-title ${card.category}`}><MoveArt entryId={card.entry_id} full/><div><span>{card.doc_id} · {groupNames[card.category]}</span><h2>{card.name}</h2><p>{card.beginner.summary}</p></div></header>
      <section className="archive-costs" aria-label="费用与资格">{card.costs.map(cost=><article key={cost.when}><span>{cost.when}</span><dl><div><dt>需要持有</dt><dd>{amounts(cost.requires)}</dd></div><div><dt>实际扣除</dt><dd>{amounts(cost.spends)}</dd></div></dl>{'qualification' in cost&&cost.qualification&&<p>{cost.qualification}</p>}</article>)}</section>
      <p className="archive-warning"><span>留意</span>{card.beginner.watch_out}</p>
      <nav className="archive-card-tabs" role="tablist" aria-label="档案深度" onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?false:event.key==='End'?true:!precision;setPrecision(next);event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[Number(next)].focus();}}}><button role="tab" aria-controls="archive-reading-panel" aria-selected={!precision} aria-pressed={!precision} onClick={()=>setPrecision(false)}>先看懂</button><button role="tab" aria-controls="archive-reading-panel" aria-selected={precision} aria-pressed={precision} onClick={()=>setPrecision(true)}>精确属性与完整限制</button></nav>
      <div id="archive-reading-panel" role="tabpanel" aria-label={precision?'精确属性与完整限制':'先看懂'}>{precision?<Precision card={card}/>:<>
       <section className="archive-example-picker"><h3>这两张一起出</h3><div className="archive-scene-rail" ref={sceneRef} key={selected} role="group" aria-label="场景选择">{sceneIds.map((id,index)=><button key={id} aria-pressed={activeExample.id===id} onFocus={event=>event.currentTarget.scrollIntoView({block:'nearest',inline:'nearest'})} onClick={()=>setExampleId(id)}>场景 {index+1}：{examples[id].scene_label}</button>)}</div></section>
       <ExamplePlayer key={activeExample.id} example={activeExample} scene={sceneIds.indexOf(activeExample.id)+1}/>
       <p className="archive-tip"><span>小提示</span>{card.tip.text}</p>
      </>}</div>
      {card.beginner.glossary_ids.length>0&&<section className="archive-terms"><h3>这张牌用到的词</h3>{card.beginner.glossary_ids.map(id=><details key={id}><summary>{terms[id].label}<small>{terms[id].short}</small></summary><p>{terms[id].detail}</p></details>)}</section>}
      <section className="archive-relations"><h3>关联卡牌</h3>{card.relations.slice(0,3).map(relation=><button key={relation.entry_id} onClick={()=>selectCard(relation.entry_id,true)}><MoveArt entryId={relation.entry_id}/><span><strong>{cardById[relation.entry_id].name}</strong><small>{relation.label}</small><p>{relation.note}</p></span><i>›</i></button>)}{card.relations.length>3&&<details><summary>更多关联卡牌</summary><div className="archive-more-relations">{card.relations.slice(3).map(relation=><button key={relation.entry_id} onClick={()=>selectCard(relation.entry_id,true)}><MoveArt entryId={relation.entry_id}/><span><strong>{cardById[relation.entry_id].name}</strong><small>{relation.label}</small><p>{relation.note}</p></span><i>›</i></button>)}</div></details>}</section>
      <section className="archive-rule-links"><h3>关联规则</h3>{card.rule_ids.map(id=><button key={id} onClick={()=>readRule(id)}>{manual?.sections.find(section=>section.id===id)?.text.split('\n')[0].replace(/^#+\s*/,'')||id}</button>)}</section>
      <div className="archive-egg" data-open={eggOpen}><button aria-expanded={eggOpen} onClick={()=>setEggOpen(!eggOpen)}>课间便签</button><p>{card.easter_egg.text}</p></div>
     </article>}

    </div>
   </section>
  </div>
  {mode!=='card'&&<Dialog key={mode} title={mode==='start'?'先看三张牌':mode==='questions'?'常见问题':'完整规则'} className="archive-dialog" onClose={()=>setMode('card')}><div className="archive-dialog-scroll" ref={guideRef}>
     {mode==='start'&&<article className="archive-guide"><span className="archive-kicker">第一次玩</span><h2>{content.onboarding.title}</h2><p>{content.onboarding.intro}</p><nav className="archive-guide-steps" aria-label="入门步骤">{content.onboarding.steps.map((step,index)=><button key={step.id} aria-pressed={introStep===index} onClick={()=>setIntroStep(index)}>{index+1} · {step.title}</button>)}</nav><h3>{intro.title}</h3><p>{intro.copy}</p>{intro.example_ids[0]&&<ExamplePlayer key={intro.example_ids[0]} example={examples[intro.example_ids[0]]}/>}<details className="archive-think"><summary>{intro.prompt}</summary><p>{intro.answer}</p></details>{'more_copy' in intro&&<details><summary>多人局怎样继续</summary><p>{intro.more_copy}</p></details>}<div className="archive-guide-actions">{intro.cards.map(id=><button key={id} onClick={()=>selectCard(id,true)}>查看 {cardById[id].name}</button>)}<button disabled={introStep===content.onboarding.steps.length-1} onClick={()=>setIntroStep(introStep+1)}>下一步 →</button></div><small>{content.onboarding.availability}</small></article>}
     {mode==='questions'&&<article className="archive-guide"><span className="archive-kicker">带着问题看</span><h2>你想弄清哪一件事？</h2>{content.questions.map(question=><details className="archive-question" key={question.id}><summary>{question.question}</summary><p>{question.answer}</p><div className="archive-guide-actions">{question.cards.map(id=><button key={id} onClick={()=>selectCard(id,true)}>{cardById[id].name}</button>)}</div></details>)}</article>}
     {mode==='rules'&&<article className="archive-guide"><span className="archive-kicker">规则阅读层 · 原文可追溯</span><h2>按主题查规则</h2><nav className="archive-chapters" aria-label="规则主题">{content.chapters.map(item=><button key={item.id} aria-pressed={item.id===chapter.id} onClick={()=>setChapterId(item.id)}>{item.title}</button>)}</nav><h3>{chapter.title}</h3><p>{chapter.lead}</p>{chapter.sections.map(section=><section className="archive-rule-section" key={section.title}><h3>{section.title}</h3><ul>{section.body.map(text=><li key={text}>{text}</li>)}</ul>{section.rule_ids.map(id=>{const source=manual?.sections.find(section=>section.id===id);return <details key={id} data-rule={id} open={id===ruleFocus}><summary>原条款 · {source?.text.split('\n')[0].replace(/^#+\s*/,'')||id}</summary>{source?.text.split('\n').filter(line=>line.trim()).map((line,index)=><p className="archive-original-rule" key={index}>{line.replace(/^#+\s*/,'')}</p>)}</details>;})}</section>)}<div className="archive-guide-actions">{chapter.related_cards.map(id=><button key={id} onClick={()=>selectCard(id,true)}>{cardById[id].name}</button>)}</div></article>}
  </div></Dialog>}
 </main>;
}
