const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {canonical,fields,validatePack,packRef,validateSnapshot}=require('./validation.cjs');
class RulesLibrary {
 constructor(directory,compiler,io=fs){this.directory=directory;this.file=path.join(directory,'rules-library.json');this.compiler=compiler;this.io=io;this.busy=false;}
 async read(){
  let data={schema_version:1,packs:[],presets:[]};
  try{const stat=await this.io.lstat(this.file);if(!stat.isFile()||stat.size>262144)throw new Error('RULE_LIBRARY_DAMAGED');data=JSON.parse(await this.io.readFile(this.file,'utf8'));}
  catch(e){if(e.code!=='ENOENT')throw new Error('RULE_LIBRARY_DAMAGED');}
  fields(data,['schema_version','packs','presets']);
  if(data.schema_version!==1||!Array.isArray(data.packs)||data.packs.length>16||!Array.isArray(data.presets)||data.presets.length>32)throw new Error('RULE_LIBRARY_DAMAGED');
  const seen=new Set();
  for(const item of data.packs){fields(item,['manifest','pack_ref']);validatePack(item.manifest);if(canonical(item.pack_ref)!==canonical(packRef(item.manifest)))throw new Error('RULE_LIBRARY_DAMAGED');const key=item.pack_ref.id+'@'+item.pack_ref.version;if(seen.has(key))throw new Error('RULE_LIBRARY_DAMAGED');seen.add(key);}
  const names=new Set();
  for(const item of data.presets){fields(item,['id','name','rules_request']);if(typeof item.id!=='string'||!/^[-a-f0-9]{36}$/.test(item.id)||typeof item.name!=='string'||![...item.name].length||[...item.name].length>40||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(item.name)||names.has(item.id))throw new Error('RULE_LIBRARY_DAMAGED');names.add(item.id);await this.compile(item.rules_request,data);}
  const descriptors=await this.compiler('rules.describe');return {...data,descriptors};
 }
 manifests(request,data){if(!request||!Array.isArray(request.pack_refs)||request.pack_refs.length>1)throw new Error('RULES_INVALID');return request.pack_refs.map(ref=>{const item=data.packs.find(p=>canonical(p.pack_ref)===canonical(ref));if(!item)throw new Error('PACK_NOT_INSTALLED');return item.manifest;});}
 async compile(request,data){data=data||await this.read();const manifests=this.manifests(request,data);const result=await this.compiler('rules.compile',{rules_request:request,rule_pack_manifests:manifests});validateSnapshot(result.rules_snapshot,result.rule_pack_manifests);return result;}
 async mutate(action){if(this.busy)throw new Error('RULE_LIBRARY_BUSY');this.busy=true;let temp;
  try{const data=await this.read();const changed=await action(data);if(changed){const {descriptors,...stored}=data;await this.io.mkdir(this.directory,{recursive:true,mode:0o700});temp=path.join(this.directory,randomUUID()+'.tmp');await this.io.writeFile(temp,JSON.stringify(stored),{flag:'wx',mode:0o600});await this.io.rename(temp,this.file);}return data;}
  catch(e){if(e.code)throw new Error('RULE_LIBRARY_SAVE_FAILED');throw e;}
  finally{if(temp)await this.io.unlink(temp).catch(()=>{});this.busy=false;}
 }
 async importFile(filename){const stat=await this.io.lstat(filename);if(!stat.isFile()||stat.size>8192||!filename.endsWith('.deidei-pack.json'))throw new Error('PACK_INVALID');const bytes=await this.io.readFile(filename);if(bytes.length>8192)throw new Error('PACK_INVALID');const result=await this.compiler('rules.validate_pack',{pack_json:new TextDecoder('utf-8',{fatal:true}).decode(bytes)});validatePack(result.manifest);if(canonical(result.pack_ref)!==canonical(packRef(result.manifest)))throw new Error('PACK_INVALID');
  return this.mutate(data=>{const existing=data.packs.find(item=>item.pack_ref.id===result.pack_ref.id&&item.pack_ref.version===result.pack_ref.version);if(existing){if(existing.pack_ref.content_hash!==result.pack_ref.content_hash)throw new Error('PACK_CONFLICT');return false;}if(data.packs.length>=16)throw new Error('RULE_LIBRARY_FULL');data.packs.push(result);return true;});
 }
 deletePack(ref){return this.mutate(data=>{fields(ref,['id','version','content_hash']);if(data.presets.some(p=>p.rules_request.pack_refs.some(r=>r.content_hash===ref.content_hash)))throw new Error('PACK_IN_USE');const index=data.packs.findIndex(p=>canonical(p.pack_ref)===canonical(ref));if(index<0)throw new Error('PACK_NOT_INSTALLED');data.packs.splice(index,1);return true;});}
 savePreset(name,request){return this.mutate(async data=>{if(typeof name!=='string'||![...name.trim()].length||[...name.trim()].length>40||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(name))throw new Error('PRESET_NAME_INVALID');if(data.presets.length>=32)throw new Error('RULE_LIBRARY_FULL');await this.compile(request,data);data.presets.push({id:randomUUID(),name:name.trim(),rules_request:structuredClone(request)});return true;});}
 deletePreset(id){return this.mutate(data=>{const index=data.presets.findIndex(p=>p.id===id);if(index<0)throw new Error('PRESET_NOT_FOUND');data.presets.splice(index,1);return true;});}
}
module.exports={RulesLibrary};
