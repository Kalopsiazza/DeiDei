const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {transformSync}=require('esbuild');
// Execute the actual hook/transition handlers; Electron smoke covers React effects and JSX wiring.
const sessionSource=fs.readFileSync(path.join(__dirname,'../online/useOnlineSession.ts'),'utf8');
const acceptCode=sessionSource.slice(sessionSource.indexOf(' const accept='),sessionSource.indexOf(' useEffect(()=>{'));
const commandCode=sessionSource.slice(sessionSource.indexOf(' const run='),sessionSource.indexOf(' return {state,'));
assert.ok(acceptCode.includes('lastRevision')&&commandCode.includes('const leave='));
const handlersCode=transformSync(`${acceptCode}\n${commandCode}\nglobalThis.handlers={accept,run,leave};`,{loader:'ts'}).code;
const initial={status:'connected',revision:0,pending:false,error:null,snapshot:{room_id:'room1',view:{phase:'result',match:{match_id:'match1'}}}};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function session(api={}){
 const result={busy:false,error:'',exits:0,accepted:[]};
 const context={api,performance:{now:()=>100},describeError:code=>code,lock:{current:false},alive:{current:true},leaving:{current:false},lastRevision:{current:-1},commandGeneration:{current:0},receipt:{current:0},currentState:{current:structuredClone(initial)},setBusy:value=>{result.busy=value;},setError:value=>{result.error=value;},setNow:()=>{},setState:value=>result.accepted.push(value),onExit:()=>result.exits++};
 vm.runInNewContext(handlersCode,context);return {result,...context};
}
test('online run/leave errors and throws restore the same page intent and release the serial lock',async()=>{
 for(const action of [async()=>({ok:false,error:'DENIED'}),async()=>{throw new Error('injected');}]){
  const current=session({leave:action});assert.equal(await current.handlers.leave(),false);
  assert.equal(current.leaving.current,false);assert.equal(current.lock.current,false);assert.equal(current.result.busy,false);assert.equal(current.result.exits,0);assert.ok(current.result.error);
 }
});
test('delayed leave rejection and disconnect clear exit intent without silently navigating later',async()=>{
 for(const late of [{error:{code:'DENIED'},pending:false},{status:'reconnecting',pending:true}]){
  const current=session({leave:async()=>({ok:true,data:{...initial,pending:true,revision:1}})});
  assert.equal(await current.handlers.leave(),true);assert.equal(current.leaving.current,true);
  current.handlers.accept({...initial,...late,revision:2});assert.equal(current.leaving.current,false);
  current.handlers.accept({...initial,status:'idle',snapshot:null,revision:3});assert.equal(current.result.exits,0);
 }
});
test('offline exit cancels a slow command; unmount/stale replies cannot revive the old room',async()=>{
 const old=deferred(),current=session({leave:async()=>({ok:true,data:{...initial,status:'idle',snapshot:null,revision:3}})});
 const pending=current.handlers.run(()=>old.promise);assert.equal(current.lock.current,true);
 current.handlers.accept({...initial,status:'reconnecting',pending:true,revision:2});
 assert.equal(await current.handlers.leave(),true);assert.equal(current.result.exits,1);
 old.resolve({ok:true,data:{...initial,revision:1}});assert.equal(await pending,false);
 assert.equal(current.result.accepted.at(-1).snapshot,null);assert.equal(current.result.busy,false);
 const delayed=deferred(),disposed=session();const request=disposed.handlers.run(()=>delayed.promise);
 disposed.alive.current=false;++disposed.commandGeneration.current;delayed.resolve({ok:true,data:initial});await request;
 assert.equal(disposed.result.accepted.length,0);
});
const roomSource=fs.readFileSync(path.join(__dirname,'../online/OnlineRoom.tsx'),'utf8');
const transitionSource=roomSource.slice(roomSource.indexOf(' const resultKey='),roomSource.indexOf(' if(!activeRoom){'));
assert.ok(transitionSource.includes('const transitionResult='));
const transitionCode=transformSync(`${transitionSource}\nglobalThis.handlers={transitionResult,cancelResult};`,{loader:'ts'}).code;
function transition(){
 const effects=[],timers=new Map(),values=[];let serial=0;
 const snapshot=structuredClone(initial.snapshot),context={snapshot,v:snapshot.view,state:structuredClone(initial),connected:true,currentState:{current:structuredClone(initial)},resultTimer:{current:null},resultLock:{current:false},resultAlive:{current:true},useEffect:callback=>effects.push(callback),setResultLeaving:value=>values.push(value),window:{matchMedia:()=>({matches:false}),setTimeout:callback=>{timers.set(++serial,callback);return serial;},clearTimeout:id=>timers.delete(id)}};
 vm.runInNewContext(transitionCode,context);
 return {context,values,timers,effects,fire:async()=>{const [id,callback]=[...timers][0];timers.delete(id);await callback();}};
}
test('result failure resets fade on the same result and double clicks schedule one command',async()=>{
 const current=transition();let calls=0;
 current.context.handlers.transitionResult(async()=>{calls++;return false;});current.context.handlers.transitionResult(async()=>{calls++;return true;});
 assert.equal(current.timers.size,1);assert.equal(current.context.resultLock.current,true);await current.fire();
 assert.equal(calls,1);assert.deepEqual(current.values,[true,false]);assert.equal(current.context.resultLock.current,false);
});
test('late result timer cannot run against a new match/disconnect and does not update after unmount',async()=>{
 for(const modify of [state=>state.snapshot.view.match.match_id='new-match',state=>state.status='reconnecting']){
  const current=transition();let calls=0;current.context.handlers.transitionResult(async()=>{calls++;return true;});modify(current.context.currentState.current);await current.fire();assert.equal(calls,0);assert.equal(current.values.at(-1),false);
 }
 const current=transition(),pending=deferred();current.context.handlers.transitionResult(()=>pending.promise);const firing=current.fire();current.context.resultAlive.current=false;pending.resolve(false);await firing;assert.deepEqual(current.values,[true]);
});
