// Deliberately has no publication capability. Inspect the actual signed/candidate artifacts first.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const semver=require('../desktop/node_modules/semver');
const out=path.resolve(process.argv[2]);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'release-manifest.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(out,'update-config.json'),'utf8'));
if(!semver.valid(manifest.version)||config.mode!=='production'||config.provider!=='github'||Object.keys(config).sort().join()!=='arch,configured,mode,owner,platform,provider,repo,schema_version')throw Error('RELEASE_INPUT_INVALID');
const uploads=manifest.artifacts.map(record=>{
 if(path.basename(record.filename)!==record.filename||record.version!==manifest.version)throw Error('RELEASE_ARTIFACT_INVALID');
 const file=path.join(out,'packaged',record.filename),bytes=fs.readFileSync(file);
 if(bytes.length!==record.bytes||createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error('RELEASE_ARTIFACT_CHANGED');
 if(record.filename.endsWith('.yml')){
  const feed=bytes.toString('utf8');
  if(/^\s*stagingPercentage\s*:/m.test(feed)||!feed.includes('version: '+manifest.version+'\n'))throw Error('RELEASE_FEED_INVALID');
  for(const match of feed.matchAll(/^\s*(?:-\s*)?(?:url|path):\s*([^\n]+)$/gm)){
   const name=match[1].trim().replace(/^['"]|['"]$/g,'');
   if(!manifest.artifacts.some(artifact=>artifact.filename===name))throw Error('RELEASE_FEED_ASSET_INVALID');
  }
 }
 return {filename:record.filename,bytes:record.bytes,sha256:record.sha256};
});
const pre=semver.prerelease(manifest.version);
if(pre&&(pre.length!==2||pre[0]!=='beta'||!Number.isInteger(pre[1])))throw Error('RELEASE_CHANNEL_INVALID');
console.log(JSON.stringify({operation:'DRY_RUN_ONLY',repository:config.owner+'/'+config.repo,configured:config.configured,tag:'v'+manifest.version,prerelease:Boolean(pre),channel:pre?'beta':'stable',eligible_for_publication:manifest.distribution==='production'&&manifest.levels.production_trust==='PASS'&&config.configured===true,uploads},null,2));
