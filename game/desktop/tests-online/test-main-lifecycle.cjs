const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {EventEmitter}=require('node:events');
const {NetworkRoomPort}=require('../online/network-room-port.cjs');
const {fields}=require('../profile.cjs');
const {FakeSocket,clock,hello,identity}=require('./fake.cjs');
const mainSource=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8');
const requireMain=createRequire(path.resolve(__dirname,'../main.cjs'));
const profile=nickname=>({local_id:'synthetic-profile',nickname,avatar_id:'leaf',settings:{fullscreen:false}});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

// Load the complete production main and its actual IPC handlers, with only the
// Electron shell/profile IO controlled. NetworkRoomPort and its timers are real.
async function main(){
 const time=clock(),sockets=[],handlers=new Map(),reads=[];
 let online,window,ready,dialogResponse=0;
 const app=new EventEmitter();
 Object.assign(app,{isPackaged:false,getPath:()=>'/unused-synthetic-profile',setPath:()=>{},requestSingleInstanceLock:()=>true,
  whenReady:()=>({then:callback=>(ready=Promise.resolve().then(callback))}),quit:()=>app.emit('before-quit',{preventDefault:()=>{}})});
 class Window extends EventEmitter {
  constructor(){super();window=this;this.destroyed=false;this.webContents=new EventEmitter();
   Object.assign(this.webContents,{mainFrame:{url:'app://desktop/index.html'},setWindowOpenHandler:()=>{},send:()=>{},
    session:{setPermissionRequestHandler:()=>{},setPermissionCheckHandler:()=>{},webRequest:{onBeforeRequest:()=>{}}}});
  }
  isDestroyed(){return this.destroyed;}
  setTitle(){} setFullScreen(){} async loadURL(){}
  close(){let prevented=false;this.emit('close',{preventDefault:()=>{prevented=true;}});if(!prevented){this.destroyed=true;this.emit('closed');app.emit('window-all-closed');}}
 }
 class ControlledNetwork extends NetworkRoomPort {
  constructor(options){super({...options,...time,random:()=>0.5,socketFactory:()=>{const socket=new FakeSocket();sockets.push(socket);return socket;}});online=this;}
 }
 class Fixture {isActive(){return false;}async close(){}async preview(){return {source:'fixture'};}}
 const modules={electron:{app,BrowserWindow:Window,ipcMain:{handle:(name,callback)=>handlers.set(name,callback)},
  protocol:{registerSchemesAsPrivileged:()=>{},handle:()=>{}},dialog:{showMessageBox:async()=>({response:dialogResponse})}},
  './worker-port.cjs':{WorkerPort:Fixture},'./online/network-room-port.cjs':{NetworkRoomPort:ControlledNetwork},
  './online/service-config.cjs':{loadServiceConfig:()=>({url:'ws://127.0.0.1:8765/rooms-v1',error:null})},
  './profile.cjs':{fields,ProfileStore:class {read(){return reads.length?reads.shift():Promise.resolve(profile('initial'));}}},
  './build/fixture.cjs':{FixturePort:Fixture,manual:{},scenes:['sample']}};
 vm.runInNewContext(mainSource,{require:name=>name in modules?modules[name]:requireMain(name),__dirname:path.resolve(__dirname,'..'),
  process:{env:{},platform:process.platform},Buffer,URL,Response,setTimeout:time.schedule,clearTimeout:time.cancel},
  {filename:path.resolve(__dirname,'../main.cjs')});
 await ready;
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
 return {online,window,app,time,sockets,readLater:()=>{const read=deferred();reads.push(read.promise);return read;},
  invoke:(name,...args)=>handlers.get(name)(event,...args),invokeFrom:(name,event,...args)=>handlers.get(name)(event,...args),
  confirmClose:value=>{dialogResponse=value;},authenticate:()=>{const socket=sockets.at(-1);socket.message(hello());socket.ack(socket.sent[0],identity);return socket;}};
}
function stopped(current,count=0){
 assert.deepEqual({sockets:current.sockets.length,running:current.online.running,status:current.online.read().status,timers:current.time.timers.size},
  {sockets:count,running:false,status:'idle',timers:0},'exit must not allocate a socket or retain a handshake/reconnect timer');
 current.time.advance(10000);assert.equal(current.sockets.length,count);
}
test('main: a profile read completed after leave cannot create a socket or retry timer',async()=>{
 const current=await main(),read=current.readLater(),opening=current.invoke('online.openLobby');
 const left=await current.invoke('online.leave');assert.equal(left.ok,true);stopped(current);
 read.resolve(profile('old'));const reply=await opening;assert.equal(reply.ok,true);stopped(current);
});
test('main: rapid exit/reentry accepts only the latest initialization in either completion order',async()=>{
 for(const newerFirst of [true,false]){
  const current=await main(),old=current.readLater(),first=current.invoke('online.openLobby');
  await current.invoke('online.leave');
  const latest=current.readLater(),second=current.invoke('online.openLobby');
  if(!newerFirst){old.resolve(profile('old'));assert.equal((await first).ok,true);stopped(current);}
  latest.resolve(profile('new'));assert.equal((await second).ok,true);assert.equal(current.sockets.length,1);
  const socket=current.authenticate();assert.equal(current.online.read().status,'connected');
  if(newerFirst){old.resolve(profile('old'));assert.equal((await first).ok,true);}
  assert.equal(current.sockets.length,1);assert.equal(current.online.running,true);assert.equal(socket.closed,false);
  assert.equal(current.online.profile.nickname==='new',true,'latest profile must own the legal session');
  assert.equal(current.time.timers.size,0);current.time.advance(10000);assert.equal(current.sockets.length,1);
  await current.invoke('online.leave');stopped(current,1);
 }
});
test('main: accepted close, port replacement and a newer initialization invalidate the old profile read',async()=>{
 for(const boundary of ['window-close','before-quit','replace-port','new-initialization']){
  const current=await main(),old=current.readLater(),first=current.invoke('online.openLobby');
  let second,newest;
  if(boundary==='window-close')current.window.close();
  else if(boundary==='before-quit')current.app.quit();
  else if(boundary==='replace-port')assert.equal((await current.invoke('fixture.preview',{scene:'sample'})).ok,true);
  else {newest=current.readLater();second=current.invoke('online.openLobby');}
  old.resolve(profile('old'));assert.equal((await first).ok,true);stopped(current);
  if(second){newest.resolve(profile('new'));assert.equal((await second).ok,true);assert.equal(current.sockets.length,1);
   current.authenticate();assert.equal(current.online.profile.nickname==='new',true);assert.equal(current.online.running,true);
   await current.invoke('online.leave');stopped(current,1);}
 }
});
test('main: rejected IPC senders and extra arguments do not invalidate an authorized initialization',async()=>{
 const current=await main(),read=current.readLater(),opening=current.invoke('online.openLobby');
 const valid={sender:current.window.webContents,senderFrame:current.window.webContents.mainFrame};
 for(const event of [{...valid,sender:{}},{...valid,senderFrame:{url:'app://desktop/index.html'}}]){
  const reply=await current.invokeFrom('online.leave',event);assert.equal(reply.ok,false);assert.equal(reply.error,'INVALID_SENDER');
 }
 const invalid=await current.invoke('online.leave',{});assert.equal(invalid.ok,false);assert.equal(invalid.error,'INVALID_INPUT');
 read.resolve(profile('new'));assert.equal((await opening).ok,true);assert.equal(current.sockets.length,1);
 await current.invoke('online.leave');stopped(current,1);
});
test('main: canceling an active-room close preserves the current legal connection',async()=>{
 const current=await main();await current.invoke('online.openLobby');const socket=current.authenticate();
 await current.invoke('online.create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});
 socket.ack(socket.sent.at(-1),{room_id:'room1',room_code:'ABCD2345'});
 current.window.close();await flush();assert.equal(current.window.isDestroyed(),false);assert.equal(current.online.running,true);
 assert.equal(socket.closed,false);assert.equal(current.sockets.length,1);assert.equal(current.time.timers.size,0);
 current.online.close();stopped(current,1);
});
test('main: confirmed close retains the 3-second bound for a pending room command',async()=>{
 const current=await main();await current.invoke('online.openLobby');const socket=current.authenticate();
 await current.invoke('online.create',{password:null,options:{turn_ms:10000,early_reveal:true,spectator_cap:6}});
 socket.ack(socket.sent.at(-1),{room_id:'room1',room_code:'ABCD2345'});
 await current.invoke('online.ready',{room_id:'room1',ready:true});assert.equal(current.online.read().pending,true);
 current.confirmClose(1);current.window.close();await flush();current.time.advance(2999);await flush();
 assert.equal(current.online.running,true);assert.equal(current.window.isDestroyed(),false);
 current.time.advance(1);await flush();assert.equal(current.window.isDestroyed(),true);assert.equal(socket.closed,true);stopped(current,1);
});
