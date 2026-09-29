const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const uiSource = /^(index\.html|style\.css|renderer\.tsx|interaction\.ts|view-loop\.ts|types\.ts|online\/.*\.(?:ts|tsx)|assets\/menu\/.*\.(?:png|webp))$/;
const build = () => spawnSync(process.execPath, ['build.cjs'], { cwd: root, stdio: 'inherit' }).status === 0;

if (!build()) process.exit(1);

const electron = spawn(require('electron'), ['.'], {
  cwd: root,
  env: { ...process.env, DEIDEI_DEV_RELOAD: '1' },
  stdio: 'inherit',
});

let timer;
const watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
  if (!filename || !uiSource.test(filename.split(path.sep).join('/'))) return;
  clearTimeout(timer);
  timer = setTimeout(build, 120);
});

const stop = signal => {
  clearTimeout(timer);
  watcher.close();
  if (!electron.killed) electron.kill(signal);
};

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
electron.once('exit', code => {
  watcher.close();
  process.exitCode = code ?? 0;
});
