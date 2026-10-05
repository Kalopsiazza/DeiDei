import React, {createContext,useContext} from 'react';
import type {CardStyle,Manual} from './types';

// One preference covers local/online battles, history, resources and the manual.
export const CardStyleContext=createContext<CardStyle>('illustrated');
export function MoveArt({entryId,full=false}:{entryId:string;full?:boolean}) {
 const style=useContext(CardStyleContext),complete=full&&style==='illustrated';
 return <img className={complete?'full-card-face':undefined} src={complete?`assets/cards/${entryId}.webp`:`assets/${style==='classic'?'moves-classic':'moves'}/${entryId}.png`} alt=""/>;
}

export function CardSettingsPanel({value,onChange,manual}:{value:CardStyle;onChange:(value:CardStyle)=>void;manual:Manual|null}) {
 const samples=['Bi','Def','Charge'].map(id=>manual?.entries.find(entry=>entry.entry_id===id)).filter(entry=>!!entry);
 return <div className="card-style-panel">
  <p className="card-style-intro">挑一副喜欢的牌。牌桌、出牌记录与图鉴一起切换。</p>
  <fieldset className="card-style-choices"><legend className="sr-only">卡牌风格</legend>
   {([['illustrated','绘画牌面','铜金刻线 · 纸绘质感'],['classic','原版卡牌','原有图标 · 折射卡框']] as const).map(([id,title,note])=><label className="card-style-option" data-style={id} key={id}>
    <input type="radio" name="card-style" value={id} checked={value===id} onChange={()=>onChange(id)} aria-label={title}/>
    <span className="card-style-choice">
     <span className="card-style-choice-heading"><span><strong>{title}</strong><small>{note}</small></span><i aria-hidden="true"/></span>
     <span className="card-style-samples" aria-hidden="true"><CardStyleContext value={id}>{samples.map(entry=><span className={`showcase-card card-style-sample ${entry.ui_group}`} key={entry.entry_id}><header><span>{entry.doc_id}</span><em>{{attack:'攻击',defense:'防御',skill:'技能'}[entry.ui_group]}</em></header><span className="showcase-art"><MoveArt entryId={entry.entry_id} full/></span><footer><strong>{entry.name}</strong></footer></span>)}</CardStyleContext></span>
     <span className="card-style-key">{['攻击','防御','技能'].map((name,index)=><span key={name} data-category={['attack','defense','skill'][index]}><i/>{name}</span>)}</span>
    </span>
   </label>)}
  </fieldset>
  <p className="card-style-note">选择即可预览，保存后下次启动沿用。</p>
 </div>;
}
