const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
function validateProfile(p) {
  if (!p || typeof p !== 'object' || Object.keys(p).sort().join() !== 'avatarId,localId,nickname,settings,version' ||
      p.version !== 1 || typeof p.localId !== 'string' || !/^[a-f0-9-]{36}$/.test(p.localId) ||
      typeof p.nickname !== 'string' || !p.nickname.trim() || p.nickname.length > 40 ||
      /[\u0000-\u001f]/.test(p.nickname) || !['test-1', 'test-2'].includes(p.avatarId) ||
      !p.settings || Object.keys(p.settings).join() !== 'sound' || typeof p.settings.sound !== 'boolean') {
    throw new Error('INVALID_PROFILE');
  }
  return p;
}
async function readProfile(directory) {
  try {
    const file = path.join(directory, 'profile.json');
    if ((await fs.stat(file)).size > 65536) throw new Error('PROFILE_TOO_LARGE');
    return validateProfile(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch (e) { if (e.code === 'ENOENT') return null; throw new Error('PROFILE_READ_FAILED: damaged or inaccessible; original retained'); }
}
async function writeProfile(directory, p) {
  validateProfile(p);
  // Read first: never overwrite a corrupt existing profile as if it were a new one.
  const old = await readProfile(directory);
  if (old && old.localId !== p.localId) throw new Error('LOCAL_ID_MISMATCH');
  await fs.mkdir(directory, { recursive: true });
  const temp = path.join(directory, `profile-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, JSON.stringify(p, null, 2), { flag: 'wx', mode: 0o600 });
    await fs.rename(temp, path.join(directory, 'profile.json'));
  } finally { await fs.unlink(temp).catch(() => {}); }
  return p;
}
module.exports = { validateProfile, readProfile, writeProfile };
