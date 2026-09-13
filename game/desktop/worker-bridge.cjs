const { spawn } = require('node:child_process');
// Adapted from R01-T02-b 135b938fcfe0486895adfeea37fab73ee5f881dd.
const LIMIT = 1024 * 1024;
class WorkerBridge {
  constructor(executable, args = [], timeout = 10000, spawnChild = spawn, env = process.env) {
    this.spawnChild = spawnChild; this.env = env;
    this.executable = executable; this.args = args; this.timeout = timeout;
    this.failure = null; this.serial = 0; this.current = null; this.generations = new Set(); this.stopping = null;
  }
  start() {
    if (this.current) return this.current;
    const child = this.spawnChild(this.executable, this.args, { shell: false, windowsHide: true, env: this.env, stdio: ['pipe', 'pipe', 'pipe'] });
    const g = { child, pending: new Map(), buffer: Buffer.alloc(0), failed: false,
      exited: false, closed: false, retiring: false, timers: [] };
    g.done = new Promise(resolve => { g.resolveClose = resolve; });
    this.failure = null; this.current = g; this.generations.add(g);
    child.on('error', () => this.fail(g, 'WORKER_START_FAILED'));
    child.stdin.on('error', () => this.fail(g, 'WORKER_PIPE_FAILED'));
    child.on('exit', () => { g.exited = true; this.fail(g, 'WORKER_EXITED'); });
    child.on('close', () => {
      g.closed = true; this.fail(g, 'WORKER_EXITED');
      for (const timer of g.timers) clearTimeout(timer);
      this.generations.delete(g); g.resolveClose();
    });
    child.stderr.on('data', () => { /* Diagnostics are not protocol messages. */ });
    child.stdout.on('data', chunk => {
      if (g.failed || g.closed) return;
      g.buffer = Buffer.concat([g.buffer, chunk]);
      let end;
      while ((end = g.buffer.indexOf(10)) >= 0) {
        const line = g.buffer.subarray(0, end + 1); g.buffer = g.buffer.subarray(end + 1);
        try {
          if (line.length > LIMIT) throw new Error();
          const r = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line));
          if (!r || typeof r !== 'object' || Array.isArray(r) || Object.keys(r).sort().join(',') !== (r.ok ? 'data,id,ok,v' : 'error,id,ok,v') || r.v !== 1 || typeof r.ok !== 'boolean' || !g.pending.has(r.id) ||
              (r.ok ? !Object.hasOwn(r, 'data') : typeof r.error?.code !== 'string')) throw new Error();
          const p = g.pending.get(r.id); clearTimeout(p.timer); g.pending.delete(r.id);
          r.ok ? p.resolve(r.data) : p.reject(new Error(r.error.code));
        } catch { this.fail(g, 'WORKER_PROTOCOL_ERROR'); return; }
      }
      if (g.buffer.length > LIMIT) this.fail(g, 'WORKER_FRAME_TOO_LARGE');
    });
    return g;
  }
  fail(g, message, reap = true) {
    if (!g.failed) {
      g.failed = true; g.buffer = Buffer.alloc(0);
      for (const p of g.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
      g.pending.clear();
      if (this.current === g) { this.current = null; this.failure = message; }
    }
    if (reap) this.retire(g, false);
  }
  retire(g, graceful) {
    if (g.retiring || g.closed) return g.done;
    g.retiring = true;
    const kill = signal => { if (!g.exited && !g.closed) g.child.kill(signal); };
    if (graceful) {
      try { g.child.stdin.end(); } catch { kill('SIGTERM'); }
      g.timers.push(setTimeout(() => kill('SIGTERM'), 1000));
    } else { kill('SIGTERM'); }
    g.timers.push(setTimeout(() => kill('SIGKILL'), 2000));
    return g.done;
  }
  request(op, payload = {}) {
    let frame;
    const id = `req-${++this.serial}`;
    try { frame = JSON.stringify({ v: 1, id, op, payload }) + '\n'; }
    catch { return Promise.reject(new Error('BAD_REQUEST')); }
    if (Buffer.byteLength(frame) > LIMIT) return Promise.reject(new Error('FRAME_TOO_LARGE'));
    if (this.stopping) return Promise.reject(new Error('WORKER_STOPPING'));
    if ((this.current?.pending.size ?? 0) >= 16 || (!this.current && this.generations.size >= 16)) {
      return Promise.reject(new Error('WORKER_BUSY'));
    }
    let g;
    try { g = this.start(); } catch { return Promise.reject(new Error('WORKER_START_FAILED')); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(g, 'WORKER_TIMEOUT'), this.timeout);
      g.pending.set(id, { resolve, reject, timer });
      try { g.child.stdin.write(frame); } catch { this.fail(g, 'WORKER_PIPE_FAILED'); }
    });
  }
  stop() {
    if (this.stopping) return this.stopping;
    const generations = [...this.generations];
    this.stopping = Promise.all(generations.map(g => g.done)).then(() => { this.stopping = null; });
    for (const g of generations) {
      this.fail(g, 'WORKER_STOPPING', false); this.retire(g, true);
    }
    return this.stopping;
  }
}
module.exports = { WorkerBridge };
