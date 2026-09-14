const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { WorkerBridge } = require('./worker-bridge.cjs');
const { WorkerPort } = require('./worker-port.cjs');
const { pollViews, ddText } = require('./build/view-loop.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(r => {resolve = r;}); return { promise, resolve }; };
const profile = { local_id:'local-test',nickname:'本机测试',avatar_id:'leaf' };
const live = (match='new') => ({source:'live', match_id:match, phase:'selecting'});

function fakeChild() {
  const child = new EventEmitter();
  for (const stream of ['stdin', 'stdout', 'stderr']) child[stream] = new PassThrough();
  child.kills = []; child.kill = signal => child.kills.push(signal);
  return child;
}
function reply(child, id, data) { child.stdout.write(JSON.stringify({v:1,id,ok:true,data})+'\n'); }

test('S09 old exit/stdout cannot settle or fail new process requests; stop waits close', async () => {
  const children = [];
  const bridge = new WorkerBridge('test', [], 1000, () => {const c=fakeChild();children.push(c);return c;});
  const first = bridge.request('health');
  children[0].emit('error',new Error('injected'));
  await assert.rejects(first,/WORKER_START_FAILED/);
  const second = bridge.request('health');
  reply(children[0],'req-2','old'); children[0].emit('exit',1);
  reply(children[1],'req-2','new');
  assert.equal(await second,'new');
  let stopped=false;
  const done=bridge.stop().then(()=>{stopped=true;});
  await wait(5);assert.equal(stopped,false);
  children[1].emit('close');await wait(5);assert.equal(stopped,false);
  children[0].emit('close');await done;assert.equal(stopped,true);
});

test('transport frame bounds, pending cap, malformed UTF8 and timeout reject all pending',async()=>{
  for(const mode of ['cap','bad-json','oversize','timeout','utf8']) {
    const child=fakeChild();const bridge=new WorkerBridge('test',[],mode==='timeout'?10:1000,()=>child);
    const count=mode==='cap'?16:2;
    const pending=Array.from({length:count},()=>bridge.request('health').catch(e=>e.message));
    if(mode==='cap') {await assert.rejects(bridge.request('health'),/WORKER_BUSY/);child.emit('exit');}
    if(mode==='bad-json')child.stdout.write('{}\n');
    if(mode==='oversize')child.stdout.write('x'.repeat(1024*1024+1));
    if(mode==='utf8')child.stdout.write(Buffer.from([0xff,10]));
    const results=await Promise.all(pending);
    assert.ok(results.every(code=>code===results[0]));
    assert.match(results[0],/^WORKER_/);
    child.emit('close');await bridge.stop();
  }
});

test('WorkerPort marks dead match interrupted, no implicit respawn; restart is explicit',async()=>{
  let calls=0, fail=false;
  const bridge={stop:async()=>{},request:async()=>{calls++;if(fail)throw new Error('WORKER_TIMEOUT');return live();}};
  const port=new WorkerPort(profile,bridge);
  await port.startSolo(profile.local_id);fail=true;
  await assert.rejects(port.getView(),/MATCH_INTERRUPTED/);const before=calls;
  await assert.rejects(port.getView(),/MATCH_INTERRUPTED/);assert.equal(calls,before);
  fail=false;await port.startSolo(profile.local_id);assert.equal(port.isActive(),true);
});

test('S10 late response after leave/new scene cannot restore old active match',async()=>{
  const late=deferred();
  const bridge={stop:async()=>{},request:async op=>op==='get_view'?late.promise:live()};
  const port=new WorkerPort(profile,bridge);
  await port.startSolo(profile.local_id);const old=port.getView();
  await port.leave();await port.startSolo(profile.local_id);
  late.resolve(live('old'));await assert.rejects(old,/STALE_VIEW/);
  assert.equal(port.isActive(),true);
});

test('S10 renderer polls selecting and stops on rejected/failed getView with retry possible',async()=>{
  for(const rejection of [false,true]) {
    const errors=[],views=[];
    const stop=pollViews(async()=>{if(rejection)throw new Error('GET_VIEW_FAILED');return {ok:false,error:'READ_FAILED'};},{current:false},v=>views.push(v),e=>errors.push(e),1);
    await wait(15);stop();
    assert.deepEqual(views,[]);assert.deepEqual(errors,[rejection?'GET_VIEW_FAILED':'READ_FAILED']);
  }
  const got=deferred();
  const stop=pollViews(async()=>({ok:true,data:live()}),{current:false},v=>got.resolve(v),()=>assert.fail('unexpected error'),1);
  assert.equal((await got.promise).phase,'selecting');stop();
});

test('S10 single in-flight read spans disposed and new scene; late data is discarded',async()=>{
  const late=deferred(), slot={current:false},views=[];let reads=0;
  const stop=pollViews(()=>{reads++;return late.promise;},slot,v=>views.push(v),()=>{},1);
  await wait(10);assert.equal(reads,1);stop();
  const stopNew=pollViews(async()=>{reads++;return {ok:true,data:live('new')};},slot,v=>views.push(v),()=>{},1);
  await wait(10);assert.equal(reads,1);
  late.resolve({ok:true,data:live('old')});await wait(10);stopNew();
  assert.ok(views.length>0);assert.ok(views.every(v=>v.match_id==='new'));
});

test('BigInt sixths formatting covers fractions and integers beyond Number precision',()=>{
  assert.deepEqual(['0','6','2','3','7','9','36'].map(ddText),['0','1','1/3','1/2','1又1/6','1又1/2','6']);
  assert.equal(ddText('6'+'0'.repeat(4998)+'3'),'1'+'0'.repeat(4999)+'又1/2');
  const huge=10n**100n;assert.equal(ddText(String(huge*6n+3n)),`${huge}又1/2`);
});

test('real subprocess protocol starts live UUID match, retries once and leaves cleanly',async()=>{
  const port=new WorkerPort({...profile,local_id:'663f8313-c0b3-4cf1-bbe0-f4b72df1d9af'});
  try {
    const view=await port.startSolo(port.profile.local_id);
    assert.equal(view.source,'live');assert.equal(view.options.length,33);
    const one=await port.submit(view.view_id,'Charge');const retry=await port.submit(view.view_id,'Charge');
    assert.equal(one.view_id,retry.view_id);assert.equal(one.phase,'submitting');
    await assert.rejects(port.submit(view.view_id,'Def'),/REQUEST_CONFLICT/);
    await port.leave();
  } finally {await port.close();}
});

test('idle real worker exit is detected before any read can respawn it',async()=>{
  const port=new WorkerPort(profile);
  try {
    await port.startSolo(profile.local_id);
    const child=port.bridge.current.child;
    const closed=new Promise(resolve=>child.once('close',resolve));child.kill('SIGTERM');await closed;
    const serial=port.bridge.serial;
    await assert.rejects(port.getView(),/MATCH_INTERRUPTED/);
    assert.equal(port.bridge.serial,serial);assert.equal(port.bridge.current,null);
  } finally {await port.close();}
});
