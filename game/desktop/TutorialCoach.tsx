import React, {useEffect, useState} from 'react';
import { BackButton } from './SharedUI';
import type {DesktopView} from './types';
import {ddText} from './view-loop';
const lessons=[
 {title:'先攒一拍',pick:'点下面的「攒」。DD 是用来出招的资源；攒成功会得到 1 DD。',result:'双方都攒，没人受伤。你的 DD 从 0 变成了 1，下一拍就能用 bi。'},
 {title:'挡住一次攻击',pick:'这一拍，教学对手会出 bi。点「防」挡住它，把刚攒的 1 DD 留下来。',result:'防挡住了 bi。对手花掉 1 DD，你的 1 DD 还在；防不会花掉它。'},
 {title:'轮到你出招',pick:'对手已经没有 DD，这拍会攒。点「bi」：花掉 1 DD，攻击正在攒的对手。',result:'bi 击中了正在攒的对手，你赢下第一场！下一场双方从 0 DD 重新开始，试着自己赢一次。'},
];
export function TutorialCoach({view,busy,suspended,error,onNext,onSolo,onExit}:{view:DesktopView;busy:boolean;suspended:boolean;error:string;onNext:()=>void;onSolo:()=>void;onExit:()=>void}) {
 const tutorial=view.tutorial!;
 const [hint,setHint]=useState(false);
 useEffect(()=>setHint(false),[view.view_id]);
 const selected=view.options.find(o=>o.entry_id===view.selected_entry_id);
 const correct=selected?.entry_id===tutorial.target_entry_id;
 const revealed=view.phase==='revealed';
 const lesson=lessons[tutorial.step];
 const me=view.participants.find(p=>p.player_id===view.self_id)!;
 const opponent=view.participants.find(p=>p.player_id!==view.self_id)!;
 const title=tutorial.stage==='complete'?'你已经会玩第一局了':tutorial.stage==='guided'?lesson.title:'自己试一场';
 const challengeHint=opponent.resources.dd6==='0'
   ? me.resources.dd6==='0'?'双方都没有 DD，可以先攒一拍。':'对手没有 DD，会攒。想赢下这一拍，可以用 bi。'
   :'对手有 DD，会出 bi。防可以挡住它，把自己的 DD 留下来。';
 let text=tutorial.stage==='complete'?'攒得到 DD，防挡住 bi，bi 花 1 DD 攻击。接下来可以进入普通单人，遇到新牌再去图鉴查看。':
  tutorial.stage==='guided'?revealed?lesson.result:view.phase==='submitting'?'招式已锁定。看牌桌，双方即将一起揭晓。':correct?'选好了。点右下方「确认出招」，双方才会一起揭晓。':selected?`这一步先试「${view.options.find(o=>o.entry_id===tutorial.target_entry_id)?.name}」。${lesson.pick}`:lesson.pick:
  revealed?tutorial.ended?tutorial.won?'你自己赢了！点完成教程，准备进入普通单人。':'这次被击中了。攒遇到 bi 会被淘汰；重试这一场，试着先挡住攻击。':`这一拍结束，你有 ${ddText(me.resources.dd6)} DD。看看双方出招和资源，再决定下一拍。`:
  view.phase==='submitting'?'这拍已经交牌，等双方一起揭晓。':hint?challengeHint:'观察双方的 DD，从三张牌里自己做决定。教学对手无 DD 时攒，有 DD 时用 bi；赢下这一场即可完成。';
 return <section className="tutorial-coach" aria-label="新手实战指导" data-stage={tutorial.stage}>
  <div><span className="tutorial-kicker">新手实战 · {tutorial.stage==='guided'?`${tutorial.step+1} / 4`:tutorial.stage==='challenge'?'4 / 4':'已完成'} · 教学对手</span><span className="tutorial-resource-readout">你 {ddText(me.resources.dd6)} DD · 教学对手 {ddText(opponent.resources.dd6)} DD</span><h2>{title}</h2><p role={error?'alert':'status'}>{error&&<span className="tutorial-correction">{error} </span>}{text}</p></div>
  <nav aria-label="教程操作">
   {tutorial.stage==='challenge'&&!revealed&&view.phase==='selecting'&&<button disabled={suspended||busy} aria-pressed={hint} onClick={()=>setHint(v=>!v)}>{hint?'收起提示':'给点提示'}</button>}
   {revealed&&tutorial.stage!=='complete'&&<button className="primary" disabled={suspended||busy} onClick={onNext}>{tutorial.stage==='guided'?tutorial.step===2?'开始独立练习':'明白了，继续':tutorial.ended?tutorial.won?'完成教程':'重试独立练习':'继续下一拍'}</button>}
   {tutorial.stage==='complete'&&<><button className="primary" disabled={busy||suspended} onClick={onSolo}>进入普通单人</button><BackButton disabled={busy||suspended} onClick={onExit}>返回主菜单</BackButton></>}
  </nav>
 </section>;
}
