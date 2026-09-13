const { WorkerBridge } = require('./worker-bridge.cjs');
const { workerLaunch } = require('./worker-launch.cjs');

function localBridge(context) {
  const {executable,args,env}=workerLaunch(context);
  return new WorkerBridge(executable,args,10000,undefined,env);
}

class WorkerPort {
  constructor(profile, bridge, launchContext) {
    if (bridge === undefined) bridge = localBridge(launchContext);
    this.profile = profile; this.bridge = bridge; this.generation = 0;
    this.active = false; this.interrupted = false; this.starting = false;
  }
  async call(op, payload = {}) {
    if (op !== 'start_solo' && this.bridge.failure) this.interrupted = true;
    if (this.interrupted) { this.active = false; await this.bridge.stop(); throw new Error('MATCH_INTERRUPTED'); }
    const generation = this.generation;
    try {
      const view = await this.bridge.request(op, payload);
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
  async startSolo(profileId) {
    if (profileId !== this.profile.local_id) throw new Error('INVALID_PROFILE');
    if (this.starting) throw new Error('WORKER_BUSY');
    this.starting = true; ++this.generation;
    try {
      await this.bridge.stop();
      this.interrupted = false;
      return await this.call('start_solo', { profile_id: profileId, nickname: this.profile.nickname, avatar_id: this.profile.avatar_id });
    } finally { this.starting = false; }
  }
  submit(view_id, entry_id) { return this.call('submit', { view_id, entry_id }); }
  getView() { return this.call('get_view'); }
  async leave() {
    ++this.generation; this.active = false;
    // Explicit leave is also the recovery path after a dead worker; never spawn to leave.
    if (this.interrupted || this.bridge.failure) { await this.bridge.stop(); return null; }
    try { return await this.bridge.request('leave'); }
    finally { await this.bridge.stop(); }
  }
  async close() { ++this.generation; this.active = false; await this.bridge.stop(); }
  isActive() { return this.active; }
}
module.exports = { WorkerPort, localBridge };
