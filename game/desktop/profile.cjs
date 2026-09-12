const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const avatars = ['leaf', 'sun', 'moon', 'star'];
const fail = code => { throw new Error(code); };
function fields(p, keys) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).sort().join() !== [...keys].sort().join()) fail('INVALID_INPUT');
}
function validateInput(p) {
  fields(p, ['nickname', 'avatar_id']);
  if (typeof p.nickname !== 'string' || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(p.nickname) || !p.nickname.trim() || [...p.nickname.trim()].length > 20 || !avatars.includes(p.avatar_id)) fail('INVALID_PROFILE');
  return { nickname: p.nickname.trim(), avatar_id: p.avatar_id };
}
function validateSettings(s) {
  fields(s, ['music', 'effects', 'fullscreen']);
  if (![s.music, s.effects].every(n => Number.isInteger(n) && n >= 0 && n <= 100) || typeof s.fullscreen !== 'boolean') fail('INVALID_SETTINGS');
  return { ...s };
}
function validateStored(p) {
  fields(p, ['profile_version', 'local_id', 'nickname', 'avatar_id', 'settings']);
  if (p.profile_version !== 1 || typeof p.local_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.local_id)) fail('INVALID_PROFILE');
  validateInput({ nickname: p.nickname, avatar_id: p.avatar_id }); validateSettings(p.settings);
  return p;
}
class ProfileStore {
  constructor(directory, io = fs) { this.directory = directory; this.io = io; this.busy = false; this.file = path.join(directory, 'profile.json'); }
  async read() {
    try {
      const s = await this.io.lstat(this.file);
      if (!s.isFile() || s.size > 65536) fail('PROFILE_DAMAGED');
      return validateStored(JSON.parse(await this.io.readFile(this.file, 'utf8')));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      fail(e.code === 'EACCES' || e.code === 'EPERM' ? 'PROFILE_UNREADABLE' : 'PROFILE_DAMAGED');
    }
  }
  async save(mode, payload) {
    if (this.busy) fail('PROFILE_BUSY');
    this.busy = true;
    let temp;
    try {
      fields(payload, mode === 'recover' ? ['nickname', 'avatar_id', 'confirmed'] : mode === 'settings' ? ['nickname', 'avatar_id', 'settings'] : ['nickname', 'avatar_id']);
      const input = validateInput({ nickname: payload.nickname, avatar_id: payload.avatar_id });
      if (mode === 'recover' && payload.confirmed !== true) fail('CONFIRM_REQUIRED');
      let old;
      try { old = await this.read(); }
      catch (e) { if (mode !== 'recover' || e.message !== 'PROFILE_DAMAGED') throw e; }
      if (mode === 'recover' && old !== undefined) fail('RECOVERY_NOT_NEEDED');
      if (mode === 'create' && old) fail('PROFILE_EXISTS');
      if (['update', 'settings'].includes(mode) && !old) fail('PROFILE_MISSING');
      const profile = { profile_version: 1, local_id: old?.local_id || randomUUID(), ...input,
        settings: mode === 'settings' ? validateSettings(payload.settings) : old?.settings || { music: 60, effects: 70, fullscreen: false } };
      await this.io.mkdir(this.directory, { recursive: true, mode: 0o700 });
      if (mode === 'recover') {
        const stat = await this.io.lstat(this.file);
        if (!stat.isFile()) fail('PROFILE_UNREADABLE');
        await this.io.copyFile(this.file, path.join(this.directory, `profile-damaged-${randomUUID()}.json`), fs.constants.COPYFILE_EXCL);
      }
      temp = path.join(this.directory, `profile-${randomUUID()}.tmp`);
      // Same-directory rename keeps the old file intact if writing fails.
      await this.io.writeFile(temp, JSON.stringify(profile, null, 2), { flag: 'wx', mode: 0o600 });
      await this.io.rename(temp, this.file);
      return profile;
    } catch (e) { if (e.code) fail('SAVE_FAILED'); throw e; }
    finally { if (temp) await this.io.unlink(temp).catch(() => {}); this.busy = false; }
  }
}
module.exports = { ProfileStore, fields, validateInput, validateSettings };
