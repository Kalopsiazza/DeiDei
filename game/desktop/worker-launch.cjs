const fs = require('node:fs');
const path = require('node:path');

function workerLaunch({isPackaged=false, resourcesPath, platform=process.platform,aiPython}={}, inherited=process.env) {
  if (!isPackaged) {
    const root=path.resolve(__dirname,'../..');
    return {executable:inherited.DEIDEI_PYTHON || 'python3', args:['-u','-m','deidei_runtime.worker'],
      env:{...Object.fromEntries(Object.entries(inherited).filter(([key])=>!/^DEIDEI_AI_/i.test(key))),...(aiPython?{DEIDEI_AI_PYTHON:aiPython}:{}), PYTHONPATH:[path.join(root,'game/core'),path.join(root,'game/runtime')].join(path.delimiter), PYTHONNOUSERSITE:'1'}};
  }
  try {
    if (!['darwin','win32'].includes(platform) || !path.isAbsolute(resourcesPath)) throw new Error();
    const directory=path.join(resourcesPath,'worker');
    const executable=path.join(directory,platform==='win32'?'deidei-worker.exe':'deidei-worker');
    for (const file of [executable,path.join(directory,'_internal/deidei_runtime/data/catalog.json'),path.join(directory,'_internal/deidei_runtime/entry-map.json')]) {
      if (!fs.statSync(file).isFile()) throw new Error();
      fs.accessSync(file,fs.constants.R_OK);
    }
    fs.accessSync(executable,platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);
    const fd=fs.openSync(executable,'r'), header=Buffer.alloc(4);
    try {fs.readSync(fd,header,0,4,0);} finally {fs.closeSync(fd);}
    if (platform==='win32' ? header.toString('ascii',0,2)!=='MZ' : !['cffaedfe','cefaedfe','cafebabe','bebafeca','cafebabf','bfbafeca'].includes(header.toString('hex'))) throw new Error();
    const env=Object.fromEntries(Object.entries(inherited).filter(([key])=>! /^(PYTHON|_PYI|PYINSTALLER|VIRTUAL_ENV|CONDA|_CE_|_OLD_VIRTUAL_|PYENV|UV_PYTHON|DEIDEI_PYTHON|DEIDEI_AI_)/i.test(key)));
    const ai=path.join(resourcesPath,'ai-worker',platform==='win32'?'deidei-ai-worker.exe':'deidei-ai-worker');if(!fs.statSync(ai).isFile())throw Error();env.DEIDEI_AI_WORKER=ai;return {executable,args:[],env};
  } catch {throw new Error('PACKAGE_INCOMPLETE');}
}
module.exports={workerLaunch};
