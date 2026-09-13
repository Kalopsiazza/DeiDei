const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { WorkerBridge } = require('./bridge.cjs');
function harness() {
  const children=[];
  const sandbox={module:{exports:{}},Buffer,setTimeout,clearTimeout,require:n=>{
    assert.equal(n,'node:child_process');
    return {spawn:()=>{
      const c=new EventEmitter(); c.stdin=new EventEmitter(); c.stdout=new EventEmitter(); c.stderr=new EventEmitter();
      c.writes=[]; c.kills=[]; c.stdin.write=x=>c.writes.push(JSON.parse(x)); c.stdin.end=()=>{};
      c.kill=s=>{c.kills.push(s);return true;}; children.push(c); return c;
    }};
  }};
  vm.runInNewContext(fs.readFileSync(require.resolve('./bridge.cjs'),'utf8'),sandbox);
  return {b:new sandbox.module.exports.WorkerBridge('fake'),children};
}
const observe=p=>p.then(data=>({ok:true,data}),e=>({ok:false,error:e.message}));
function reply(child, index=0) { child.stdout.emit('data',Buffer.from(JSON.stringify({v:1,id:child.writes[index].id,ok:true,data:{worker:'ready'}})+'\n')); }
function close(child) { child.emit('exit',0); child.emit('close',0); }
test('old exit and stdout cannot touch fresh generation; immediate retry; retained cleanup', async()=>{
  const {b,children}=harness();
  const first=observe(b.request('health')); const old=children[0];
  old.stdout.emit('data',Buffer.from('bad\n')); assert.equal((await first).error,'WORKER_PROTOCOL_ERROR');
  const second=observe(b.request('health')); const fresh=children[1];
  old.stdout.emit('data',Buffer.from('bad-again\n')); reply(old); close(old);
  reply(fresh); assert.equal((await second).ok,true); assert.equal(b.current.child,fresh);
  const stopped=b.stop(); close(fresh); await stopped; assert.equal(b.generations.size,0);
});
test('stdin failure, repeated stop, spawn error with close but no exit; late events',async()=>{
  const {b,children}=harness(); const p=observe(b.request('health')); const old=children[0];
  old.stdin.emit('error',new Error('broken pipe')); assert.equal((await p).error,'WORKER_PIPE_FAILED');
  assert.deepEqual(old.kills,['SIGTERM']);
  const fresh=observe(b.request('health')); const c=children[1]; reply(c); assert.equal((await fresh).ok,true);
  const s1=b.stop(),s2=b.stop(); assert.equal(s1,s2);
  assert.equal((await observe(b.request('health'))).error,'WORKER_STOPPING');
  close(c); assert.equal(b.generations.size,1); close(old); await s1;
  const failed=observe(b.request('health')); const missing=children[2];
  missing.emit('error',new Error('ENOENT')); assert.equal((await failed).error,'WORKER_START_FAILED');
  const s3=b.stop(); missing.emit('close',-2); await s3; await b.stop();
  assert.equal(b.generations.size,0);
});
test('oversize and capacity rejected before spawn; concurrent requests settle once',async()=>{
  const {b,children}=harness();
  assert.equal((await observe(b.request('health',{text:'x'.repeat(65536)}))).error,'FRAME_TOO_LARGE'); assert.equal(children.length,0);
  let settled=0;
  const pending=Array.from({length:16},()=>observe(b.request('health')).then(r=>{settled++;return r;}));
  assert.equal((await observe(b.request('health'))).error,'WORKER_BUSY'); assert.equal(children.length,1);
  const old=children[0]; for(let i=15;i>=0;i--) reply(old,i);
  assert.ok((await Promise.all(pending)).every(r=>r.ok)); assert.equal(settled,16);
  old.stdout.emit('data',Buffer.from('bad\n')); close(old); await b.stop(); assert.equal(settled,16);
});
test('injected 200ms and production 10s timeout both reap actual child; retry works', {timeout:20000}, async()=>{
  for(const timeout of [200,10000]) {
    const b=new WorkerBridge(process.execPath,['-e','setInterval(()=>{},1000)'],timeout);
    const start=performance.now(); const p=b.request('health'); const pid=b.current.child.pid;
    await assert.rejects(p,/WORKER_TIMEOUT/); const ms=performance.now()-start;
    assert.ok(ms>=timeout-20 && ms<timeout+3000,`elapsed ${ms}`);
    await b.stop(); assert.throws(()=>process.kill(pid,0));
    b.args=['-e',`process.stdin.on('data',d=>{const r=JSON.parse(d);console.log(JSON.stringify({v:1,id:r.id,ok:true,data:{worker:'ready'}}));});`];
    assert.equal((await b.request('health')).worker,'ready'); await b.stop();
    console.log(JSON.stringify({timeoutMs:timeout,observedMs:ms,reaped:true,retry:true}));
  }
});
