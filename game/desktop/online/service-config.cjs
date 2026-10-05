// Main-process only: a fixed, bounded read; never exposed through preload.
const fs=require('node:fs');
const path=require('node:path');
const {endpoint,parse}=require('./wire.cjs');
function readConfig(file) {
  const fd=fs.openSync(file,'r');
  try {
    const data=Buffer.alloc(4097);let length=0,count;
    while(length<data.length&&(count=fs.readSync(fd,data,length,data.length-length,null)))length+=count;
    return data.subarray(0,length);
  } finally {fs.closeSync(fd);}
}
function loadServiceConfig({isPackaged,resourcesPath,env,readFile=readConfig}) {
  const result=(url,error,source)=>({url,error,source});
  const environment=(diagnostic=false)=>{
    const source=diagnostic?'diagnostic-environment':'environment';
    try {
      const url=endpoint(env.DEIDEI_ROOM_URL);
      if(diagnostic&&!['127.0.0.1','[::1]'].includes(new URL(url).hostname))throw new Error('SERVICE_CONFIG_INVALID');
      return result(url,null,source);
    } catch(e) {return result(null,diagnostic&&e.message!=='SERVICE_NOT_CONFIGURED'?'SERVICE_CONFIG_INVALID':e.message,source);}
  };
  if(!isPackaged)return environment();
  let raw;
  try {raw=readFile(path.join(resourcesPath,'service-config.json'));}
  catch(e){return e.code==='ENOENT'?environment(true):result(null,'SERVICE_CONFIG_INVALID','file');}
  try {
    if(!(typeof raw==='string'||Buffer.isBuffer(raw))||Buffer.byteLength(raw)>4096)throw new Error();
    const config=parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(raw)));
    if(!config||Array.isArray(config)||Object.keys(config).sort().join(',')!=='room_url,schema_version'||config.schema_version!==1)throw new Error();
    if(config.room_url===null)return result(null,'SERVICE_NOT_CONFIGURED','file');
    const url=endpoint(config.room_url);
    if(new URL(url).protocol!=='wss:')throw new Error();
    return result(url,null,'file');
  } catch {return result(null,'SERVICE_CONFIG_INVALID','file');}
}
module.exports={loadServiceConfig};
