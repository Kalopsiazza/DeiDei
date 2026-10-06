const {createHash}=require('node:crypto');
const SKILLS=['ZengYi','ZhangXinWei','NieXiang','JuYan','LiQiang','Bomb','Cloud','TianLiJun'];
const PRESETS=['classic','firepower','loan','lucky'];
const fail=()=>{throw new Error('RULES_INVALID');};
function fields(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...keys].sort().join())fail();}
function canonical(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isSafeInteger(value))fail();return String(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
 fail();
}
const hash=value=>'sha256:'+createHash('sha256').update(canonical(value),'utf8').digest('hex');
function flags(value){fields(value,SKILLS);if(!Object.values(value).every(v=>typeof v==='boolean'))fail();}
function parameters(value){
 fields(value,['charge_gain_dd6','opening_dd6','opening_scope','lucky_probability_bps','lucky_upgrade_table']);
 if(!['6','12','30'].includes(value.charge_gain_dd6)||!['0','6'].includes(value.opening_dd6)||value.opening_scope!=='each_game'||value.lucky_upgrade_table!=='basic-attacks-v1'||!Number.isInteger(value.lucky_probability_bps)||value.lucky_probability_bps<0||value.lucky_probability_bps>10000)fail();
}
const id=value=>typeof value==='string'&&/^[a-z][a-z0-9.-]{0,63}$/.test(value);
const version=value=>typeof value==='string'&&value.length<=32&&/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);
function text(value,max){if(typeof value!=='string'||![...value].length||[...value].length>max||/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)||/(?:https?|file|javascript|data):|[/\\]{2}|(?:^|[/\\])\.\.(?:[/\\]|$)/i.test(value))fail();}
function validatePack(manifest){
 fields(manifest,['api_version','kind','id','version','name','author','base_rules_version','presets']);
 if(manifest.api_version!=='deidei.rules-pack.v1'||manifest.kind!=='declarative'||manifest.base_rules_version!=='classic-1.0.1'||!id(manifest.id)||!version(manifest.version)||!Array.isArray(manifest.presets)||!manifest.presets.length||manifest.presets.length>4)fail();
 text(manifest.name,40);text(manifest.author,60);const seen=new Set();
 for(const p of manifest.presets){fields(p,['id','name','description','skill_defaults','parameters']);if(!id(p.id)||seen.has(p.id))fail();seen.add(p.id);text(p.name,40);text(p.description,120);flags(p.skill_defaults);parameters(p.parameters);}
 if(Buffer.byteLength(canonical(manifest))>8192)fail();return structuredClone(manifest);
}
function packRef(manifest){const m=validatePack(manifest);return{id:m.id,version:m.version,content_hash:hash(m)};}
function validateRequest(value){
 fields(value,['schema_version','preset_id','skill_flags','preset_params','pack_refs']);flags(value.skill_flags);
 if(value.schema_version!==1||typeof value.preset_id!=='string'||value.preset_id.length>134||!Array.isArray(value.pack_refs)||value.pack_refs.length>1)fail();
 if(PRESETS.includes(value.preset_id)){
  if(value.pack_refs.length)fail();
  if(value.preset_id==='firepower'){if(Object.keys(value.preset_params).length){fields(value.preset_params,['firepower_charge_dd6']);if(!['12','30'].includes(value.preset_params.firepower_charge_dd6))fail();}else fields(value.preset_params,[]);}
  else fields(value.preset_params,[]);
 }else{const parts=value.preset_id.split(':');if(parts.length!==3||parts[0]!=='pack'||!id(parts[1])||!id(parts[2])||value.pack_refs.length!==1)fail();fields(value.preset_params,[]);const ref=value.pack_refs[0];fields(ref,['id','version','content_hash']);if(ref.id!==parts[1]||!version(ref.version)||typeof ref.content_hash!=='string'||!/^sha256:[0-9a-f]{64}$/.test(ref.content_hash))fail();}
 return structuredClone(value);
}
function validateSnapshot(snapshot,manifests=[]){
 fields(snapshot,['schema_version','rules_version','base_rules_version','preset_id','preset_version','skill_flags','parameters','packs','rules_hash']);
 if(snapshot.schema_version!==1||snapshot.rules_version!=='configured-1.0.0'||snapshot.base_rules_version!=='classic-1.0.1'||typeof snapshot.preset_id!=='string'||!Array.isArray(snapshot.packs)||!Array.isArray(manifests)||manifests.length>1)fail();
 flags(snapshot.skill_flags);parameters(snapshot.parameters);
 if(PRESETS.includes(snapshot.preset_id)){
  const p=snapshot.preset_id;
  if(snapshot.packs.length||manifests.length||snapshot.preset_version!=='1.0.0'||!(p==='firepower'?['12','30']:['6']).includes(snapshot.parameters.charge_gain_dd6)||snapshot.parameters.opening_dd6!==(p==='loan'?'6':'0')||snapshot.parameters.lucky_probability_bps!==(p==='lucky'?2500:0))fail();
 }else{
  const parts=snapshot.preset_id.split(':');
  if(parts.length!==3||parts[0]!=='pack'||snapshot.packs.length!==1||manifests.length!==1)fail();
  const manifest=validatePack(manifests[0]),ref=packRef(manifest),preset=manifest.presets.find(p=>p.id===parts[2]);
  if(parts[1]!==manifest.id||!preset||snapshot.preset_version!==manifest.version||canonical(snapshot.packs[0])!==canonical(ref)||canonical(snapshot.parameters)!==canonical(preset.parameters))fail();
 }
 const {rules_hash,...unsigned}=snapshot;if(rules_hash!==hash(unsigned))fail();return structuredClone(snapshot);
}
module.exports={SKILLS,PRESETS,canonical,hash,fields,validatePack,packRef,validateRequest,validateSnapshot};
