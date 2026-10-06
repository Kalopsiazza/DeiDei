const fs=require('node:fs');
const path=require('node:path');
const semver=require('semver');
const fixtures=new WeakSet();
const ARTIFACT='DeiDei-${version}-${os}-${arch}.${ext}';
function fixtureConfig(url) {
  const origin=new URL(url);
  if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port||origin.username||origin.password||origin.search||origin.hash||!origin.pathname.endsWith('/'))throw new Error('UPDATE_FIXTURE_INVALID');
  const config={schema_version:1,configured:true,mode:'fixture',provider:'generic',url:origin.href,platform:process.platform,arch:process.arch};
  fixtures.add(config);return Object.freeze(config);
}
function loadUpdateConfig({app,resourcesPath=process.resourcesPath}) {
  if(!app.isPackaged)return {configured:false,reason:'开发运行不支持原生更新。'};
  let value;
  try {
    const file=path.join(resourcesPath,'update-config.json');
    if(!fs.statSync(file).isFile()||fs.statSync(file).size>4096)throw new Error();
    value=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();
  }
  catch {return {configured:false,reason:'此安装包未配置更新来源。'};}
  if(value.mode==='fixture') {
    try {
      if(Object.keys(value).sort().join()!=='configured,mode,provider,schema_version,url'||value.schema_version!==1||value.configured!==true||value.provider!=='generic'||
          !app.getName().startsWith('DeiDei Update Fixture')||typeof value.url!=='string'||value.url.length>512)throw new Error();
      return fixtureConfig(value.url);
    }catch{return {configured:false,reason:'测试更新来源配置无效。'};}
  }
  if(Object.keys(value).sort().join()!=='arch,configured,mode,owner,platform,provider,repo,schema_version'||typeof value.configured!=='boolean')return {configured:false,reason:'更新来源配置无效。'};
  if(value.schema_version!==1||value.mode!=='production'||value.provider!=='github'||value.platform!==process.platform||value.arch!==process.arch||
      !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(value.owner||'')||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value.repo||''))return {configured:false,reason:'更新来源配置无效。'};
  if(value.configured!==true)return {configured:false,reason:'发行仓库尚待维护者确认。'};
  return Object.freeze(value);
}
function isFixture(config) {return fixtures.has(config);}
function allowedURL(value,config) {
  if(typeof value!=='string'||value.length>8192||value.trim()!==value||/\\|\/\.{1,2}(?:\/|$)|%(?:2e|2f|5c|00)/i.test(value.split('?')[0]))return false;
  let url;try {url=new URL(value);}catch{return false;}
  if(url.username||url.password||url.hash||/%(?:2e|2f|5c|00)/i.test(url.pathname)||url.pathname.includes('\\'))return false;
  if(isFixture(config)){const origin=new URL(config.url);return url.origin===origin.origin&&url.pathname.startsWith(origin.pathname);}
  if(url.protocol!=='https:'||url.port)return false;
  const prefix=`/${config.owner}/${config.repo}/releases`;
  if(url.hostname==='github.com')return url.pathname===prefix+'.atom'||url.pathname===prefix+'/latest'||url.pathname.startsWith(prefix+'/download/');
  if(url.hostname==='api.github.com')return url.pathname===`/repos/${config.owner}/${config.repo}/releases`||url.pathname.startsWith(`/repos/${config.owner}/${config.repo}/releases/`);
  return ['release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(url.hostname)&&/^\/github-production-release-asset[^/]*\//.test(url.pathname);
}
function artifactName(version,platform=process.platform,arch=process.arch) {
  if(!semver.valid(version)||!['darwin','win32'].includes(platform)||!['arm64','x64'].includes(arch))throw new Error('UPDATE_TARGET_INVALID');
  return `DeiDei-${version}-${platform==='darwin'?'mac':'win'}-${arch}.${platform==='darwin'?'zip':'exe'}`;
}
function candidate(info,config,currentVersion,channel) {
  if(!info||!semver.valid(info.version)||Object.hasOwn(info,'stagingPercentage'))throw new Error('UPDATE_METADATA_INVALID');
  const pre=semver.prerelease(info.version);
  if(pre&&(channel!=='beta'||pre.length!==2||pre[0]!=='beta'||!Number.isSafeInteger(pre[1])))throw new Error('UPDATE_CHANNEL_INVALID');
  const filename=artifactName(info.version,config.platform,config.arch);
  const matching=Array.isArray(info.files)&&info.files.filter(file=>{
    if(!file||typeof file!=='object')return false;
    if(typeof file.url!=='string')return false;
    if(file.url===filename)return true;
    try {const u=new URL(file.url);return allowedURL(file.url,config)&&(isFixture(config)||u.hostname==='github.com')&&decodeURIComponent(u.pathname.split('/').pop())===filename;}catch{return false;}
  });
  const downloadFiles=Array.isArray(info.files)&&info.files.filter(file=>typeof file?.url==='string'&&file.url.split('?')[0].endsWith(config.platform==='darwin'?'.zip':'.exe'));
  const file=matching?.length===1&&downloadFiles?.length===1&&matching[0];
  if(!file||!Number.isSafeInteger(file.size)||file.size<=0||file.size>2*1024**3||typeof file.sha512!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(file.sha512))throw new Error('UPDATE_ASSET_INVALID');
  const notes=typeof info.releaseNotes==='string'?info.releaseNotes:typeof info.releaseName==='string'?info.releaseName:'';
  return {version:info.version,filename,bytes:file.size,sha512:file.sha512,notes:notes.slice(0,8192),newer:semver.gt(info.version,currentVersion)};
}
module.exports={ARTIFACT,fixtureConfig,isFixture,loadUpdateConfig,allowedURL,artifactName,candidate};
