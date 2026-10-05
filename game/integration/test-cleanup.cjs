// Evaluate the actual driver cleanup without launching Electron or services.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const gui=fs.readFileSync(path.join(__dirname,'gui.cjs'),'utf8');
const ack=fs.readFileSync(path.join(__dirname,'test-ack-retry.cjs'),'utf8');
const {closeApplication}=require('../desktop/smoke-performance.cjs');
const helpers=gui.slice(gui.indexOf('async function stop(child){'),gui.indexOf('async function launch('));
function app(mode='normal'){
 const child={pid:0,exitCode:null,signalCode:null,kill(signal){this.signalCode=signal;}};
 return {__ownedProcess:child,process:()=>child,evaluate:async()=>{},close:async()=>{if(mode==='throw')throw new Error('injected close error');child.exitCode=mode==='nonzero'?1:0;}};
}
function guiCleanup(apps,evidence={status:'PASS'}){
 const writes=[],removed=[],process={exitCode:0};
 const context={assert,apps,children:[],peers:[],directories:['first','second'],evidence,process,path,output:'.',console,
  fs:{writeFile:async(_p,data)=>writes.push(JSON.parse(data)),rm:async dir=>removed.push(dir)},
  closeApplication:a=>closeApplication(a,15),until:async fn=>assert.ok(fn(),'owned process still active')};
 const start=gui.lastIndexOf('\n finally{')+'\n finally{'.length;
 const body=gui.slice(start,gui.indexOf('\n }\n})().catch',start));
 const finish=vm.runInNewContext(`${helpers}\n(async()=>{${body}})`,context);
 return {finish,evidence,writes,removed,process};
}
test('GUI normal exit0 persists PASS without force',async()=>{
 const h=guiCleanup([app()]);await h.finish();
 assert.equal(h.writes[0].status,'PASS');assert.equal(h.process.exitCode,0);assert.equal(h.writes[0].app_cleanup[0].normalExit,true);assert.equal(h.writes[0].app_cleanup[0].forced,false);
});
test('GUI close failure marks FAIL, continues cleanup, and retains original error',async()=>{
 const passing=guiCleanup([app('throw')]);await passing.finish();assert.equal(passing.writes[0].status,'FAIL');assert.equal(passing.process.exitCode,1);
 const first=app('throw'),second=app(),h=guiCleanup([first,second],{status:'FAIL',error:'original test error'});await h.finish();
 assert.equal(h.writes[0].status,'FAIL');assert.equal(h.writes[0].error,'original test error');assert.equal(h.process.exitCode,1);
 assert.equal(first.__cleanup.forced,true);assert.equal(first.__cleanup.signal,'SIGKILL');assert.equal(second.__cleanup.status,'PASS');assert.equal(h.evidence.cleanup_errors.length,1);assert.equal(h.removed.length,2);
});
test('GUI nonzero normal exit or unmarked SIGKILL cannot pass',async()=>{
 for(const mode of ['nonzero','signal']){
  const a=app(mode);if(mode==='signal')a.__ownedProcess.signalCode='SIGKILL';const h=guiCleanup([a]);await h.finish();
  assert.equal(h.writes[0].status,'FAIL');assert.equal(h.process.exitCode,1);assert.equal(a.__cleanup.status,'FAIL');
 }
});
test('only Q10 marked SIGKILL is an expected fault, not a normal exit',async()=>{
 const a=app();a.__faultInjection={case:'Q10',expected_signal:'SIGKILL'};a.__ownedProcess.signalCode='SIGKILL';
 const h=guiCleanup([a]);await h.finish();assert.equal(h.writes[0].status,'PASS');assert.equal(a.__cleanup.status,'EXPECTED_FAULT');assert.equal(a.__cleanup.normalExit,false);assert.equal(a.__cleanup.forced,false);
});
test('ACK first cleanup failure still stops the second child and preserves first error',async()=>{
 const firstError=new Error('original ACK assertion'),cleanupErrors=[],cleanup=[],kills=[[],[]];
 const children=kills.map((seen,index)=>({exitCode:null,signalCode:null,kill(signal){seen.push(signal);if(signal==='SIGKILL')this.signalCode=signal;else if(index===1)this.exitCode=0;}}));
 let waits=0;const context={assert,ports:[],children,firstError,cleanupErrors,cleanup,console:{error(){}},until:async fn=>{if(++waits===1)throw new Error('injected child wait timeout');assert.ok(fn());}};
 const start=ack.indexOf('\n finally{')+'\n finally{'.length,tail=ack.slice(start,ack.lastIndexOf('\n});'));
 const finish=vm.runInNewContext(`(async()=>{try{}finally{${tail}})`,context);
 await assert.rejects(finish(),error=>error===firstError);
 assert.deepEqual(kills,[['SIGINT','SIGKILL'],['SIGINT']]);assert.equal(cleanup[0].status,'FAIL');assert.equal(cleanup[0].forced,true);assert.equal(cleanup[1].status,'PASS');assert.equal(cleanupErrors.length,1);
});
