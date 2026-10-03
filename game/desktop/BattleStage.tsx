import React from 'react';
import type { DesktopView, Manual, Option, Participant } from './types';
import { groups, orderedOptions } from './interaction';
import { ddText } from './view-loop';

const groupName={attack:'攻击',defense:'防御',skill:'技能'};
const reasons:Record<string,string>={INSUFFICIENT_DD:'DD 不足',INSUFFICIENT_LIGHTNING:'雷电不足',INSUFFICIENT_CHARGE:'充能不足',INSUFFICIENT_BOMBS:'成熟层不足',ALREADY_USED:'本局已用',NO_COPY_RECORD:'没有复制记录',NO_REWARD:'奖励未就绪',FORCED_RECOVERY:'正在休整',NOT_ACTIVE:'已不在场'};
const arenaPositions:Record<number,[number,number][]>= {
 1:[[50,3]],2:[[31,8],[69,8]],3:[[13,45],[50,3],[87,45]],
 4:[[11,50],[36,7],[64,7],[89,50]],5:[[9,55],[29,8],[50,3],[71,8],[91,55]],
 6:[[8,57],[23,18],[42,6],[58,6],[77,18],[92,57]],
};
const compactMoveName=(name:string)=>{
 const tags:string[]=[];let label=name;
 for(const prefix of ['炸药','雷电'])if(label.startsWith(`${prefix}·`)){tags.push(prefix);label=label.slice(prefix.length+1);}
 if(label.startsWith('曾义赠送·')){tags.push('赠送');label=label.slice(5);}
 for(const modifier of ['翻转','旋转'])if(label.startsWith(modifier)){tags.push(modifier);label=label.slice(modifier.length);}
 return {tags,label};
};
const resourceItems=(player:Participant)=>[
 {id:'dd',name:'DD',value:ddText(player.resources.dd6),icon:'Bi'},
 {id:'lightning',name:'雷电',value:player.resources.lightning,icon:'FreeThree'},
 {id:'charge',name:'充能',value:player.resources.nx_charge,icon:'NieXiang'},
 {id:'bombs',name:'炸药',value:player.resources.mature_bombs,icon:'Bomb'},
 {id:'reward',name:'奖励',value:player.resources.reward_stock,icon:'ZengRewardBigBi'},
];
const battleLabel=(view:DesktopView,frozen=false)=>frozen?'战局冻结':view.phase==='result'?'整场结束':view.phase==='revealed'?'擂台结算':view.self_role==='spectator'?'观战中':view.self_participation==='eliminated'?'已淘汰':view.phase==='submitting'||view.submitted?'等待揭晓':'选卡状态';

export type { PlayedMove } from './view-loop';
import type { PlayedMove } from './view-loop';
export type AvatarComponent=React.ComponentType<{id?:string}>;
export type ModalComponent=React.ComponentType<{title:string;children:React.ReactNode;onClose:()=>void;closeDisabled?:boolean;className?:string}>;
export type BattleStageProps={
 view:DesktopView;manual:Manual;moveHistory:Record<string,PlayedMove[]>;mode:'local'|'online';ready:boolean;exiting:boolean;suspended:boolean;frozen:boolean;busy:boolean;revealSeconds:number;coach?:React.ReactNode;Avatar:AvatarComponent;onSelect:(entryId:string)=>void;onSubmit:()=>void;onPause:()=>void;onFreeze:()=>void;onSituation:()=>void;
};

export function BattleStage({view,moveHistory,mode,ready,exiting,suspended,frozen,busy,revealSeconds,coach,Avatar,onSelect,onSubmit,onPause,onFreeze,onSituation}:BattleStageProps):React.JSX.Element {
 const selected=view.options.find(option=>option.entry_id===view.selected_entry_id);
 const tutorial=view.tutorial,tutorialTarget=view.phase==='selecting'?tutorial?.target_entry_id:null;
 const self=view.participants.find(player=>player.player_id===view.self_id);
 const opponents=view.participants.filter(player=>player.player_id!==view.self_id);
 const positions=arenaPositions[opponents.length]||arenaPositions[6];
 const ordered=orderedOptions(view.options);
 const editable=view.self_role==='player'&&view.self_participation==='active'&&ready&&!exiting&&!busy&&!suspended&&['selecting','error'].includes(view.phase)&&!view.submitted&&view.options.length>0;
 const selectingUi=ready&&view.self_role==='player'&&view.self_participation==='active'&&['selecting','error'].includes(view.phase)&&!view.submitted;
 const selfHistory=self?(moveHistory[self.player_id]||[]).slice(-8).reverse():[];
 const timeLabel=tutorial?'不限时练习':view.timer.total_ms?`${Math.ceil(view.timer.total_ms/1000)}s 回合`:'∞ 回合';
 const moveTrail=(player:Participant)=>{
  const history=(moveHistory[player.player_id]||[]).slice(-3).reverse();
  const showingCurrent=['revealed','result'].includes(view.phase)&&history[0]?.turnId===view.public_round?.turn_id;
  const pending=player.player_id===view.self_id&&!view.submitted?selected:null;
  return <div className="move-trail" aria-label={`${player.nickname}的出牌记录`}>
   {history.map((move,index)=><span key={move.turnId} className={`move-card ${showingCurrent&&index===0?'current':''}`} data-turn={move.turn} style={{'--stack-index':String(index+(showingCurrent?0:1))} as React.CSSProperties}><span className="move-card-content"><img src={`assets/moves/${move.entryId}.png`} alt=""/><strong>{move.name}</strong></span></span>)}
   {!showingCurrent&&view.phase!=='submitting'&&<span className={`move-card active ${pending?'pending':'hidden-move'}`} style={{'--stack-index':'0'} as React.CSSProperties}>{pending?<span className="move-card-content"><img src={`assets/moves/${pending.entry_id}.png`} alt=""/><strong>{pending.name}</strong></span>:<strong>{player.submission_state==='submitted'?'已锁定':'等待'}</strong>}</span>}
  </div>;
 };
 const showcaseCard=(option:Option|undefined,className:string)=><article key={option?.entry_id||'empty'} className={`showcase-card ${className} ${option?.ui_group||'empty'}`}><header><span>{option?.doc_id||'--'}</span><em>{option?groupName[option.ui_group]:'待选'}</em></header><div className="showcase-art">{option?<img src={`assets/moves/${option.entry_id}.png`} alt=""/>:<span aria-hidden="true">?</span>}</div><footer><strong>{option?.name||'待选择'}</strong></footer></article>;
 return <main className="table battle-table" data-mode={mode} data-phase={view.phase} data-tutorial={!!tutorial} data-ready={ready} data-exiting={exiting} data-suspended={suspended} data-frozen={frozen}>
  <header className="battle-hud">
   <button className="battle-hud-button battle-pause" onClick={onPause}><i aria-hidden="true"><span/><span/></i><b>暂停</b></button>
   <section className="battle-status" aria-live="polite"><span>第 {Number(view.turn_index)} 回合</span><strong>{battleLabel(view,frozen)}</strong></section>
   <nav className="battle-hud-actions" aria-label="牌局工具"><button className="battle-hud-button battle-freeze" aria-pressed={frozen} disabled={mode==='online'||view.participants.length>2} title={mode==='online'||view.participants.length>2?'多人对局不可冻结':'冻结或恢复整场画面'} onClick={onFreeze}><i aria-hidden="true">❄</i><b>{frozen?'恢复':'冻结'}</b></button><button className="battle-hud-button battle-situation" onClick={onSituation}><i aria-hidden="true">◎</i><b>局势</b></button></nav>
  </header>
  {coach}
  <section className="battle-arena" data-seat-count={view.participants.length} aria-live="polite">
   <div className="arena-surface" aria-hidden="true"><img src="assets/battle/battle-table-v1.webp" alt=""/></div>
   {opponents.map((player,index)=>{const position=positions[index]||[50,3];const edge=position[0]<25?'left':position[0]>75?'right':'top';return <article key={player.player_id} className={`arena-seat opponent-seat seat-${edge} ${player.alive?'':'out'}`} data-seat-edge={edge} style={{'--seat-x':`${position[0]}%`,'--seat-y':`${position[1]}%`} as React.CSSProperties}>{moveTrail(player)}<footer className="seat-profile"><header><Avatar id={player.avatar_id}/><strong>{player.nickname}</strong></header></footer></article>;})}
   {self&&<article className="arena-seat self-seat seat-bottom" data-seat-edge="bottom">{moveTrail(self)}<footer className="seat-profile"><header><Avatar id={self.avatar_id}/><strong>{self.nickname}</strong></header></footer></article>}
   {view.phase==='revealed'&&!tutorial&&<section className="arena-center"><div className="arena-countdown" role="status"><span>{revealSeconds}</span><strong>{view.public_round?.next_game_id!==view.game_id?'秒后进入新局':view.public_round?.next_turn_index===view.turn_index?'秒后展示整场结果':`秒后进入第 ${Number(view.public_round?.next_turn_index||view.turn_index)} 回合`}</strong></div></section>}
   {selectingUi&&<section className="selection-stage" aria-label="本拍待选择卡牌"><div className="selection-history" aria-label="最近出牌记录">{selfHistory.map((move,index)=><span key={move.turnId} tabIndex={0} aria-label={`第 ${move.turn} 拍：${move.name}`} style={{'--history-index':String(index)} as React.CSSProperties}><img src={`assets/moves/${move.entryId}.png`} alt=""/><strong>{move.name}</strong><small>R{move.turn.padStart(2,'0')}</small></span>)}</div>{showcaseCard(selected,'selection-card')}</section>}
   {view.phase==='submitting'&&selected&&showcaseCard(selected,'commit-flight')}
  </section>
  {!!view.options.length?<section className="battle-operation" aria-label="出牌操作区" aria-hidden={!selectingUi}>
   {self&&<ul className="battle-resources" aria-label="本拍资源">{resourceItems(self).filter(item=>!tutorial||item.id==='dd').map(item=><li className={`resource-token resource-${item.id}`} key={item.id} tabIndex={0}><img src={`assets/moves/${item.icon}.png`} alt=""/><span><small>{item.name}</small><strong>{item.value}</strong></span></li>)}</ul>}
   <div className="turn-strip battle-turn"><span>{timeLabel}</span><progress max={view.timer.total_ms||1} value={view.timer.remaining_ms??1}/><span>{selected?`已选 ${selected.name}`:'选择本拍招式'}</span></div>
   <div className="card-groups battle-cards">{groups.map(group=><section className={`card-group ${group}`} key={group}><h3>{groupName[group]} <span>{view.options.filter(option=>option.ui_group===group).length}</span></h3><div className="cards">{ordered.filter(option=>option.ui_group===group).map(option=>{const label=compactMoveName(option.name);return <article key={option.entry_id} className={`card ${option.available?'':'unavailable'} ${selected?.entry_id===option.entry_id?'selected':''}`} data-entry={option.entry_id} data-tutorial-target={tutorialTarget===option.entry_id&&selected?.entry_id!==option.entry_id}><button className="card-pick" disabled={!option.available||!editable} aria-pressed={selected?.entry_id===option.entry_id} aria-label={`${option.available?'选择':'不可用'} ${option.name}${option.available?'':`：${reasons[option.reason_code||'']||'条件不足'}`}`} onClick={()=>onSelect(option.entry_id)}><img src={`assets/moves/${option.entry_id}.png`} alt=""/><strong>{!!label.tags.length&&<span className="card-tags">{label.tags.map(tag=><em key={tag}>{tag}</em>)}</span>}<span className="card-name">{tutorial?option.entry_id==='Def'?'防':option.entry_id==='Charge'?'攒':'bi':label.label}</span>{tutorial&&<small className="tutorial-card-note">{option.entry_id==='Charge'?'得到 1 DD':option.entry_id==='Def'?'挡住 bi':option.available?'花 1 DD 攻击':'还需要 1 DD'}</small>}</strong></button></article>;})}</div></section>)}</div>
   <footer className="table-actions battle-actions"><small>数字键 1–0 选择 · Enter 提交</small><span>{ordered.filter(option=>option.available).length} / {tutorial?3:33} 可用</span><button className="primary" aria-label={tutorial?'确认出招':undefined} data-tutorial-target={!!tutorialTarget&&selected?.entry_id===tutorialTarget} disabled={!editable||!selected} onClick={onSubmit}>{view.submitted?'已提交':view.phase==='error'?'重试提交':'确认出招'}</button></footer>
  </section>:<section className="spectating"><h2>{view.self_role==='spectator'?(view.mode==='preview'?'你正在观看公开演示。':'你正在观战。'):view.self_participation==='eliminated'?'你已淘汰，等待下一场。':view.self_participation==='departing'?'你已退出本场，等待房间更新。':view.phase==='revealed'?'本拍已揭晓，等待下一拍。':'等待本拍状态更新。'}</h2><p>{view.self_role==='spectator'||view.self_participation!=='active'?'当前身份不接受选招快捷键。':'揭晓期间不接受选招。'}</p></section>}
 </main>;
}

export function SituationDialog({view,moveHistory,gaps=[],Modal,Avatar,onClose}:{view:DesktopView;manual:Manual;moveHistory:Record<string,PlayedMove[]>;gaps?:string[];Modal:ModalComponent;Avatar:AvatarComponent;onClose:()=>void}):React.JSX.Element {
 const turns=[...new Set(Object.values(moveHistory).flat().map(move=>move.turn))].sort((a,b)=>Number(b)-Number(a));
 const multiplayer=view.mode==='multiplayer';
 return <Modal className="battle-dialog situation-dialog" title="本局态势" onClose={onClose}><header className="situation-overview"><span>第 {Number(view.turn_index)} 回合 · {battleLabel(view)}</span><small>{view.participants.length} 名玩家 · {view.participants.filter(player=>player.alive).length} 人仍在场</small></header><div className="situation-grid"><section className="situation-resources"><header><span>资源状态</span></header><div className="situation-player-list">{view.participants.map(player=><article key={player.player_id} data-focused={player.player_id===view.self_id} data-alive={player.alive}><header><Avatar id={player.avatar_id}/><span><strong>{player.nickname}</strong><small>{player.player_id===view.self_id?'本机席位':player.alive?'仍在场':'已淘汰'}</small></span></header><ul>{resourceItems(player).map(item=><li key={item.id}><img src={`assets/moves/${item.icon}.png`} alt=""/><span>{item.name}</span><strong>{item.value}</strong></li>)}</ul><footer><span>强化削 {player.resources.enhanced_xiao?'有':'无'}</span><span>云 {player.resources.cloud_uses}</span><span>田利军 {player.resources.tian_uses}</span><span>放置 {player.resources.bomb_placement_count}</span></footer></article>)}</div>{multiplayer&&<section className="elimination-log"><header><span>本局淘汰</span><small>新一局重置</small></header>{view.participants.some(player=>!player.alive)?<ul>{view.participants.filter(player=>!player.alive).map(player=><li key={player.player_id}><Avatar id={player.avatar_id}/><strong>{player.nickname}</strong><span>已离场</span></li>)}</ul>:<p>目前无人淘汰。</p>}</section>}</section><section className="situation-timeline"><header><span>回合记录</span></header>{gaps.map(gap=><p className="situation-empty" key={gap} role="status">{gap}</p>)}{turns.length?<ol>{turns.map(turn=><li key={turn}><i/><div><span>第 {Number(turn)} 回合</span>{view.participants.map(player=>{const move=(moveHistory[player.player_id]||[]).find(item=>item.turn===turn);return move&&<article key={player.player_id}><Avatar id={player.avatar_id}/><span><small>{player.nickname}</small><strong>{move.name}</strong></span><img src={`assets/moves/${move.entryId}.png`} alt=""/></article>;})}</div></li>)}</ol>:<p className="situation-empty">{gaps.length?'尚未收到本局的揭晓记录。':'第一轮尚未揭晓，出招记录会沿时间轴逐回合留下。'}</p>}</section></div></Modal>;
}

export function MatchResult({view,moveHistory,leaving,Avatar,onReview,onPrimary,onExit,primaryLabel='准备下一局',primaryDisabled=false,exitLabel='退出房间',exitDisabled=false}:{view:DesktopView;moveHistory:Record<string,PlayedMove[]>;leaving:boolean;Avatar:AvatarComponent;onReview:()=>void;onPrimary:()=>void;onExit:()=>void;primaryLabel?:string;primaryDisabled?:boolean;exitLabel?:string;exitDisabled?:boolean}):React.JSX.Element {
 const players=[...view.participants].sort((a,b)=>Number(b.player_id===view.self_id)-Number(a.player_id===view.self_id));
 const winner=players.find(player=>player.player_id===view.outcome?.winner_id);
 const tone=view.self_role==='spectator'?'spectator':!view.outcome?.winner_id?'draw':view.self_id===view.outcome.winner_id?'victory':'defeat';
 const copy=tone==='spectator'?{kicker:'MATCH COMPLETE',title:'整场结束',detail:winner?`${winner.nickname} 留到了最后。`:'这一局没有留下胜者。'}:tone==='victory'?{kicker:'MATCH COMPLETE',title:'胜利',detail:`${winner?.nickname||'你'} 留到了最后。`}:tone==='defeat'?{kicker:'MATCH COMPLETE',title:'阵亡',detail:`${winner?.nickname||'对手'} 留到了最后。`}:{kicker:'MATCH COMPLETE',title:'同归于尽',detail:'这一局没有留下胜者。'};
 const turns=[...new Set(Object.values(moveHistory).flat().map(move=>move.turn))].sort((a,b)=>Number(b)-Number(a));
 const lastTurn=turns[0]||view.turn_index;
 const finalMove=(player:Participant)=>(moveHistory[player.player_id]||[]).find(move=>move.turn===lastTurn);
 return <main className={`match-cinematic match-outro ${view.mode==='multiplayer'?'online-result':''} result-${tone}`} data-leaving={leaving} data-player-count={players.length} aria-label={`${view.mode==='multiplayer'?'联机结算':'整场结果'}：${copy.title}`}><div className="cinematic-backdrop" aria-hidden="true"><img src="assets/battle/battle-arena-approach-v1.webp" alt=""/><span/></div><header className="result-heading"><span>{copy.kicker} · ROUND {String(view.turn_index).padStart(2,'0')}</span><h1>{copy.title}</h1><p>{copy.detail}</p></header><section className="result-players" aria-label="本场玩家结果">{players.map(player=><article key={player.player_id} tabIndex={0} aria-label={`${player.nickname}${player.player_id===view.self_id?'，你':''}${player.player_id===view.outcome?.winner_id?'，存活':'，离场'}`} data-result={player.player_id===view.outcome?.winner_id?'winner':'out'} data-self={player.player_id===view.self_id}><Avatar id={player.avatar_id}/><strong>{player.nickname}</strong></article>)}</section><section className="result-last-turn" aria-label="最后一拍"><header><span>最后一拍</span><strong>第 {Number(lastTurn)} 回合</strong></header><div>{players.map(player=>{const move=finalMove(player);return <article key={player.player_id} data-self={player.player_id===view.self_id}><header><Avatar id={player.avatar_id}/><span>{player.player_id===view.self_id?`你 · ${player.nickname}`:player.nickname}</span></header><div className="result-move-art">{move?<img src={`assets/moves/${move.entryId}.png`} alt=""/>:<span>?</span>}</div><strong>{move?.name||'招式记录未载入'}</strong></article>;})}</div></section><nav className="result-actions" aria-label="终场操作"><button disabled={leaving} onClick={onReview}>局势回顾<small>REVIEW</small></button><button className="primary" disabled={leaving||primaryDisabled} onClick={onPrimary}>{primaryLabel}<small>{primaryDisabled?'WAITING':'NEXT MATCH'}</small></button><button disabled={leaving||exitDisabled} onClick={onExit}>{exitLabel}<small>EXIT</small></button></nav></main>;
}
