import type { DesktopView, Manual, Reply } from './types';

// One shared slot also covers a read still completing after a page/scene change.
export function pollViews(read: () => Promise<Reply<DesktopView>>, slot: { current: boolean },
  apply: (view: DesktopView) => void, fail: (error: string) => void, delay = 150): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    if (stopped) return;
    if (slot.current) { timer = setTimeout(tick, delay); return; }
    slot.current = true;
    try {
      const reply = await read();
      if (stopped) return;
      if (!reply.ok) { stopped = true; fail(reply.error); return; }
      apply(reply.data);
    } catch (error) {
      if (!stopped) { stopped = true; fail(error instanceof Error ? error.message : 'GET_VIEW_FAILED'); }
    } finally {
      slot.current = false;
      if (!stopped) timer = setTimeout(tick, delay);
    }
  };
  timer = setTimeout(tick, delay);
  return () => { stopped = true; clearTimeout(timer); };
}

export function ddText(raw: string): string {
  const value = BigInt(raw), whole = value / 6n, remainder = value % 6n;
  if (!remainder) return String(whole);
  const divisor = remainder % 3n === 0n ? 3n : remainder % 2n === 0n ? 2n : 1n;
  return `${whole ? `${whole}又` : ''}${remainder / divisor}/${6n / divisor}`;
}


export type PlayedMove={matchId:string;gameId:string;turnId:string;turn:string;name:string;entryId:string;actualMove:string;branch:string|null;isRecovery:boolean;decisionSource?:string;baseMove?:string;origin?:string;upgrade?:import('./types').PublicRound['actions'][string]['upgrade'];spend?:import('./types').Resources};
export type PublicHistory={match_id:string;game_id:string;moves:Record<string,PlayedMove[]>;turns:string[];next_game_id:string|null;previous_game_missing:boolean};
export const emptyHistory:PublicHistory={match_id:'',game_id:'',moves:{},turns:[],next_game_id:null,previous_game_missing:false};

export function recordPublicRound(previous:PublicHistory,view:DesktopView,manual:Manual):PublicHistory {
 const round=['revealed','result'].includes(view.phase)?view.public_round:null;
 const match_id=round?.match_id||view.match_id,game_id=round?.game_id||view.game_id;
 const fresh=previous.match_id!==match_id||previous.game_id!==game_id;
 const history=fresh?{...emptyHistory,match_id,game_id,moves:{},turns:[],previous_game_missing:previous.match_id!==match_id?BigInt(view.game_index)>1n:previous.game_id!==game_id&&previous.next_game_id!==game_id}:previous;
 if(!round||history.turns.includes(round.turn_index))return history;
 const moves={...history.moves};
 for(const [pid,action] of Object.entries(round.actions)){
  const declared=manual.entries.find(entry=>entry.entry_id===action.entry_id)?.name||action.entry_id;
  const actual=manual.entries.find(entry=>entry.entry_id===action.actual_move)?.name||action.actual_move;
  const name=action.is_recovery?'曾义休整':action.upgrade?`${declared} → ${actual} · 幸运`:declared;
  moves[pid]=[...(moves[pid]||[]),{matchId:round.match_id,gameId:round.game_id,turnId:round.turn_id,turn:round.turn_index,name,entryId:action.entry_id,actualMove:action.actual_move,branch:action.branch,isRecovery:action.is_recovery,decisionSource:pid===view.self_id?'human':view.decision_source||undefined,baseMove:action.base_move,origin:action.origin,upgrade:action.upgrade,spend:action.spend}];
 }
 // ponytail: keep every received public round in this game; display caps belong to the seats/sidebar.
 return {...history,moves,turns:[...history.turns,round.turn_index],next_game_id:round.next_game_id};
}

export function historyGaps(history:PublicHistory,view:DesktopView):string[] {
 const received=history.turns.map(BigInt).sort((a,b)=>a<b?-1:a>b?1:0);
 const through=BigInt(view.turn_index)-(['revealed','result'].includes(view.phase)?0n:1n);
 const gaps=history.previous_game_missing?['上一局结束记录未收到，无法补全。']:[];
 let expected=1n;
 for(const turn of [...received,through+1n]){
  if(turn>expected)gaps.push(`第 ${expected}${turn-1n===expected?'':`—${turn-1n}`} 拍记录未收到。`);
  if(turn>=expected)expected=turn+1n;
 }
 return gaps;
}
