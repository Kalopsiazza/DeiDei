// Native package input only; never copied into the application.
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {UI_ASSETS}=require('../desktop/ui-assets.cjs');
const RUNTIME_FILES=Object.freeze(['main.cjs','ui-assets.cjs','preload.cjs','profile.cjs','graphics.cjs',
 'worker-port.cjs','worker-bridge.cjs','worker-launch.cjs','online/network-room-port.cjs',
 'online/wire.cjs','online/service-config.cjs','catalog.json','build/fixture.cjs']);
const STAGE_FILES=Object.freeze([...RUNTIME_FILES,...Object.keys(UI_ASSETS).map(name=>'build/ui/'+name)]);
function verifyStage(directory) {
 directory=fs.realpathSync(directory);
 const missing=STAGE_FILES.filter(name=>!fs.existsSync(path.join(directory,name))||!fs.statSync(path.join(directory,name)).isFile());
 if(missing.length)throw new Error('PACKAGE_STAGE_INCOMPLETE:\n'+missing.join('\n'));
 for(const name of RUNTIME_FILES.filter(name=>name.endsWith('.cjs'))){
  const file=path.resolve(directory,name),resolve=createRequire(file).resolve;
  // ponytail: current runtime uses literal local requires; review this check if that changes.
  for(const [,dependency] of fs.readFileSync(file,'utf8').matchAll(/require\(['"](\.[^'"]+)['"]\)/g)){
   let resolved;
   try{resolved=resolve(dependency);}catch{throw new Error(`PACKAGE_STAGE_DEPENDENCY: ${name} -> ${dependency}`);}
   if(!STAGE_FILES.includes(path.relative(directory,resolved).split(path.sep).join('/')))
    throw new Error(`PACKAGE_STAGE_DEPENDENCY: ${name} -> ${dependency} is not in the stage allowlist`);
  }
 }
 return {status:'PASS',files:STAGE_FILES.length};
}
module.exports={RUNTIME_FILES,STAGE_FILES,verifyStage};
if(require.main===module){
 try{console.log(JSON.stringify(process.argv[2]==='--list'?STAGE_FILES:verifyStage(path.resolve(process.argv[2]))));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
