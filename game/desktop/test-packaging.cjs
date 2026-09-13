const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {workerLaunch}=require('./worker-launch.cjs');
const {localBridge}=require('./worker-port.cjs');

function bundle(platform) {
 const resourcesPath=fs.mkdtempSync(path.join(os.tmpdir(),'deidei-package-test-'));
 const root=path.join(resourcesPath,'worker'), data=path.join(root,'_internal/deidei_runtime/data');
 fs.mkdirSync(data,{recursive:true});
 const executable=path.join(root,platform==='win32'?'deidei-worker.exe':'deidei-worker');
 fs.writeFileSync(executable,platform==='win32'?Buffer.from('MZ\0\0'):Buffer.from('cffaedfe','hex'),{mode:0o755});
 fs.writeFileSync(path.join(data,'catalog.json'),'{}');
 fs.writeFileSync(path.join(data,'../entry-map.json'),'{}');
 return {resourcesPath,executable,data,isPackaged:true,platform};
}

test('P08 packaged launch ignores developer variables and preserves OS environment',()=>{
 for(const platform of ['darwin','win32']) {
  const context=bundle(platform);
  try {
   const inherited={DEIDEI_PYTHON:'/missing/python',PYTHONHOME:'/missing',PYTHONPATH:'/source',PYTHONSTARTUP:'/bad',_PYI_APPLICATION_HOME_DIR:'/bad',PYINSTALLER_RESET_ENVIRONMENT:'1',VIRTUAL_ENV:'/venv',CONDA_PREFIX:'/conda',CONDA_EXE:'/bad',PYENV_ROOT:'/bad',UV_PYTHON:'/bad',SystemRoot:'C:\\Windows',TEMP:'/tmp',HOME:'/profile',LANG:'zh_CN.UTF-8',PATH:'/os'};
   const before={...inherited};const launch=workerLaunch(context,inherited);
   assert.equal(launch.executable,context.executable);assert.deepEqual(launch.args,[]);
   assert.deepEqual(launch.env,{SystemRoot:'C:\\Windows',TEMP:'/tmp',HOME:'/profile',LANG:'zh_CN.UTF-8',PATH:'/os'});
   assert.deepEqual(inherited,before);
   const bridge=localBridge(context);assert.equal(bridge.executable,context.executable);assert.deepEqual(bridge.args,[]);
  }finally{fs.rmSync(context.resourcesPath,{recursive:true,force:true});}
 }
});

test('P09 missing worker/catalog/map, wrong binary or no executable bit never falls back',()=>{
 for(const broken of ['worker','catalog','entry-map','binary','permission']) {
  const c=bundle('darwin');
  try {
   if(broken==='worker')fs.unlinkSync(c.executable);
   if(broken==='catalog')fs.unlinkSync(path.join(c.data,'catalog.json'));
   if(broken==='entry-map')fs.unlinkSync(path.join(c.data,'../entry-map.json'));
   if(broken==='binary')fs.writeFileSync(c.executable,'not executable');
   if(broken==='permission' && process.platform!=='win32')fs.chmodSync(c.executable,0o644);
   if(broken!=='permission' || process.platform!=='win32')assert.throws(()=>workerLaunch(c,{DEIDEI_PYTHON:process.execPath}),/^Error: PACKAGE_INCOMPLETE$/);
  }finally{fs.rmSync(c.resourcesPath,{recursive:true,force:true});}
 }
});

test('P04 source launch retains module arguments and explicit developer Python',()=>{
 const launch=workerLaunch({}, {DEIDEI_PYTHON:'/developer/python',HOME:'/profile'});
 assert.equal(launch.executable,'/developer/python');assert.deepEqual(launch.args,['-u','-m','deidei_runtime.worker']);
 assert.equal(launch.env.PYTHONPATH,[path.resolve(__dirname,'../core'),path.resolve(__dirname,'../runtime')].join(path.delimiter));
 assert.equal(workerLaunch({},{}).executable,'python3');
});
