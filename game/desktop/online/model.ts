import type { Manual, Option, Resources } from '../types';
import type { CorePlayer, OnlineState, RoomSnapshot } from './types';
import { ddText } from '../view-loop';
export const resourceNames:Record<string,string>={dd6:'DD',lightning:'雷电',nx_charge:'充能',mature_bombs:'成熟炸药',reward_stock:'奖励',pending_bombs:'待成熟炸药',bomb_placement_count:'炸药放置',enhanced_xiao:'强化削'};
export function resourceText(resources:Resources):string {
 return Object.entries(resources).filter(([,v])=>v!=='0').map(([k,v])=>`${k==='dd6'?ddText(v):v} ${resourceNames[k]}`).join(' · ')||'0 DD';
}
export function optionsFor(snapshot:RoomSnapshot|null,manual:Manual):Option[] {
 return (snapshot?.view.self.options||[]).map(o=>{
  const entry=manual.entries.find(e=>e.entry_id===o.entry_id)!;
  return {...o,name:entry.name,ui_group:entry.ui_group,detail_rule_ids:entry.detail_rule_ids,cost_text:resourceText(o.spend),requirement_text:`持有 ${resourceText(o.required)}`};
 });
}
export function publicPlayers(snapshot:RoomSnapshot):Record<string,CorePlayer> {
 const m=snapshot.view.match;if(!m)return {};
 const revealing=snapshot.view.phase==='revealing';
 return revealing&&m.last_turn ? {...m.public_state.players,...m.last_turn.core_resolution.ledger.post_turn_players} : m.public_state.players;
}
export function remainingAt(state:OnlineState,receivedAt:number,now:number):number|null {
 return state.remaining_ms===null?null:Math.max(0,state.remaining_ms-Math.max(0,now-receivedAt));
}
export function canSelect(state:OnlineState,remaining:number|null):boolean {
 const s=state.snapshot,v=s?.view,me=v?.members.find(p=>p.player_id===v.self.player_id);
 return !!v&&state.status==='connected'&&!state.pending&&v.phase==='selecting'&&me?.participation==='active'&&v.self.role==='player'&&!v.self.accepted_entry_id&&!state.confirmed&&remaining!==null&&remaining>0;
}
export function canSetTurnLimit(state:OnlineState):boolean {
 const v=state.snapshot?.view,me=v?.members.find(p=>p.player_id===v.self.player_id);
 return !!v&&state.status==='connected'&&v.host_id===v.self.player_id&&!!me?.connected&&!v.pending_close&&['lobby','selecting','revealing','result'].includes(v.phase);
}
export function hostRecoveryText(snapshot:RoomSnapshot,remaining:number|null):string {
 const h=snapshot.view.host_recovery;
 if(!h)return '';
 return h.kind==='grace'?`房主恢复剩余 ${Math.ceil((remaining||0)/1000)} 秒，其他人的牌局继续。`:`房主连续缺席 ${h.missing_count} / ${h.close_at_count} 拍 · 前三次代攒，第四次缺席关房；牌局继续，强制休整按规则执行。`;
}
export function startReason(snapshot:RoomSnapshot):string {
 const players=snapshot.view.members.filter(p=>p.role==='player');
 return players.length<2?'至少两位玩家':players.some(p=>!p.connected)?'有人掉线':players.some(p=>!p.ready)?'有人未准备':'';
}
export function turnSummary(snapshot:RoomSnapshot,manual:Manual):string[] {
 const m=snapshot.view.match,t=m?.last_turn;if(!m||!t)return ['还没有已揭晓的招式。'];
 const name=(id:string|null)=>m.roster_profiles.find(p=>p.player_id===id)?.nickname||'系统';
 const move=(id:string|null)=>manual.entries.find(e=>e.entry_id===id)?.name||id||'';
 const sources:Record<string,string>={human:'本人提交',timeout_auto:'超时代理',forced:'强制休整'};
 const result:string[]=[];
 for(const [pid,a] of Object.entries(t.core_resolution.ledger.actions))result.push(`${name(pid)}：${a.is_recovery?'曾义休整':move(a.entry_id)} → ${move(a.actual_move)}${a.branch?` → ${move(a.branch)}`:''}${a.condition?` · ${a.condition==='success'?'成功':'失败'}`:''}；实付 ${resourceText(a.spend)}；${sources[t.action_sources[pid]]||'已揭晓'}。`);
 for(const e of t.core_resolution.ledger.events) {
  if(e.resource_delta===null||e.resource_delta==='0')continue;
  if(e.result!=='applied'){result.push(`${name(e.target_id||e.actor_id)}：${e.reason_code==='CHARGE_CANCELLED'?'攒未生效，DD 没有增加':'此资源变动未生效'}。`);continue;}
  const neg=e.resource_delta.startsWith('-'),value=neg?e.resource_delta.slice(1):e.resource_delta;
  result.push(`${name(e.target_id||e.actor_id)}：${neg?'-':'+'}${e.resource==='dd6'?ddText(value):value} ${resourceNames[e.resource||'']||'资源'}。`);
 }
 for(const pid of t.core_resolution.ledger.eliminated_ids)result.push(`${name(pid)}：本拍淘汰。`);
 for(const f of t.room_forfeits)result.push(`${name(f.player_id)}：${f.reason==='three_absences'?'连续三拍缺席':'主动离房'}，退出本场。`);
 result.push(({continue_game:'继续下一拍。',restart_survivors:'存活者进入新局，下一局选择时资源归零。',sole_survivor:'本场结束，唯一赢家。',nobody_survives:'本场结束，无人获胜。'} as Record<string,string>)[t.effective_transition.kind]||'');
 return result;
}
export const errorText:Record<string,string>={SERVICE_CONFIG_INVALID:'联机服务配置无效，请联系维护者。',SECURE_CONNECTION_FAILED:'安全连接未建立，请检查服务器证书或网络。',SERVICE_NOT_CONFIGURED:'联机服务尚未配置。',INVALID_ENDPOINT:'开发服务配置无效。',WEBSOCKET_UNAVAILABLE:'当前运行时不支持联机连接。',INVALID_MESSAGE:'服务消息格式不兼容，请重新连接。',CONNECTION_REJECTED:'连接被服务拒绝，请重新连接。',ROOM_ACCESS_DENIED:'房间号或密码不正确。',ROOM_FULL:'参战席位已满，可以主动改为观战。',MATCH_IN_PROGRESS:'比赛已经开始，可以主动改为观战。',SPECTATORS_FULL:'观众席已满。',SPECTATORS_DISABLED:'这个房间不开放观战。',COMMAND_PENDING:'上一项操作正在确认，请稍候。',NOT_CONNECTED:'网络暂断，正在尝试重连。',UNSUPPORTED_PROTOCOL:'联机协议版本不兼容，需要 rooms-1.1 服务。',HOST_ROLE_FIXED:'房主必须保留参战席位角色。',POLICY_STALE:'时限设置已更新，请重新打开设置后重试。',ROOM_CLOSING:'房主已离开，房间将在本拍结束后关闭。',HOST_LEFT:'房主离开，房间已结束。',HOST_TIMEOUT:'房主未及时返回，房间已结束。',HOST_ABSENT:'房主连续第四拍缺席，房间已结束。',SERVER_RESTART:'服务已重启，原房间已结束，请重新创建或加入。',SESSION_EXPIRED:'临时身份已过期，请重新连接。',SESSION_REPLACED:'此临时身份已在另一连接恢复。',ROOM_GONE:'房间已结束。',ROOM_NOT_MEMBER:'你已离开此房间。',ROOM_IDLE:'房间长时间未操作，已结束。',NOT_READY:'需要所有参战者连线并准备。',STALE_TURN:'这一拍已结束，请等待最新牌桌。',TURN_CLOSED:'出牌时间已结束，等待服务揭晓。',ALREADY_SUBMITTED:'本拍已确认，不能更换。',UNAVAILABLE_MOVE:'这张牌当前不可用。',FORCED_RECOVERY:'本拍强制休整，无需提交。',RATE_LIMITED:'操作过快，请稍后重试。',SERVER_BUSY:'服务繁忙，请稍后重试。',REQUEST_CONFLICT:'请求已失效，请读取最新状态。',STALE_COMMAND:'旧操作已失效，请重新操作。',ROOM_STATE_TOO_LARGE:'房间数据超过限制，房间已结束。',INTERNAL_ERROR:'服务发生错误，房间无法继续。'};
export const describeError=(code:string)=>errorText[code]||`操作未完成（${code}）。`;
