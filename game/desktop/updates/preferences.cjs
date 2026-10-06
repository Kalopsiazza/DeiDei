const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

const DEFAULTS = Object.freeze({schema_version:1,autoCheck:true,autoDownload:false,channel:'stable'});
function preferences(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).sort().join() !== 'autoCheck,autoDownload,channel,schema_version' ||
      value.schema_version !== 1 || typeof value.autoCheck !== 'boolean' ||
      typeof value.autoDownload !== 'boolean' || !['stable','beta'].includes(value.channel)) throw new Error('UPDATE_PREFERENCES_INVALID');
  return {...value};
}
async function atomicJSON(file, value) {
  await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
  const temporary = file+'.'+randomUUID()+'.tmp';
  try {
    const handle = await fs.open(temporary,'wx',0o600);
    try {await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();} finally {await handle.close();}
    await fs.rename(temporary,file);
  } finally {await fs.rm(temporary,{force:true});}
}
class UpdatePreferences {
  constructor(directory) {this.file=path.join(directory,'update-preferences.json');this.pending=Promise.resolve();}
  async read() {
    try {if((await fs.stat(this.file)).size>4096)throw new Error();return preferences(JSON.parse(await fs.readFile(this.file,'utf8')));}
    catch (error) {if(error.code==='ENOENT')return {...DEFAULTS};throw new Error('UPDATE_PREFERENCES_INVALID');}
  }
  save(patch) {
    if (!patch || typeof patch!=='object' || Array.isArray(patch) || !Object.keys(patch).length ||
        Object.keys(patch).some(key=>!['autoCheck','autoDownload','channel'].includes(key))) return Promise.reject(new Error('UPDATE_PREFERENCES_INVALID'));
    const operation=this.pending.catch(()=>{}).then(async()=>{
      const value=preferences({...await this.read(),...patch});await atomicJSON(this.file,value);return value;
    });
    this.pending=operation;return operation;
  }
}
module.exports={UpdatePreferences,DEFAULTS,preferences,atomicJSON};
