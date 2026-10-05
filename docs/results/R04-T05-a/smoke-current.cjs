// Issue #39: short ordinary-main worker and loopback route, owned synthetic data only.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const desktop = path.join(root, 'game/desktop');
const {_electron: electron} = require(path.join(desktop, 'node_modules/playwright-core'));
const {Peer, until} = require(path.join(root, 'game/integration/peer.cjs'));
const {enterArena, leaveSolo} = require(path.join(root, 'game/integration/gui-actions.cjs'));
const {sourceInput, closeApplication} = require(path.join(desktop, 'smoke-performance.cjs'));
const python = process.env.DEIDEI_PYTHON || 'python3';
assert.ok(process.env.DEIDEI_T05_OUTPUT, 'Set a fresh DEIDEI_T05_OUTPUT directory');
const output = path.resolve(process.env.DEIDEI_T05_OUTPUT);
const report = {input: sourceInput(), driverSha256: createHash('sha256').update(require('node:fs').readFileSync(__filename)).digest('hex'), checks: [], pageErrors: [], cleanup: []};
let app, page, service, peer;
const directories = [];
const record = (name, evidence) => report.checks.push({name, evidence});
const env = {...process.env, PYTHONPATH: [path.join(root, 'game/core'), path.join(root, 'game/server')].join(path.delimiter)};
delete env.ELECTRON_RUN_AS_NODE; delete env.DEIDEI_ROOM_URL; delete env.DEIDEI_DEV_RELOAD;
async function launch(entry = 'main.cjs', url) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deidei-t05-')); directories.push(dir);
  app = await electron.launch({args: [path.join(desktop, entry)], env: {...env, DEIDEI_TEST_DATA_DIR: dir, ...(url ? {DEIDEI_ROOM_URL: url} : {})}});
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.pageErrors.push(e.message));
  await app.evaluate(({app, BrowserWindow}) => {app.focus({steal: true}); BrowserWindow.getAllWindows()[0].focus();});
  await page.locator('.welcome-scene').waitFor();
  const skip = page.getByRole('button', {name: '跳过开场', exact: true}); if (await skip.count()) await skip.click();
  await page.getByRole('button', {name: '进入牌厅', exact: true}).click();
  await page.getByRole('textbox', {name: '昵称', exact: true}).fill('整合验收');
  await page.getByRole('button', {name: '确认名字', exact: true}).click();
  await page.getByRole('radio', {name: '熟悉', exact: true}).check();
  await page.getByRole('button', {name: '进入牌厅', exact: true}).click();
  await page.locator('.menu-layout').waitFor(); record('fresh welcome and familiar branch enters hall', {entry});
}
async function close() {
  if (!app) return;
  const cleanup = await closeApplication(app); report.cleanup.push(cleanup); app = null; page = null;
  assert.ok(cleanup.normalExit && !cleanup.forced, 'owned Electron closes normally');
}
const online = async () => {const r = await page.evaluate(() => window.desktop.online.read()); assert.ok(r.ok); return r.data;};
async function shot(name) {await page.screenshot({path: path.join(output, `${name}.png`), scale: 'css'});}
async function main() {
  assert.ok(!require('node:fs').existsSync(path.join(output, 'checks.json')), 'preserve previous evidence');
  await fs.mkdir(output, {recursive: true});
  try {
    await launch();
    await page.getByRole('button', {name: '单人对局', exact: false}).click();
    await page.getByRole('button', {name: /开始对局/}).click(); await enterArena(page);
    await page.locator('.battle-table[data-phase=selecting]').waitFor();
    const before = await page.evaluate(() => window.desktop.port.getView()); assert.equal(before.data.source, 'live');
    await page.locator('[data-entry=Charge] .card-pick').click(); await page.getByRole('button', {name: '确认出招', exact: true}).click();
    await page.locator('.battle-table[data-phase=revealed]').waitFor();
    const revealed = await page.evaluate(() => window.desktop.port.getView()); assert.equal(revealed.data.source, 'live');
    record('ordinary main real worker submits and reveals', {phase: revealed.data.phase, turn: revealed.data.turn_index, source: revealed.data.source});
    await shot('solo-revealed'); await leaveSolo(page); record('solo exit returns to hall');
    await page.getByRole('button', {name: '好友联机', exact: false}).click();
    await page.getByText('联机服务尚未配置', {exact: false}).waitFor(); record('ordinary main unconfigured service is explicit'); await shot('online-unconfigured'); await close();
    await launch('tests-online/smoke-main.cjs');
    await page.getByRole('button', {name: '好友联机', exact: false}).click();
    await page.getByText('MOCK', {exact: true}).waitFor(); assert.equal((await online()).source, 'fixture'); record('dev no-address launcher explicitly labels MOCK'); await shot('online-mock'); await close();
    service = spawn(python, ['-u', '-m', 'deidei_server', '--port', '0'], {cwd: root, env, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = ''; service.stdout.on('data', b => stdout += b); service.stderr.on('data', b => stderr += b);
    const url = await until(() => stdout.match(/Listening: (ws:\/\/127\.0\.0\.1:\d+\/rooms-v1)/)?.[1], 'owned loopback server starts');
    await launch('main.cjs', url);
    await page.getByRole('button', {name: '好友联机', exact: false}).click(); await until(async () => (await online()).status === 'connected', 'real room connected');
    await page.getByRole('button', {name: '创建房间', exact: true}).click();
    await page.getByRole('slider', {name: '每拍时间', exact: true}).focus(); await page.keyboard.press('End');
    await page.getByRole('button', {name: '创建并进入', exact: true}).click(); await page.locator('.online-lobby').waitFor();
    const created = (await online()).snapshot;
    peer = await new Peer(url, '合成来宾').open(); await peer.ok('room.join', {room_code: created.view.room_code, password: null, role: 'player'});
    await peer.ok('room.ready', {room_id: created.room_id, ready: true});
    await until(async () => (await online()).snapshot.view.members.length === 2, 'guest joins room');
    await page.getByRole('button', {name: '准备', exact: true}).click(); await page.getByRole('button', {name: '开始对局', exact: true}).click(); await enterArena(page);
    await page.locator('.battle-table[data-phase=selecting]').waitFor();
    await page.locator('[data-entry=Charge] .card-pick').click(); await page.getByRole('button', {name: '确认出招', exact: true}).click();
    await until(async () => (await online()).snapshot.view.self.accepted_entry_id === 'Charge', 'host submission acknowledged');
    await peer.sync(created.room_id); assert.equal(peer.view.view.self.accepted_entry_id, null);
    assert.equal(peer.view.view.match.last_turn, null); assert.equal(JSON.stringify(peer.view.view.members).includes('Charge'), false);
    record('opponent snapshot before reveal contains no submitted move');
    await peer.submit('Charge'); await page.locator('.battle-table[data-phase=revealed]').waitFor();
    const real = await online(); assert.equal(real.source, 'online'); assert.equal(real.snapshot.view.phase, 'revealing');
    const actions = real.snapshot.view.match.last_turn.core_resolution.ledger.actions;
    assert.equal(Object.keys(actions).length, 2); assert.ok(Object.values(actions).every(x => x.entry_id === 'Charge'));
    record('real loopback create join ready start submit reveal', {source: real.source, actions: Object.values(actions).map(x => x.entry_id)}); await shot('online-revealed');
    await page.getByRole('button', {name: '暂停', exact: true}).click(); await page.getByRole('button', {name: '退出游戏 LEAVE MATCH', exact: true}).click();
    await page.getByRole('button', {name: '确认结束房间', exact: true}).click(); await page.locator('.menu-layout').waitFor(); record('real online exit returns to hall');
    assert.equal(report.pageErrors.length, 0); record('no renderer errors'); report.status = 'PASS';
  } catch (error) {report.status = 'FAIL'; report.failure = error.stack; process.exitCode = 1; if (page && !page.isClosed()) await shot('failure').catch(() => {});}
  finally {
    try {await close();} catch (error) {report.status = 'FAIL'; report.cleanupError = error.message; process.exitCode = 1;}
    if (peer) peer.close();
    if (service) {service.kill('SIGINT'); try {await until(() => service.exitCode !== null || service.signalCode, 'owned server exits', 5000); assert.equal(service.exitCode, 0); record('owned loopback server exits', {exit: service.exitCode});} catch (error) {report.status = 'FAIL'; report.serverCleanupError = error.message; process.exitCode = 1; service.kill('SIGKILL');}}
    for (const dir of directories) await fs.rm(dir, {recursive: true, force: true});
    report.profilesRemoved = directories.every(dir => !require('node:fs').existsSync(dir));
    report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({status: report.status, output, checks: report.checks.length, failure: report.failure}));
  }
}
main().catch(e => {console.error(e); process.exitCode = 1;});
