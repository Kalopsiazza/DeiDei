// Dedicated test launcher. No delay controls are exposed by ordinary main/preload.
const path = require('node:path');
const { WorkerBridge } = require('./worker-bridge.cjs');
const { WorkerPort } = require('./worker-port.cjs');
const { FixturePort } = require('./build/fixture.cjs');
if (!process.env.DEIDEI_TEST_DATA_DIR) throw new Error('TEST_DATA_DIR_REQUIRED');
global.__b = { arm:null, pending:null, release:null };
async function delayed(op, action) {
  const armed=global.__b.arm;
  if(armed?.op===op) {
    global.__b.arm=null;global.__b.pending=op;
    await new Promise(resolve=>{global.__b.release=resolve;});
    global.__b.pending=null;global.__b.release=null;
    if(armed.fail)throw new Error('MATCH_INTERRUPTED');
  }
  return action();
}
const spawn = WorkerBridge.prototype.start;
WorkerBridge.prototype.start=function(){
  this.args=['-u',path.resolve(__dirname,'../runtime/tests/summary_worker.py'),path.join(process.env.DEIDEI_TEST_DATA_DIR,'ledger.jsonl')];
  const generation=spawn.call(this);global.__testWorker=generation.child;return generation;
};
const start=WorkerPort.prototype.startSolo;
WorkerPort.prototype.startSolo=function(...args){global.__testPort=this;return delayed('start',()=>start.apply(this,args));};
const preview=FixturePort.prototype.preview;
FixturePort.prototype.preview=function(...args){return delayed('preview',()=>preview.apply(this,args));};
require('./main.cjs');
