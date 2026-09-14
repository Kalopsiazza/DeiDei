const { app, BrowserWindow, ipcMain, protocol, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { WorkerPort } = require('./worker-port.cjs');
const { NetworkRoomPort } = require('./online/network-room-port.cjs');
const online=new NetworkRoomPort({url:process.env.DEIDEI_ROOM_URL});
const { ProfileStore, fields } = require('./profile.cjs');
const { FixturePort, manual, scenes } = require('./build/fixture.cjs');
protocol.registerSchemesAsPrivileged([{ scheme:'app', privileges:{ standard:true, secure:true, supportFetchAPI:true } }]);
// Test harness supplies a separate temporary OS profile before any Electron session exists.
if (!app.isPackaged && process.env.DEIDEI_TEST_DATA_DIR) app.setPath('userData',process.env.DEIDEI_TEST_DATA_DIR);
let window, allowClose=false, closePending=false;
const ownsProfile=app.requestSingleInstanceLock();
if(!ownsProfile)app.quit();
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
let port=new FixturePort(), switching=false;
async function replacePort(next, start) {
  if(switching)throw new Error('WORKER_BUSY');
  if(online.isActive())throw new Error('ROOM_ACTIVE');
  switching=true;
  try { online.close();if(port.close)await port.close();else await port.leave();port=next;const view=await start(next);window.setTitle(`叠叠 R02 · ${view.source==='live'?'本地单人':'演示数据'}`);return view; }
  finally { switching=false; }
}
const files={ 'index.html':'text/html; charset=utf-8', 'renderer.js':'text/javascript', 'style.css':'text/css' };
const validString=s=>typeof s==='string' && s.length>0 && s.length<=128;
app.whenReady().then(async()=>{
  if(!ownsProfile)return;
  const store=new ProfileStore(path.join(app.getPath('userData'),'local-profile'));
  protocol.handle('app',async request=>{
    const u=new URL(request.url), name=u.pathname.slice(1);
    if((u.protocol!=='app:' || u.host!=='desktop') || u.search || u.hash || request.method!=='GET' || !Object.hasOwn(files,name)) return new Response('',{status:403});
    try {return new Response(await fs.readFile(path.join(__dirname,'build/ui',name)),{headers:{'Content-Type':files[name]}});}
    catch{return new Response('Local asset unavailable',{status:404});}
  });
  window=new BrowserWindow({width:1366,height:768,useContentSize:true,minWidth:1000,minHeight:650,title:'叠叠 R02 · 本地单人',backgroundColor:'#f5f1e7',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',e=>e.preventDefault());
  window.webContents.on('will-attach-webview',e=>e.preventDefault());
  const session=window.webContents.session;
  session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false)); session.setPermissionCheckHandler(()=>false);
  session.webRequest.onBeforeRequest((d,cb)=>{const u=new URL(d.url);cb({cancel:u.protocol!=='app:'||u.host!=='desktop'});});
  const expose=(channel,fn,hasPayload=false)=>ipcMain.handle(channel,async(event,...args)=>{
    try{
      if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||event.senderFrame.url!=='app://desktop/index.html') throw new Error('INVALID_SENDER');
      if(args.length!==(hasPayload?1:0)||Buffer.byteLength(JSON.stringify(args))>4096) throw new Error('INVALID_INPUT');
      return {ok:true,data:await fn(args[0])};
    }catch(e){const safe=/^[A-Z_]+$/.test(e.message)?e.message:'OPERATION_FAILED';return {ok:false,error:safe};}
  });
  expose('profile.read',()=>store.read());
  for(const mode of ['create','update','recover']) expose(`profile.${mode}`,p=>store.save(mode,p),true);
  expose('settings.apply',async p=>{const profile=await store.save('settings',p);window.setFullScreen(profile.settings.fullscreen);return profile;},true);
  expose('port.startSolo',async p=>{fields(p,['profile_id']);const profile=await store.read();if(!profile||p.profile_id!==profile.local_id)throw new Error('INVALID_PROFILE');return replacePort(new WorkerPort(profile,undefined,{isPackaged:app.isPackaged,resourcesPath:process.resourcesPath,platform:process.platform}),next=>next.startSolo(p.profile_id));},true);
  expose('port.submit',p=>{fields(p,['view_id','entry_id']);if(!validString(p.view_id)||!validString(p.entry_id))throw new Error('INVALID_INPUT');return port.submit(p.view_id,p.entry_id);},true);
  expose('port.getView',()=>port.getView()); expose('port.leave',()=>port.leave());
  expose('fixture.preview',p=>{fields(p,['scene']);if(!scenes.includes(p.scene))throw new Error('INVALID_SCENE');return replacePort(new FixturePort(),next=>next.preview(p.scene));},true);
  online.onChange(state=>{if(window&&!window.isDestroyed())window.webContents.send('online.change',state);});
  expose('online.openLobby',async()=>{
    if(switching)throw new Error('WORKER_BUSY');
    if(port.isActive())throw new Error('SOLO_ACTIVE');
    const profile=await store.read();if(!profile)throw new Error('INVALID_PROFILE');
    if(switching||port.isActive())throw new Error('SOLO_ACTIVE');
    return online.openLobby(profile);
  });
  for(const method of ['create','join','ready','start','setTurnLimit','changeRole','submit','returnLobby'])expose(`online.${method}`,p=>online[method](p),true);
  expose('online.read',()=>online.read());
  expose('online.leave',()=>online.leave());
  expose('manual.read',()=>manual);
  expose('app.quit',()=>{window.close();return null;});
  window.on('close',e=>{
    if(allowClose||(!port.isActive()&&!online.isActive()))return;
    e.preventDefault();
    if(closePending)return;closePending=true;
    dialog.showMessageBox(window,{type:'question',buttons:['继续对局','退出'],defaultId:0,cancelId:0,message:online.isActive()?'退出好友房？':'退出当前对局？',detail:online.isActive()?(online.snapshot?.view.host_id===online.snapshot?.view.self.player_id?'你是房主，退出将结束房间。':'退出后原席位由服务处理，本机档案保留。'):'本次对局进度不会保存，本机档案和已保存的设置仍保留。'}).then(async r=>{if(r.response===1){await exitOnline();allowClose=true;window.close();}}).finally(()=>{closePending=false;});
  });
  await window.loadURL('app://desktop/index.html');
  try{const p=await store.read();if(p)window.setFullScreen(p.settings.fullscreen);}catch{}
});
async function exitOnline() {
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
  if(quitting)return;
  if((port.isActive()||online.isActive())&&!allowClose){event.preventDefault();window.close();return;}
  online.close();
  if(!port.close)return;
  event.preventDefault();quitting=true;void port.close().finally(()=>app.quit());
});
app.on('window-all-closed',()=>app.quit());
