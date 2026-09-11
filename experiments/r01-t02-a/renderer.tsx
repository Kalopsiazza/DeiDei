import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
type Profile = { version: number; localId: string; nickname: string; avatarId: string; settings: { sound: boolean } };
type Reply = {ok: boolean; data?: unknown; error?: string};
declare global { interface Window { experiment: {
  health(): Promise<Reply>; profileRead(): Promise<Reply>; profileWrite(p: Profile): Promise<Reply>;
  runCase(id: string): Promise<Reply>; chooseEasy(seed: number): Promise<Reply>; shutdown(): Promise<Reply>;
}}}
function Panel() {
  const [nickname, setNickname] = useState('本机测试者');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [seed, setSeed] = useState('42');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('请点击 Health 开始。失败后可再次点击重试。');
  async function run(label: string, action: () => Promise<Reply>) {
    setBusy(true); const start = performance.now();
    try { const r = await action(); setLog(`${label} · ${(performance.now()-start).toFixed(1)} ms\n${JSON.stringify(r, null, 2)}`); }
    catch { setLog(`${label} · IPC_FAILED`); }
    finally { setBusy(false); }
  }
  async function read() {
    const r = await window.experiment.profileRead();
    if (r.ok && r.data) { const p = r.data as Profile; setProfile(p); setNickname(p.nickname); }
    return r;
  }
  async function save() {
    const existing = await window.experiment.profileRead();
    if (!existing.ok) return existing;
    const p = { version: 1, localId: (existing.data as Profile | null)?.localId ?? profile?.localId ?? crypto.randomUUID(),
      nickname, avatarId: 'test-1', settings: { sound: false } };
    const r = await window.experiment.profileWrite(p); if (r.ok) setProfile(p); return r;
  }
  return <main><small>R01-T02-a / 独立实验 / 非正式游戏</small><h1>桌面技术验证</h1>
    <p>本地素材、测试档案与 Python 规则调用。六席位仅为固定显示样本。</p>
    <section className="seats" aria-label="六个固定席位">{Array.from({length:6}, (_,i)=><div key={i}>席位 {i+1}<br/><span>TEST ONLY</span></div>)}</section>
    <section className="cards" aria-label="本地素材样本">{['攒','Bi','防御'].map(name=><figure key={name}><img src="app://experiment/card.svg" alt={`${name}测试卡图`}/><figcaption>{name}</figcaption></figure>)}</section>
    <fieldset disabled={busy}><legend>验证操作</legend>
    <button onClick={()=>run('Health', window.experiment.health)}>Health / 重试</button>
    <button onClick={()=>run('停止 worker', window.experiment.shutdown)}>停止 worker</button>
    <div><label>测试昵称 <input value={nickname} maxLength={40} onChange={e=>setNickname(e.target.value)}/></label>
    <button onClick={()=>run('档案写入', save)}>写入档案</button><button onClick={()=>run('档案读取', read)}>读取档案</button></div>
    <div>{[['charge_charge','双方攒'],['bi_charge','Bi 对攒'],['bi_def','Bi 对防御'],['reflect_bi','反弹对 Bi']].map(([id,label])=><button key={id} onClick={()=>run(label,()=>window.experiment.runCase(id))}>{label}</button>)}</div>
    <label>Easy 随机种子 <input type="number" min="0" max="4294967295" value={seed} onChange={e=>setSeed(e.target.value)}/></label>
    <button onClick={()=>run('Easy heuristic', ()=>window.experiment.chooseEasy(Number(seed)))}>请求简单 AI</button></fieldset>
    <h2>调用结果 {busy ? '· 等待中（最多 10 秒）' : ''}</h2><pre role="status">{log}</pre>
    <footer>结果记录旧程序行为；不代表正式玩法确认。专家模型不在此包中。</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Panel/>);
