import type { DesktopView, Manual, Option, Participant, Profile, Scene } from './types';
import catalog from './catalog.json';
import availability from './fixture-availability.json';
export const manual = catalog as Manual;
const zero = { dd6: '0', lightning: '0', nx_charge: '0', mature_bombs: '0', reward_stock: '0' };
export const scenes: Scene[] = ['initial','midgame','spectator','eliminated','restart','winner','draw','invalid'];
// ponytail: two authored snapshots only; replace FixturePort with WorkerPort at integration.
function options(mid: boolean): Option[] {
  const list = structuredClone(manual.entries).map(({ description: _description, ...o }) => o);
  for (const o of list) {
    const dd: Record<string,string> = { Bi:'1',Three:'3',BigBi:'5',Reflect:'1',Bomb:'1',Xiao:'1/3',Pragon:'2',Volvo:'4',RotateThree:'6',XiaoBei:'7',FlipVolvo:'8',Shell:'10',Absorb:'1' };
    if (dd[o.entry_id]) { o.cost_text = `${dd[o.entry_id]} DD`; o.requirement_text = `持有 ${dd[o.entry_id]} DD`; }
    else if (o.entry_id === 'NieXiang') { o.cost_text='4充能·0DD'; o.requirement_text='持有 4 充能'; }
    else if (o.entry_id.startsWith('Bomb')) { o.cost_text=`${o.spend.mature_bombs}层·0DD`; o.requirement_text=`持有 ${o.required.mature_bombs} 成熟层`; }
    else if (o.entry_id.startsWith('Free')) { o.cost_text=`${o.spend.lightning}雷电·0DD`; o.requirement_text=`持有 ${o.required.lightning} 雷电`; }
    else if (o.entry_id === 'ZhangXinWei') { o.cost_text='0 DD'; o.requirement_text='未用 · 需有效记录'; }
    else if (o.entry_id === 'ZengRewardBigBi') { o.cost_text='1奖励·0DD'; o.requirement_text='持有 1 份奖励'; }
    else { o.cost_text='0 DD'; o.requirement_text=['Cloud','TianLiJun'].includes(o.entry_id)?'本局首次':['LiQiang','ZengYi'].includes(o.entry_id)?'本局未用':'无资源门槛'; }
  }
  if (!mid) return list;
  for (const o of list) {
    const reason = (availability.midgame_unavailable as Record<string,string>)[o.entry_id];
    o.available = !reason; o.reason_code = reason || null;
    if (o.entry_id === 'Xiao') { o.name = '削（强化）'; o.spend.dd6 = '0'; o.cost_text = '0 DD'; o.requirement_text = '持有 ≥1/3 DD'; }
    if (o.entry_id === 'Cloud') { o.required.dd6 = o.spend.dd6 = '6'; o.cost_text = '1 DD'; o.requirement_text = '持有 1 DD'; }
    if (o.entry_id === 'TianLiJun') { o.required.dd6 = o.spend.dd6 = '3'; o.cost_text = '1/2 DD'; o.requirement_text = '持有 1/2 DD'; }
    if (o.entry_id === 'ZhangXinWei') { o.requirement_text = '未用·记录Pragon'; o.cost_text = '0 DD'; }
  }
  return list;
}
export class FixturePort {
  private serial = 0;
  private view!: DesktopView;
  private submittedAt: number|null = null;
  private errorOnce = false;
  private solo = false;
  private progress = '';
  constructor(private profile?: Profile, private now: () => number = Date.now) { this.reset('initial'); }
  private reset(scene: Scene, profile?: Profile): DesktopView {
    this.serial++; this.submittedAt = null; this.errorOnce = scene === 'invalid'; this.solo = !!profile;
    const mid = ['midgame','winner','draw','invalid'].includes(scene);
    const participants: Participant[] = Array.from({ length: profile ? 2 : 6 }, (_, i) => ({
      player_id: i === 0 && profile ? profile.local_id : `player_${i+1}`, nickname: i === 0 && profile ? profile.nickname : profile ? '纸上同学 · 演示对手' : `玩家 ${String(i+1).padStart(2,'0')}`,
      avatar_id: i === 0 && profile ? profile.avatar_id : ['leaf','sun','moon','star'][i%4], alive: true,
      resources: { ...zero, enhanced_xiao: false, cloud_uses: '0', tian_uses: '0', bomb_placement_count: '0' }, submission_state: i % 2 ? 'submitted' : 'thinking'
    }));
    if (mid) participants[0].resources = { dd6:'36',lightning:'3',nx_charge:'4',mature_bombs:'2',reward_stock:'1',enhanced_xiao:true,cloud_uses:'1',tian_uses:'1',bomb_placement_count:'3' };
    if (scene === 'eliminated' || scene === 'restart') { participants[0].alive = false; participants[0].submission_state = 'out'; }
    if (scene === 'restart') { participants[4].alive = false; participants[4].submission_state = 'out'; }
    this.progress = mid ? '本人进度：待成熟 0 · 炸药放置 3 次 · 云 / 田利军首次已用 · 张新伟未用，记录 Pragon · 历强已用 · 曾义奖励可用' : '本人进度：待成熟 0 · 炸药放置 0 次 · 云 / 田利军首次未用 · 张新伟未用，无记录 · 历强 / 曾义未用';
    const spectator = ['spectator','eliminated','restart'].includes(scene);
    this.view = { source:'fixture',view_id:`fixture:${this.serial}`,match_id:`demo:${this.serial}`,game_id:`demo:${this.serial}:g${scene==='restart'?'2':'1'}`,turn_index:mid?'6':'1',phase:'selecting',participants,self_id:scene==='spectator'?null:participants[0].player_id,options:spectator?[]:options(mid),selected_entry_id:null,submitted:false,timer:{ mode: profile ? 'untimed' : 'preview',remaining_ms:profile?null:8000,total_ms:profile?null:12000 },summary:[scene==='restart'?'脚本：上轮两人淘汰，其余四人新局归零，原淘汰席位仍保留。':spectator?'公开摘要：等待仍在场的玩家揭晓。':'等待共同揭晓；目前只显示公开提交状态。'],outcome:null };
    if (scene==='winner' || scene==='draw') this.finish(scene==='draw');
    return this.copy();
  }
  private copy() { const v = structuredClone(this.view); if (v.self_id && v.options.length) v.summary.push(this.progress); return v; }
  private finish(draw = false) {
    this.view.phase = 'result';
    const winner = draw ? null : this.view.participants[0].player_id;
    this.view.outcome = { winner_id:winner,reason:draw?'全员淘汰，无人获胜':'唯一存活者' };
    for (const p of this.view.participants) { p.alive = p.player_id === winner; p.submission_state = p.alive ? 'submitted' : 'out'; }
    this.view.summary = [draw?'脚本示例：全员同时淘汰。':'脚本示例：参赛者中仅一人存活。','结果由演示脚本预置，与本次选牌无关。'];
  }
  async startSolo(profileId: string) { if (!this.profile || this.profile.local_id !== profileId) throw new Error('INVALID_PROFILE'); return this.reset('initial',this.profile); }
  async preview(scene: Scene) { if (!scenes.includes(scene)) throw new Error('INVALID_SCENE'); return this.reset(scene); }
  async submit(viewId: string, entryId: string) {
    if (viewId !== this.view.view_id) throw new Error('STALE_VIEW');
    if (this.view.submitted) throw new Error('ALREADY_SUBMITTED');
    if (!['selecting','error'].includes(this.view.phase) || !this.view.options.length) throw new Error('NOT_SELECTING');
    const option = this.view.options.find(o=>o.entry_id===entryId);
    if (!option?.available) throw new Error('UNAVAILABLE_MOVE');
    this.view.selected_entry_id = entryId;
    if (this.errorOnce) { this.errorOnce=false; this.view.phase='error'; this.view.summary=['演示：提交被拒绝。选择已保留，可以重试。']; return this.copy(); }
    this.view.submitted=true; this.view.phase='submitting';
    this.view.participants.find(p=>p.player_id===this.view.self_id)!.submission_state='submitted';
    this.submittedAt=this.now(); this.view.summary=['本人已提交，等待演示对手；不会再次提交。'];
    return this.copy();
  }
  async getView() {
    if (this.submittedAt !== null) {
      const elapsed=this.now()-this.submittedAt;
      if (elapsed>=5000 && this.view.phase!=='result') this.finish();
      else if (elapsed>=1200 && this.view.phase==='submitting') {
        this.view.phase='revealed'; this.view.summary=[`本人选择：${this.view.options.find(o=>o.entry_id===this.view.selected_entry_id)?.name}。`,'脚本揭晓：演示对手选择普通防御。','这是状态演示，未计算攻击、收益或胜负。'];
      }
    }
    return this.copy();
  }
  async leave() { const v=this.reset('spectator'); this.solo=false; return v; }
  isActive() { return this.solo && this.view.phase !== 'result'; }
}
