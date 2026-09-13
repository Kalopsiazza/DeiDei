const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { WorkerBridge } = require('./bridge.cjs');
const { readProfile, writeProfile } = require('./profile.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window, bridge, exiting = false, writing = false;
const cases = ['charge_charge', 'bi_charge', 'bi_def', 'reflect_bi'];
app.whenReady().then(async () => {
  const directory = path.join(app.getPath('userData'), 'r01-t02-b-test');
  const resource = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'dist');
  bridge = new WorkerBridge(path.join(resource, 'worker', process.platform === 'win32' ? 'worker.exe' : 'worker'));
  const files = new Set(['index.html', 'renderer.js', 'style.css', 'card.svg']);
  protocol.handle('app', async request => {
    const u = new URL(request.url); const name = u.pathname.slice(1);
    if (u.host !== 'experiment' || !files.has(name) || request.method !== 'GET') return new Response('', { status: 403 });
    const types = { 'index.html': 'text/html; charset=utf-8', 'renderer.js': 'text/javascript', 'style.css': 'text/css', 'card.svg': 'image/svg+xml' };
    try { return new Response(await fs.readFile(path.join(__dirname, 'build', 'ui', name)), { headers: { 'Content-Type': types[name] } }); }
    catch { return new Response('Local asset unavailable', { status: 404 }); }
  });
  window = new BrowserWindow({ width: 1050, height: 850, title: 'DeiDei R01 — 技术验证（非游戏）',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('app://experiment/') }));
  const expose = (name, handler) => ipcMain.handle(name, async (event, ...args) => {
    try {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
          event.senderFrame.url !== 'app://experiment/index.html' || args.length > 1) throw new Error('INVALID_SENDER');
      return { ok: true, data: await handler(...args) };
    } catch (e) { return { ok: false, error: e.message.startsWith('E') ? 'FILESYSTEM_ERROR: check permissions' : e.message }; }
  });
  const empty = p => { if (p !== undefined) throw new Error('INVALID_ARGUMENT'); };
  expose('health', p => { empty(p); return bridge.request('health'); });
  expose('profileRead', p => { empty(p); return readProfile(directory); });
  expose('profileWrite', async p => {
    if (writing) throw new Error('PROFILE_BUSY');
    writing = true; try { return await writeProfile(directory, p); } finally { writing = false; }
  });
  expose('runCase', id => { if (!cases.includes(id)) throw new Error('INVALID_CASE'); return bridge.request('run_case', { case_id: id }); });
  expose('chooseEasy', seed => { if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('INVALID_SEED'); return bridge.request('choose_easy', { seed }); });
  expose('shutdown', async p => { empty(p); const r = await bridge.request('shutdown'); await bridge.stop(); return r; });
  await window.loadURL('app://experiment/index.html');
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (exiting || !bridge) return;
  event.preventDefault(); exiting = true;
  bridge.stop().finally(() => app.quit());
});
