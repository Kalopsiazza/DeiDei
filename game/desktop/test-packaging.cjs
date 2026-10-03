const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {workerLaunch}=require('./worker-launch.cjs');
const {localBridge}=require('./worker-port.cjs');
const {execFileSync,spawnSync}=require('node:child_process');
const {STAGE_FILES,verifyStage}=require('../packaging/stage.cjs');

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
  'assets/menu/welcome-card-back-v1.png':'image/png',
  'assets/menu/welcome-opening-v1.mp4':'video/mp4',
  'assets/battle/battle-table-v1.webp':'image/webp',
  'assets/battle/battle-arena-approach-v1.webp':'image/webp',
 };
 const moves=['Charge','Bi','Def','Three','ThreeDef','BigBi','Reflect','SelfBi','Cloud','Bomb','Xiao','Pragon','PragonDef','Volvo','VolvoDef','RotateThree','XiaoBei','FlipVolvo','Shell','Absorb','NieXiang','NieXiangDef','JuYan','TianLiJun','ZhangXinWei','LiQiang','BombPragon','BombVolvo','BombFlipVolvo','FreeThree','FreeRotateThree','ZengYi','ZengRewardBigBi'];
 for(const name of moves)expected[`assets/moves/${name}.png`]='image/png';
 assert.deepEqual(Object.keys(UI_ASSETS).sort(),['index.html','renderer.js','style.css','welcome.css',...Object.keys(expected)].sort());
 for(const [relativePath,contentType] of Object.entries(expected)){
  assert.equal(UI_ASSETS[relativePath],contentType);
  assert.deepEqual(resolveUiAsset(relativePath),{relativePath,contentType});
 }
 for(const name of ['../main.cjs','%2e%2e/main.cjs','assets/menu/unknown.png','assets/moves/unknown.png','assets/online/unknown.webp'])assert.equal(resolveUiAsset(name),null);
});

test('R04 built UI contains the bounded menu assets and opening video',()=>{
 const limits={
  'menu-environment.webp':1_500_000,
  'menu-character.png':2_500_000,
  'menu-atmosphere.png':1_000_000,
  'welcome-opening-v1.mp4':8_000_000,
 };
 for(const [name,maxBytes] of Object.entries(limits)){
  const file=path.join(__dirname,'build/ui/assets/menu',name);
  assert.ok(fs.existsSync(file),`${name} must be copied into build/ui`);
  const bytes=fs.statSync(file).size;
  assert.ok(bytes>0&&bytes<=maxBytes,`${name} must stay within its byte budget`);
 }
});

test('R04 built UI contains the bounded raster battle table',()=>{
 const file=path.join(__dirname,'build/ui/assets/battle/battle-table-v1.webp');
 assert.ok(fs.existsSync(file),'battle table must be copied into build/ui');
 const bytes=fs.statSync(file).size;
 assert.ok(bytes>0&&bytes<=1_000_000,'battle table must stay within its byte budget');
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


test('R04 release stage derives every UI asset and resolves runtime modules',()=>{
 const {UI_ASSETS}=require('./ui-assets.cjs');
 for(const name of Object.keys(UI_ASSETS))assert.ok(STAGE_FILES.includes('build/ui/'+name),name);
 for(const name of ['online/network-room-port.cjs','online/wire.cjs','catalog.json'])assert.ok(STAGE_FILES.includes(name),name);
 assert.ok(!STAGE_FILES.some(name=>name.includes('online-atrium')),'retired source assets stay out of release');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'deidei-stage-'));
 try{
  for(const name of STAGE_FILES){const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(__dirname,name),target);}
  assert.deepEqual(verifyStage(directory),{status:'PASS',files:STAGE_FILES.length});
  const media='build/ui/assets/menu/welcome-opening-v1.mp4';
  fs.unlinkSync(path.join(directory,media));
  assert.throws(()=>verifyStage(directory),error=>error.message.includes(media));
  fs.copyFileSync(path.join(__dirname,media),path.join(directory,media));
  fs.appendFileSync(path.join(directory,'main.cjs'),"\nrequire('./online/missing.cjs');\n");
  assert.throws(()=>verifyStage(directory),error=>error.message.includes('main.cjs -> ./online/missing.cjs'));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('R04 manual compilation input must be committed before native build',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'deidei-build-input-'));
 try{
  const relative='docs/results/R04-T01-b/manual-content/content.json';
  fs.mkdirSync(path.dirname(path.join(directory,relative)),{recursive:true});
  fs.writeFileSync(path.join(directory,relative),'{}');
  for(const args of [['init','--quiet'],['add','.'],['-c','user.name=Stage test','-c','user.email=stage@example.invalid','commit','--quiet','-m','input']])execFileSync('git',args,{cwd:directory});
  const script="import importlib.util, pathlib, sys; spec=importlib.util.spec_from_file_location('build',sys.argv[1]); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); module.check_clean_inputs(pathlib.Path(sys.argv[2]))";
  const args=['-c',script,path.resolve(__dirname,'../packaging/build.py'),directory];
  const python=process.env.DEIDEI_PYTHON||'python3';
  assert.equal(spawnSync(python,args,{encoding:'utf8'}).status,0);
  fs.writeFileSync(path.join(directory,relative),'{"changed":true}');
  const result=spawnSync(python,args,{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/commit build inputs before building/);
  assert.ok(result.stderr.includes(relative));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
