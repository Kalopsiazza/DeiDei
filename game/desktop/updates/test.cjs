const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {UpdatePreferences}=require('./preferences.cjs');
const {fixtureConfig,allowedURL,candidate,artifactName,loadUpdateConfig}=require('./config.cjs');
const {UpdateService,checkBytes}=require('./service.cjs');

test('update preferences are separate, atomic, strict and serialized',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-updates-'));
  try {
    const store=new UpdatePreferences(directory);
    assert.deepEqual(await store.read(),{schema_version:1,autoCheck:true,autoDownload:false,channel:'stable'});
    await assert.rejects(fs.stat(store.file),{code:'ENOENT'});
    await Promise.all([store.save({channel:'beta'}),store.save({autoDownload:true})]);
    assert.equal((await store.read()).channel,'beta');assert.equal((await store.read()).autoDownload,true);
    for(const patch of [{url:'http://127.0.0.1'},{channel:'alpha'},{autoCheck:1},[]])await assert.rejects(store.save(patch),/UPDATE_PREFERENCES_INVALID/);
    assert.equal((await fs.readdir(directory)).length,1);
    await fs.writeFile(store.file,'broken');await assert.rejects(store.read(),/UPDATE_PREFERENCES_INVALID/);
  }finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('trusted origin, asset, architecture, channels and downgrade boundaries',()=>{
  const config={configured:true,provider:'github',owner:'Kalopsiazza',repo:'DeiDei-releases',platform:'darwin',arch:'arm64'};
  assert.equal(allowedURL('https://github.com/Kalopsiazza/DeiDei-releases/releases/download/v0.5.0/'+artifactName('0.5.0'),config),true);
  for(const url of ['http://github.com/Kalopsiazza/DeiDei-releases/releases.atom','https://github.com/other/repo/releases.atom','https://evil.example/update.zip','file:///tmp/update.zip','https://u:p@github.com/Kalopsiazza/DeiDei-releases/releases.atom','https://github.com/Kalopsiazza/DeiDei-releases/releases/download/%2e%2e/a'])assert.equal(allowedURL(url,config),false,url);
  const fixture=fixtureConfig('http://127.0.0.1:12345/updates/');
  assert.equal(allowedURL('http://127.0.0.1:12345/updates/latest-mac.yml',fixture),true);
  assert.equal(allowedURL('http://127.0.0.1:12346/updates/latest-mac.yml',fixture),false);
  assert.equal(allowedURL('http://127.0.0.1:12345/updates/latest-mac.yml',{...fixture}),false,'fixture permission cannot be reconstructed from JSON');
  const info=version=>({version,files:[{url:artifactName(version,'darwin','arm64'),size:42,sha512:createHash('sha512').update('fixture').digest('base64')}]});
  assert.equal(candidate(info('0.5.0'),config,'0.4.0-beta.1','stable').newer,true);
  assert.equal(candidate(info('0.3.9'),config,'0.4.0-beta.1','stable').newer,false);
  assert.equal(candidate(info('0.5.0-beta.2'),config,'0.4.0','beta').newer,true);
  for(const version of ['0.5.0-alpha.1','0.5.0-rc.1'])assert.throws(()=>candidate(info(version),config,'0.4.0','beta'),/UPDATE_CHANNEL_INVALID/);
  assert.throws(()=>candidate({...info('0.5.0'),stagingPercentage:100},config,'0.4.0','stable'),/UPDATE_METADATA_INVALID/);
  assert.throws(()=>candidate({version:'0.5.0',files:[{...info('0.5.0').files[0],url:artifactName('0.5.0','win32','x64')}]},config,'0.4.0','stable'),/UPDATE_ASSET_INVALID/);
  assert.throws(()=>candidate({version:'0.5.0',files:[{...info('0.5.0').files[0],size:2**32}]},config,'0.4.0','stable'),/UPDATE_ASSET_INVALID/);
});
test('missing distribution configuration starts no updater and preferences still save',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-updates-'));
  try {
    const app={isPackaged:false,getVersion:()=> '0.1.0',getPath:()=>directory};
    const service=await new UpdateService({app,config:loadUpdateConfig({app})}).start();
    assert.equal(service.read().status,'not_supported');assert.equal(service.updater,null);
    await service.setPreferences({autoCheck:false,channel:'beta'});assert.equal(service.read().status,'not_supported');
    assert.throws(()=>service.check(),/UPDATE_NOT_SUPPORTED/);await service.close();
  }finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('real cached bytes reject damage and wrong size',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-updates-'));
  try {
    const file=path.join(directory,'candidate.zip');await fs.writeFile(file,'real candidate bytes');
    const expected={bytes:20,sha512:createHash('sha512').update('real candidate bytes').digest('base64')};
    assert.equal((await checkBytes(file,expected)).size,20);
    await assert.rejects(checkBytes(file,{...expected,bytes:19}),/UPDATE_SIZE_MISMATCH/);
    await fs.writeFile(file,'evil candidate bytes');await assert.rejects(checkBytes(file,expected),/UPDATE_HASH_MISMATCH/);
  }finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('packaged update configuration rejects unknown fields, oversized files and fixture escalation',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-update-config-'));
 try {
  const file=path.join(directory,'update-config.json'),app={isPackaged:true,getName:()=> 'DeiDei R02'};
  const config={schema_version:1,configured:true,mode:'production',provider:'github',owner:'Kalopsiazza',repo:'DeiDei-releases',platform:process.platform,arch:process.arch};
  await fs.writeFile(file,JSON.stringify(config));assert.equal(loadUpdateConfig({app,resourcesPath:directory}).configured,true);
  for(const invalid of [{...config,headers:{}},{...config,token:'forbidden'},{schema_version:1,configured:true,mode:'fixture',provider:'generic',url:'http://127.0.0.1:1234/'},[config]]){
   await fs.writeFile(file,JSON.stringify(invalid));assert.equal(loadUpdateConfig({app,resourcesPath:directory}).configured,false);
  }
  await fs.writeFile(file,' '.repeat(4097));assert.equal(loadUpdateConfig({app,resourcesPath:directory}).configured,false);
 }finally {await fs.rm(directory,{recursive:true,force:true});}
});
test('unit lifecycle consumes one handoff, cannot cancel after native failure, invalidates concurrent channel changes',async()=>{
 const {EventEmitter}=require('node:events');const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-update-unit-'));
 let service;
 try {
  const file=path.join(directory,'synthetic.zip');await fs.writeFile(file,'synthetic');const bytes=await fs.readFile(file);
  const updater=new EventEmitter();updater.netSession={webRequest:{onBeforeRequest(){},onBeforeSendHeaders(){}}};
  updater.checkForUpdates=async()=>({updateInfo:{version:'0.5.0',files:[{url:artifactName('0.5.0'),size:bytes.length,sha512:createHash('sha512').update(bytes).digest('base64')}]},cancellationToken:{cancelled:false,cancel(){this.cancelled=true;}}});
  updater.downloadUpdate=async()=>{updater.emit('update-downloaded',{version:'0.5.0',downloadedFile:file});return [file];};
  let handoffs=0;updater.quitAndInstall=()=>{handoffs++;throw Error('synthetic native failure');};
  const app={isPackaged:false,getVersion:()=> '0.4.0',getPath:()=>directory};service=await new UpdateService({app,config:fixtureConfig('http://127.0.0.1:1234/'),updater}).start({schedule:false});
  await Promise.all([service.setPreferences({channel:'beta'}),service.setPreferences({channel:'stable'})]);assert.equal(service.generation,2);assert.equal(service.read().preferences.channel,'stable');
  await service.check();await service.download();service.install('now');await service.verifyReady(service.generation);
  assert.throws(()=>service.handoffInstall(service.generation),/synthetic native failure/);assert.equal(handoffs,1);assert.equal(service.read().restartRequired,true);
  assert.throws(()=>service.handoffInstall(service.generation),/UPDATE_RESTART_REQUIRED/);assert.throws(()=>service.cancelInstallPlan(),/UPDATE_RESTART_REQUIRED/);assert.equal(handoffs,1);
 }finally {await service?.close();await fs.rm(directory,{recursive:true,force:true});}
});

test('damaged optional update files preserve bytes and block updates without failing startup',async()=>{
 for(const [name,code] of [['update-preferences.json','UPDATE_PREFERENCES_INVALID'],['update-observations.json','UPDATE_CACHE_INVALID']]){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-update-corrupt-'));let service;
  try {
   const file=path.join(directory,name),damaged=Buffer.from('damaged optional update state\\n');await fs.writeFile(file,damaged);
   const app={isPackaged:true,getVersion:()=> '0.5.0',getPath:()=>directory};
   service=await new UpdateService({app,config:{configured:true,provider:'github',owner:'Kalopsiazza',repo:'DeiDei-releases',platform:process.platform,arch:process.arch}}).start();
   assert.equal(service.read().status,'error');assert.equal(service.read().error,code);
   assert.deepEqual(service.read().preferences,{schema_version:1,autoCheck:false,autoDownload:false,channel:'stable'});
   assert.equal(service.updater,null);assert.equal(service.timer,undefined);
   for(const operation of [()=>service.check(),()=>service.download(),()=>service.install(),()=>service.cancelDownload(),()=>service.cancelInstallPlan()])assert.throws(operation,new RegExp(code));
   await assert.rejects(service.setPreferences({autoCheck:true}),new RegExp(code));
   assert.deepEqual(await fs.readFile(file),damaged);assert.deepEqual(await fs.readdir(directory),[name]);
  }finally {await service?.close();await fs.rm(directory,{recursive:true,force:true});}
 }
});
