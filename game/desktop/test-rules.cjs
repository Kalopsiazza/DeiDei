const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {RulesLibrary}=require('./rules/library.cjs');
const {canonical,packRef,validateRequest,validateSnapshot,hash}=require('./rules/validation.cjs');
const {localBridge}=require('./worker-port.cjs');
const vectors=require('../../docs/rules/packs/golden-vectors.json');
test('Python and JavaScript agree on all canonical rule and pack vectors; tampering fails',()=>{
 for(const v of vectors){assert.deepEqual(validateRequest(v.request),v.request);assert.deepEqual(validateSnapshot(v.snapshot,v.manifests),v.snapshot);if(v.pack_ref){assert.deepEqual(packRef(v.manifests[0]),v.pack_ref);assert.equal(canonical(v.manifests[0]),v.canonical_manifest);}const bad=structuredClone(v.snapshot);bad.parameters.opening_dd6=bad.parameters.opening_dd6==='0'?'6':'0';assert.throws(()=>validateSnapshot(bad,v.manifests));}
 const bad=structuredClone(vectors[4]);bad.manifests[0].author+='改';assert.throws(()=>validateSnapshot(bad.snapshot,bad.manifests));
 const extra=structuredClone(vectors[0].request);extra.model_path='/tmp/file';assert.throws(()=>validateRequest(extra));
});
test('actual compiler imports persist atomically, reject conflict and preserve frozen match after deletion',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'deidei-rules-')),bridge=localBridge();
 const compile=(op,payload)=>bridge.request(op,payload,2);
 const make=()=>new RulesLibrary(path.join(directory,'library'),compile);
 try{
  let library=make();const file=path.resolve(__dirname,'../../docs/rules/packs/fast-opening.deidei-pack.json');
  const loaded=await library.importFile(file);assert.equal(loaded.packs.length,1);
  const request=vectors.find(v=>v.name==='community.fast-opening').request;
  const frozen=(await library.compile(request)).rules_snapshot;
  assert.equal(frozen.parameters.opening_dd6,'6');assert.equal(frozen.parameters.charge_gain_dd6,'12');
  const before=await fs.readFile(library.file);await library.importFile(file);assert.deepEqual(await fs.readFile(library.file),before);
  library=make();assert.deepEqual((await library.compile(request)).rules_snapshot,frozen);
  const changed=JSON.parse(await fs.readFile(file,'utf8'));changed.author+='改';const conflict=path.join(directory,'conflict.deidei-pack.json');await fs.writeFile(conflict,JSON.stringify(changed));await assert.rejects(library.importFile(conflict),/PACK_CONFLICT/);assert.deepEqual(await fs.readFile(library.file),before);
  const preset=await library.savePreset('我的起手',request);await assert.rejects(library.deletePack(loaded.packs[0].pack_ref),/PACK_IN_USE/);
  await library.deletePreset(preset.presets[0].id);await library.deletePack(loaded.packs[0].pack_ref);assert.equal((await library.read()).packs.length,0);
  assert.equal(frozen.rules_hash,hash(Object.fromEntries(Object.entries(frozen).filter(([key])=>key!=='rules_hash'))));
  const duplicate=path.join(directory,'duplicate.deidei-pack.json');await fs.writeFile(duplicate,'{"id":"a","id":"b"}');await assert.rejects(library.importFile(duplicate));
 }finally{await bridge.stop();await fs.rm(directory,{recursive:true,force:true});}
});
