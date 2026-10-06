import React from 'react';
import {SKILLS,skillNames,presetNames,type RulesSnapshot,type PackManifest} from './types';
export function RulesSummary({snapshot,manifests=[]}:{snapshot:RulesSnapshot;manifests?:PackManifest[]}){
 const p=snapshot.parameters,disabled=SKILLS.filter(key=>!snapshot.skill_flags[key]);
 const selected=manifests[0]?.presets.find(item=>`pack:${manifests[0].id}:${item.id}`===snapshot.preset_id);
 const custom=SKILLS.some(key=>snapshot.skill_flags[key]!== (selected?.skill_defaults[key]??true))||(snapshot.preset_id==='firepower'&&p.charge_gain_dd6==='30');
 return <section className="rules-summary" aria-label="已确认规则" data-rules-hash={snapshot.rules_hash}>
  <h3>{presetNames[snapshot.preset_id]||selected?.name||'扩展包'}{custom?'·自定义':''}{snapshot.preset_id!=='classic'&&<small>试验玩法</small>}</h3>
  <p>每局 {Number(p.opening_dd6)/6} DD 开始 · 一次攒 {Number(p.charge_gain_dd6)/6} DD{p.opening_dd6==='6'?' · 无需还款':''}</p>
  {p.lucky_probability_bps>0&&<p>适用攻击有 {p.lucky_probability_bps/100}% 概率升一级；支付原价，只转换一次。更高档攻击未必更有利。</p>}
  <p>{disabled.length?`本规则禁用：${disabled.map(key=>skillNames[key]).join('、')}`:'八项技能全部开启'}</p>
  {selected&&<p>{selected.description}<small>作者：{manifests[0].author}（自报） · {manifests[0].version}</small></p>}
 </section>;
}
