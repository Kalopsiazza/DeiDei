const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {ProfileStore,validateInput,validateSettings}=require('./profile.cjs');
const {FixturePort,manual}=require('./build/fixture.cjs');
const {orderedOptions,shortcutEntry}=require('./build/interaction.cjs');
const input={nickname:'纸上同学',avatar_id:'leaf'};
const temporary=async fn=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-store-'));try{await fn(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}};
test('nickname Unicode boundary, exact fields, avatars and settings validation',()=>{
 assert.equal(validateInput({...input,nickname:'  同学  '}).nickname,'同学');
 assert.equal([...validateInput({...input,nickname:'😀'.repeat(20)}).nickname].length,20);
 for(const nickname of ['', ' ', '😀'.repeat(21),'a\u0000','a\u007f','a\u0085','a\u202e','a\ud800'])assert.throws(()=>validateInput({...input,nickname}));
 for(const p of [{...input,local_id:'../../x'},{...input,avatar_id:'remote'},{...input,nickname:true}])assert.throws(()=>validateInput(p));
 for(const music of [-1,101,NaN,true,1.5])assert.throws(()=>validateSettings({music,effects:50,fullscreen:false}));
 assert.throws(()=>validateSettings({music:50,effects:50,fullscreen:0}));
});
test('atomic profile creation, stable identity, settings and restart read',()=>temporary(async dir=>{
 const s=new ProfileStore(dir);assert.equal(await s.read(),null);const p=await s.save('create',input);
 assert.equal(p.profile_version,1);assert.match(p.local_id,/^[a-f0-9-]{36}$/);
 await assert.rejects(s.save('create',input),/PROFILE_EXISTS/);
 const changed=await s.save('settings',{...input,nickname:'新昵称',settings:{music:25,effects:40,fullscreen:false}});
 assert.equal(changed.local_id,p.local_id);assert.deepEqual(await new ProfileStore(dir).read(),changed);
 const renamed=await s.save('update',{...input,nickname:'更新'});assert.equal(renamed.settings.music,25);
}));
test('write/rename failures preserve old bytes, input and remove temporary file',()=>temporary(async dir=>{
 const s=new ProfileStore(dir);await s.save('create',input);const before=await fs.readFile(s.file);
 for(const op of ['writeFile','rename']){
 const io={...fs,[op]:async()=>{const e=new Error('injected');e.code='EACCES';throw e;}};
 const draft={...input,nickname:'未保存'};
 await assert.rejects(new ProfileStore(dir,io).save('update',draft),/SAVE_FAILED/);
 assert.deepEqual(await fs.readFile(s.file),before);assert.equal(draft.nickname,'未保存');
 assert.deepEqual(await fs.readdir(dir),['profile.json']);
 }
}));
test('corruption never overwritten automatically, recovery backs up original only with confirmation',()=>temporary(async dir=>{
 const s=new ProfileStore(dir);await fs.writeFile(s.file,'{damaged');
 await assert.rejects(s.read(),/PROFILE_DAMAGED/);await assert.rejects(s.save('create',input),/PROFILE_DAMAGED/);
 await assert.rejects(s.save('recover',{...input,confirmed:false}),/CONFIRM_REQUIRED/);
 assert.equal(await fs.readFile(s.file,'utf8'),'{damaged');
 const p=await s.save('recover',{...input,confirmed:true});assert.equal(p.nickname,input.nickname);
 const backup=(await fs.readdir(dir)).find(n=>n.startsWith('profile-damaged-'));assert.equal(await fs.readFile(path.join(dir,backup),'utf8'),'{damaged');
 await assert.rejects(s.save('recover',{...input,confirmed:true}),/RECOVERY_NOT_NEEDED/);
}));
test('oversized and symbolic-link profiles rejected; concurrent writes cannot race',()=>temporary(async dir=>{
 const s=new ProfileStore(dir);await fs.writeFile(s.file,' '.repeat(65537));await assert.rejects(s.read(),/PROFILE_DAMAGED/);
 await fs.unlink(s.file);const target=path.join(dir,'target');await fs.writeFile(target,'untouched');await fs.symlink(target,s.file);
 await assert.rejects(s.save('recover',{...input,confirmed:true}),/PROFILE_UNREADABLE/);assert.equal(await fs.readFile(target,'utf8'),'untouched');
 await fs.unlink(s.file);const first=s.save('create',input);await assert.rejects(s.save('create',input),/PROFILE_BUSY/);await first;
}));
test('33 unique static cards, categories 18/9/6, initial 12 and midgame 26 available',async()=>{
 const p=new FixturePort();const initial=await p.preview('initial'),mid=await p.preview('midgame');
 assert.equal(initial.options.length,33);assert.equal(new Set(initial.options.map(o=>o.entry_id)).size,33);
 assert.deepEqual(['attack','defense','skill'].map(g=>initial.options.filter(o=>o.ui_group===g).length),[18,9,6]);
 assert.equal(initial.options.filter(o=>o.available).length,12);assert.equal(mid.options.filter(o=>o.available).length,26);
 const xiao=mid.options.find(o=>o.entry_id==='Xiao');assert.equal(xiao.required.dd6,'2');assert.equal(xiao.spend.dd6,'0');
 const copy=mid.options.find(o=>o.entry_id==='ZhangXinWei');assert.equal(copy.spend.nx_charge,'0');assert.equal(copy.required.nx_charge,'0');
 assert.equal(manual.sections.length,28);
 for(const o of initial.options){assert.match(o.doc_id,/^E\d\d$/);for(const n of Object.values(o.required))assert.match(n,/^(0|[1-9]\d*)$/);}
});
test('keyboard assignment stable, unique 1–0, blocked input and grey card rejection',async()=>{
 const p=new FixturePort(),v=await p.preview('midgame');const before=JSON.stringify(v.options);
 const assigned='1234567890'.split('').map(k=>shortcutEntry(v.options,k,false));assert.equal(new Set(assigned).size,10);
 assert.deepEqual(assigned,orderedOptions(v.options).filter(o=>o.available).slice(0,10).map(o=>o.entry_id));
 assert.equal(shortcutEntry(v.options,'1',true),null);assert.equal(shortcutEntry(v.options,'a',false),null);assert.equal(JSON.stringify(v.options),before);
 await assert.rejects(p.submit(v.view_id,'Shell'),/UNAVAILABLE_MOVE/);assert.equal((await p.getView()).submitted,false);
});
test('script states, duplicate/stale submission, privacy and immutable snapshots',async()=>{
 let now=0;const profile={...input,local_id:'local-test',profile_version:1,settings:{music:50,effects:50,fullscreen:false}};const p=new FixturePort(profile,()=>now);await assert.rejects(p.startSolo('wrong-id'),/INVALID_PROFILE/);const v=await p.startSolo('local-test');
 assert.equal(v.participants.length,2);assert.equal(v.timer.mode,'untimed');assert.equal(v.source,'fixture');assert.ok(p.isActive());
 assert.ok(v.participants.every(p=>!Object.hasOwn(p,'selected_entry_id')));
 const submitting=await p.submit(v.view_id,'Charge');assert.equal(submitting.phase,'submitting');
 await assert.rejects(p.submit(v.view_id,'Charge'),/ALREADY_SUBMITTED/);
 assert.deepEqual(submitting.options,v.options);now=1201;assert.equal((await p.getView()).phase,'revealed');now=5001;const done=await p.getView();assert.equal(done.phase,'result');assert.equal(done.outcome.winner_id,'local-test');assert.ok(!p.isActive());
 done.participants[0].nickname='tampered';assert.notEqual((await p.getView()).participants[0].nickname,'tampered');
 await p.leave();await assert.rejects(p.submit(v.view_id,'Charge'),/STALE_VIEW/);now=9999;assert.equal((await p.getView()).phase,'selecting');
});
test('error preserves selection, retry works, draw and spectating keep real roster',async()=>{
 const p=new FixturePort();let v=await p.preview('invalid');v=await p.submit(v.view_id,'Bi');assert.equal(v.phase,'error');assert.equal(v.selected_entry_id,'Bi');assert.equal(v.submitted,false);
 assert.equal((await p.submit(v.view_id,'Bi')).phase,'submitting');
 v=await p.preview('draw');assert.equal(v.outcome.winner_id,null);assert.ok(v.participants.every(p=>!p.alive));
 for(const scene of ['spectator','eliminated','restart']){v=await p.preview(scene);assert.deepEqual(v.options,[]);await assert.rejects(p.submit(v.view_id,'Charge'),/NOT_SELECTING/);}
 assert.equal(v.participants.length,6);assert.equal(v.participants.filter(p=>p.alive).length,4);assert.equal(v.participants[0].alive,false);assert.equal(v.participants[0].resources.dd6,'0');
 await assert.rejects(p.preview('made-up'),/INVALID_SCENE/);
});
