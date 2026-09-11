const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { WorkerBridge } = require('./bridge.cjs');
const { readProfile, writeProfile, validateProfile } = require('./profile.cjs');
test('worker failure, timeout, protocol fault, shutdown and restart', async () => {
  let b = new WorkerBridge(path.join(__dirname, 'missing-worker'), [], 200);
  await assert.rejects(b.request('health'), /WORKER_START_FAILED/);
  for (const script of ['setInterval(()=>{},1000)', 'process.stdout.write("bad\\n");setInterval(()=>{},1000)', 'process.exit(2)']) {
    b = new WorkerBridge(process.execPath, ['-e', script], 200);
    await assert.rejects(b.request('health'), /WORKER_(TIMEOUT|PROTOCOL_ERROR|EXITED)/); await b.stop();
  }
  b = new WorkerBridge(path.join(__dirname,'dist','worker',process.platform==='win32'?'worker.exe':'worker'));
  try {
    assert.equal((await b.request('health')).worker, 'ready');
    await assert.rejects(b.request('nope'), /BAD_REQUEST/);
    await b.request('shutdown'); await b.stop();
    assert.equal((await b.request('health')).worker, 'ready');
  } finally { await b.stop(); }
});
test('profile atomic replacement, validation and preservation on errors', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'r01-profile-'));
  try {
    const p = {version:1,localId:'00000000-0000-4000-8000-000000000000',nickname:'测试 <b>文字</b>',avatarId:'test-1',settings:{sound:false}};
    assert.equal(await readProfile(dir), null);
    await writeProfile(dir,p); assert.deepEqual(await readProfile(dir),p);
    for (const invalid of [{...p, extra:1},{...p,nickname:''},{...p,settings:{sound:'yes'}},{...p,avatarId:'../file'}]) assert.throws(()=>validateProfile(invalid));
    await fs.writeFile(path.join(dir,'profile.json'),'{damaged');
    await assert.rejects(writeProfile(dir,p), /PROFILE_READ_FAILED/);
    assert.equal(await fs.readFile(path.join(dir,'profile.json'),'utf8'),'{damaged');
    const blocked=path.join(dir,'blocked'); await fs.writeFile(blocked,'file');
    await assert.rejects(writeProfile(blocked,p));
    assert.equal(await fs.readFile(blocked,'utf8'),'file');
    assert.deepEqual((await fs.readdir(dir)).sort(),['blocked','profile.json']);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
