const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateGraphics, matchGraphicsPreset } = require('../graphics.cjs');
const SCOPES = ['preferences', 'performance'];
const POLICY_ID = 'deidei-stats-v1';
const clone = value => structuredClone(value);
const empty = () => ({ version: 1, record_local: true, scopes: { preferences: false, performance: false }, revision: 0, policy_id: POLICY_ID, consented_origin: '', epoch: crypto.randomBytes(16).toString('hex'), credentials: [], eligible: [], outbox: [], controls: [], attempts: { day: '', count: 0, last: 0, next: 0, failures: 0 } });
function validate(value) {
  const fields = Object.keys(empty()).sort().join();
  if (!value || Object.keys(value).sort().join() !== fields || value.version !== 1 || typeof value.record_local !== 'boolean'
    || Object.keys(value.scopes || {}).sort().join() !== 'performance,preferences' || SCOPES.some(k => typeof value.scopes[k] !== 'boolean')
    || !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision > 2147483647 || !/^deidei-stats-v[1-9][0-9]{0,3}$/.test(value.policy_id)
    || typeof value.consented_origin !== 'string' || !/^[a-f0-9]{32}$/.test(value.epoch)
    || !Array.isArray(value.credentials) || value.credentials.length > 8 || !Array.isArray(value.eligible) || value.eligible.length > 180
    || !Array.isArray(value.outbox) || value.outbox.length > 32 || !Array.isArray(value.controls) || value.controls.length > 16
    || Buffer.byteLength(JSON.stringify(value.outbox)) > 128 * 1024) throw new Error('PRIVACY_STATE_INVALID');
  for (const c of value.credentials) {
    if (Object.keys(c).sort().join() !== 'deleted,enrolled,installation_id,origin,policy_id,sealed' || typeof c.origin !== 'string'
      || !/^deidei-stats-v[1-9][0-9]{0,3}$/.test(c.policy_id) || !/^[a-f0-9]{32}$/.test(c.installation_id) || typeof c.sealed !== 'string' || c.sealed.length > 4096
      || typeof c.enrolled !== 'boolean' || typeof c.deleted !== 'boolean') throw new Error('PRIVACY_STATE_INVALID');
  }
  for (const item of value.eligible) if (!item || !Number.isSafeInteger(item.acked_revision) || item.acked_revision < 0 || !validReport(item.report)) throw new Error('PRIVACY_STATE_INVALID');
  for (const report of value.outbox) if (!validReport(report)) throw new Error('PRIVACY_STATE_INVALID');
  for (const c of value.controls) if (!exact(c, 'installation_id,kind,origin') || !['consent', 'erasure'].includes(c.kind) || typeof c.origin !== 'string' || !/^[a-f0-9]{32}$/.test(c.installation_id)) throw new Error('PRIVACY_STATE_INVALID');
  if (!value.attempts || Object.keys(value.attempts).sort().join() !== 'count,day,failures,last,next' || typeof value.attempts.day !== 'string'
    || ['count', 'failures', 'last', 'next'].some(k => !Number.isFinite(value.attempts[k]) || value.attempts[k] < 0)) throw new Error('PRIVACY_STATE_INVALID');
  return value;
}
function exact(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === keys; }
function count(value, minimum = 0, maximum = 1000000) { return Number.isSafeInteger(value) && value >= minimum && value <= maximum; }
function validData(scope, data) {
  try {
    if (scope === 'preferences') {
      if (!exact(data, 'card_style,graphics,preset,recommendations,sessions,settings_changes') || !['classic','illustrated'].includes(data.card_style)
        || data.preset !== matchGraphicsPreset(validateGraphics(data.graphics)) || !count(data.settings_changes)
        || !exact(data.recommendations, 'adopted,shown') || !count(data.recommendations.shown) || !count(data.recommendations.adopted, 0, data.recommendations.shown)
        || !Array.isArray(data.sessions) || data.sessions.length > 64) return false;
      const dimensions = new Set();
      for (const s of data.sessions) {
        if (!exact(s, 'card_style,count,gameplay,session_kind,skills') || !['solo','multiplayer'].includes(s.session_kind)
          || !['classic','firepower','loan','lucky','custom_pack'].includes(s.gameplay) || !['classic','illustrated'].includes(s.card_style)
          || !Array.isArray(s.skills) || s.skills.length !== 8 || s.skills.some(v => typeof v !== 'boolean') || !count(s.count, 1)) return false;
        const key = JSON.stringify([s.session_kind, s.gameplay, s.card_style, s.skills]); if (dimensions.has(key)) return false; dimensions.add(key);
      }
      return true;
    }
    if (scope !== 'performance' || !exact(data, 'algorithm_version,compositing,effective_graphics,long_interval_ratio,memory,os,p95,parallelism,pixel_load,preset,reduced_motion,reduced_transparency,samples,saved_graphics')) return false;
    validateGraphics(data.saved_graphics); validateGraphics(data.effective_graphics);
    const choices = { os: ['macos','windows','linux','other'], memory: ['unknown','le4','le8','le16','gt16'], parallelism: ['unknown','le2','le4','le8','gt8'], compositing: ['unknown','hardware','software'], pixel_load: ['unknown','le1m','le3m','le8m','gt8m'], p95: ['le20','le33','le50','gt50'], long_interval_ratio: ['le1pct','le5pct','gt5pct'], algorithm_version: ['graphics-v1'] };
    return Object.entries(choices).every(([key, values]) => values.includes(data[key])) && typeof data.reduced_motion === 'boolean' && typeof data.reduced_transparency === 'boolean' && count(data.samples, 240, 4096) && data.preset === matchGraphicsPreset(data.effective_graphics);
  } catch { return false; }
}
function validReport(report) {
  return exact(report, 'app_version,consent_revision,data,day,epoch,report_revision,scope')
    && SCOPES.includes(report.scope) && /^[a-f0-9]{32}$/.test(report.epoch) && /^\d{4}-\d{2}-\d{2}$/.test(report.day)
    && !Number.isNaN(Date.parse(report.day)) && /^\d{1,5}\.\d{1,5}\.\d{1,5}(?:-(?:alpha|beta|rc)\.\d{1,4})?$/.test(report.app_version)
    && count(report.consent_revision, 1, 2147483647) && count(report.report_revision, 1, 2147483647)
    && validData(report.scope, report.data) && Buffer.byteLength(JSON.stringify(report)) <= 32 * 1024;
}

async function atomicWrite(filename, value) {
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = filename + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, filename);
    const directory = await fs.open(path.dirname(filename), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}
class ConsentStore {
  constructor(directory, { safeStorage, write = atomicWrite } = {}) {
    this.directory = directory; this.safeStorage = safeStorage; this.write = write;
    this.filename = path.join(directory, 'privacy-state.json'); this.state = empty(); this.writable = false;
  }
  async load() {
    try {
      const stat = await fs.lstat(this.filename);
      if (!stat.isFile() || stat.size > 256 * 1024) throw new Error('PRIVACY_STATE_INVALID');
      this.state = validate(JSON.parse(await fs.readFile(this.filename, 'utf8')));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('PRIVACY_STATE_UNREADABLE');
    }
    await this.commit(this.state);
    return clone(this.state);
  }
  encryptionAvailable() {
    return Boolean(this.safeStorage?.isEncryptionAvailable() && this.safeStorage?.getSelectedStorageBackend?.() !== 'basic_text');
  }
  seal(secret, credential) {
    if (!this.encryptionAvailable()) throw new Error('SECURE_STORAGE_UNAVAILABLE');
    return this.safeStorage.encryptString(JSON.stringify({ capability: secret, origin: credential.origin, installation_id: credential.installation_id, policy_id: credential.policy_id })).toString('base64');
  }
  unseal(credential) {
    if (!this.encryptionAvailable()) throw new Error('SECURE_STORAGE_UNAVAILABLE');
    const value = JSON.parse(this.safeStorage.decryptString(Buffer.from(credential.sealed, 'base64')));
    if (!exact(value, 'capability,installation_id,origin,policy_id') || !/^[a-f0-9]{64}$/.test(value.capability) || value.origin !== credential.origin || value.installation_id !== credential.installation_id || value.policy_id !== credential.policy_id) throw new Error('SECURE_STORAGE_UNREADABLE');
    return value.capability;
  }
  commit(value) {
    const operation = this.persist(value); this.diskPromise = operation.catch(() => {}); return operation;
  }
  async persist(value) {
    validate(value);
    if (Buffer.byteLength(JSON.stringify(value)) > 256 * 1024) throw new Error('PRIVACY_STATE_LIMIT');
    try { await this.write(this.filename, value); this.state = clone(value); this.writable = true; }
    catch { this.writable = false; throw new Error('PRIVACY_SAVE_FAILED'); }
  }
}
module.exports = { ConsentStore, atomicWrite, SCOPES, POLICY_ID, clone, validReport, validData };
