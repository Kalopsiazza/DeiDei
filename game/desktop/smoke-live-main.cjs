// Test-only launch path. The ordinary main.cjs has no seeded opponent or diagnostic API.
const path = require('node:path');
const { WorkerBridge } = require('./worker-bridge.cjs');
if (!process.env.DEIDEI_TEST_DATA_DIR) throw new Error('TEST_DATA_DIR_REQUIRED');
const original = WorkerBridge.prototype.start;
WorkerBridge.prototype.start = function () {
  this.args = ['-u', path.resolve(__dirname, '../runtime/tests/seeded_worker.py'), path.join(process.env.DEIDEI_TEST_DATA_DIR, 'ledger.jsonl')];
  const generation = original.call(this);
  global.__testWorker = generation.child;
  return generation;
};
const { WorkerPort } = require('./worker-port.cjs');
const startSolo = WorkerPort.prototype.startSolo;
WorkerPort.prototype.startSolo = function (...args) { global.__testPort = this; return startSolo.apply(this,args); };
require('./main.cjs');
