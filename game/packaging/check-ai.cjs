// External only: real frozen CPU model forward, invalid developer variables and independent EOF shutdown.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createInterface}=require('node:readline');
const {performance}=require('node:perf_hooks');

(async()=>{
 const resources=path.resolve(process.argv[2]),generation='packagesmoke';
 const executable=path.join(resources,'ai-worker',process.platform==='win32'?'deidei-ai-worker.exe':'deidei-ai-worker');
 assert.ok(fs.statSync(executable).isFile());
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'叠叠 AI '));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>! /^(PYTHON|_PYI|PYINSTALLER|VIRTUAL_ENV|CONDA|_CE_|_OLD_VIRTUAL_|PYENV|UV_PYTHON|DEIDEI_)/i.test(key)));
 Object.assign(env,{PATH:process.platform==='win32'?path.join(process.env.SystemRoot,'System32'):'/usr/bin:/bin',PYTHONHOME:'/nonexistent',PYTHONPATH:'/nonexistent',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1'});
 const began=performance.now();const child=spawn(executable,[generation],{cwd,env,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let receive,stderr='',lines=0;
 const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code));});
 createInterface({input:child.stdout}).on('line',line=>{lines++;if(!receive)return child.kill();const done=receive;receive=null;try{done.resolve(JSON.parse(line));}catch(error){done.reject(error);}});
 child.stderr.on('data',data=>{stderr=(stderr+data).slice(-32768);});
 async function next(timeout){let timer;try{return await Promise.race([new Promise((resolve,reject)=>{receive={resolve,reject};timer=setTimeout(()=>reject(Error('FROZEN_AI_TIMEOUT')),timeout);}),closed.then(code=>{throw Error(`FROZEN_AI_EXIT_${code}: ${stderr}`);})]);}finally{clearTimeout(timer);}}
 try {
  assert.deepEqual(await next(30000),{v:1,generation,type:'ready'});
  const coldMs=performance.now()-began,hot=[];
  const observation=Array(156).fill(0);for(const slot of [14,77,92,155])observation[slot]=1;
  for(const mask of [Array(31).fill(true),Array.from({length:31},(_,index)=>index===0)]) {
   const decision_id='package-'+hot.length,expected={match_id:'package',game_id:'1',turn_index:'1',rules_hash:'package-smoke'};
   const response=next(750),start=performance.now();
   child.stdin.write(JSON.stringify({v:1,generation,decision_id,expected,observation,mask})+'\n');
   const result=await response;assert.deepEqual(result.expected,expected);assert.equal(result.decision_id,decision_id);assert.equal(result.generation,generation);
   const p=result.probabilities;assert.equal(p.length,31);assert.ok(p.every((value,index)=>Number.isFinite(value)&&value>=0&&(mask[index]||value===0)));assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-6);
   hot.push(performance.now()-start);
  }
  child.stdin.end();let timer;const code=await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('FROZEN_AI_EOF_LEASE_FAILED')),3000);})]).finally(()=>clearTimeout(timer));
  assert.equal(code,0);assert.equal(lines,3);
  console.log(JSON.stringify({status:'PASS',executable:path.basename(executable),evidence_kind:'real frozen model load and two CPU forwards, no fallback',cold_ms:coldMs,hot_ms:hot,stdout_lines:lines,eof_exit_code:code,cwd:'Chinese-space temp outside source',developer_environment:'invalid Python variables and OS-only PATH'}));
 }finally{if(child.exitCode===null)child.kill();await closed.catch(()=>{});fs.rmSync(cwd,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
