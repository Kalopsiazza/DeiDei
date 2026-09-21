const { spawn } = require('node:child_process');
const LIMIT = 65536;
class WorkerBridge {
  constructor(executable, args = [], timeout = 10000) {
    this.executable = executable; this.args = args; this.timeout = timeout;
    this.pending = new Map(); this.serial = 0; this.child = null;
  }
  start() {
    if (this.child) return;
    const child = spawn(this.executable, this.args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    let buffer = Buffer.alloc(0);
    const fail = (message) => {
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
      this.pending.clear();
      if (this.child === child) this.child = null;
    };
    child.on('error', () => fail('WORKER_START_FAILED'));
    child.stdin.on('error', () => fail('WORKER_PIPE_FAILED'));
    child.on('exit', () => fail('WORKER_EXITED'));
    child.stderr.on('data', () => { /* Diagnostics are not protocol messages. */ });
    child.stdout.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let end;
      while ((end = buffer.indexOf(10)) >= 0) {
        const line = buffer.subarray(0, end + 1); buffer = buffer.subarray(end + 1);
        try {
          if (line.length > LIMIT) throw new Error();
          const r = JSON.parse(line.toString('utf8'));
          if (r.v !== 1 || typeof r.ok !== 'boolean' || !this.pending.has(r.id) ||
              (r.ok ? !Object.hasOwn(r, 'data') : typeof r.error?.code !== 'string')) throw new Error();
          const p = this.pending.get(r.id); clearTimeout(p.timer); this.pending.delete(r.id);
          r.ok ? p.resolve(r.data) : p.reject(new Error(r.error.code));
        } catch { fail('WORKER_PROTOCOL_ERROR'); child.kill(); return; }
      }
      if (buffer.length > LIMIT) { fail('WORKER_FRAME_TOO_LARGE'); child.kill(); }
    });
  }
  request(op, payload = {}) {
    this.start();
    const child = this.child;
    const id = `req-${++this.serial}`;
    const frame = JSON.stringify({ v: 1, id, op, payload }) + '\n';
    if (Buffer.byteLength(frame) > LIMIT) return Promise.reject(new Error('FRAME_TOO_LARGE'));
    if (this.pending.size >= 16) return Promise.reject(new Error('WORKER_BUSY'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id); reject(new Error('WORKER_TIMEOUT')); child.kill();
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer }); child.stdin.write(frame);
    });
  }
  async stop() {
    const child = this.child;
    if (!child) return;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.stdin.end();
    const timer = setTimeout(() => child.kill(), 1000);
    const hardTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
    await exited; clearTimeout(timer); clearTimeout(hardTimer);
  }
}
module.exports = { WorkerBridge };
