import React,{useEffect,useRef,useState} from 'react';
import type {Settings,Manual} from './types';
import type {GraphicsSettings} from './graphics.cjs';
import type {PrivacyState,PrivacyPreview,PrivacyScope} from './privacy/types';
import type {UpdateState} from './updates/types';
import type {HardwareState,SampleResult,SampleTicket} from './hardware/types';
import {sampleScene} from './hardware/SampleRunner';
import {GraphicsSettingsPanel} from './GraphicsSettingsPanel';
import {CardSettingsPanel} from './CardArt';
import {BackButton,Identity,Select} from './SharedUI';
const take=<T,>(reply:{ok:true;data:T}|{ok:false;error:string}):T=>{if(!reply.ok)throw Error(reply.error);return reply.data;};
const warnings:Record<string,string>={STOPPED_NOT_SAVED_RETRY_NEXT_START_MAY_RESTORE:'本次已停止，关闭选择尚未写入，请重试；下次启动可能仍读取原保存值。',ERASURE_PENDING:'已停止上传，删除请求等待服务确认。离线时可稍后重试。',PRIVACY_STATE_UNREADABLE_OR_UNWRITABLE:'隐私状态无法验证，上传已关闭。请检查本机存储后重试。',CONSENT_CONFIRMATION_PENDING:'同意已保存，等待收集服务确认，当前仍未发送统计。',UPLOAD_RETRY_PENDING:'暂时无法上报，等待有限退避重试。',UPLOAD_REJECTED:'服务拒绝了报告，当前上传已停止。',LOCAL_USAGE_SAVE_FAILED:'本机摘要写入失败，本次设置保存不受影响。',CLEAR_LOCAL_FAILED:'清除未完整完成，请重试。'};
const text=(error:unknown)=>({SAMPLE_CONTEXT_CHANGED:'本次短测因窗口、焦点或系统偏好变化而失效，请保持窗口可见后重测。',SAMPLE_EXPIRED:'本次短测因窗口、焦点或系统偏好变化而失效，请保持窗口可见后重测。',SAMPLE_CANCELLED:'已取消短测，临时逐帧样本已丢弃。',SAMPLE_TOO_FEW:'有效样本不足，本次结果无效。',SAMPLE_NOT_VISIBLE:'短测需要游戏窗口保持可见并获得焦点。',UPLOAD_UNAVAILABLE:'请先启用本机记录，并配置可信收集服务及安全存储。'}[(error as Error).message]||`操作未完成（${(error as Error).message}），可重试。`);
const labels:Record<string,string>={idle:'当前版本',checking:'正在检查',available:'可下载新版本',downloading:'正在下载',verifying:'正在校验',ready:'已准备安装',installing:'原生安装正在接管',error:'更新未完成',not_supported:'当前运行方式不支持原生更新'};
const presetLabel={high:'高质量',balanced:'均衡',smooth:'流畅'};
type Props={windowState:{requested:boolean|null;actual:boolean;pending:boolean}|null;settings:Settings;onSettings:(value:Settings)=>void;nickname:string;avatar:string;onName:(value:string)=>void;onAvatar:(value:string)=>void;manual:Manual|null;saving:boolean;dirty:boolean;onClose:()=>void;onSave:()=>void;onRecommend:(graphics:GraphicsSettings,token:string)=>void};
export function SettingsScreen(p:Props){
 const [tab,setTab]=useState('声音'),[error,setError]=useState('');const scroll=useRef<HTMLDivElement>(null);
 const [privacy,setPrivacy]=useState<PrivacyState|null>(null),[preview,setPreview]=useState<PrivacyPreview|null>(null),[privacyBusy,setPrivacyBusy]=useState(false);
 const [updates,setUpdates]=useState<UpdateState|null>(null),[updateBusy,setUpdateBusy]=useState(false);
 const [hardware,setHardware]=useState<HardwareState|SampleResult|null>(null),[remaining,setRemaining]=useState<number|null>(null),[sampleMessage,setSampleMessage]=useState('');
 const recommendationElement=useRef<HTMLDivElement>(null);
 const sample=useRef<{ticket:SampleTicket;controller:AbortController}|null>(null),privacySequence=useRef(0),updateGeneration=useRef(-1);
 const acceptPrivacy=(state:PrivacyState,sequence:number)=>{if(sequence!==privacySequence.current)return;setPrivacy(current=>current&&state.revision<current.revision?current:state);};
 const acceptUpdate=(state:UpdateState)=>{if(state.generation<updateGeneration.current)return;updateGeneration.current=state.generation;setUpdates(state);};
 useEffect(()=>{let live=true;const sequence=++privacySequence.current;void window.desktop.privacy.read().then(reply=>{if(live&&reply.ok)acceptPrivacy(reply.data,sequence);else if(live&&!reply.ok)setError(text(Error(reply.error)));});void window.desktop.updates.read().then(reply=>{if(live&&reply.ok)acceptUpdate(reply.data);});void window.desktop.hardware.read().then(reply=>{if(live&&reply.ok)setHardware(reply.data);});const unbind=window.desktop.updates.onChange(state=>{if(live)acceptUpdate(state);});return()=>{live=false;unbind();if(sample.current){sample.current.controller.abort();void window.desktop.hardware.cancelSample(sample.current.ticket.token);}};},[]);
 useEffect(()=>{const node=scroll.current;if(!node)return;node.scrollTop=0;const edges=()=>{node.dataset.edgeTop=String(node.scrollTop>1);node.dataset.edgeBottom=String(node.scrollHeight-node.clientHeight-node.scrollTop>1);};const observer=new ResizeObserver(edges);observer.observe(node);if(node.firstElementChild)observer.observe(node.firstElementChild);node.addEventListener('scroll',edges);edges();return()=>{observer.disconnect();node.removeEventListener('scroll',edges);};},[tab]);
 useEffect(()=>{const node=recommendationElement.current;if(tab!=='画面'||!hardware||!node)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){void window.desktop.hardware.presentRecommendation(hardware.recommendation.token);observer.disconnect();}},{root:scroll.current,threshold:.1});observer.observe(node);return()=>observer.disconnect();},[tab,hardware?.recommendation.token]);
 const privacyAction=async(operation:()=>Promise<{ok:true;data:PrivacyState}|{ok:false;error:string}>)=>{const sequence=++privacySequence.current;setPrivacyBusy(true);setError('');try{acceptPrivacy(take(await operation()),sequence);setPreview(null);}catch(e){setError(text(e));}finally{if(sequence===privacySequence.current)setPrivacyBusy(false);}};
 const stop=()=>{setPrivacy(current=>current?{...current,effectiveScopes:{preferences:false,performance:false},status:'stopped'}:current);void privacyAction(()=>window.desktop.privacy.stop());};
 const scope=(key:PrivacyScope,value:boolean)=>privacy&&void privacyAction(()=>window.desktop.privacy.setScope(key,value,privacy.revision,privacy.stateToken));
 const updateAction=async(operation:()=>ReturnType<typeof window.desktop.updates.read>)=>{setUpdateBusy(true);setError('');try{acceptUpdate(take(await operation()));}catch(e){setError(text(e));}finally{setUpdateBusy(false);}};
 const begin=async()=>{setError('');setSampleMessage('');try{const ticket=take(await window.desktop.hardware.beginSample(p.settings.graphics));const controller=new AbortController();sample.current={ticket,controller};setRemaining(10);const summary=await sampleScene(ticket,setRemaining,controller.signal);const result=take(await window.desktop.hardware.finishSample(ticket.token,summary));setHardware(result);setSampleMessage(`场景 ${result.sample.width}×${result.sample.height}，DPR ${result.sample.dpr}；实际组合 ${result.sample.effectiveGraphics.ambientMotion}/${result.sample.effectiveGraphics.glass}/${result.sample.effectiveGraphics.decoration}。系统减少动态：${result.system.reducedMotion?'是':'否'}，减少透明：${result.system.reducedTransparency?'是':'否'}。有效 ${result.sample.count} 个 rAF 间隔，p95 ${result.sample.p95.toFixed(1)}ms，>50ms 比例 ${(result.sample.longIntervalRatio*100).toFixed(1)}%。`);}catch(e){setSampleMessage(text(e));if(sample.current)void window.desktop.hardware.cancelSample(sample.current.ticket.token);}finally{sample.current=null;setRemaining(null);}};
 const cancel=()=>sample.current?.controller.abort();
 const changedGraphics=(graphics:GraphicsSettings)=>{cancel();p.onSettings({...p.settings,graphics});};
 const immediate=tab==='隐私'||tab==='更新';
 return <main className="settings-layout">
<header className="settings-heading">
<BackButton className="settings-back" disabled={p.saving} onClick={p.onClose}>返回主菜单</BackButton>
<span>CONFIGURATION</span>
<h1>设置</h1>
<p>体验草稿保存后生效，隐私与更新选项立即保存。</p>
</header>
<nav aria-label="设置分类">{[['声音','AUDIO'],['画面','GRAPHICS'],['卡牌','CARDS'],['窗口','DISPLAY'],['昵称头像','PROFILE'],['隐私','PRIVACY'],['更新','UPDATES'],['关于','ABOUT']].map(([name,en])=>
<button key={name} aria-pressed={tab===name} onClick={()=>{cancel();setTab(name);}}>
<span>{name}</span>
<small>{en}</small>
</button>)}</nav>
<section className="settings-content" data-tab={tab}>
<header>
<span>{immediate?'立即保存 · IMMEDIATE':'LOCAL PREFERENCES'}</span>
<h2>{tab}</h2>
</header>{error&&<p className="settings-inline-error" role="alert">{error}</p>}<div className="settings-scroll" ref={scroll} tabIndex={0} aria-label="设置选项">
<div className="settings-tab-panel" key={tab}>{tab==='隐私'?<div className="privacy-panel">
<p>记录仅保留粗粒度摘要。两项上传分别同意，打开前的历史不补传。</p>
<p>
<strong>收集目的地：</strong>{privacy?.collectorOrigin||'尚未配置 · 仅本机记录'}</p>{privacy&&<>
<label className="checkbox">
<input type="checkbox" checked={privacy.recordLocal} disabled={privacyBusy} onChange={event=>void privacyAction(()=>window.desktop.privacy.setLocalRecording(event.target.checked))}/>
<span>记录本机使用摘要<small>立即保存 · 可关闭；关闭时同时停止两项上传。</small>
</span>
</label>
<label className="checkbox">
<input type="checkbox" checked={privacy.persistedScopes.preferences} disabled={privacyBusy||!privacy.configured||!privacy.recordLocal||!privacy.secureStorageAvailable} onChange={event=>scope('preferences',event.target.checked)}/>
<span>上传游戏与外观偏好<small>立即保存 · 版本、卡牌/画面选择、正式玩法使用次数、确实变化的保存次数、推荐展示与保存采用次数。</small>
</span>
</label>
<label className="checkbox">
<input type="checkbox" checked={privacy.persistedScopes.performance} disabled={privacyBusy||!privacy.configured||!privacy.recordLocal||!privacy.secureStorageAvailable} onChange={event=>scope('performance',event.target.checked)}/>
<span>上传本机性能摘要<small>立即保存 · OS 与硬件粗档、实际画面组合、有效短测 p95 档和长间隔比例；不开上传也能推荐。</small>
</span>
</label>
<div className="settings-control-row">
<button className="danger" onClick={stop}>立即停止全部上传</button>
<button disabled={privacyBusy} onClick={()=>void window.desktop.privacy.preview().then(reply=>{if(reply.ok)setPreview(reply.data);else setError(text(Error(reply.error)));})}>查看待上传内容（{privacy.pendingReports}）</button>
</div>
<p role="status">{privacy.effectiveScopes.preferences||privacy.effectiveScopes.performance?'所选范围已确认，可在菜单空闲时发送。':'当前没有有效的统计发送权限。'}{privacy.pendingDeletion?' 删除尚待服务确认。':privacy.status==='deleted'?' 已收到后台删除确认。':''}</p>{privacy.warning&&<p className="settings-inline-error" role="status">{warnings[privacy.warning]||`统计状态：${privacy.warning}`}</p>}<div className="settings-control-row">
<button disabled={privacyBusy} onClick={()=>void privacyAction(()=>window.desktop.privacy.clearLocal())}>清除本机统计与未发队列</button>
<button disabled={privacyBusy} onClick={()=>void privacyAction(()=>window.desktop.privacy.deleteUploaded())}>{privacy.pendingDeletion?'重试删除已上传数据':'删除已上传数据'}</button>
</div>{privacy.oldDestinations.length>0&&<p>仍保留用于删除旧报告的原目的地凭据：{privacy.oldDestinations.join('、')}</p>}{preview&&<details open>
<summary>实际待上传 JSON（不包含凭据）</summary>
<pre className="settings-json">{JSON.stringify(preview.reports,null,2)}</pre>
</details>}<p>本机汇总最多 90 天；队列最多 7 天/32 条/128KiB。统计数据和持久日志不保留 IP，但网络连接仍使用 IP。不上传昵称、头像、身份/房间标识、原硬件型号、出牌、模型输入、截图或逐帧数组。</p>
<p>删除收到后台 ACK 才完成；已主动导出的离线 CSV 无法收回。好友房通信承载对局，更新请求用于取得版本及安装包，它们分别使用必要网络请求。</p>
</>}</div>:tab==='更新'?<div className="updates-panel">{updates?<>
<p>当前 {updates.currentVersion} · {labels[updates.status]}</p>{updates.reason&&<p role="status">{updates.reason}</p>}<label className="checkbox">
<input type="checkbox" checked={updates.preferences.autoCheck} disabled={updateBusy} onChange={event=>void updateAction(()=>window.desktop.updates.setPreferences({autoCheck:event.target.checked}))}/>
<span>自动检查更新<small>立即保存 · 启动延迟检查与周期检查；普通退出不安装。</small>
</span>
</label>
<label className="checkbox">
<input type="checkbox" checked={updates.preferences.autoDownload} disabled={updateBusy} onChange={event=>void updateAction(()=>window.desktop.updates.setPreferences({autoDownload:event.target.checked}))}/>
<span>自动下载完整安装包<small>立即保存 · 默认关闭；下载后仍需安装确认。</small>
</span>
</label>
<label className="settings-channel">
<span>更新渠道 · 立即保存</span>
<Select aria-label="更新渠道" value={updates.preferences.channel} disabled={updateBusy} onChange={event=>void updateAction(()=>window.desktop.updates.setPreferences({channel:event.target.value as 'stable'|'beta'}))} options={[{value:'stable',label:'正式'},{value:'beta',label:'Beta'}]}/>
</label>{updates.candidate&&<p>候选 {updates.candidate.version} · {(updates.candidate.bytes/1048576).toFixed(1)} MiB</p>}{updates.progress&&<>
<progress max={100} value={updates.progress.percent} aria-label="下载进度"/>
<span>{updates.progress.percent.toFixed(1)}%</span>
</>}<div className="settings-control-row">
<button disabled={updateBusy||updates.status==='not_supported'||updates.status==='downloading'||updates.status==='installing'} onClick={()=>void updateAction(()=>window.desktop.updates.check())}>检查更新</button>
<button disabled={updateBusy||!['available','error'].includes(updates.status)||!updates.candidate} onClick={()=>void updateAction(()=>window.desktop.updates.download())}>下载</button>{updates.status==='downloading'&&<button onClick={()=>void updateAction(()=>window.desktop.updates.cancelDownload())}>取消下载</button>}</div>{updates.status==='ready'&&<div className="settings-control-row">
<button disabled={updateBusy} onClick={()=>void updateAction(()=>window.desktop.updates.install('now'))}>现在重启安装</button>
<button disabled={updateBusy} onClick={()=>void updateAction(()=>window.desktop.updates.install('menu'))}>回到菜单时安装</button>
</div>}{updates.installPlan&&<>
<p>已准备安装计划；活动房间和未保存草稿需要先处理。</p>
<button onClick={()=>void updateAction(()=>window.desktop.updates.cancelInstallPlan())}>取消安装计划</button>
</>}<p>当前源码运行或未配置发布源时，会明确显示不支持。检查不降级；完整包校验与操作系统发布者信任分别验证。</p>
</>:<p role="status">正在读取更新状态…</p>}</div>:<fieldset className="settings-experience" disabled={p.saving}>{tab==='声音'?<>
<p>音源尚未加入。音量会真实保存，当前没有试听声音。</p>{(['music','effects'] as const).map(key=>
<label className="settings-range" key={key}>
<span>{key==='music'?'音乐':'音效'}<b>{p.settings[key]}%</b>
</span>
<input type="range" aria-label={key==='music'?'音乐音量':'音效音量'} min="0" max="100" value={p.settings[key]} style={{'--range-value':`${p.settings[key]}%`} as React.CSSProperties} onChange={event=>p.onSettings({...p.settings,[key]:Number(event.target.value)})}/>
</label>)}</>:tab==='画面'?<>
<GraphicsSettingsPanel value={p.settings.graphics} onChange={changedGraphics} disabled={p.saving||remaining!==null}/>
<section className="hardware-panel">
<h3>本机画面建议</h3>{hardware?<>
<p>{hardware.hardware.memoryGiB??'未知'} GiB · 可用并行度 {hardware.hardware.parallelism??'未知'} · {hardware.hardware.compositing==='hardware'?'硬件合成':hardware.hardware.compositing==='software'?'软件合成':'合成状态未知'}</p>
<div ref={recommendationElement}><strong>建议：{presetLabel[hardware.recommendation.preset]}</strong></div>{hardware.recommendation.reasons.map(reason=>
<p key={reason}>{reason}</p>)}<div className="settings-control-row">
<button disabled={remaining!==null} onClick={()=>p.onRecommend(hardware.recommendation.graphics,hardware.recommendation.token)}>应用到草稿</button>
<button disabled={remaining!==null} onClick={()=>setSampleMessage('已保持当前画面，保存值未改动。')}>保持当前</button>
</div>
</>:<p>正在读取本机信息…</p>}<p>短测约 2 秒稳定 + 8 秒采样，仅测当前可见场景的 rAF 回调间隔，不代表屏幕呈现 FPS；窗口或系统偏好变化会失效。</p>
<div className="settings-control-row">
<button disabled={remaining!==null} onClick={()=>void begin()}>在本机测一测</button>{remaining!==null&&<button onClick={cancel}>取消短测（{remaining}s）</button>}</div>{sampleMessage&&<p role="status">{sampleMessage}</p>}</section>
</>:tab==='卡牌'?<CardSettingsPanel value={p.settings.cardStyle} onChange={cardStyle=>p.onSettings({...p.settings,cardStyle})} manual={p.manual}/>:tab==='窗口'?<>
<label className="checkbox">
<input type="checkbox" checked={p.settings.fullscreen} onChange={event=>p.onSettings({...p.settings,fullscreen:event.target.checked})}/>
<span>保存后切换全屏<small>macOS 切换可能有短暂等待；已保存值与实际窗口结果分别显示。</small>
</span>
</label>
{p.windowState&&<p role="status">已保存窗口：{p.windowState.requested===null?'尚未读取':p.windowState.requested?'全屏':'窗口'} · 实际窗口：{p.windowState.actual?'全屏':'窗口'}{p.windowState.pending?' · 正在等待系统切换':' · 系统结果已确认'}</p>}
<p>窗口模式可拖动边缘调整大小。目标内容区 1366×768 / 1920×1080。</p>
</>:tab==='昵称头像'?<Identity nickname={p.nickname} avatar={p.avatar} onName={p.onName} onAvatar={p.onAvatar}/>:<>
<h3>DeiDei</h3>
<p>本机规则、原模型、好友房与可导入规则包。网络与安装各层以当前可验证状态为准。</p>
<p>原创分层美术与系统字体。</p>
</>}</fieldset>}</div>
</div>
<footer>
<span>{p.dirty?'有未保存的体验修改':'体验已与本机档案同步'}{immediate?' · 本页控制立即保存':''}</span>
<button className="settings-action settings-close" disabled={p.saving} onClick={p.onClose}>
<span>关闭</span>
</button>
<button className="settings-action settings-save primary" aria-busy={p.saving} disabled={p.saving||!p.dirty||remaining!==null} onClick={p.onSave}>
<span>{p.saving?'保存中…':'保存并关闭'}</span>
</button>
</footer>
</section>
</main>;
}
