import React,{useEffect,useId,useRef,useState} from 'react';
import {Modal,TextInput} from '../SharedUI';
import {RulesSummary} from './RulesSummary';
import {SKILLS,skillNames,classicRequest,modeLabel,type RulesRequest,type RulesSnapshot,type RulesLibrary,type PackManifest} from './types';
const notes:Record<string,string>={classic:'经典1.0.1，默认体验。',firepower:'一次攒2 DD，可选5 DD。攻击费用与强度保持原规则。',loan:'每局以1 DD开始，本版无需还款。续拍不会再次领取。',lucky:'适用攻击有25%概率升一级，支付原价，只转换一次；不承诺更有利。'};
const errors:Record<string,string>={PACK_CONFLICT:'同一包的同一版本已有不同内容，原包已保留。',PACK_IN_USE:'先删除使用此包的命名预设，再删除包。',PACK_NOT_INSTALLED:'这份包不在本机规则库，请导入或换一个模式。',RULE_LIBRARY_DAMAGED:'规则库无法验证，原文件已保留。',RULE_LIBRARY_SAVE_FAILED:'规则库保存失败，原文件已保留。'};
type Props={value:RulesRequest;onApply:(request:RulesRequest)=>Promise<void>|void;onClose:()=>void;readonlySnapshot?:RulesSnapshot;manifests?:PackManifest[]};
export function RulePicker({value,onApply,onClose,readonlySnapshot,manifests=[]}:Props){
 const [library,setLibrary]=useState<RulesLibrary|null>(null),[mode,setMode]=useState(value.preset_id),[drafts,setDrafts]=useState<Record<string,RulesRequest>>(()=>({[value.preset_id]:structuredClone(value)})),[snapshot,setSnapshot]=useState<RulesSnapshot|null>(readonlySnapshot||null),[actualManifests,setActualManifests]=useState(manifests),[error,setError]=useState(''),[busy,setBusy]=useState(false),[name,setName]=useState(''),[confirmPack,setConfirmPack]=useState('');
 const nameId=useId(),alive=useRef(true),request=drafts[mode];
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const failure=(code:string)=>errors[code]||`规则操作未完成（${code}）`;
 const refresh=async()=>{const reply=await window.desktop.rules.read();if(!reply.ok)throw new Error(reply.error);if(alive.current)setLibrary(reply.data);};
 useEffect(()=>{if(!readonlySnapshot)void refresh().catch(e=>setError(failure(e.message)));},[]);
 useEffect(()=>{if(readonlySnapshot)return;let current=true;setSnapshot(null);void window.desktop.rules.compile(request).then(reply=>{if(!current)return;if(reply.ok){setSnapshot(reply.data.rules_snapshot);setActualManifests(reply.data.rule_pack_manifests);setError('');}else setError(failure(reply.error));});return()=>{current=false;};},[request,library]);
 const action=async(fn:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){if(alive.current)setError(failure((e as Error).message));}finally{if(alive.current)setBusy(false);}};
 const take=<T,>(r:import('../types').Reply<T>)=>{if(!r.ok)throw new Error(r.error);return r.data;};
 const edit=(next:RulesRequest)=>{setSnapshot(null);setDrafts(previous=>({...previous,[next.preset_id]:next}));setMode(next.preset_id);};
 const choose=(id:string)=>{if(drafts[id]){setSnapshot(null);setMode(id);return;}const builtin=library?.descriptors.presets.find(p=>p.id===id);if(builtin){edit(structuredClone(builtin.request));return;}for(const pack of library?.packs||[]){const p=pack.manifest.presets.find(item=>`pack:${pack.manifest.id}:${item.id}`===id);if(p){edit({...classicRequest(),preset_id:id,skill_flags:{...p.skill_defaults},pack_refs:[pack.pack_ref]});return;}}};
 return <Modal title={readonlySnapshot?'本场规则':'选择本场规则'} className="rule-dialog" closeDisabled={busy} onClose={onClose}>
  {readonlySnapshot?<><RulesSummary snapshot={readonlySnapshot} manifests={manifests}/><p>本场已经固定，准备或开局后以已确认规则为准。</p><button className="settings-action" onClick={onClose}>关闭详情</button></>:<>
   <div className="rule-workbench"><nav className="rule-mode-list" aria-label="玩法模式" tabIndex={0}>
    {(library?.descriptors.presets||[]).map(p=><label className="rule-mode" key={p.id}><input type="radio" name={nameId} checked={mode===p.id} onChange={()=>choose(p.id)}/><span>{p.name}{p.id!=='classic'&&<small>试验</small>}</span></label>)}
    {(library?.packs||[]).map(pack=><section className="rule-pack" key={pack.pack_ref.content_hash}><h4>{pack.manifest.name}</h4><small>作者自报：{pack.manifest.author}</small>{pack.manifest.presets.map(p=><label className="rule-mode" key={p.id}><input type="radio" name={nameId} checked={mode===`pack:${pack.manifest.id}:${p.id}`} onChange={()=>choose(`pack:${pack.manifest.id}:${p.id}`)}/><span>{p.name}</span></label>)}{confirmPack===pack.pack_ref.content_hash?<><span>删除本机包？活动对局保持原规则。</span><button onClick={()=>setConfirmPack('')}>保留</button><button disabled={busy} onClick={()=>void action(async()=>{setLibrary(take(await window.desktop.rules.deletePack(pack.pack_ref)));setConfirmPack('');})}>确认删除包</button></>:<button disabled={busy} onClick={()=>setConfirmPack(pack.pack_ref.content_hash)}>删除此包</button>}</section>)}
    <button className="settings-action" disabled={busy} onClick={()=>void action(async()=>setLibrary(take(await window.desktop.rules.importPack())))}>导入规则包…</button>
    {!!library?.presets.length&&<h4>命名预设</h4>}{library?.presets.map(p=><div className="rule-saved" key={p.id}><button disabled={busy} onClick={()=>edit(structuredClone(p.rules_request))}>{p.name}</button><button aria-label={`删除预设：${p.name}`} disabled={busy} onClick={()=>void action(async()=>setLibrary(take(await window.desktop.rules.deletePreset(p.id))))}>删除</button></div>)}
   </nav><section className="rule-edit" aria-label="规则内容" tabIndex={0}>
    <h3>{modeLabel(request,library)}</h3><p>{notes[mode]||'声明式规则只组合现有原生能力，作者自报，不执行脚本。'}</p>
    {mode==='firepower'&&<fieldset disabled={busy}><legend>一次攒的收益</legend>{(['12','30'] as const).map(amount=><label className="checkbox" key={amount}><input type="radio" name={nameId+'-charge'} checked={(request.preset_params.firepower_charge_dd6||'12')===amount} onChange={()=>edit({...request,preset_params:{firepower_charge_dd6:amount}})}/><span>{Number(amount)/6} DD</span></label>)}</fieldset>}
    {[SKILLS.slice(0,5),SKILLS.slice(5)].map((group,index)=><fieldset disabled={busy} key={index}><legend>{index===0?'T0 技能':'T1 技能'}</legend><div className="rule-skill-grid">{group.map(skill=><label className="checkbox" key={skill}><input type="checkbox" checked={request.skill_flags[skill]} onChange={e=>edit({...request,skill_flags:{...request.skill_flags,[skill]:e.target.checked}})}/><span>{skillNames[skill]}</span></label>)}</div></fieldset>)}
    {snapshot&&<RulesSummary snapshot={snapshot} manifests={actualManifests}/>}
    <label>保存命名预设<TextInput aria-label="预设名称" value={name} maxLength={40} onChange={e=>setName(e.target.value)}/></label><button className="settings-action" disabled={busy||!snapshot||!name.trim()} onClick={()=>void action(async()=>{setLibrary(take(await window.desktop.rules.savePreset(name,request)));setName('');})}>保存到本机预设</button>
   </section></div>
   {error&&<p className="rule-error" role="alert">{error}</p>}
   <footer className="rule-footer"><button className="settings-action" disabled={busy} onClick={()=>{setDrafts({classic:classicRequest()});setMode('classic');setSnapshot(null);}}>恢复默认</button><span>只应用当前模式 · 教程仍用经典全开</span><button disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy||!snapshot||!!error} onClick={()=>void action(async()=>{await onApply(structuredClone(request));onClose();})}>{busy?'确认中…':'应用本场规则'}</button></footer>
  </>}
 </Modal>;
}
