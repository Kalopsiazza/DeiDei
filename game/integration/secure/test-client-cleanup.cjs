const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'clients.cjs'),'utf8');
const closeSource=source.slice(source.indexOf('async function close(c){'),source.indexOf('async function select('));
function harness(error){
 const process={exitCode:null,signalCode:null,kill(signal){this.signalCode=signal;}};
 const c={process,app:{evaluate:async()=>{},close:async()=>{if(error)throw error;process.exitCode=0;}}};
 const close=vm.runInNewContext(`(${closeSource.trim()})`,{assert,setTimeout,clearTimeout,until:async fn=>assert.ok(fn(),'process must end')});
 return {c,close};
}
test('normal client exit0 can pass',async()=>{
 const {c,close}=harness();await close(c);assert.equal(c.cleanup.status,'PASS');assert.equal(c.cleanup.forced,false);assert.equal(c.cleanup.exit_code,0);
});
test('app.close error still reclaims owned process but cannot pass',async()=>{
 const {c,close}=harness(new Error('injected close failure'));
 await assert.rejects(close(c),/did not exit normally/);
 assert.equal(c.closed,true);assert.equal(c.cleanup.status,'FAIL');assert.equal(c.cleanup.forced,true);assert.equal(c.cleanup.signal,'SIGKILL');assert.match(c.cleanup.error,/injected close failure/);
});
test('exit0 after a wait deadline cannot erase the cleanup wait error',async()=>{
 const {c}=harness();
 const close=vm.runInNewContext(`(${closeSource.trim()})`,{assert,setTimeout,clearTimeout,until:async()=>{c.process.exitCode=0;throw new Error('injected exit wait deadline');}});
 await assert.rejects(close(c),/did not exit normally/);
 assert.equal(c.cleanup.status,'FAIL');assert.equal(c.cleanup.exit_code,0);assert.match(c.cleanup.wait_error,/injected exit wait deadline/);
});
test('cleanup failure preserves original test error and marks final evidence FAIL',async()=>{
 const {c,close}=harness(new Error('cleanup exception'));
 const evidence={status:'FAIL',error:'first test failure'},writes=[],process={exitCode:1};
 const start=source.lastIndexOf('\n finally{')+'\n finally{'.length;
 const body=source.slice(start,source.indexOf('\n }\n})().catch',start));
 const finish=vm.runInNewContext(`(async()=>{${body}})`,{clients:[c],workers:[],directories:[],processes:[c.process],close,evidence,process,pass:()=>assert.fail('cleanup cannot PASS'),fs:{writeFile:async(_p,data)=>writes.push(data)},path,output:'.',layer:'stub',input:{close(){}}});
 await finish();assert.equal(evidence.error,'first test failure');assert.equal(evidence.status,'FAIL');assert.equal(process.exitCode,1);assert.equal(evidence.cleanup_errors.length,1);assert.equal(JSON.parse(writes[0]).client_cleanup[0].forced,true);
});
