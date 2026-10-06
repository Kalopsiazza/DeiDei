const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { TelemetryService, performRequest, trustedOrigin } = require('./privacy/telemetry-service.cjs');
const { atomicWrite } = require('./privacy/consent-store.cjs');
const { graphicsForPreset } = require('./graphics.cjs');
const fixtureKey = crypto.randomBytes(32);
const safeStorage = { isEncryptionAvailable: () => true, encryptString(value) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', fixtureKey, iv); const content = Buffer.concat([cipher.update(value), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), content]); }, decryptString(value) { const cipher = crypto.createDecipheriv('aes-256-gcm', fixtureKey, value.subarray(0,12)); cipher.setAuthTag(value.subarray(12,28)); return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]).toString(); } };
const barrier = () => { let release; const wait = new Promise(resolve => { release = resolve; }); return { wait, release }; };
const profile = preset => ({ profile_version:3, local_id:'private-id', nickname:'private-nickname', avatar_id:'leaf', settings:{graphics:graphicsForPreset(preset),cardStyle:'illustrated',music:50,effects:50,fullscreen:false} });
const session = id => ({ id, sessionKind:'solo', gameplay:'classic', cardStyle:'illustrated', skills:[true,true,true,true,true,true,true,true] });
async function setup(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deidei-privacy-'));
  const service = new TelemetryService({ directory, safeStorage, appVersion:'0.2.0', ...options });
  t.after(async () => { service.dispose(); await service.serial; await fs.rm(directory,{recursive:true,force:true}); });
  await service.ready; return {service,directory};
}
async function collector(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deidei-collector-'));
  const token = 'a'.repeat(64); const tokenFile = path.join(directory,'admin.token'); await fs.writeFile(tokenFile,token,{mode:0o600});
  const root = path.resolve(__dirname, '..', '..');
  const python = path.join(root,'game/telemetry/.venv/bin/python');
  const proc = spawn(python,['-m','deidei_stats','--database',path.join(directory,'stats.sqlite3'),'--admin-token-file',tokenFile],{env:{...process.env,PYTHONPATH:path.join(root,'game/telemetry')},stdio:['ignore','pipe','pipe']});
  let raw=''; let stderr='';proc.stderr.on('data', data=> {stderr+=data;});
  const ready = await new Promise((resolve,reject)=> { const timeout=setTimeout(()=>reject(new Error('COLLECTOR_START_TIMEOUT '+stderr)),10000);proc.stdout.on('data',data=>{raw+=data;const line=raw.split('\n')[0];try{ const r=JSON.parse(line);clearTimeout(timeout);resolve(r);}catch{}});proc.on('error',reject);proc.on('exit',code=>{if(code!==null)reject(new Error('COLLECTOR_EXIT '+code+' '+stderr));}); });
  t.after(async()=>{proc.kill('SIGINT');await once(proc,'exit');assert.equal(stderr,'','HTTP/app logs must contain no addresses or secrets');await fs.rm(directory,{recursive:true,force:true});});
  const origin='http://127.0.0.1:'+ready.port;
  return {origin, summary:async()=>{const response=await fetch(origin+'/admin/v1/summary',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);return response.json();}};
}
async function enable(service, scope='preferences') { const state=service.read();return service.setScope(scope,true,state.revision,state.stateToken); }

test('new and existing profile default zero requests; no renderer secrets; no arbitrary destination', async t=>{
 let calls=0;const {service}=await setup(t,{request:async()=>{calls++;throw Error('unexpected');}});
 await service.recordSettings(profile('balanced'),profile('high'));await service.recordSession(session('before'));service.setIdle(true);await service.flush();
 assert.equal(calls,0);assert.equal(service.read().configured,false);assert.equal(service.preview().reports.length,0);
 assert.ok(!JSON.stringify(service.preview()).includes('private-nickname'));assert.ok(!JSON.stringify(service.preview()).includes('private-id'));
 await assert.rejects(enable(service),/UPLOAD_UNAVAILABLE/);await assert.rejects(service.recordSession({...session('x'),gameplay:'package-private-name'}));
 assert.throws(()=>trustedOrigin('https://trusted.example/other',false));assert.throws(()=>trustedOrigin('http://127.0.0.1:1234',false));
 assert.throws(()=>trustedOrigin('https://secret:credential@trusted.example/',false));
});

test('real HTTP consent scopes, no historical backfill, ACK baseline restart, new epoch clear and erasure',async t=>{
 const c=await collector(t);let now=Date.now();let calls=[];const {service,directory}=await setup(t,{collectorOrigin:c.origin,fixture:true,now:()=>now,request:async(...args)=>{calls.push(args[1]);return performRequest(...args);}});
 await service.recordSettings(profile('balanced'),profile('high'));await service.recordSession(session('history1'));await service.recordSession(session('history2'));
 assert.equal(calls.length,0);await enable(service);assert.equal(service.read().effectiveScopes.preferences,true);assert.equal(service.preview().reports.length,0);
 await service.recordSession(session('consented1'));service.setIdle(true);await service.flush();
 assert.equal((await c.summary()).groups[0].session_uses,1);assert.equal(service.preview().reports.length,0);
 assert.equal(service.store.state.eligible[0].report.data.sessions[0].count,1);assert.equal(service.store.state.eligible[0].acked_revision,1);
 service.dispose();const resumed=new TelemetryService({directory,safeStorage,appVersion:'0.2.0',collectorOrigin:c.origin,fixture:true,now:()=>now});await resumed.ready;t.after(()=>resumed.dispose());
 assert.equal(resumed.read().effectiveScopes.preferences,true);now+=3600001;await resumed.recordSession(session('consented2'));resumed.setIdle(true);await resumed.flush();
 assert.equal((await c.summary()).groups[0].session_uses,2);
 await resumed.clearLocal();assert.equal(resumed.preview().reports.length,0);assert.equal(resumed.local.days.length,0);now+=3600001;
 await resumed.recordSession(session('new-epoch'));await resumed.flush();assert.equal((await c.summary()).groups[0].session_uses,3);
 const publicState=JSON.stringify(resumed.preview());for(const secret of resumed.store.state.credentials)assert.ok(!publicState.includes(secret.installation_id)&&!publicState.includes(secret.sealed));
 const oldId=resumed.store.state.credentials[0].installation_id;await resumed.deleteUploaded();assert.equal(resumed.read().status,'deleted');assert.equal((await c.summary()).installations,0);
 await enable(resumed);assert.notEqual(resumed.store.state.credentials[0].installation_id,oldId);
});

test('enable write blocked then newer stop closes gate immediately and never reopens from stale ACK',async t=>{
 const c=await collector(t);const entered=barrier(),release=barrier();let hold=false;
 const {service}=await setup(t,{collectorOrigin:c.origin,fixture:true,barrier:async name=>{if(hold&&name==='before-consent-write'){hold=false;entered.release();await release.wait;}}});
 hold=true;const enabling=enable(service);await entered.wait;const stopping=service.stop();assert.equal(service.read().effectiveScopes.preferences,false);
 release.release();await enabling;await stopping;assert.deepEqual(service.read().persistedScopes,{preferences:false,performance:false});assert.deepEqual(service.read().effectiveScopes,{preferences:false,performance:false});
 const stale=await service.setScope('preferences',true,0,'stale');assert.equal(stale.conflict,true);
});

test('upload ACK cannot swallow new same-day version; stop/delete invalidate delayed replies',async t=>{
 const c=await collector(t);let now=Date.now();let delayed=false;const entered=barrier(),release=barrier();
 const {service}=await setup(t,{collectorOrigin:c.origin,fixture:true,now:()=>now,request:async(...args)=>{const response=await performRequest(...args);if(delayed&&args[1].endsWith('/reports')){delayed=false;entered.release();await release.wait;}return response;}});
 await enable(service);await service.recordSession(session('1'));service.setIdle(true);delayed=true;const uploading=service.flush();await entered.wait;
 await service.recordSession(session('2'));release.release();await uploading;
 assert.equal(service.preview().reports.length,1);assert.equal(service.preview().reports[0].data.sessions[0].count,2);assert.equal(service.store.state.eligible[0].acked_revision,1);
 now+=3600001;await service.flush();assert.equal((await c.summary()).groups[0].session_uses,2);
 const e2=barrier(),r2=barrier();const base=service.request;service.request=async(...args)=>{const response=await base(...args);if(args[1].endsWith('/reports')){e2.release();await r2.wait;}return response;};
 now+=3600001;await service.recordSession(session('3'));const staleUpload=service.flush();await e2.wait;await service.deleteUploaded();r2.release();await staleUpload;
 assert.equal(service.preview().reports.length,0);assert.equal((await c.summary()).installations,0);assert.deepEqual(service.read().effectiveScopes,{preferences:false,performance:false});
});

test('stop persistence failure stays stopped through restart cancellation; retry verifies cold start',async t=>{
 const c=await collector(t);let fail=false;const {service,directory}=await setup(t,{collectorOrigin:c.origin,fixture:true,write:async(...args)=>{if(fail)throw Error('injected disk failure');return atomicWrite(...args);}});
 await enable(service);fail=true;await service.stop();assert.equal(service.read().persistedScopes.preferences,true);assert.equal(service.read().effectiveScopes.preferences,false);assert.match(service.read().warning,/STOPPED_NOT_SAVED/);
 service.restartSuspended(true);service.restartSuspended(false);await service.serial;assert.equal(service.read().effectiveScopes.preferences,false);
 fail=false;await service.stop();assert.equal(service.read().persistedScopes.preferences,false);service.dispose();
 const resumed=new TelemetryService({directory,safeStorage,appVersion:'0.2.0',collectorOrigin:c.origin,fixture:true});await resumed.ready;t.after(()=>resumed.dispose());assert.equal(resumed.read().effectiveScopes.preferences,false);
});

test('scopes are independent; recommendation adoption must have same epoch denominator; performance closed projection',async t=>{
 const c=await collector(t);const {service}=await setup(t,{collectorOrigin:c.origin,fixture:true});
 await enable(service);await service.recordRecommendation('recommendation-a','shown',graphicsForPreset('smooth'));await service.clearLocal();await service.recordRecommendation('recommendation-a','adopted',graphicsForPreset('smooth'));
 assert.equal(service.preview().reports.length,0);
 await service.recordRecommendation('recommendation-b','shown',graphicsForPreset('balanced'));await service.recordRecommendation('recommendation-b','shown',graphicsForPreset('balanced'));await service.recordRecommendation('recommendation-b','adopted',graphicsForPreset('balanced'));await service.recordRecommendation('recommendation-b','adopted',graphicsForPreset('balanced'));
 assert.deepEqual(service.preview().reports[0].data.recommendations,{shown:1,adopted:1});
 const sample={os:'macos',memory:'le16',parallelism:'le8',compositing:'hardware',pixel_load:'le3m',saved_graphics:graphicsForPreset('high'),effective_graphics:graphicsForPreset('balanced'),preset:'balanced',reduced_motion:true,reduced_transparency:false,p95:'le20',long_interval_ratio:'le1pct',algorithm_version:'graphics-v1',samples:300};
 await service.recordPerformance(sample);assert.equal(service.preview().reports.some(r=>r.scope==='performance'),false);
 await enable(service,'performance');await service.recordPerformance(sample);assert.deepEqual(service.preview().reports.map(r=>r.scope),['performance']);
 await assert.rejects(service.recordPerformance({...sample,serial:'private'}));await assert.rejects(service.recordPerformance({...sample,preset:'high'}));
});

test('unavailable encryption/corrupt state fail closed; origin change retains isolated old erasure capabilities',async t=>{
 const c1=await collector(t),c2=await collector(t);const {service,directory}=await setup(t,{collectorOrigin:c1.origin,fixture:true});await enable(service);await service.recordSession(session('a'));service.setIdle(true);await service.flush();service.dispose();
 const changed=new TelemetryService({directory,safeStorage,appVersion:'0.2.0',collectorOrigin:c2.origin,fixture:true});await changed.ready;t.after(()=>changed.dispose());assert.deepEqual(changed.read().persistedScopes,{preferences:false,performance:false});assert.deepEqual(changed.read().oldDestinations,[c1.origin]);
 await enable(changed);assert.equal(changed.store.state.credentials.length,2);await changed.deleteUploaded();assert.equal((await c1.summary()).installations,0);assert.equal((await c2.summary()).installations,0);changed.dispose();
 const unavailable=new TelemetryService({directory,safeStorage:{isEncryptionAvailable:()=>false},appVersion:'0.2.0',collectorOrigin:c2.origin,fixture:true});await unavailable.ready;t.after(()=>unavailable.dispose());assert.equal(unavailable.read().effectiveScopes.preferences,false);await assert.rejects(enable(unavailable),/UPLOAD_UNAVAILABLE/);
 await fs.writeFile(path.join(directory,'privacy-state.json'),'{damaged');const corrupt=new TelemetryService({directory,safeStorage,appVersion:'0.2.0',collectorOrigin:c2.origin,fixture:true});await corrupt.ready;t.after(()=>corrupt.dispose());assert.equal(corrupt.read().effectiveScopes.preferences,false);assert.match(corrupt.read().warning,/UNREADABLE/);
});

test('bounded UTC retention and queue; 429 honors Retry-After, daily four attempts and retry ceiling; no match sends',async t=>{
 const c=await collector(t);let now=Date.parse(new Date().toISOString().slice(0,10)+'T00:00:00Z'), reports=0, throttled=false;
 const {service}=await setup(t,{collectorOrigin:c.origin,fixture:true,now:()=>now,request:async(...args)=>{
   if(args[1].endsWith('/reports')){reports++;if(throttled)return {status:429,retryAfter:'7200',body:{error:'RATE_LIMIT'}};}
   return performRequest(...args);
 }});
 await enable(service);await service.recordSession(session('initial'));service.setIdle(false);await service.flush();assert.equal(reports,0);
 service.setIdle(true);throttled=true;await service.flush();assert.equal(reports,1);now+=3600001;await service.flush();assert.equal(reports,1);now+=3600001;await service.flush();assert.equal(reports,2);
 now+=7200001;await service.flush();now+=7200001;await service.flush();assert.equal(reports,4);now+=7200001;await service.flush();assert.equal(reports,4);
 service.setIdle(false);for(let n=0;n<100;n++){now+=86400000;await service.recordSession(session('day-'+n));}
 assert.ok(service.local.days.length<=90);assert.ok(service.store.state.eligible.length<=180);assert.ok(service.store.state.outbox.length<=32);
 assert.ok(Buffer.byteLength(JSON.stringify(service.store.state.outbox))<=128*1024);
 assert.ok(service.store.state.outbox.every(r=>r.day>=new Date(now-6*86400000).toISOString().slice(0,10)));
 assert.ok(service.local.days.every(r=>r.day>=new Date(now-89*86400000).toISOString().slice(0,10)));
 service.store.state.attempts.failures=8;await service.flush();assert.equal(reports,4);
});

test('encrypted capabilities bind origin and installation, same saved receipt does not duplicate settings count',async t=>{
 const c=await collector(t);const {service,directory}=await setup(t,{collectorOrigin:c.origin,fixture:true});await enable(service);
 await service.recordSettings(profile('balanced'),profile('high'));await service.recordSettings(profile('balanced'),profile('high'));assert.equal(service.preview().reports[0].data.settings_changes,1);
 const state=structuredClone(service.store.state);state.credentials[0].origin='https://attacker.invalid';state.consented_origin='https://attacker.invalid';await atomicWrite(path.join(directory,'privacy-state.json'),state);service.dispose();
 let requests=0;const tampered=new TelemetryService({directory,safeStorage,appVersion:'0.2.0',collectorOrigin:c.origin,fixture:true,request:async()=>{requests++;throw Error('must not send');}});await tampered.ready;t.after(()=>tampered.dispose());
 assert.equal(requests,0);assert.equal(tampered.read().effectiveScopes.preferences,false);assert.match(tampered.read().warning,/UNREADABLE/);
});

test('installation persistence barrier waits rename and never waits enrollment ACK',async t=>{
 const c=await collector(t);const entered=barrier(),release=barrier();let delayed=true;
 const {service}=await setup(t,{collectorOrigin:c.origin,fixture:true,request:async(...args)=>{const response=await performRequest(...args);if(delayed&&args[1].endsWith('/enrollments')){delayed=false;entered.release();await release.wait;}return response;}});
 const enabling=enable(service);await entered.wait;const result=await Promise.race([service.persistenceBarrier(),new Promise((_,reject)=>setTimeout(()=>reject(Error('barrier waited telemetry network')),100))]);
 assert.equal(result.persistedScopes.preferences,true);assert.equal(result.effectiveScopes.preferences,false);
 const stopping=service.stop();const persisted=await service.persistenceBarrier();assert.equal(persisted.persistedScopes.preferences,false);release.release();await enabling;await stopping;assert.equal(service.read().effectiveScopes.preferences,false);
});
