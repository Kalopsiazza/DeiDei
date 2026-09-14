const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('preload only exposes named methods, strips IPC event and removes exact subscription',async()=>{
 let desktop,channel,callback,removed;
 const ipc={invoke:(...args)=>args,on:(name,fn)=>{channel=name;callback=fn;},removeListener:(name,fn)=>removed=[name,fn]};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../preload.cjs'),'utf8'),{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'desktop');desktop=value;}},ipcRenderer:ipc};}});
 assert.deepEqual(Object.keys(desktop.online).sort(),['openLobby','create','join','ready','start','changeRole','submit','returnLobby','leave','read','onChange'].sort());
 let delivered;const dispose=desktop.online.onChange((...args)=>delivered=args);callback({sender:'privileged-event'},{status:'connected'});
 assert.equal(channel,'online.change');assert.deepEqual(delivered,[{status:'connected'}]);dispose();assert.deepEqual(removed,['online.change',callback]);
 assert.deepEqual(await desktop.online.join({room_code:'ABCD2345',password:null,role:'spectator'}),['online.join',{room_code:'ABCD2345',password:null,role:'spectator'}]);
});
