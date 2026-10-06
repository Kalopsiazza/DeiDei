const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const semver=require('semver');
const {UpdatePreferences,atomicJSON,DEFAULTS}=require('./preferences.cjs');
const {loadUpdateConfig,isFixture,allowedURL,candidate}=require('./config.cjs');

async function checkBytes(file,expected) {
  const before=await fsp.stat(file);
  if(!before.isFile()||before.size!==expected.bytes)throw new Error('UPDATE_SIZE_MISMATCH');
  const hash=createHash('sha512');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  const after=await fsp.stat(file);
  if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||hash.digest('base64')!==expected.sha512)throw new Error('UPDATE_HASH_MISMATCH');
  return {size:after.size,mtimeMs:after.mtimeMs,ino:after.ino};
}
class UpdateService {
  constructor({app,userData=app.getPath('userData'),config=loadUpdateConfig({app}),updater=null}) {
    this.app=app;this.config=config;this.store=new UpdatePreferences(userData);this.historyFile=path.join(userData,'update-observations.json');
    this.updater=updater;this.listeners=new Set();this.generation=0;this.history={};this.closed=false;this.nativeUsed=false;this.failures=0;
    this.snapshot={status:'idle',currentVersion:app.getVersion(),candidate:null,progress:null,lastCheck:null,error:null,reason:null,installPlan:null,generation:0,restartRequired:false};
    if(!semver.valid(this.snapshot.currentVersion))throw new Error('UPDATE_VERSION_INVALID');
  }
  async start({schedule=true}={}) {
    // Optional update state must never prevent the ordinary game window opening.
    // Keep damaged files for recovery; do not clear the hash observation protection.
    try {this.prefs=await this.store.read();}
    catch {return this.blockStartup('UPDATE_PREFERENCES_INVALID');}
    try {
      if((await fsp.stat(this.historyFile)).size>16_384)throw new Error();
      this.history=JSON.parse(await fsp.readFile(this.historyFile,'utf8'));
      if(!this.history||typeof this.history!=='object'||Array.isArray(this.history)||Object.keys(this.history).length>32||
          Object.entries(this.history).some(([key,hash])=>key.length>512||typeof hash!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(hash)))throw new Error();
    }
    catch(error){if(error.code!=='ENOENT')return this.blockStartup('UPDATE_CACHE_INVALID');}
    if(!this.config.configured||(!this.app.isPackaged&&!isFixture(this.config))||!['darwin','win32'].includes(this.config.platform)) {
      this.update({status:'not_supported',reason:this.config.reason||'此运行方式不支持原生更新。'});return this;
    }
    if(!this.updater) {
      const {MacUpdater,NsisUpdater}=require('electron-updater');
      this.updater=new (this.config.platform==='darwin'?MacUpdater:NsisUpdater)(isFixture(this.config)?{provider:'generic',url:this.config.url}:{provider:'github',owner:this.config.owner,repo:this.config.repo,private:false});
    }
    const updater=this.updater;
    updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.disableWebInstaller=true;updater.disableDifferentialDownload=true;updater.logger=null;
    if(isFixture(this.config)&&!this.app.isPackaged)updater.forceDevUpdateConfig=true;
    this.configureChannel();
    const network=updater.netSession;
    network.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!allowedURL(details.url,this.config)}));
    network.webRequest.onBeforeSendHeaders((details,callback)=>{
      const headers={...details.requestHeaders};
      for(const key of Object.keys(headers))if(key.toLowerCase()==='x-user-staging-id')delete headers[key];
      callback({requestHeaders:headers});
    });
    this.nativeError=()=>{if(this.nativeUsed)this.update({status:'error',error:'UPDATE_NATIVE_FAILED',reason:'原生安装失败。旧应用保留，请重开游戏后重试。',restartRequired:true,installPlan:null});};
    updater.on('error',this.nativeError);
    if(schedule)this.schedule(30_000+Math.floor(Math.random()*30_000));
    return this;
  }
  blockStartup(error) {
    this.startupBlocked=error;this.prefs={...DEFAULTS,autoCheck:false,autoDownload:false};
    this.update({status:'error',error,reason:'更新设置或缓存记录损坏，更新已停用。原文件保留，请恢复有效文件后重开游戏。'});
    return this;
  }
  configureChannel() {this.updater.channel=this.prefs.channel==='stable'?'latest':'beta';this.updater.allowPrerelease=this.prefs.channel==='beta';this.updater.allowDowngrade=false;}
  read() {return structuredClone({...this.snapshot,preferences:this.prefs});}
  update(patch) {Object.assign(this.snapshot,patch,{generation:this.generation});for(const listener of this.listeners)listener(this.read());}
  onChange(listener) {this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  schedule(delay=6*60*60*1000) {
    clearTimeout(this.timer);
    if(this.closed||this.startupBlocked||!this.prefs.autoCheck||this.snapshot.status==='not_supported')return;
    this.timer=setTimeout(()=>{this.check().catch(()=>{}).finally(()=>this.schedule(this.failures?Math.min(6*60*60*1000,60_000*2**Math.min(this.failures,8)):6*60*60*1000));},delay);
    this.timer.unref?.();
  }
  ensureAvailable() {if(this.startupBlocked)throw new Error(this.startupBlocked);if(this.closed||this.snapshot.status==='not_supported')throw new Error('UPDATE_NOT_SUPPORTED');if(this.nativeUsed)throw new Error('UPDATE_RESTART_REQUIRED');}
  async bounded(promise) {
    let timer;
    try {return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{this.downloadToken?.cancel();void this.updater.netSession.closeAllConnections?.();reject(new Error('UPDATE_TIMEOUT'));},30_000);})]);}
    finally {clearTimeout(timer);}
  }
  async settlePrevious(generation) {
    await Promise.allSettled([this.checkWork,this.downloadWork].filter(work=>work&&work.generation!==generation).map(work=>work.promise));
    if(generation!==this.generation||this.closed)throw new Error('UPDATE_CANCELLED');
  }
  async remember(value) {
    const key=`${this.config.owner||this.config.url}/${this.config.repo||''}/${this.config.platform}/${this.config.arch}/${value.version}`;
    if(this.history[key]&&this.history[key]!==value.sha512)throw new Error('UPDATE_VERSION_CONTENT_CHANGED');
    const history={...this.history,[key]:value.sha512};
    // ponytail: last 32 observed releases are enough; increase only if old-feed replay becomes a supported use case.
    const bounded=Object.fromEntries(Object.entries(history).slice(-32));
    await atomicJSON(this.historyFile,bounded);this.history=bounded;
  }
  check() {
    this.ensureAvailable();const generation=this.generation;
    if(this.checkWork?.generation===generation)return this.checkWork.promise;
    if(this.downloadWork?.generation===generation)return this.downloadWork.promise;
    const operation=(async()=>{
      try {
        await this.settlePrevious(generation);this.configureChannel();this.cachedFile=null;this.verified=null;
        this.update({status:'checking',error:null,reason:null,installPlan:null,progress:null});
        const result=await this.bounded(this.updater.checkForUpdates());
        if(generation!==this.generation||this.closed)return this.read();
        this.update({lastCheck:new Date().toISOString()});
        if(!result?.updateInfo)throw new Error('UPDATE_METADATA_INVALID');
        const value=candidate(result.updateInfo,this.config,this.snapshot.currentVersion,this.prefs.channel);
        await this.remember(value);
        if(generation!==this.generation||this.closed)return this.read();
        this.failures=0;
        this.update({status:value.newer?'available':'idle',candidate:value.newer?value:null,reason:value.newer?null:'保持当前版本，等待符合渠道的新版本。'});
        this.candidateToken=result.cancellationToken;
        if(value.newer&&this.prefs.autoDownload)queueMicrotask(()=>{if(generation===this.generation&&!this.closed)void this.download().catch(()=>{});});
        return this.read();
      }catch(error){if(generation===this.generation&&!this.closed){this.failures++;this.update({status:'error',error:this.safeError(error),reason:'检查更新失败，可重试。',candidate:null});}throw error;}
      finally {if(this.checkWork?.promise===operation)this.checkWork=null;}
    })();
    this.checkWork={generation,promise:operation};return operation;
  }
  download() {
    this.ensureAvailable();const generation=this.generation;
    if(this.downloadWork?.generation===generation)return this.downloadWork.promise;
    if(!this.snapshot.candidate||!['available','ready','error'].includes(this.snapshot.status))return Promise.reject(new Error('UPDATE_NO_CANDIDATE'));
    const expected={...this.snapshot.candidate};
    const operation=(async()=>{
      let downloaded;const active=()=>generation===this.generation&&!this.closed;
      const progress=value=>{if(active())this.update({progress:{percent:value.percent,total:value.total,transferred:value.transferred,bytesPerSecond:value.bytesPerSecond}});};
      const finished=value=>{if(active())downloaded=value;};
      try {
        await this.settlePrevious(generation);
        this.downloadToken=this.candidateToken;
        if(!this.downloadToken||this.downloadToken.cancelled)throw new Error('UPDATE_CHECK_REQUIRED');
        this.updater.on('download-progress',progress);this.updater.on('update-downloaded',finished);
        this.update({status:'downloading',error:null,reason:null,progress:null,installPlan:null});
        await this.bounded(this.updater.downloadUpdate(this.downloadToken));
        if(!active())return this.read();
        if(!downloaded||downloaded.version!==expected.version||typeof downloaded.downloadedFile!=='string')throw new Error('UPDATE_DOWNLOAD_INVALID');
        this.update({status:'verifying'});
        const stamp=await checkBytes(downloaded.downloadedFile,expected);
        if(!active())return this.read();
        this.cachedFile=downloaded.downloadedFile;this.verified={generation,stamp,at:Date.now()};
        this.update({status:'ready',reason:'完整包已下载并校验；系统发布者校验在安装时进行。'});return this.read();
      }catch(error){
        if(downloaded?.downloadedFile&&['UPDATE_HASH_MISMATCH','UPDATE_SIZE_MISMATCH'].includes(error.message))await fsp.unlink(downloaded.downloadedFile).catch(()=>{});
        if(active())this.update({status:'error',error:this.safeError(error),reason:error.code==='ERR_UPDATER_INVALID_SIGNATURE'?'发布者校验失败，请重新取得可信完整包。':'下载或校验失败，可重试。',installPlan:null});throw error;
      }
      finally {this.updater.removeListener('download-progress',progress);this.updater.removeListener('update-downloaded',finished);if(this.downloadWork?.promise===operation){this.downloadWork=null;this.downloadToken=null;}}
    })();
    this.downloadWork={generation,promise:operation};return operation;
  }
  cancelDownload() {
    this.ensureAvailable();if(this.nativeUsed)throw new Error('UPDATE_RESTART_REQUIRED');
    if(this.downloadWork){this.generation++;this.downloadToken?.cancel();this.candidateToken=null;this.verified=null;this.update({status:'idle',candidate:null,progress:null,installPlan:null,error:null,reason:'下载已取消，可重新检查。'});}
    return this.read();
  }
  async setPreferences(patch) {
    if(this.startupBlocked)throw new Error(this.startupBlocked);
    if(this.closed||this.nativeUsed)throw new Error('UPDATE_RESTART_REQUIRED');
    const saved=await this.store.save(patch);const before=this.prefs;this.prefs=saved;
    if(saved.channel!==before.channel){this.generation++;this.downloadToken?.cancel();this.cachedFile=null;this.verified=null;this.update({status:this.snapshot.status==='not_supported'?'not_supported':'idle',candidate:null,progress:null,installPlan:null,error:null,reason:this.snapshot.status==='not_supported'?this.snapshot.reason:'渠道已保存，等待新检查。'});}
    else this.update({});
    this.schedule();
    if(saved.autoDownload&&!before.autoDownload&&this.snapshot.status==='available')void this.download().catch(()=>{});
    return this.read();
  }
  install(mode='now') {
    this.ensureAvailable();if(!['now','menu'].includes(mode))throw new Error('UPDATE_INSTALL_MODE_INVALID');
    if(this.snapshot.status!=='ready')throw new Error('UPDATE_NOT_READY');
    this.update({installPlan:{mode,generation:this.generation}});return this.read();
  }
  cancelInstallPlan() {this.ensureAvailable();this.update({installPlan:null});return this.read();}
  async verifyReady(generation) {
    this.ensureAvailable();if(generation!==this.generation||this.snapshot.status!=='ready'||!this.snapshot.installPlan||!this.cachedFile)throw new Error('UPDATE_NOT_READY');
    let stamp;const file=this.cachedFile,expected={...this.snapshot.candidate};
    try {stamp=await checkBytes(file,expected);}
    catch(error){if(['UPDATE_HASH_MISMATCH','UPDATE_SIZE_MISMATCH'].includes(error.message))await fsp.unlink(file).catch(()=>{});if(generation===this.generation)this.update({status:'error',error:this.safeError(error),installPlan:null,reason:'缓存已损坏，请重新检查并下载。'});throw error;}
    if(generation!==this.generation||!this.snapshot.installPlan)throw new Error('UPDATE_CANCELLED');
    this.verified={generation,stamp,at:Date.now()};return this.read();
  }
  // Main-only: the shutdown coordinator calls this synchronously after its final nonce/privacy/worker checks.
  handoffInstall(generation) {
    this.ensureAvailable();const verified=this.verified;
    if(generation!==this.generation||!this.snapshot.installPlan||this.snapshot.status!=='ready'||!verified||verified.generation!==generation||Date.now()-verified.at>5000)throw new Error('UPDATE_NOT_READY');
    const stamp=fs.statSync(this.cachedFile);
    if(['size','mtimeMs','ino'].some(key=>stamp[key]!==verified.stamp[key]))throw new Error('UPDATE_CACHE_CHANGED');
    this.nativeUsed=true;clearTimeout(this.timer);this.update({status:'installing',installPlan:null});
    try {this.updater.quitAndInstall(this.config.platform==='win32',true);}catch(error){this.nativeError();throw error;}
    return this.read();
  }
  safeError(error) {if(error.code==='ERR_UPDATER_INVALID_SIGNATURE')return 'UPDATE_SIGNATURE_INVALID';return /^UPDATE_[A-Z_]+$/.test(error.message)?error.message:'UPDATE_NETWORK_FAILED';}
  async close() {this.closed=true;clearTimeout(this.timer);this.generation++;this.downloadToken?.cancel();this.listeners.clear();await Promise.allSettled([this.checkWork?.promise,this.downloadWork?.promise].filter(Boolean));if(this.nativeError)this.updater?.removeListener('error',this.nativeError);}
}
module.exports={UpdateService,checkBytes};
