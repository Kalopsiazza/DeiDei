const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {ProfileStore,validateSettings}=require('./profile.cjs');
const input={nickname:'原来的同学',avatar_id:'moon'};
const oldSettings={music:23,effects:47,fullscreen:true};
const v1={profile_version:1,local_id:'12345678-1234-4234-8234-123456789abc',...input,settings:oldSettings};
const temporary=async fn=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-graphics-'));try{await fn(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}};

test('legal v1 reads as v2 high without changing the original bytes',()=>temporary(async dir=>{
 const store=new ProfileStore(dir),bytes=JSON.stringify(v1,null,3)+'\n';
 await fs.writeFile(store.file,bytes);
 const profile=await store.read();
 assert.equal(profile.profile_version,2);
 assert.deepEqual(profile.settings,{...oldSettings,graphics:{ambientMotion:'full',glass:'full',decoration:'full'}});
 assert.equal(profile.local_id,v1.local_id);assert.equal(profile.avatar_id,v1.avatar_id);
 assert.equal(await fs.readFile(store.file,'utf8'),bytes);
 profile.settings.graphics.glass='off';
 assert.equal((await store.read()).settings.graphics.glass,'full');
}));

test('first v1 update persists v2 while preserving identity, avatar, volume and high graphics',()=>temporary(async dir=>{
 const store=new ProfileStore(dir);await fs.writeFile(store.file,JSON.stringify(v1));
 const profile=await store.save('update',{...input,nickname:'新昵称'});
 assert.equal(profile.profile_version,2);assert.equal(profile.local_id,v1.local_id);assert.equal(profile.avatar_id,v1.avatar_id);
 assert.deepEqual(profile.settings,{...oldSettings,graphics:{ambientMotion:'full',glass:'full',decoration:'full'}});
 assert.deepEqual(JSON.parse(await fs.readFile(store.file,'utf8')),profile);
}));

test('presets and custom are recognized both ways and never share returned objects',()=>{
 const {graphicsForPreset,validateGraphics,sameGraphics,matchGraphicsPreset}=require('./graphics.cjs');
 const combinations={high:{ambientMotion:'full',glass:'full',decoration:'full'},balanced:{ambientMotion:'reduced',glass:'light',decoration:'simple'},smooth:{ambientMotion:'off',glass:'off',decoration:'simple'}};
 for(const [id,expected] of Object.entries(combinations)){
  const first=graphicsForPreset(id),second=graphicsForPreset(id);
  assert.deepEqual(first,expected);assert.notEqual(first,second);
  assert.equal(matchGraphicsPreset(first),id);
  assert.equal(matchGraphicsPreset({decoration:first.decoration,glass:first.glass,ambientMotion:first.ambientMotion}),id);
  assert.ok(sameGraphics(first,second));
  first.glass=first.glass==='off'?'full':'off';
  assert.equal(matchGraphicsPreset(first),'custom');assert.deepEqual(second,expected);assert.deepEqual(graphicsForPreset(id),expected);
  const copy=validateGraphics(second);assert.notEqual(copy,second);copy.glass='other';assert.deepEqual(second,expected);
  first.glass=expected.glass;assert.equal(matchGraphicsPreset(first),id);
 }
 assert.throws(()=>graphicsForPreset('custom'));
 const valid=graphicsForPreset('balanced');
 for(const invalid of [null,[],{}, {...valid,unknown:true},{...valid,ambientMotion:'light'},{...valid,glass:'reduced'},{...valid,decoration:'off'}])assert.throws(()=>validateGraphics(invalid));
});

test('new and confirmed recovered profiles use v2 balanced',()=>temporary(async dir=>{
 const store=new ProfileStore(dir),created=await store.save('create',input);
 assert.equal(created.profile_version,2);
 assert.deepEqual(created.settings,{music:60,effects:70,fullscreen:false,graphics:{ambientMotion:'reduced',glass:'light',decoration:'simple'}});
 await fs.writeFile(store.file,'broken');
 const recovered=await store.save('recover',{...input,confirmed:true});
 assert.equal(recovered.profile_version,2);assert.deepEqual(recovered.settings,created.settings);
}));

test('v1 and v2 validation rejects missing, unknown or invalid fields and preserves disk',()=>temporary(async dir=>{
 const store=new ProfileStore(dir),validGraphics={ambientMotion:'full',glass:'full',decoration:'full'};
 const v2={...v1,profile_version:2,settings:{...oldSettings,graphics:validGraphics}};
 for(const invalid of [
  {...v1,settings:{...oldSettings,graphics:validGraphics}},
  {...v1,settings:{...oldSettings,music:'23'}},
  {...v1,local_id:'unknown'}, {...v1,nickname:''}, {...v1,unknown:true},
  {...v2,profile_version:3}, {...v2,settings:oldSettings},
  {...v2,settings:{...v2.settings,unknown:true}},
  {...v2,settings:{...v2.settings,graphics:{...validGraphics,unknown:true}}},
  {...v2,settings:{...v2.settings,graphics:{...validGraphics,glass:'unknown'}}},
 ]){
  const bytes=JSON.stringify(invalid);await fs.writeFile(store.file,bytes);
  await assert.rejects(store.read(),/PROFILE_DAMAGED/);await assert.rejects(store.save('update',input),/PROFILE_DAMAGED/);
  assert.equal(await fs.readFile(store.file,'utf8'),bytes);
 }
 await fs.writeFile(store.file,JSON.stringify(v2));
 assert.deepEqual(await store.read(),v2);
 const before=await fs.readFile(store.file);
 for(const settings of [oldSettings,{...v2.settings,graphics:{...validGraphics,glass:'unknown'}},{...v2.settings,unknown:true}]){
  await assert.rejects(store.save('settings',{...input,settings}));
  assert.deepEqual(await fs.readFile(store.file),before);
 }
 assert.throws(()=>validateSettings(oldSettings));
}));

test('graphics settings save copies the input and write/rename failures preserve bytes and draft',()=>temporary(async dir=>{
 const store=new ProfileStore(dir);await store.save('create',input);
 const draft={...input,settings:{...oldSettings,graphics:{ambientMotion:'off',glass:'light',decoration:'full'}}};
 const expected=structuredClone(draft),before=await fs.readFile(store.file);
 for(const op of ['writeFile','rename']){
  const io={...fs,[op]:async()=>{const error=new Error('injected');error.code='EACCES';throw error;}};
  await assert.rejects(new ProfileStore(dir,io).save('settings',draft),/SAVE_FAILED/);
  assert.deepEqual(await fs.readFile(store.file),before);assert.deepEqual(draft,expected);
  assert.deepEqual(await fs.readdir(dir),['profile.json']);
 }
 const saved=await store.save('settings',draft);
 assert.deepEqual(saved.settings,draft.settings);assert.notEqual(saved.settings,draft.settings);assert.notEqual(saved.settings.graphics,draft.settings.graphics);
 draft.settings.graphics.glass='off';assert.equal(saved.settings.graphics.glass,'light');
 assert.equal((await store.read()).settings.graphics.glass,'light');
}));
