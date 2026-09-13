const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {workerLaunch}=require('../desktop/worker-launch.cjs');

(async()=>{
 const resourcesPath=path.resolve(process.argv[2]);
 const {executable,args,env}=workerLaunch({isPackaged:true,resourcesPath},
  {...process.env,DEIDEI_PYTHON:'/nonexistent/python',PYTHONPATH:'/nonexistent/source',PYTHONHOME:'/nonexistent/python',
   PATH:process.platform==='win32'?path.join(process.env.SystemRoot,'System32'):'/usr/bin:/bin'});
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'deidei-frozen-'));
 const child=spawn(executable,args,{env,cwd,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const closed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code));});
 let lines=0,stderr='',receive;
 createInterface({input:child.stdout}).on('line',line=>{lines++;assert.ok(receive,'unsolicited stdout');const done=receive;receive=null;done(JSON.parse(line));});
 child.stderr.on('data',d=>stderr+=d);
 const timer=setTimeout(()=>child.kill(),20000);
 const transcript=[];
 async function request(op,payload={}) {
  const id=`smoke-${transcript.length+1}`;
  const response=new Promise(resolve=>{receive=resolve;});
  child.stdin.write(JSON.stringify({v:1,id,op,payload})+'\n');
  const r=await Promise.race([response,closed.then(()=>{throw new Error('worker closed before reply');})]);
  assert.equal(r.id,id);assert.equal(r.v,1);assert.equal(r.ok,true,JSON.stringify(r));
  transcript.push({op,response:r});return r.data;
 }
 try {
  assert.equal((await request('health')).opponent,'random-legal-v1');
  const view=await request('start_solo',{profile_id:'package-smoke',nickname:'成包烟测',avatar_id:'leaf'});
  assert.equal(view.source,'live');assert.equal(view.options.length,33);
  await request('submit',{view_id:view.view_id,entry_id:'Charge'});
  await request('get_view');await request('leave');await request('shutdown');
  assert.equal(await closed,0);assert.equal(lines,6);assert.equal(stderr,'');
  console.log(JSON.stringify({status:'PASS',executable:path.basename(executable),cwd:'temporary directory outside source',
   developer_environment:'invalid Python variables; OS-only PATH',stdout_lines:lines,exit_code:0,transcript},null,2));
 }finally{clearTimeout(timer);if(child.exitCode===null)child.kill();fs.rmSync(cwd,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
