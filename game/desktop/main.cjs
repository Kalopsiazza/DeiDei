const { app, BrowserWindow, ipcMain, protocol, dialog, safeStorage, screen, nativeTheme, systemPreferences } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsNative = require('node:fs');
const { WorkerPort,localBridge } = require('./worker-port.cjs');
const {TelemetryService,trustedOrigin}=require('./privacy/telemetry-service.cjs');
const {HardwareService}=require('./hardware/service.cjs');
const {UpdateService}=require('./updates/service.cjs');
const {ShutdownCoordinator}=require('./lifecycle/shutdown.cjs');
const {SKILLS}=require('./rules/validation.cjs');
const {RulesLibrary}=require('./rules/library.cjs');
const { NetworkRoomPort } = require('./online/network-room-port.cjs');
const { resolveUiAsset } = require('./ui-assets.cjs');
const { loadServiceConfig } = require('./online/service-config.cjs');
const serviceConfig=loadServiceConfig({isPackaged:app.isPackaged,resourcesPath:process.resourcesPath,env:process.env});
const online=new NetworkRoomPort({url:serviceConfig.url,configurationError:serviceConfig.error});
const { ProfileStore, fields } = require('./profile.cjs');
const { FixturePort, manual, scenes } = require('./build/fixture.cjs');
protocol.registerSchemesAsPrivileged([{ scheme:'app', privileges:{ standard:true, secure:true, supportFetchAPI:true, stream:true } }]);
// Test harness supplies a separate temporary OS profile before any Electron session exists.
if (!app.isPackaged && process.env.DEIDEI_TEST_DATA_DIR) app.setPath('userData',process.env.DEIDEI_TEST_DATA_DIR);
let window, allowClose=false, closePending=false, onlineLifecycle=0;
const ownsProfile=app.requestSingleInstanceLock();
if(!ownsProfile)app.quit();
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
let port=new FixturePort(), switching=false, startingSolo=false, restartGate=false, coordinator=null, shutdownCleanup=null, updateService=null, prepareGeneration=0, candidatePort=null,soloPrepareWork=0;
const retiringCandidates=new Set();
const retireCandidate=candidate=>{if(!candidate)return Promise.resolve();const work=Promise.resolve().then(()=>candidate.close());retiringCandidates.add(work);const settled=()=>{retiringCandidates.delete(work);coordinator?.pump();};work.then(settled,settled);return work;};
const ensurePlayable=()=>{if(restartGate||coordinator?.handedOff)throw Error('RESTART_PREPARING');};
async function replacePort(next, start) {
  ensurePlayable();if(switching)throw new Error('WORKER_BUSY');
  if(online.isActive())throw new Error('ROOM_ACTIVE');
  ++onlineLifecycle;
  switching=true;
  let adopted=false;
  try {const view=await start(next);online.close();if(port.close)await port.close();else await port.leave();port=next;adopted=true;window.setTitle(`叠叠 R02 · ${view.source==='live'?'本地单人':'演示数据'}`);return view; }
  catch(error){if(!adopted)await next.close?.();throw error;}
  finally { switching=false; }
}
const validString=s=>typeof s==='string' && s.length>0 && s.length<=128;
app.whenReady().then(async()=>{
  if(!ownsProfile)return;
  const store=new ProfileStore(path.join(app.getPath('userData'),'local-profile'));
  const workerContext={isPackaged:app.isPackaged,resourcesPath:process.resourcesPath,platform:process.platform,wireVersion:2,aiPython:path.resolve(__dirname,'../ai/.venv/bin/python')};
  let rulesBridge=null;
  const ruleLibrary=new RulesLibrary(path.join(app.getPath('userData'),'rules'),(op,payload={})=>{rulesBridge??=localBridge(workerContext);return rulesBridge.request(op,payload,2);});
  let committedProfile=null,windowPreference=null;
  const windowState=()=>({requested:windowPreference,actual:window?.isFullScreen()||false,pending:windowPreference!==null&&windowPreference!==window.isFullScreen()});
  let collectorOrigin='',collectorFixture=false;
  if(app.isPackaged){try{const filename=path.join(process.resourcesPath,'telemetry-config.json');if(fsNative.statSync(filename).size>4096)throw Error();const config=JSON.parse(fsNative.readFileSync(filename,'utf8'));fields(config,['schema_version','origin']);if(config.schema_version!==1||!(config.origin===null||typeof config.origin==='string'))throw Error();collectorOrigin=trustedOrigin(config.origin||'',false);}catch{collectorOrigin='';}}
  // Explicit isolated source harness only; no renderer URL or packaged environment override.
  if(!app.isPackaged&&process.env.DEIDEI_TEST_DATA_DIR===app.getPath('userData')){try{const filename=path.join(app.getPath('userData'),'privacy-fixture-config.json');if(fsNative.statSync(filename).size>4096)throw Error();const config=JSON.parse(fsNative.readFileSync(filename,'utf8'));fields(config,['schema_version','origin']);if(config.schema_version!==1||typeof config.origin!=='string')throw Error();const target=new URL(config.origin);if(target.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(target.hostname)||!target.port||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error();collectorOrigin=target.origin;collectorFixture=true;}catch{}}
  const privacy=new TelemetryService({directory:path.join(app.getPath('userData'),'privacy'),safeStorage,appVersion:app.getVersion(),collectorOrigin,fixture:collectorFixture});await privacy.ready;
  const hardware=new HardwareService({app,nativeTheme,systemPreferences,readContext:()=>{const bounds=window.getContentBounds(),display=screen.getDisplayMatching(bounds);return {width:bounds.width,height:bounds.height,dpr:display.scaleFactor,displayId:display.id,focused:window.isFocused(),visible:window.isVisible(),minimized:window.isMinimized()};},onShown:(token,graphics)=>privacy.recordRecommendation(token,'shown',graphics),onPerformance:summary=>privacy.recordPerformance(summary)});
  const updates=updateService=new UpdateService({app,userData:app.getPath('userData')});await updates.start();
  const recordMatch=(view,kind,profile)=>{if(!profile||!view?.rules_snapshot)return;const r=view.rules_snapshot;void privacy.recordSession({id:kind+':'+view.match_id,sessionKind:kind,gameplay:r.preset_id.startsWith('pack:')?'custom_pack':r.preset_id,cardStyle:profile.settings.cardStyle,skills:SKILLS.map(k=>r.skill_flags[k])}).catch(()=>{});};

  protocol.handle('app',async request=>{
    const u=new URL(request.url), asset=resolveUiAsset(u.pathname.slice(1));
    if((u.protocol!=='app:' || u.host!=='desktop') || u.search || u.hash || request.method!=='GET' || !asset) return new Response('',{status:403});
    try {return new Response(await fs.readFile(path.join(__dirname,'build/ui',asset.relativePath)),{headers:{'Content-Type':asset.contentType}});}
    catch{return new Response('Local asset unavailable',{status:404});}
  });
  window=new BrowserWindow({width:1366,height:768,useContentSize:true,minWidth:1000,minHeight:650,title:'叠叠 R02 · 本地单人',backgroundColor:'#f5f1e7',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',e=>e.preventDefault());
  window.webContents.on('will-attach-webview',e=>e.preventDefault());
  for(const event of ['resize','move','blur','minimize','hide'])window.on(event,()=>hardware.checkContext());screen.on('display-metrics-changed',()=>hardware.checkContext());nativeTheme.on('updated',()=>hardware.checkContext());
  const session=window.webContents.session;
  session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false)); session.setPermissionCheckHandler(()=>false);
  session.webRequest.onBeforeRequest((d,cb)=>{const u=new URL(d.url);cb({cancel:u.protocol!=='app:'||u.host!=='desktop'});});
  const expose=(channel,fn,hasPayload=false,envelope=false)=>ipcMain.handle(channel,async(event,...args)=>{
    try{
      if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!=='app://desktop/index.html') throw new Error('INVALID_SENDER');
      if(args.length!==(hasPayload?1:0)||Buffer.byteLength(JSON.stringify(args))>4096) throw new Error('INVALID_INPUT');
      if(coordinator?.handedOff&&!['updates.read','online.read','privacy.read'].includes(channel))throw Error('RESTART_HANDED_OFF');
      if(restartGate&&/^(profile\.(create|update|recover)|settings\.apply|rules\.|hardware\.|port\.(start|submit)|online\.(openLobby|create|join|ready|start|setRules|submit))/.test(channel))throw Error('RESTART_PREPARING');
      const result=await fn(args[0]);return envelope?result:{ok:true,data:result};
    }catch(e){const safe=/^[A-Z_]+$/.test(e.message)?e.message:'OPERATION_FAILED';return {ok:false,error:safe};}
  });
  expose('profile.read',async()=>{const profile=await store.read();committedProfile=profile;if(profile)void privacy.recordSettings(profile,profile).catch(()=>{});return profile;});
  for(const mode of ['create','update','recover']) expose(`profile.${mode}`,async p=>{const before=committedProfile,profile=await store.save(mode,p);committedProfile=profile;if(before)void privacy.recordSettings(before,profile).catch(()=>{});else void privacy.recordSettings(profile,profile).catch(()=>{});return profile;},true);
  expose('settings.apply',async p=>{fields(p,p.recommendationToken===undefined?['nickname','avatar_id','settings']:['nickname','avatar_id','settings','recommendationToken']);if(p.recommendationToken!==undefined&&(!/^[a-f0-9]{32}$/.test(p.recommendationToken)||typeof p.recommendationToken!=='string'))throw Error('INVALID_INPUT');const before=await store.read(),{recommendationToken,...input}=p;const profile=await store.save('settings',input);committedProfile=profile;const warnings=[];try{windowPreference=profile.settings.fullscreen;window.setFullScreen(profile.settings.fullscreen);}catch{warnings.push('FULLSCREEN_APPLY_FAILED');}window.webContents.send('settings.windowChange',windowState());try{const recorded=await privacy.recordSettings(before,profile);if(recorded.warning==='LOCAL_USAGE_SAVE_FAILED')warnings.push('LOCAL_USAGE_SAVE_FAILED');if(recommendationToken&&hardware.validateAdoption(recommendationToken,profile.settings.graphics)){await privacy.recordRecommendation(recommendationToken,'adopted',profile.settings.graphics);hardware.markAdopted(recommendationToken);}}catch{warnings.push('LOCAL_USAGE_SAVE_FAILED');}if(profile.settings.fullscreen!==window.isFullScreen())warnings.push('FULLSCREEN_PENDING');return {ok:true,data:profile,...(warnings.length?{warnings}:{})};},true,true);
  expose('settings.windowState',()=>windowState());
  for(const event of ['enter-full-screen','leave-full-screen'])window.on(event,()=>window.webContents.send('settings.windowChange',windowState()));
  expose('rules.read',()=>ruleLibrary.read());
  expose('rules.compile',p=>{fields(p,['rules_request']);return ruleLibrary.compile(p.rules_request);},true);
  expose('rules.importPack',async()=>{const selected=await dialog.showOpenDialog(window,{title:'导入声明式规则包',properties:['openFile'],filters:[{name:'DeiDei 规则包',extensions:['json']}]});return selected.canceled?ruleLibrary.read():ruleLibrary.importFile(selected.filePaths[0]);});
  expose('rules.deletePack',p=>{fields(p,['pack_ref']);return ruleLibrary.deletePack(p.pack_ref);},true);
  expose('rules.savePreset',p=>{fields(p,['name','rules_request']);return ruleLibrary.savePreset(p.name,p.rules_request);},true);
  expose('rules.deletePreset',p=>{fields(p,['id']);return ruleLibrary.deletePreset(p.id);},true);
  const cancelCandidate=async()=>{++prepareGeneration;const previous=candidatePort;candidatePort=null;await retireCandidate(previous);};
  expose('port.prepareSolo',async p=>{fields(p,['opponent_id']);ensurePlayable();if(!['random-legal-v1','legacy-maskable-ppo-v1'].includes(p.opponent_id))throw Error('INVALID_INPUT');if(switching||startingSolo||port.isActive()||online.isActive())throw Error('MATCH_ACTIVE');soloPrepareWork++;try{const generation=++prepareGeneration,previous=candidatePort;candidatePort=null;await retireCandidate(previous);await Promise.all(retiringCandidates);const profile=await store.read();if(generation!==prepareGeneration)throw Error('STALE_PREPARE');if(!profile)throw Error('INVALID_PROFILE');const candidate=new WorkerPort(profile,undefined,workerContext);candidatePort=candidate;try{const status=await candidate.prepareSolo(p.opponent_id);if(generation!==prepareGeneration||candidatePort!==candidate)throw Error('STALE_PREPARE');return status;}catch(error){if(candidatePort===candidate)candidatePort=null;await retireCandidate(candidate);throw error;}}finally{soloPrepareWork--;coordinator?.pump();}},true);
  expose('port.soloStatus',()=>candidatePort?candidatePort.soloStatus():({requested_id:null,active_id:null,state:'idle',compatibility:{missing_features:[]},model_turns:0,fallback_turns:0}));
  expose('port.cancelSoloPrepare',async()=>{if(startingSolo||switching)throw Error('WORKER_BUSY');await cancelCandidate();return {requested_id:null,active_id:null,state:'cancelled',compatibility:{missing_features:[]},model_turns:0,fallback_turns:0};});
  expose('port.startSolo',async p=>{fields(p,['profile_id','rules_request','opponent_id']);ensurePlayable();if(startingSolo||switching)throw Error('WORKER_BUSY');if(!['random-legal-v1','legacy-maskable-ppo-v1'].includes(p.opponent_id))throw Error('INVALID_INPUT');startingSolo=true;try{const profile=await store.read();if(!profile||p.profile_id!==profile.local_id)throw Error('INVALID_PROFILE');const configured=await ruleLibrary.compile(p.rules_request);const candidate=candidatePort;let next;if(candidate){const generation=prepareGeneration,status=await candidate.soloStatus();if(generation!==prepareGeneration||candidatePort!==candidate||status.requested_id!==p.opponent_id||status.state!=='ready')throw Error('AI_NOT_READY');next=candidate;candidatePort=null;++prepareGeneration;}else{if(p.opponent_id!=='random-legal-v1')throw Error('AI_NOT_READY');next=new WorkerPort(profile,undefined,workerContext);}const view=await replacePort(next,port=>port.startSolo(p.profile_id,p.rules_request,configured.rule_pack_manifests,p.opponent_id));recordMatch(view,'solo',profile);return view;}finally{startingSolo=false;}},true);
  expose('port.startTutorial',async p=>{fields(p,['profile_id']);ensurePlayable();if(startingSolo||switching)throw Error('WORKER_BUSY');startingSolo=true;try{const profile=await store.read();if(!profile||p.profile_id!==profile.local_id)throw Error('INVALID_PROFILE');await cancelCandidate();return await replacePort(new WorkerPort(profile,undefined,workerContext),next=>next.startTutorial(p.profile_id));}finally{startingSolo=false;}},true);
  expose('port.tutorialNext',p=>{fields(p,['view_id']);if(!validString(p.view_id)||typeof port.tutorialNext!=='function')throw new Error('INVALID_INPUT');return port.tutorialNext(p.view_id);},true);
  expose('port.submit',p=>{if(switching)throw new Error('WORKER_BUSY');fields(p,['view_id','entry_id']);if(!validString(p.view_id)||!validString(p.entry_id))throw new Error('INVALID_INPUT');return port.submit(p.view_id,p.entry_id);},true);
  expose('port.getView',()=>port.getView()); expose('port.leave',()=>port.leave());
  expose('fixture.preview',p=>{fields(p,['scene']);if(!scenes.includes(p.scene))throw new Error('INVALID_SCENE');return replacePort(new FixturePort(),next=>next.preview(p.scene));},true);
  online.onChange(state=>{const v=state.snapshot?.view;if(state.source==='online'&&v?.match&&v.self.role==='player'&&['selecting','revealing','result'].includes(v.phase))recordMatch({rules_snapshot:v.rules_snapshot,match_id:v.match.match_id},'multiplayer',committedProfile);if(window&&!window.isDestroyed())window.webContents.send('online.change',state);});
  expose('online.openLobby',async()=>{
    if(switching||startingSolo)throw new Error('WORKER_BUSY');
    if(port.isActive())throw new Error('SOLO_ACTIVE');
    const lifecycle=++onlineLifecycle;
    const profile=await store.read();
    // A late profile read must not revive an exited lobby or close a newer one.
    if(lifecycle!==onlineLifecycle||window.isDestroyed())return online.read();
    if(!profile)throw new Error('INVALID_PROFILE');
    if(switching||port.isActive())throw new Error('SOLO_ACTIVE');
    return online.openLobby(profile);
  });
  for(const method of ['join','ready','start','setTurnLimit','changeRole','submit','returnLobby'])expose(`online.${method}`,p=>online[method](p),true);
  for(const method of ['create','setRules'])expose(`online.${method}`,async p=>{fields(p,method==='create'?['password','options','rules_request']:['room_id','rules_request','expected_rules_revision','expected_rules_hash']);const configured=await ruleLibrary.compile(p.rules_request);return online[method]({...p,rule_pack_manifests:configured.rule_pack_manifests});},true);
  expose('online.read',()=>online.read());
  expose('online.leave',()=>{++onlineLifecycle;return online.leave();});
  shutdownCleanup=async(native=false)=>{if(!native)coordinator?.invalidate(true);await privacy.persistenceBarrier();await cancelCandidate();await Promise.all(retiringCandidates);await port.close?.();online.close();await rulesBridge?.stop();};
  coordinator=new ShutdownCoordinator({updates,privacy,canPrepare:()=>!switching&&!startingSolo&&!store.busy&&!ruleLibrary.busy&&!candidatePort&&!soloPrepareWork&&!retiringCandidates.size&&!port.isActive()&&!online.isActive()&&!(port.bridge?.current?.pending.size),sendPrepare:request=>window.webContents.send('lifecycle.prepareRestart',request),onGate:value=>{restartGate=value;},cleanup:()=>shutdownCleanup(true),backup:async()=>{const base=path.join(app.getPath('userData'),'restart-backup');await fs.mkdir(base,{recursive:true,mode:0o700});for(const [name,filename] of [['profile.json',store.file],['rules-library.json',ruleLibrary.file],['privacy-state.json',privacy.store.filename]]){try{await fs.copyFile(filename,path.join(base,name));}catch(error){if(error.code!=='ENOENT')throw error;}}}});
  expose('lifecycle.reportContext',p=>{fields(p,['page','experienceDirty','ruleEditing','modal','transitioning']);if(!['loading','profile','menu','prepare','intro','table','result','settings','manual','online'].includes(p.page)||['experienceDirty','ruleEditing','modal','transitioning'].some(k=>typeof p[k]!=='boolean'))throw Error('INVALID_INPUT');coordinator.report(p);return null;},true);
  expose('lifecycle.replyRestart',async p=>{fields(p,['nonce','generation','ready']);if(typeof p.nonce!=='string'||!Number.isSafeInteger(p.generation)||typeof p.ready!=='boolean')throw Error('INVALID_INPUT');await coordinator.reply(p);return null;},true);
  window.webContents.on('did-start-loading',()=>coordinator.invalidate(true));
  for(const method of ['read','check','download','cancelDownload','cancelInstallPlan'])expose(`updates.${method}`,()=>{if(method==='cancelInstallPlan')coordinator.invalidate(false);return updates[method]();});
  expose('updates.install',p=>{fields(p,['mode']);return updates.install(p.mode);},true);
  expose('updates.setPreferences',p=>{coordinator.invalidate(false);return updates.setPreferences(p);},true);
  updates.onChange(state=>{if(state.restartRequired&&coordinator?.handedOff){coordinator.handedOff=false;restartGate=false;privacy.restartSuspended(false);}if(window&&!window.isDestroyed())window.webContents.send('updates.change',state);});
  expose('privacy.read',()=>privacy.read());expose('privacy.preview',()=>privacy.preview());
  for(const method of ['stop','clearLocal','deleteUploaded'])expose(`privacy.${method}`,()=>{coordinator.invalidate(true);return privacy[method]();});
  expose('privacy.setLocalRecording',p=>{fields(p,['value']);if(typeof p.value!=='boolean')throw Error('INVALID_INPUT');coordinator.invalidate(true);return privacy.setLocalRecording(p.value);},true);
  expose('privacy.setScope',p=>{fields(p,['scope','value','expectedRevision','expectedStateToken']);if(!['preferences','performance'].includes(p.scope)||typeof p.value!=='boolean'||!Number.isSafeInteger(p.expectedRevision)||typeof p.expectedStateToken!=='string'||p.expectedStateToken.length>128)throw Error('INVALID_INPUT');coordinator.invalidate(true);return privacy.setScope(p.scope,p.value,p.expectedRevision,p.expectedStateToken);},true);
  expose('hardware.read',async()=>{const profile=await store.read();if(!profile)throw Error('INVALID_PROFILE');return hardware.read(profile.settings.graphics);});
  expose('hardware.presentRecommendation',p=>{fields(p,['token']);if(typeof p.token!=='string'||p.token.length>128)throw Error('INVALID_INPUT');return hardware.presentRecommendation(p.token);},true);
  expose('hardware.beginSample',p=>{fields(p,['graphics']);if(coordinator.context?.page!=='settings'||port.isActive()||online.isActive())throw Error('SAMPLE_IN_MATCH');return hardware.beginSample(p.graphics);},true);
  expose('hardware.finishSample',p=>{fields(p,['token','summary']);if(coordinator.context?.page!=='settings'||port.isActive()||online.isActive())throw Error('SAMPLE_IN_MATCH');return hardware.finishSample(p.token,p.summary);},true);
  expose('hardware.cancelSample',p=>{fields(p,['token']);if(typeof p.token!=='string'||p.token.length>128)throw Error('INVALID_INPUT');return hardware.cancelSample(p.token);},true);
  expose('manual.read',()=>manual);
  expose('app.quit',()=>{window.close();return null;});
  window.on('close',e=>{
    if(allowClose||(!port.isActive()&&!online.isActive())){++onlineLifecycle;return;}
    e.preventDefault();
    if(closePending)return;closePending=true;
    dialog.showMessageBox(window,{type:'question',buttons:['继续对局','退出'],defaultId:0,cancelId:0,message:online.isActive()?'退出好友房？':'退出当前对局？',detail:online.isActive()?(online.snapshot?.view.host_id===online.snapshot?.view.self.player_id?'你是房主，退出将结束房间。':'退出后原席位由服务处理，本机档案保留。'):'本次对局进度不会保存，本机档案和已保存的设置仍保留。'}).then(async r=>{if(r.response===1){await exitOnline();allowClose=true;window.close();}}).finally(()=>{closePending=false;});
  });
  await window.loadURL('app://desktop/index.html');
  window.once('closed',()=>{coordinator.close();privacy.dispose();void updates.close();void rulesBridge?.stop();void cancelCandidate().catch(()=>{});});
  if (!app.isPackaged && process.env.DEIDEI_DEV_RELOAD === '1') {
    let reloadTimer;
    const watcher = fsNative.watch(path.join(__dirname, 'build/ui'), { recursive:true }, (_event, filename) => {
      if (filename !== '.reload') return;
      clearTimeout(reloadTimer);
      reloadTimer=setTimeout(()=>{if(window&&!window.isDestroyed())window.webContents.reloadIgnoringCache();},100);
    });
    window.once('closed',()=>{clearTimeout(reloadTimer);watcher.close();});
  }
  try{const p=await store.read();if(p){committedProfile=p;void privacy.recordSettings(p,p).catch(()=>{});windowPreference=p.settings.fullscreen;try{window.setFullScreen(p.settings.fullscreen);}finally{window.webContents.send('settings.windowChange',windowState());}}}catch{}
});
async function exitOnline() {
  ++onlineLifecycle;
  if(!online.isActive()){online.close();return;}
  // Give the serialized leave its ack before closing the socket; never hang OS quit.
  await new Promise(resolve=>{
    let finishing=false,sent=false,unsubscribe;
    const finish=()=>{if(finishing)return;finishing=true;clearTimeout(timeout);unsubscribe?.();online.close();resolve();};
    const timeout=setTimeout(finish,3000);
    const next=state=>{
      if(!online.isActive()||state.status!=='connected'){finish();return;}
      if(!state.pending){if(sent){finish();return;}sent=true;try{online.leave();}catch{finish();}}
    };
    unsubscribe=online.onChange(next);next(online.read());
  });
}
let quitting=false;
app.on('before-quit',event=>{
  if(coordinator?.handedOff)return;
  if(quitting)return;
  if((port.isActive()||online.isActive())&&!allowClose){event.preventDefault();window.close();return;}
  ++onlineLifecycle;
  online.close();
  if(!port.close)return;
  event.preventDefault();quitting=true;void (shutdownCleanup?shutdownCleanup():port.close()).finally(()=>app.quit());
});
app.on('window-all-closed',()=>app.quit());
