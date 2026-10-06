const { WorkerBridge } = require('./worker-bridge.cjs');
const {fields}=require('./rules/validation.cjs');
function validStatus(value){fields(value,['requested_id','active_id','state','compatibility','model_turns','fallback_turns']);fields(value.compatibility,['missing_features']);if(![null,'random-legal-v1','legacy-maskable-ppo-v1'].includes(value.requested_id)||![null,'random-legal-v1','legacy-maskable-ppo-v1'].includes(value.active_id)||!['idle','preparing','ready','active','degraded','cancelled','failed'].includes(value.state)||!['model_turns','fallback_turns'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0)||!Array.isArray(value.compatibility.missing_features)||value.compatibility.missing_features.length>16||value.compatibility.missing_features.some(v=>typeof v!=='string'||v.length>80))throw Error('WORKER_PROTOCOL_ERROR');return value;}
const { workerLaunch } = require('./worker-launch.cjs');

function localBridge(context) {
  const {executable,args,env}=workerLaunch(context);
  return new WorkerBridge(executable,args,10000,undefined,env);
}

class WorkerPort {
  constructor(profile, bridge, launchContext) {
    if (bridge === undefined) bridge = localBridge(launchContext);
    this.profile = profile; this.bridge = bridge; this.generation = 0;
    this.wireVersion=launchContext?.wireVersion||1;
    this.active = false; this.interrupted = false; this.starting = false;
  }
  async call(op, payload = {}) {
    if (!['start_solo','start_tutorial'].includes(op) && this.bridge.failure) this.interrupted = true;
    if (this.interrupted) { this.active = false; await this.bridge.stop(); throw new Error('MATCH_INTERRUPTED'); }
    const generation = this.generation;
    try {
      const view = await this.bridge.request(op, payload,this.wireVersion);
      if (generation !== this.generation) throw new Error('STALE_VIEW');
      if (!view || view.source !== 'live') throw new Error('WORKER_PROTOCOL_ERROR');
      this.active = !['error', 'result'].includes(view.phase);
      return view;
    } catch (error) {
      if (generation === this.generation && /^(WORKER_|FRAME_TOO_LARGE)/.test(error.message)) {
        this.interrupted = true; this.active = false;
        await this.bridge.stop();
        throw new Error('MATCH_INTERRUPTED');
      }
      throw error;
    }
  }
  startSolo(profileId,rules_request,rule_pack_manifests=[],opponent_id='random-legal-v1') { return this.start(profileId,'start_solo',this.wireVersion===2?{rules_request,rule_pack_manifests,opponent_id}:{}); }
  startTutorial(profileId) { return this.start(profileId,'start_tutorial'); }
  async start(profileId,op,configured={}) {
    if (profileId !== this.profile.local_id) throw new Error('INVALID_PROFILE');
    if (this.starting) throw new Error('WORKER_BUSY');
    this.starting = true; ++this.generation;
    try {
      if(this.wireVersion===1||this.interrupted||this.bridge.failure)await this.bridge.stop();
      this.interrupted = false;
      return await this.call(op, { profile_id: profileId, nickname: this.profile.nickname, avatar_id: this.profile.avatar_id,...configured });
    } finally { this.starting = false; }
  }
  async statusCall(op,payload={}){const generation=this.generation;const value=validStatus(await this.bridge.request(op,payload,2));if(generation!==this.generation)throw Error('STALE_PREPARE');return value;}
  prepareSolo(opponent_id){return this.statusCall('prepare_solo',{opponent_id});}
  soloStatus(){return this.statusCall('solo_status');}
  cancelSoloPrepare(){return this.statusCall('cancel_solo_prepare');}
  submit(view_id, entry_id) { return this.call('submit', { view_id, entry_id }); }
  tutorialNext(view_id) { return this.call('tutorial_next', {view_id}); }
  getView() { return this.call('get_view'); }
  async leave() {
    ++this.generation; this.active = false;
    // Explicit leave is also the recovery path after a dead worker; never spawn to leave.
    if (this.interrupted || this.bridge.failure) { await this.bridge.stop(); return null; }
    try { return await this.bridge.request('leave',{},this.wireVersion); }
    finally { await this.bridge.stop(); }
  }
  async close() { ++this.generation; this.active = false; await this.bridge.stop(); }
  isActive() { return this.active; }
}
module.exports = { WorkerPort, localBridge };
