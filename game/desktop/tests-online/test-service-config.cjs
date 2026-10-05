const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {endpoint}=require('../online/wire.cjs');
const {loadServiceConfig}=require('../online/service-config.cjs');
const {NetworkRoomPort}=require('../online/network-room-port.cjs');
const load=(raw,env={DEIDEI_ROOM_URL:'ws://127.0.0.1:9999/rooms-v1'})=>loadServiceConfig({isPackaged:true,resourcesPath:'/test/resources',env,readFile:file=>{assert.equal(file,'/test/resources/service-config.json');if(raw instanceof Error)throw raw;return raw;}});
const json=room_url=>JSON.stringify({schema_version:1,room_url});
test('S06 rejects ambiguous, plaintext remote and non-target URLs before opening a socket',()=>{
  for(const value of ['ws://example.com:80/rooms-v1','http://127.0.0.1:9/rooms-v1','wss://user@localhost/rooms-v1','wss://localhost/rooms-v1?','wss://localhost/rooms-v1#','wss://localhost/a/../rooms-v1','wss://localhost/%72ooms-v1','wss://localhost/rooms-v1/','wss://localhost:0/rooms-v1','wss://localhost:65536/rooms-v1','wss://localhost:/rooms-v1','wss://0.0.0.0/rooms-v1','wss://[::]/rooms-v1','wss://224.0.0.1/rooms-v1','wss://255.255.255.255/rooms-v1','wss://[ff02::1]/rooms-v1','wss://[::ffff:e000:1]/rooms-v1','wss://[::ffff:224.0.0.1]/rooms-v1','wss://[::ffff:0.0.0.0]/rooms-v1','wss://127.1/rooms-v1','wss://2130706433/rooms-v1','wss://%6cocalhost/rooms-v1','wss://-bad.example/rooms-v1','wss://a..b/rooms-v1','ws://127.0.0.1/rooms-v1','wss://localhost/rooms-v1\n','wss://local\u200bhost/rooms-v1','wss://'+ 'a'.repeat(2048)+'/rooms-v1',{},42]){
    assert.throws(()=>endpoint(value),/INVALID_ENDPOINT/);
    const port=new NetworkRoomPort({url:value,socketFactory:()=>{assert.fail('invalid endpoint opened a socket');}});
    assert.equal(port.openLobby({nickname:'测试',avatar_id:'leaf'}).status,'unavailable');port.close();
  }
});
test('S07 exact secure endpoints, DNS/IP, 443 default and explicit ports',()=>{
  for(const url of ['wss://example.com/rooms-v1','wss://localhost:443/rooms-v1','wss://127.0.0.1:8443/rooms-v1','wss://[::1]:8443/rooms-v1','wss://[2001:db8::1]/rooms-v1','wss://[::ffff:127.0.0.1]/rooms-v1','wss://[0:0:0:0:0:0:0:1]/rooms-v1','ws://127.0.0.1:80/rooms-v1','ws://[::1]:8765/rooms-v1'])assert.equal(new URL(endpoint(url)).href,new URL(url).href);
  assert.equal(endpoint(endpoint('ws://127.0.0.1:80/rooms-v1')),'ws://127.0.0.1:80/rooms-v1');
});
test('S10 fixed packaged file wins over environment',()=>{
  assert.deepEqual(load(json('wss://service.example/rooms-v1')),{url:'wss://service.example/rooms-v1',error:null,source:'file'});
});
test('S11 null deliberately disables online; malformed files never fall back',()=>{
  assert.equal(load(json(null)).error,'SERVICE_NOT_CONFIGURED');
  for(const raw of ['{','null','[]','{}',json('ws://127.0.0.1:8765/rooms-v1'),'{"schema_version":1,"room_url":null,"room_url":"wss://localhost/rooms-v1"}','{"schema_version":1,"room_url":null,"room_\\u0075rl":null}',JSON.stringify({schema_version:1,room_url:null,extra:1}),json(false),json(null)+' '.repeat(4096),Buffer.from([0xff]),Object.assign(new Error(),{code:'EACCES'}),Object.assign(new Error(),{code:'EIO'})])assert.deepEqual(load(raw),{url:null,error:'SERVICE_CONFIG_INVALID',source:'file'});
});
test('S12 missing file allows only explicit loopback diagnostics',()=>{
  const absent=Object.assign(new Error(),{code:'ENOENT'});
  for(const url of ['ws://127.0.0.1:9999/rooms-v1','wss://[::1]/rooms-v1'])assert.equal(load(absent,{DEIDEI_ROOM_URL:url}).url,url);
  for(const url of ['wss://localhost/rooms-v1','wss://service.example/rooms-v1','ws://remote:9/rooms-v1'])assert.equal(load(absent,{DEIDEI_ROOM_URL:url}).error,'SERVICE_CONFIG_INVALID');
  assert.equal(load(absent,{}).error,'SERVICE_NOT_CONFIGURED');
  assert.equal(loadServiceConfig({isPackaged:false,env:{DEIDEI_ROOM_URL:'wss://service.example/rooms-v1'},readFile:()=>assert.fail()}).url,'wss://service.example/rooms-v1');
  assert.equal(loadServiceConfig({isPackaged:false,env:{}}).error,'SERVICE_NOT_CONFIGURED');
});
test('S11 actual bounded file read, exact byte limit and delayed configuration error',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'deidei-config-'));
  try {
    const file=path.join(dir,'service-config.json'),options={isPackaged:true,resourcesPath:dir,env:{}};
    fs.writeFileSync(file,json(null).padEnd(4096));assert.equal(loadServiceConfig(options).error,'SERVICE_NOT_CONFIGURED');
    fs.appendFileSync(file,' ');assert.equal(loadServiceConfig(options).error,'SERVICE_CONFIG_INVALID');
    const port=new NetworkRoomPort({url:'ws://127.0.0.1:9999/rooms-v1',configurationError:'SERVICE_CONFIG_INVALID',socketFactory:()=>assert.fail()});
    assert.equal(port.read().status,'idle');assert.equal(port.openLobby({nickname:'测试',avatar_id:'leaf'}).error.code,'SERVICE_CONFIG_INVALID');assert.equal(port.isActive(),false);port.close();
  } finally {fs.rmSync(dir,{recursive:true});}
});
