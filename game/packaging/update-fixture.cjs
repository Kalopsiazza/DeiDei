const {app}=require('electron');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createHash}=require('node:crypto');
const {UpdateService}=require('../desktop/updates/service.cjs');
const {fixtureConfig,artifactName}=require('../desktop/updates/config.cjs');
const out=process.env.DEIDEI_UPDATE_EVIDENCE;
if(!out||app.getName()!=='DeiDei Update Fixture')throw new Error('UPDATE_FIXTURE_ONLY');
const userData=path.join(out,'profile');fs.mkdirSync(userData,{recursive:true});app.setPath('userData',userData);
const cache=path.join(out,'cache');fs.mkdirSync(cache,{recursive:true});app.setPath('cache',cache);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report={evidence_kind:'real electron-updater HTTP transport, isolated no-window Electron',checks:[],native_install:'NOT_RUN',production_trust:'NOT_RUN',requests:[]};
const pass=(id)=>{report.checks.push({id,status:'PASS'});console.log('PASS',id);};
const save=()=>fs.writeFileSync(path.join(out,'transport.json'),JSON.stringify(report,null,2)+'\n');
app.whenReady().then(async()=>{
  app.dock?.hide();let service,server,forbidden;let version='0.5.0',payload=Buffer.from('real complete transport fixture bytes'),expected=payload,delay=0,redirect=false,staged=false,wrongPlatform=false,slow=false;
  let forbiddenRequests=0;
  try {
    forbidden=http.createServer((_request,response)=>{forbiddenRequests++;response.end('forbidden');});await new Promise(resolve=>forbidden.listen(0,'127.0.0.1',resolve));
    server=http.createServer((request,response)=>{
      report.requests.push({path:request.url,headers:Object.keys(request.headers),staging_id_sent:Object.keys(request.headers).some(key=>key.toLowerCase()==='x-user-staging-id')});
      if(new URL(request.url,'http://127.0.0.1').pathname.endsWith('.yml')) {
        const filename=artifactName(version,wrongPlatform?'win32':process.platform,wrongPlatform?'x64':process.arch);
        const info={version,files:[{url:filename,size:expected.length,sha512:createHash('sha512').update(expected).digest('base64')}],...(staged?{stagingPercentage:100}:{})};
        const send=()=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(info));};
        if(delay)setTimeout(send,delay);else send();return;
      }
      if(redirect){response.writeHead(302,{Location:`http://127.0.0.1:${forbidden.address().port}/forbidden.zip`});response.end();return;}
      response.setHeader('Content-Length',payload.length);
      if(slow){let offset=0;const timer=setInterval(()=>{if(offset>=payload.length){clearInterval(timer);response.end();}else {response.write(payload.subarray(offset,offset+=1024));}},20);response.once('close',()=>clearInterval(timer));}
      else response.end(payload);
    });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const config=fixtureConfig(`http://127.0.0.1:${server.address().port}/`);
    fs.writeFileSync(path.join(app.getAppPath(),'dev-app-update.yml'),JSON.stringify({provider:'generic',url:config.url,updaterCacheDirName:'deidei-update-fixture-cache'}));
    service=await new UpdateService({app,userData,config}).start({schedule:false});
    assert.equal(service.updater.autoDownload,false);assert.equal(service.updater.autoInstallOnAppQuit,false);assert.equal(service.updater.disableDifferentialDownload,true);
    const first=service.check();assert.equal(service.check(),first);await first;assert.equal(service.read().status,'available');pass('check-concurrent-deduped');
    const download=service.download();assert.equal(service.download(),download);await download;assert.equal(service.read().status,'ready');
    assert.deepEqual(await fsp.readFile(service.cachedFile),payload);pass('real-download-hash-size-ready');
    assert.equal(service.nativeUsed,false);assert.equal(service.updater.autoInstallOnAppQuit,false);assert.equal(service.read().installPlan,null);pass('ready-auto-install-disabled-no-handoff');
    service.install('menu');assert.equal(service.read().installPlan.mode,'menu');service.cancelInstallPlan();assert.equal(service.read().installPlan,null);pass('installation-plan-memory-only-cancellable');
    service.install('now');await fsp.writeFile(service.cachedFile,Buffer.alloc(payload.length));await assert.rejects(service.verifyReady(service.generation),/UPDATE_HASH_MISMATCH/);assert.equal(service.read().status,'error');pass('real-cached-byte-damage-rejected-before-handoff');
    await service.check();await service.download();assert.equal(service.read().status,'ready');pass('damaged-cache-revalidated-and-redownloaded');
    expected=Buffer.from('changed same version bytes');await assert.rejects(service.check(),/UPDATE_VERSION_CONTENT_CHANGED/);pass('same-version-different-content-rejected');
    version='0.5.1';expected=Buffer.from('expected correct bytes');payload=Buffer.from('actual corrupted bytes');await service.check();await assert.rejects(service.download());assert.equal(service.read().status,'error');pass('real-transport-checksum-corruption-rejected');
    version='0.5.2';payload=Buffer.alloc(100_000,17);expected=payload;slow=true;await service.check();const cancelling=service.download();await pause(100);service.cancelDownload();await cancelling.catch(()=>{});assert.equal(service.read().status,'idle');assert.equal(service.nativeUsed,false);pass('real-active-download-cancellation');slow=false;
    version='0.5.3';delay=200;const stale=service.check();await pause(20);await service.setPreferences({channel:'beta',autoCheck:false});await stale;assert.equal(service.read().status,'idle');assert.equal(service.read().candidate,null);assert.equal(service.updater.allowDowngrade,false);pass('channel-change-invalidates-late-check');delay=0;
    version='0.5.3-beta.1';await service.check();assert.equal(service.read().candidate.version,version);assert.equal(service.updater.allowDowngrade,false);pass('beta-channel-real-feed');
    await service.setPreferences({channel:'stable'});version='0.3.9';await service.check();assert.equal(service.read().status,'idle');assert.equal(service.read().currentVersion,'0.4.0-beta.1');pass('beta-to-stable-does-not-downgrade');
    version='0.5.4';staged=true;await assert.rejects(service.check(),/UPDATE_METADATA_INVALID/);staged=false;pass('staging-percentage-rejected');
    wrongPlatform=true;await assert.rejects(service.check(),/UPDATE_ASSET_INVALID/);wrongPlatform=false;pass('wrong-platform-asset-rejected');
    version='0.5.5';redirect=true;await service.check();await assert.rejects(service.download());assert.equal(forbiddenRequests,0);redirect=false;pass('real-redirect-to-untrusted-origin-blocked');
    assert.ok(report.requests.length>5);assert.ok(report.requests.every(request=>!request.staging_id_sent));pass('persistent-staging-header-never-transmitted');
    await service.close();
    service=await new UpdateService({app,userData,config}).start({schedule:false});assert.equal(service.read().status,'idle');assert.equal(service.read().installPlan,null);assert.equal(service.read().preferences.autoCheck,false);assert.equal(service.read().candidate,null);pass('service-recreated-preferences-cache-needs-check-plan-not-restored');
    report.ordinary_product_quit_and_reopen='NOT_RUN: separate signed native fixture harness';
    report.status='PASS';save();
  }catch(error){report.status='FAIL';report.error=String(error.stack||error);save();console.error(error);process.exitCode=1;}
  finally {await service?.close().catch(()=>{});server?.closeAllConnections();forbidden?.closeAllConnections();await Promise.all([server,forbidden].filter(Boolean).map(value=>new Promise(resolve=>value.close(resolve))));save();app.exit(process.exitCode||0);}
});
