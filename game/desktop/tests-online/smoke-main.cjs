// Test-only transport injection. Product main never imports this launcher or a fake service.
const {NetworkRoomPort}=require('../online/network-room-port.cjs');
const {ScriptedSocket}=require('./fake.cjs');
const controller={view:null};
const key=require.resolve('../online/network-room-port.cjs');
require.cache[key].exports.NetworkRoomPort=class extends NetworkRoomPort {
 constructor(){super({url:'ws://127.0.0.1:8765/rooms-v1',socketFactory:()=>new ScriptedSocket(controller),source:'fixture'});global.__onlinePort=this;}
};
global.__onlineTest=controller;
global.__onlineSamples=require('./fake.cjs');
require('../main.cjs');
