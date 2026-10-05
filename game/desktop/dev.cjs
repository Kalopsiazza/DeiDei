const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = __dirname;
const uiSource = /^(index\.html|style\.css|welcome\.css|WelcomeEntrance\.tsx|renderer\.tsx|GraphicsSettingsPanel\.tsx|graphics\.(?:cjs|d\.cts)|BattleStage\.tsx|ManualArchive\.tsx|TutorialCoach\.tsx|SharedUI\.tsx|useSoloSession\.ts|interaction\.ts|view-loop\.ts|types\.ts|online\/.*\.(?:ts|tsx)|styles\/.*\.css|assets\/(?:menu|battle)\/.*\.(?:png|webp|mp4))$/;
const build = () => {
  const ok = spawnSync(process.execPath, ['build.cjs'], { cwd: root, stdio: 'inherit' }).status === 0;
  if (ok) fs.writeFileSync(path.join(root, 'build/ui/.reload'), String(Date.now()));
  return ok;
};

if (!build()) process.exit(1);

const electronEntry = process.env.DEIDEI_ROOM_URL ? '.' : path.join(root, 'tests-online/smoke-main.cjs');
console.log(process.env.DEIDEI_ROOM_URL ? '[dev] 好友房连接真实开发服务。' : '[dev] 未配置房间服务，好友房使用脚本化 UI 演示。');
const electron = spawn(require('electron'), [electronEntry], {
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
