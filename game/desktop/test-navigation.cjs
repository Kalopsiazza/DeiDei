const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {transformSync}=require('esbuild');

// Execute the renderer's actual handlers. Window smoke checks the JSX wiring.
const source=fs.readFileSync(path.join(__dirname,'renderer.tsx'),'utf8');
const start=source.indexOf(' const navigate='), end=source.indexOf(' const start=',start);
assert.ok(start>=0 && end>start,'Renderer navigation handlers must be present');
const code=transformSync(source.slice(start,end)+'\nglobalThis.handlers={navigate,changeScene};',{loader:'ts'}).code;
function renderer() {
 const state={page:'prepare',busy:false,error:'',readError:false,view:null,modal:'preview'};
 const context={sceneChangePending:{current:false},generation:{current:0},busy:false,message:code=>code};
 for(const key of ['page','busy','error','readError','view','modal'])context['set'+key[0].toUpperCase()+key.slice(1)]=value=>{state[key]=value;};
 vm.runInNewContext(code,context);
 return {state,...context};
}
function deferred() {
 let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};
}

test('F02 synchronous flag blocks navigation and duplicate start before React rerenders',async()=>{
 const r=renderer(), pending=deferred();let calls=0;
 const action=()=>{calls++;return pending.promise;};
 const started=r.handlers.changeScene(action,'table');
 assert.equal(r.sceneChangePending.current,true);
 r.handlers.navigate(()=>{r.state.page='menu';});
 await r.handlers.changeScene(action,'result');
 assert.equal(calls,1);assert.equal(r.state.page,'prepare');
 pending.resolve({match_id:'one'});await started;
 assert.equal(r.state.page,'table');assert.equal(r.state.view.match_id,'one');
 assert.equal(r.sceneChangePending.current,false);assert.equal(r.state.busy,false);
 r.handlers.navigate(()=>{r.state.page='menu';});assert.equal(r.state.page,'menu');
});

test('F02 delayed failure keeps original page, unlocks navigation and allows a fresh start',async()=>{
 const r=renderer(), pending=deferred();
 const started=r.handlers.changeScene(()=>pending.promise,'table');
 r.handlers.navigate(()=>{r.state.page='menu';});
 pending.reject(new Error('MATCH_INTERRUPTED'));await started;
 assert.equal(r.state.page,'prepare');assert.equal(r.state.view,null);
 assert.equal(r.state.error,'MATCH_INTERRUPTED');assert.equal(r.state.readError,true);
 assert.equal(r.sceneChangePending.current,false);assert.equal(r.state.busy,false);
 r.handlers.navigate(()=>{r.state.page='menu';});assert.equal(r.state.page,'menu');
 await r.handlers.changeScene(async()=>({match_id:'retry'}),'table');
 assert.equal(r.state.view.match_id,'retry');assert.equal(r.state.error,'');assert.equal(r.state.readError,false);
});

test('F02 scene preview and synchronous action failure both release the flag',async()=>{
 const r=renderer();
 await r.handlers.changeScene(()=>{throw new Error('FAILED');},'result');
 assert.equal(r.sceneChangePending.current,false);assert.equal(r.state.page,'prepare');
 await r.handlers.changeScene(async()=>({source:'fixture'}),'result');
 assert.equal(r.state.page,'result');assert.equal(r.state.modal,'');assert.equal(r.state.busy,false);
});

test('F02 existing generation protection discards stale success and error',async()=>{
 for(const fails of [false,true]) {
  const r=renderer(), pending=deferred();
  const started=r.handlers.changeScene(()=>pending.promise,'table');
  ++r.generation.current;
  if(fails)pending.reject(new Error('OLD_ERROR'));else pending.resolve({match_id:'old'});
  await started;
  assert.equal(r.state.page,'prepare');assert.equal(r.state.view,null);assert.equal(r.state.error,'');
  assert.equal(r.sceneChangePending.current,false);
 }
});
