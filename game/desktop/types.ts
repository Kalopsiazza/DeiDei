export type Resources = { dd6: string; lightning: string; nx_charge: string; mature_bombs: string; reward_stock: string };
export type Option = { entry_id: string; doc_id: string; available: boolean; reason_code: string | null; required: Resources; spend: Resources; forced: boolean; name: string; ui_group: 'attack'|'defense'|'skill'; cost_text: string; requirement_text: string; detail_rule_ids: string[] };
export type Participant = { player_id: string; nickname: string; avatar_id: string; alive: boolean; resources: Resources & { enhanced_xiao: boolean; cloud_uses: string; tian_uses: string; bomb_placement_count: string }; submission_state: 'thinking'|'submitted'|'out' };
export type PublicRound = { match_id:string; game_id:string; turn_index:string; turn_id:string; actions:Record<string,{entry_id:string;actual_move:string;branch:string|null;is_recovery:boolean}>; next_game_id:string; next_turn_index:string };
export type DesktopView = { mode:'solo'|'tutorial'|'preview'|'multiplayer'; self_role:'player'|'spectator'; self_participation:'active'|'eliminated'|'spectating'|'departing'; public_round:PublicRound|null; tutorial?: {stage:'guided'|'challenge'|'complete';step:number;target_entry_id:string|null;won:boolean;ended:boolean}; source: 'fixture'|'live'|'online'; view_id: string; match_id: string; game_index:string; game_id: string; turn_index: string; phase: 'selecting'|'submitting'|'revealed'|'result'|'error'; participants: Participant[]; self_id: string|null; options: Option[]; selected_entry_id: string|null; submitted: boolean; timer: { mode: 'untimed'|'preview'|'reveal'; remaining_ms: number|null; total_ms: number|null }; summary: string[]; outcome: { winner_id: string|null; reason: string }|null };
export type { GraphicsPreset, GraphicsSettings } from './graphics.cjs';
export type Settings = { music: number; effects: number; fullscreen: boolean; graphics: import('./graphics.cjs').GraphicsSettings };
export type Profile = { profile_version: 2; local_id: string; nickname: string; avatar_id: string; settings: Settings };
export type ProfileInput = Pick<Profile, 'nickname'|'avatar_id'>;
export type Reply<T> = { ok: true; data: T }|{ ok: false; error: string };
export type Manual = { entries: (Option & { description: string })[]; sections: { id: string; text: string }[] };
export type Scene = 'initial'|'midgame'|'spectator'|'eliminated'|'restart'|'winner'|'defeat'|'draw'|'invalid';
export type Bridge = {
  online: import('./online/types').OnlineBridge;
  profile: { read(): Promise<Reply<Profile|null>>; create(p: ProfileInput): Promise<Reply<Profile>>; update(p: ProfileInput): Promise<Reply<Profile>>; recover(p: ProfileInput & { confirmed: true }): Promise<Reply<Profile>> };
  settings: { apply(p: ProfileInput & { settings: Settings }): Promise<Reply<Profile>> };
  port: { startSolo(id: string): Promise<Reply<DesktopView>>; startTutorial(id: string): Promise<Reply<DesktopView>>; tutorialNext(id: string): Promise<Reply<DesktopView>>; submit(id: string, entry: string): Promise<Reply<DesktopView>>; getView(): Promise<Reply<DesktopView>>; leave(): Promise<Reply<DesktopView>> };
  preview(scene: Scene): Promise<Reply<DesktopView>>;
  manual(): Promise<Reply<Manual>>;
  quit(): Promise<Reply<null>>;
};
declare global { interface Window { desktop: Bridge } }
