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

test('R04 visual assets use an exact local allowlist',()=>{
 const modulePath=path.join(__dirname,'ui-assets.cjs');
 assert.ok(fs.existsSync(modulePath),'ui asset resolver must exist');
 const {UI_ASSETS,resolveUiAsset}=require(modulePath);
 const expected={
  'assets/menu/menu-environment.webp':'image/webp',
  'assets/menu/menu-character.png':'image/png',
  'assets/menu/menu-atmosphere.png':'image/png',
 };
 const moves=['Charge','Bi','Def','Three','ThreeDef','BigBi','Reflect','SelfBi','Cloud','Bomb','Xiao','Pragon','PragonDef','Volvo','VolvoDef','RotateThree','XiaoBei','FlipVolvo','Shell','Absorb','NieXiang','NieXiangDef','JuYan','TianLiJun','ZhangXinWei','LiQiang','BombPragon','BombVolvo','BombFlipVolvo','FreeThree','FreeRotateThree','ZengYi','ZengRewardBigBi'];
 for(const name of moves)expected[`assets/moves/${name}.png`]='image/png';
 assert.deepEqual(Object.keys(UI_ASSETS).sort(),['index.html','renderer.js','style.css',...Object.keys(expected)].sort());
 for(const [relativePath,contentType] of Object.entries(expected)){
  assert.equal(UI_ASSETS[relativePath],contentType);
  assert.deepEqual(resolveUiAsset(relativePath),{relativePath,contentType});
 }
 for(const name of ['../main.cjs','%2e%2e/main.cjs','assets/menu/unknown.png','assets/moves/unknown.png'])assert.equal(resolveUiAsset(name),null);
});

test('R04 built UI contains the three bounded menu assets',()=>{
 const limits={
  'menu-environment.webp':1_500_000,
  'menu-character.png':2_500_000,
  'menu-atmosphere.png':1_000_000,
 };
 for(const [name,maxBytes] of Object.entries(limits)){
  const file=path.join(__dirname,'build/ui/assets/menu',name);
  assert.ok(fs.existsSync(file),`${name} must be copied into build/ui`);
  const bytes=fs.statSync(file).size;
  assert.ok(bytes>0&&bytes<=maxBytes,`${name} must stay within its byte budget`);
 }
});

test('R04 built UI contains the complete bounded move icon set',()=>{
 const catalog=require('./catalog.json');
 const folder=path.join(__dirname,'build/ui/assets/moves');
 assert.deepEqual(fs.readdirSync(folder).sort(),catalog.entries.map(entry=>`${entry.entry_id}.png`).sort());
 for(const entry of catalog.entries){
  const bytes=fs.statSync(path.join(folder,`${entry.entry_id}.png`)).size;
  assert.ok(bytes>0&&bytes<=750_000,`${entry.entry_id}.png must stay within its byte budget`);
 }
});

test('R04 dev reload waits for a completed build marker',()=>{
 const dev=fs.readFileSync(path.join(__dirname,'dev.cjs'),'utf8');
 const main=fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8');
 assert.match(dev,/build\/ui\/\.reload/);
 assert.match(main,/filename !== '\.reload'/);
});
