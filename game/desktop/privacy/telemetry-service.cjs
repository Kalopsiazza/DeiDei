const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const http = require('node:http');
const { ConsentStore, atomicWrite, SCOPES, POLICY_ID, clone, validData } = require('./consent-store.cjs');
const { validateGraphics, matchGraphicsPreset, sameGraphics } = require('../graphics.cjs');
const id = () => crypto.randomBytes(16).toString('hex');
const dayOf = time => new Date(time).toISOString().slice(0, 10);
const falseScopes = () => ({ preferences: false, performance: false });
const reportKey = value => [value.epoch, value.scope, value.day, value.app_version].join('/');
const settings = profile => profile?.settings || profile;
const pref = profile => ({ card_style: ['classic', 'illustrated'].includes(settings(profile)?.cardStyle) ? settings(profile).cardStyle : 'classic', graphics: validateGraphics(settings(profile)?.graphics || { ambientMotion: 'reduced', glass: 'light', decoration: 'simple' }), preset: matchGraphicsPreset(settings(profile)?.graphics || { ambientMotion: 'reduced', glass: 'light', decoration: 'simple' }), sessions: [], settings_changes: 0, recommendations: { shown: 0, adopted: 0 } });
function trustedOrigin(origin, fixture) {
  if (!origin) return '';
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(fixture && url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('UNTRUSTED_STATS_ORIGIN');
  return url.origin;
}
function performRequest(origin, route, method, data, capability, signal, guard) {
  const url = new URL(route, origin);
  const bytes = Buffer.from(JSON.stringify(data));
  if (bytes.length > 32 * 1024) return Promise.reject(new Error('REPORT_LIMIT'));
  return new Promise((resolve, reject) => {
    if (!guard()) return reject(new Error('OBSOLETE_OPERATION'));
    const request = (url.protocol === 'https:' ? https : http).request(url, { method, signal, timeout: 10000, headers: { 'Content-Type': 'application/json', 'Content-Length': bytes.length, ...(capability ? { Authorization: 'Bearer ' + capability } : {}) } }, response => {
      let size = 0; const chunks = [];
      response.on('data', chunk => { size += chunk.length; if (size > 16 * 1024) { request.destroy(new Error('RESPONSE_LIMIT')); return; } chunks.push(chunk); });
      response.on('end', () => {
        let body; try { body = JSON.parse(Buffer.concat(chunks)); } catch { return reject(new Error('INVALID_RESPONSE')); }
        resolve({ status: response.statusCode, retryAfter: response.headers['retry-after'], body });
      });
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('REQUEST_TIMEOUT'))); request.on('error', reject);
    // Final barrier runs synchronously immediately before writing bytes; no await separates it from end.
    if (!guard()) { request.destroy(); reject(new Error('OBSOLETE_OPERATION')); return; }
    request.end(bytes);
  });
}
class TelemetryService {
  constructor({ directory, safeStorage, appVersion, collectorOrigin = '', fixture = false, now = Date.now, write, request = performRequest, barrier = async () => {} }) {
    if (!/^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-(?:alpha|beta|rc)\.\d{1,4})?$/.test(appVersion)) throw new Error('APP_VERSION_INVALID');
    this.store = new ConsentStore(directory, { safeStorage, write }); this.directory = directory; this.appVersion = appVersion;
    this.origin = trustedOrigin(collectorOrigin, fixture); this.fixture = fixture; this.now = now; this.request = request; this.barrier = barrier;
    this.trustedDestinations = new Set(this.origin ? [this.origin] : []);
    this.effective = falseScopes(); this.stateToken = id(); this.serial = Promise.resolve(); this.aborters = new Set();
    this.idle = false; this.suspended = false; this.warning = null; this.uploadStatus = 'local_only'; this.local = { version: 1, days: [] };
    this.sessions = new Set(); this.recommendations = new Map(); this.selected = null; this.timer = null; this.inFlight = false;
    this.validState = false; this.ready = this.initialize();
  }
  async initialize() {
    try {
      await this.store.load(); this.validState = true;
      const state = clone(this.store.state);
      // Old deletion destinations were accepted by the main-only configuration when credentials were created.
      for (const c of state.credentials) { trustedOrigin(c.origin, this.fixture); this.trustedDestinations.add(c.origin); if (!c.deleted) this.store.unseal(c); }
      if (state.consented_origin !== this.origin || state.policy_id !== POLICY_ID) {
        state.scopes = falseScopes(); state.revision++; state.epoch = id(); state.eligible = []; state.outbox = [];
        state.consented_origin = this.origin; state.policy_id = POLICY_ID;
        await this.store.commit(state);
      }
      try {
        const filename = path.join(this.directory, 'local-usage.json');
        const stat = await fs.stat(filename);
        if (stat.size > 256 * 1024) throw new Error('LOCAL_USAGE_INVALID');
        const local = JSON.parse(await fs.readFile(filename, 'utf8'));
        if (local.days?.some(d => !d || Object.keys(d).sort().join() !== 'app_version,day,performance,preferences' || !/^\d{4}-\d{2}-\d{2}$/.test(d.day) || typeof d.app_version !== 'string' || !validData('preferences', d.preferences) || (d.performance !== null && !validData('performance', d.performance)))) throw new Error('LOCAL_USAGE_INVALID');
        if (local.version !== 1 || Object.keys(local).sort().join() !== 'days,version' || !Array.isArray(local.days) || local.days.length > 90) throw new Error('LOCAL_USAGE_INVALID');
        this.local = local;
      } catch (error) { if (error.code !== 'ENOENT') this.warning = 'LOCAL_USAGE_UNREADABLE'; }
      this.uploadStatus = this.origin ? 'stopped' : 'local_only';
      if (state.record_local && SCOPES.some(scope => state.scopes[scope])) await this.synchronize(this.stateToken, true);
    } catch { this.validState = false; this.effective = falseScopes(); this.warning = 'PRIVACY_STATE_UNREADABLE_OR_UNWRITABLE'; this.uploadStatus = 'stopped'; }
    return this.read();
  }
  read() {
    const s = this.store.state;
    return { recordLocal: s.record_local, persistedScopes: clone(s.scopes), effectiveScopes: clone(this.effective), revision: s.revision, stateToken: this.stateToken, policyId: POLICY_ID, collectorOrigin: this.origin || null, configured: Boolean(this.origin), secureStorageAvailable: this.store.encryptionAvailable(), status: this.uploadStatus, warning: this.warning, pendingReports: s.outbox.length, pendingDeletion: s.controls.some(c => c.kind === 'erasure'), oldDestinations: s.credentials.filter(c => !c.deleted && (c.origin !== this.origin || c.policy_id !== POLICY_ID)).map(c => c.origin), localDays: this.local.days.length };
  }
  preview() { return { ...this.read(), reports: clone(this.store.state.outbox), local: clone(this.local) }; }
  closeGate() {
    this.stateToken = id(); this.effective = falseScopes(); this.uploadStatus = this.origin ? 'stopped' : 'local_only';
    for (const controller of this.aborters) controller.abort(); this.aborters.clear();
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    return this.stateToken;
  }
  enqueue(operation) {
    const result = this.serial.then(() => this.ready).then(operation);
    this.serial = result.catch(() => {}); return result;
  }
  currentCredential(state = this.store.state) { return state.credentials.find(c => c.origin === this.origin && c.policy_id === POLICY_ID && !c.deleted); }
  isCurrent(token, epoch) { return this.stateToken === token && this.store.state.epoch === epoch; }
  async network(credential, route, method, data, guard) {
    if (!this.trustedDestinations.has(credential.origin)) throw new Error('UNTRUSTED_STATS_ORIGIN');
    const controller = new AbortController(); this.aborters.add(controller);
    const secret = this.store.unseal(credential);
    try {
      await this.barrier('before-request');
      if (!guard()) throw new Error('OBSOLETE_OPERATION');
      return await this.request(credential.origin, route, method, data, route.endsWith('enrollments') ? null : secret, controller.signal, guard);
    } finally { this.aborters.delete(controller); }
  }
  async synchronize(token, initializing = false) {
    const s = this.store.state; const epoch = s.epoch; const credential = this.currentCredential(s);
    if (!this.origin || !credential || !this.isCurrent(token, epoch)) return;
    const data = { installation_id: credential.installation_id, policy_id: POLICY_ID, scopes: clone(s.scopes), revision: s.revision, epoch };
    try {
      this.uploadStatus = 'confirming';
      let response = await this.network(credential, credential.enrolled ? '/stats/v1/consent' : '/stats/v1/enrollments', credential.enrolled ? 'PUT' : 'POST', credential.enrolled ? data : { ...data, capability: this.store.unseal(credential) }, () => this.isCurrent(token, epoch));
      if (!credential.enrolled && response.status === 409 && this.isCurrent(token, epoch)) response = await this.network(credential, '/stats/v1/consent', 'PUT', data, () => this.isCurrent(token, epoch));
      if (response.status !== 200 || response.body.revision !== s.revision || response.body.epoch !== epoch) throw new Error('CONSENT_NOT_CONFIRMED');
      if (!this.isCurrent(token, epoch)) return;
      const persist = async () => {
        if (!this.isCurrent(token, epoch)) return;
        const next = clone(this.store.state); this.currentCredential(next).enrolled = true;
        next.controls = next.controls.filter(c => !(c.kind === 'consent' && c.origin === credential.origin));
        await this.store.commit(next);
      };
      if (initializing) await persist(); else await this.enqueue(persist);
      if (!this.isCurrent(token, epoch)) return;
      this.effective = s.record_local && !this.suspended ? clone(s.scopes) : falseScopes();
      this.uploadStatus = SCOPES.some(k => this.effective[k]) ? 'enabled' : 'stopped'; this.warning = null;
      this.schedule();
    } catch { if (this.isCurrent(token, epoch)) { this.warning = 'CONSENT_CONFIRMATION_PENDING'; this.uploadStatus = 'confirming'; } }
  }
  setScope(scope, value, expectedRevision, expectedStateToken) {
    if (!SCOPES.includes(scope) || typeof value !== 'boolean') return Promise.reject(new Error('INVALID_SCOPE'));
    if (expectedRevision !== this.store.state.revision || expectedStateToken !== this.stateToken) return Promise.resolve({ ...this.read(), conflict: true });
    if (value && (!this.validState || !this.store.writable || !this.origin || !this.store.encryptionAvailable() || !this.store.state.record_local)) return Promise.reject(new Error('UPLOAD_UNAVAILABLE'));
    const token = this.closeGate();
    return this.change(token, state => { state.scopes[scope] = value; }, true);
  }
  stop() { const token = this.closeGate(); return this.change(token, state => { state.scopes = falseScopes(); }, true); }
  setLocalRecording(value) {
    if (typeof value !== 'boolean') return Promise.reject(new Error('INVALID_RECORDING'));
    const token = this.closeGate();
    return this.change(token, state => { state.record_local = value; if (!value) state.scopes = falseScopes(); }, true);
  }
  change(token, apply, createCredential) {
    return this.enqueue(async () => {
      const state = clone(this.store.state); apply(state); state.revision++; state.epoch = id(); state.eligible = []; state.outbox = [];
      state.consented_origin = this.origin; state.attempts.failures = 0; state.attempts.next = 0;
      state.credentials = state.credentials.filter(c => !c.deleted);
      if (createCredential && this.origin && SCOPES.some(k => state.scopes[k]) && !this.currentCredential(state)) {
        if (state.credentials.length >= 8) throw new Error('OLD_DESTINATION_LIMIT');
        const credential = { origin: this.origin, policy_id: POLICY_ID, installation_id: id(), sealed: '', enrolled: false, deleted: false };
        credential.sealed = this.store.seal(crypto.randomBytes(32).toString('hex'), credential); state.credentials.push(credential);
      }
      const credential = this.currentCredential(state);
      if (credential) state.controls = [...state.controls.filter(c => !(c.kind === 'consent' && c.origin === this.origin)), { kind: 'consent', origin: this.origin, installation_id: credential.installation_id }];
      try { await this.barrier('before-consent-write'); await this.store.commit(state); this.warning = null; }
      catch { this.warning = 'STOPPED_NOT_SAVED_RETRY_NEXT_START_MAY_RESTORE'; this.effective = falseScopes(); return this.read(); }
      return this.read();
    }).then(async () => { if (this.stateToken === token && this.store.writable && this.currentCredential() && this.warning !== 'CLEAR_LOCAL_FAILED') await this.synchronize(token); return this.read(); });
  }
  clearLocal() {
    const token = this.closeGate();
    return this.enqueue(async () => {
      const state = clone(this.store.state); state.revision++; state.epoch = id(); state.eligible = []; state.outbox = [];
      const credential = this.currentCredential(state);
      if (credential) state.controls = [...state.controls.filter(c => !(c.kind === 'consent' && c.origin === this.origin)), { kind: 'consent', origin: this.origin, installation_id: credential.installation_id }];
      try { await this.store.commit(state); this.local = { version: 1, days: [] }; await atomicWrite(path.join(this.directory, 'local-usage.json'), this.local); this.warning = null; }
      catch { this.warning = 'CLEAR_LOCAL_FAILED'; return this.read(); }
      this.sessions.clear();
      return this.read();
    }).then(async () => { if (this.stateToken === token && this.store.writable && this.currentCredential() && this.warning !== 'CLEAR_LOCAL_FAILED') await this.synchronize(token); return this.read(); });
  }
  deleteUploaded() {
    const token = this.closeGate();
    return this.enqueue(async () => {
      const state = clone(this.store.state); state.scopes = falseScopes(); state.revision++; state.epoch = id(); state.eligible = []; state.outbox = [];
      state.controls = state.credentials.filter(c => !c.deleted).map(c => ({ kind: 'erasure', origin: c.origin, installation_id: c.installation_id }));
      try { await this.store.commit(state); this.warning = null; } catch { this.warning = 'STOPPED_NOT_SAVED_RETRY_NEXT_START_MAY_RESTORE'; return this.read(); }
      return this.read();
    }).then(async () => { if (this.stateToken === token && this.store.writable) await this.retryControls(token); return this.read(); });
  }
  async retryControls(token = this.stateToken) {
    for (const control of clone(this.store.state.controls)) {
      if (this.stateToken !== token) return;
      const credential = this.store.state.credentials.find(c => c.installation_id === control.installation_id && c.origin === control.origin);
      if (!credential || credential.deleted) continue;
      if (control.kind === 'consent') { if (control.origin === this.origin) await this.synchronize(token); continue; }
      try {
        const response = await this.network(credential, '/stats/v1/erasure', 'POST', { installation_id: credential.installation_id }, () => this.stateToken === token);
        if (response.status !== 200 || response.body.deleted !== true || this.stateToken !== token) throw new Error('ERASURE_PENDING');
        await this.enqueue(async () => {
          if (this.stateToken !== token) return;
          const state = clone(this.store.state); state.credentials.find(c => c.installation_id === credential.installation_id).deleted = true;
          state.controls = state.controls.filter(c => !(c.kind === 'erasure' && c.installation_id === credential.installation_id));
          await this.store.commit(state); this.warning = null; this.uploadStatus = 'deleted';
        });
      } catch { this.warning = 'ERASURE_PENDING'; this.uploadStatus = 'deletion_pending'; }
    }
  }
  setIdle(value) {
    this.idle = Boolean(value);
    if (!this.idle) { for (const controller of this.aborters) controller.abort(); if (this.timer) clearTimeout(this.timer); this.timer = null; }
    else this.schedule();
  }
  restartSuspended(value) {
    const next = Boolean(value), previous = this.suspended;
    if (next === previous) return;
    this.suspended = next;
    if (next) {
      const mayResume = SCOPES.some(k => this.effective[k]);
      const epoch = this.store.state.epoch;
      const token = this.closeGate(); this.restartResume = { mayResume, epoch, token };
    } else {
      const resume = this.restartResume; this.restartResume = null;
      // Resume only the exact gate that this suspension closed, never an older saved consent.
      if (resume?.mayResume && !this.warning && this.isCurrent(resume.token, resume.epoch)) this.synchronize(this.stateToken).catch(() => {});
    }
  }

  schedule() {
    if (!this.idle || this.suspended || this.timer || this.inFlight || (!this.store.state.controls.length && !SCOPES.some(k => this.effective[k])) || this.store.state.attempts.failures >= 8) return;
    const attempt = this.store.state.attempts;
    const wait = Math.max(1000, attempt.next - this.now(), attempt.count ? attempt.last + 3600000 - this.now() : 0);
    this.timer = setTimeout(() => { this.timer = null; this.flush().catch(() => {}); }, Math.min(wait, 86400000)); this.timer.unref?.();
  }
  async flush() {
    if (!this.idle || this.suspended || this.inFlight) return this.read();
    this.inFlight = true;
    const token = this.stateToken; const epoch = this.store.state.epoch;
    try {
      await this.retryControls(token);
      if (!this.isCurrent(token, epoch) || !this.idle || !SCOPES.some(k => this.effective[k])) return this.read();
      let batch; let credential;
      await this.enqueue(async () => {
        if (!this.isCurrent(token, epoch) || !this.idle) return;
        const state = clone(this.store.state); this.prune(state);
        const now = this.now(); const day = dayOf(now); const attempts = state.attempts;
        if (attempts.day !== day) { attempts.day = day; attempts.count = 0; }
        if (attempts.count >= 4 || attempts.failures >= 8 || now < attempts.next || (attempts.count && now - attempts.last < 3600000)) return;
        batch = state.outbox.filter(r => this.effective[r.scope] && r.epoch === epoch);
        while (batch.length && Buffer.byteLength(JSON.stringify({ installation_id: '0'.repeat(32), reports: batch })) > 32 * 1024) batch.pop();
        if (!batch.length) return;
        credential = clone(this.currentCredential(state)); attempts.count++; attempts.last = now;
        await this.store.commit(state);
      });
      if (!batch?.length || !credential) return this.read();
      const guard = () => this.isCurrent(token, epoch) && this.idle && !this.suspended && batch.every(r => this.effective[r.scope]);
      let response; let failure;
      try { response = await this.network(credential, '/stats/v1/reports', 'POST', { installation_id: credential.installation_id, reports: batch }, guard); }
      catch { failure = true; }
      await this.enqueue(async () => {
        if (!guard()) return;
        const state = clone(this.store.state);
        if (!failure && response.status === 200 && Object.keys(response.body).join() === 'ack' && Array.isArray(response.body.ack) && response.body.ack.length === batch.length && response.body.ack.every(a => Object.keys(a).sort().join() === 'app_version,day,epoch,report_revision,scope' && batch.some(r => reportKey(r) === reportKey(a) && r.report_revision === a.report_revision))) {
          for (const report of batch) {
            const ack = response.body.ack.find(a => reportKey(a) === reportKey(report) && a.report_revision === report.report_revision);
            if (!ack) continue;
            const eligible = state.eligible.find(e => reportKey(e.report) === reportKey(report));
            if (eligible) eligible.acked_revision = Math.max(eligible.acked_revision, report.report_revision);
            state.outbox = state.outbox.filter(r => !(reportKey(r) === reportKey(report) && r.report_revision === report.report_revision));
          }
          state.attempts.failures = 0; state.attempts.next = this.now() + 3600000;
          this.uploadStatus = 'enabled'; this.warning = null;
        } else {
          state.attempts.failures = Math.min(state.attempts.failures + 1, 8);
          const retry = response?.status === 429 ? parseRetryAfter(response.retryAfter, this.now()) : 0;
          state.attempts.next = this.now() + Math.max(retry, Math.min(24 * 3600000, 60000 * 2 ** state.attempts.failures));
          if (response?.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) this.effective = falseScopes();
          this.uploadStatus = SCOPES.some(k => this.effective[k]) ? 'retry_pending' : 'stopped'; this.warning = response?.status >= 400 && response.status < 500 && response.status !== 429 ? 'UPLOAD_REJECTED' : 'UPLOAD_RETRY_PENDING';
        }
        await this.store.commit(state);
      });
    } finally { this.inFlight = false; if (this.store.state.outbox.length || this.store.state.controls.length) this.schedule(); }
    return this.read();
  }
  prune(state) {
    const current = dayOf(this.now()); const cutoff7 = dayOf(this.now() - 6 * 86400000); const cutoff90 = dayOf(this.now() - 89 * 86400000);
    state.eligible = state.eligible.filter(e => e.report.day >= cutoff90 && e.report.day <= current).slice(-180);
    state.outbox = state.outbox.filter(r => r.day >= cutoff7 && r.day <= current).slice(-32);
    while (Buffer.byteLength(JSON.stringify(state.outbox)) > 128 * 1024) state.outbox.shift();
    while (Buffer.byteLength(JSON.stringify(state.eligible)) > 120 * 1024 && state.eligible.length > 2) state.eligible.shift();
    while (Buffer.byteLength(JSON.stringify(state)) > 256 * 1024 && state.outbox.length > 1) state.outbox.shift();
  }
  observe(scope, update) {
    const token = this.stateToken; const epoch = this.store.state.epoch; const eligible = this.effective[scope];
    return this.enqueue(async () => {
      if (!this.store.state.record_local || this.stateToken !== token) return this.read();
      const date = dayOf(this.now());
      this.local.days = this.local.days.filter(d => typeof d.day === 'string' && d.day >= dayOf(this.now() - 89 * 86400000) && d.day <= date).slice(-89);
      let local = this.local.days.find(d => d.day === date && d.app_version === this.appVersion);
      if (!local) { local = { day: date, app_version: this.appVersion, preferences: pref(this.selected), performance: null }; this.local.days.push(local); }
      update(local, false);
      while (Buffer.byteLength(JSON.stringify(this.local)) > 256 * 1024 && this.local.days.length > 1) this.local.days.shift();
      try { await atomicWrite(path.join(this.directory, 'local-usage.json'), this.local); } catch { this.warning = 'LOCAL_USAGE_SAVE_FAILED'; }
      // The uploader reads only the consented epoch's eligible records, never local history.
      if (!eligible || !this.effective[scope] || !this.isCurrent(token, epoch)) return this.read();
      const state = clone(this.store.state);
      let item = state.eligible.find(e => e.report.epoch === epoch && e.report.scope === scope && e.report.day === date && e.report.app_version === this.appVersion);
      if (!item) { item = { acked_revision: 0, report: { scope, epoch, consent_revision: state.revision, day: date, app_version: this.appVersion, report_revision: 0, data: scope === 'preferences' ? pref(this.selected) : null } }; state.eligible.push(item); }
      const data = { [scope]: item.report.data }; update(data, true); item.report.data = data[scope]; item.report.report_revision++;
      state.outbox = state.outbox.filter(r => reportKey(r) !== reportKey(item.report)); state.outbox.push(clone(item.report)); this.prune(state);
      if (this.isCurrent(token, epoch) && this.effective[scope]) await this.store.commit(state);
      this.schedule(); return this.read();
    });
  }
  recordSession({ id: sessionId, sessionKind, gameplay, cardStyle, skills }) {
    if (typeof sessionId !== 'string' || sessionId.length > 256 || !['solo', 'multiplayer'].includes(sessionKind)
      || !['classic', 'firepower', 'loan', 'lucky', 'custom_pack'].includes(gameplay) || !['classic', 'illustrated'].includes(cardStyle)
      || !Array.isArray(skills) || skills.length !== 8 || skills.some(v => typeof v !== 'boolean')) return Promise.reject(new Error('INVALID_SESSION_SUMMARY'));
    if (this.sessions.has(sessionId)) return Promise.resolve(this.read());
    this.sessions.add(sessionId); if (this.sessions.size > 256) this.sessions.delete(this.sessions.values().next().value);
    return this.observe('preferences', data => {
      const sessions = data.preferences.sessions;
      const item = sessions.find(s => s.session_kind === sessionKind && s.gameplay === gameplay && s.card_style === cardStyle && s.skills.every((v, i) => v === skills[i]));
      if (item) item.count = Math.min(1000000, item.count + 1);
      else if (sessions.length < 64) sessions.push({ session_kind: sessionKind, gameplay, card_style: cardStyle, skills: [...skills], count: 1 });
    });
  }
  recordSettings(previous, next) {
    const selected = pref(next); this.selected = { graphics: selected.graphics, cardStyle: selected.card_style };
    const before = pref(previous);
    const snapshot = crypto.createHash('sha256').update(JSON.stringify(next)).digest('hex');
    const changed = JSON.stringify(previous) !== JSON.stringify(next);
    const duplicate = this.settingsSnapshot === snapshot; this.settingsSnapshot = snapshot;
    if (!changed || duplicate) return Promise.resolve(this.read());
    return this.observe('preferences', data => { const p = data.preferences; p.card_style = selected.card_style; p.graphics = selected.graphics; p.preset = selected.preset; p.settings_changes = Math.min(1000000, p.settings_changes + 1); });
  }
  recordRecommendation(token, event, graphics) {
    if (typeof token !== 'string' || token.length > 128 || !['shown', 'adopted'].includes(event)) return Promise.reject(new Error('INVALID_RECOMMENDATION'));
    let item = this.recommendations.get(token);
    if (event === 'shown') {
      if (item) return Promise.resolve(this.read());
      item = { epoch: this.store.state.epoch, shown: true, adopted: false, graphics: validateGraphics(graphics) }; this.recommendations.set(token, item);
      if (this.recommendations.size > 128) this.recommendations.delete(this.recommendations.keys().next().value);
    } else {
      if (!item || item.adopted || item.epoch !== this.store.state.epoch || !graphics || !sameGraphics(item.graphics, validateGraphics(graphics))) return Promise.resolve(this.read());
      item.adopted = true;
    }
    return this.observe('preferences', data => { data.preferences.recommendations[event] = Math.min(1000000, data.preferences.recommendations[event] + 1); });
  }
  recordPerformance(summary) {
    if (!validData('performance', summary)) return Promise.reject(new Error('INVALID_PERFORMANCE_SUMMARY'));
    const fields = 'algorithm_version,compositing,effective_graphics,long_interval_ratio,memory,os,p95,parallelism,pixel_load,preset,reduced_motion,reduced_transparency,samples,saved_graphics';
    if (!summary || Object.keys(summary).sort().join() !== fields || !Number.isSafeInteger(summary.samples) || summary.samples < 240 || summary.samples > 4096) return Promise.reject(new Error('INVALID_PERFORMANCE_SUMMARY'));
    validateGraphics(summary.saved_graphics); validateGraphics(summary.effective_graphics);
    const choices = { os: ['macos','windows','linux','other'], memory: ['unknown','le4','le8','le16','gt16'], parallelism: ['unknown','le2','le4','le8','gt8'], compositing: ['unknown','hardware','software'], pixel_load: ['unknown','le1m','le3m','le8m','gt8m'], p95: ['le20','le33','le50','gt50'], long_interval_ratio: ['le1pct','le5pct','gt5pct'], algorithm_version: ['graphics-v1'] };
    if (Object.entries(choices).some(([k,v]) => !v.includes(summary[k])) || typeof summary.reduced_motion !== 'boolean' || typeof summary.reduced_transparency !== 'boolean' || summary.preset !== matchGraphicsPreset(summary.effective_graphics)) return Promise.reject(new Error('INVALID_PERFORMANCE_SUMMARY'));
    return this.observe('performance', data => { data.performance = clone(summary); });
  }
  async persistenceBarrier() { await this.serial; await this.store.diskPromise; return this.read(); }
  dispose() { this.closeGate(); this.idle = false; }
}
function parseRetryAfter(value, now) { const numeric = Number(value); if (Number.isFinite(numeric) && numeric > 0) return numeric * 1000; const date = Date.parse(value); return Number.isFinite(date) ? Math.max(date - now, 0) : 60000; }
module.exports = { TelemetryService, performRequest, trustedOrigin };
