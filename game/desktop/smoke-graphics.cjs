// Issue #37: real main, owned synthetic profiles, bounded functional and short comparison paths.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), fsSync = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process'), { createHash } = require('node:crypto');
const { _electron: electron } = require('playwright-core');
const { sourceInput, captureDiagnostics, frameSummary, segment, closeApplication } = require('./smoke-performance.cjs');
const { graphicsForPreset } = require('./graphics.cjs');
const { ProfileStore } = require('./profile.cjs');
const root = path.resolve(__dirname, '../..');
const mainRoot = path.resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], {cwd: root, encoding: 'utf8'}).trim(), '..');
const measuring = process.argv.includes('--measure');
const settingsOnly = process.argv.includes('--settings-only');
const archiveBackOnly = process.argv.includes('--archive-back-only');
assert.ok(process.argv.slice(2).every(arg => ['--measure', '--settings-only', '--self-check', '--archive-back-only'].includes(arg)), 'Use --measure [--settings-only], --archive-back-only or --self-check');
assert.ok(!settingsOnly || measuring, '--settings-only requires --measure');
assert.ok(!archiveBackOnly || !measuring, '--archive-back-only is a functional check');
const mode = archiveBackOnly ? 'archive-back-only' : settingsOnly ? 'measure-settings-repeat' : measuring ? 'measure' : 'functional';
const output = path.resolve(process.env.DEIDEI_GRAPHICS_OUTPUT || path.join(mainRoot, '.local-outputs/R04-T04-a', `${mode}-${Date.now()}`));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stopped = style => style.animationName === 'none' || style.animationPlayState === 'paused';
const offBackdrop = value => value === 'none' || value === 'blur(0px) saturate(1)';
const details = error => ({name: error.name, message: error.message, stack: error.stack});

async function main() {
  assert.ok(!fsSync.existsSync(path.join(output, 'checks.json')), 'Use a fresh evidence directory; previous checks.json is preserved');
  const report = {input: {...sourceInput(), driverSha256: hash(fsSync.readFileSync(__filename))}, mode,
    protocol: {entry: 'ordinary main, independent synthetic profile; default mode only wraps settings.apply before disk write',
      viewport: measuring ? [1920, 1080] : '1366×768 → 1000×650 → 1920×1080 → 1366×768 content resize',
      dpr: 'native, no DPR or refresh-rate emulation', backgroundThrottling: 'ordinary main default',
      measurement: 'rAF callback intervals, not presentation FPS or a GPU diagnosis', nativePhysicalResize: false,
      ...(settingsOnly ? {repeat: 'settings-only repeat of observed three-preset stable-settings difference; fresh ordinary main/profile; each preset saved, 1400ms settle then 1200ms sample; every result retained'} : {})},
    checks: [], snapshots: [], segments: [], rendererErrors: [], cleanup: []};
  let app, page, directory, cdp;
  const check = (condition, message, evidence) => {assert.ok(condition, message); report.checks.push({message, ...(evidence === undefined ? {} : {evidence})});};
  const fail = (error, stage) => {const value = {stage, ...details(error)}; if (!report.failure) report.failure = value; else (report.secondaryFailures ??= []).push(value); process.exitCode = 1;};
  const persist = () => fs.writeFile(path.join(output, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  const select = name => page.getByRole('combobox', {name, exact: true});
  const readProfile = async () => {const reply = await page.evaluate(() => window.desktop.profile.read()); check(reply.ok, 'real profile.read succeeds'); return reply.data;};
  const styles = () => page.evaluate(() => {
    const one = (selector, pseudo = null) => {const n = document.querySelector(selector); if (!n) return null; const s = getComputedStyle(n, pseudo);
      return {animationName: s.animationName, animationPlayState: s.animationPlayState, animationDuration: s.animationDuration, backdropFilter: s.backdropFilter,
        filter: s.filter, boxShadow: s.boxShadow, opacity: s.opacity, maskImage: s.maskImage, background: s.backgroundColor};};
    const app = document.querySelector('.app');
    return {route: app?.dataset.page, graphics: {ambientMotion: app?.dataset.graphicsMotion, glass: app?.dataset.graphicsGlass, decoration: app?.dataset.graphicsDecoration},
      viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, focused: document.hasFocus(), visibility: document.visibilityState,
      preferences: {motion: matchMedia('(prefers-reduced-motion: reduce)').matches, transparency: matchMedia('(prefers-reduced-transparency: reduce)').matches},
      environment: one('.menu-environment'), atmosphere: one('.menu-atmosphere'), aura: one('.menu-aura'), particles: one('.menu-particles'),
      character: one('.menu-character'), settings: one('.settings-content'), thinGlass: one('.settings-layout', '::before'),
      settingsSheen: one('.settings-content', '::after'), back: one('.settings-back'), dialog: one('dialog.tech-dialog'), backdrop: one('dialog.tech-dialog', '::backdrop'),
      stack: one('.archive-stack'), icons: one('.archive-icon-grid'), rail: one('.archive-scene-rail'),
      selectedCard: one('.archive-stack-item[data-selected=true] .archive-stack-card'), cardSheen: one('.archive-stack-item[data-selected=true] .archive-stack-card', '::after')};
  });
  const nativeState = () => app.evaluate(({BrowserWindow, screen}) => {const w = BrowserWindow.getAllWindows()[0], d = screen.getDisplayMatching(w.getBounds());
    return {pid: process.pid, focused: w.isFocused(), visible: w.isVisible(), minimized: w.isMinimized(), contentBounds: w.getContentBounds(),
      display: {id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor, displayFrequency: d.displayFrequency}};});
  async function snapshot(label, screenshot = false) {
    const state = await styles(); report.snapshots.push({label, ...state, native: await nativeState()});
    if (screenshot) await page.screenshot({path: path.join(output, `${label}.png`), scale: 'css'});
    return state;
  }
  async function focus() {
    await app.evaluate(({app, BrowserWindow}) => {app.focus({steal: true}); BrowserWindow.getAllWindows()[0].focus();}); await page.bringToFront();
    const state = await nativeState(); check(state.focused && state.visible && !state.minimized, 'owned native window focused and visible', state);
    check(await page.evaluate(() => document.hasFocus() && document.visibilityState === 'visible'), 'renderer focused and visible');
  }
  async function launch(wrapper) {
    const env = {...process.env, DEIDEI_TEST_DATA_DIR: directory}; delete env.ELECTRON_RUN_AS_NODE; delete env.DEIDEI_ROOM_URL; delete env.DEIDEI_DEV_RELOAD;
    app = await electron.launch({args: [wrapper || path.join(__dirname, 'main.cjs')], env}); page = await app.firstWindow(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => report.rendererErrors.push(details(error))); cdp = await page.context().newCDPSession(page);
    (report.launchPreferences ??= []).push(await page.evaluate(() => ({motion: matchMedia('(prefers-reduced-motion: reduce)').matches, transparency: matchMedia('(prefers-reduced-transparency: reduce)').matches})));
    if (!measuring) await cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'no-preference'}, {name: 'prefers-reduced-transparency', value: 'no-preference'}]});
  }
  async function close() {
    if (!app) return;
    const record = await closeApplication(app); report.cleanup.push(record); app = null; page = null; cdp = null;
    check(record.normalExit && !record.forced, 'owned Electron exits normally', record);
  }
  async function enterStored(name) {
    await page.locator('.welcome-scene').waitFor(); const skip = page.getByRole('button', {name: '跳过开场', exact: true});
    if (await skip.count()) await skip.click(); await page.getByRole('button', {name: `以${name}身份进入牌厅`, exact: true}).click();
    await page.locator('.app[data-page=menu]').waitFor();
  }
  async function openSettings() {await page.getByRole('button', {name: '设置 S', exact: true}).click(); await page.getByRole('button', {name: '画面 GRAPHICS', exact: true}).click(); await select('画面预设').waitFor(); await page.waitForTimeout(950);}
  async function preset(id) {await select('画面预设').selectOption(id); await page.waitForTimeout(100); assert.deepEqual((await styles()).graphics, graphicsForPreset(id));}
  async function archiveBack() {
    const savePreset = async id => {
      await openSettings(); await preset(id);
      await page.locator(await page.locator('.settings-save').isEnabled() ? '.settings-save' : '.settings-back').click();
      await page.locator('.menu-layout').waitFor();
    };
    const openArchive = async () => {
      await page.getByRole('button', {name: '经典规则手册 R', exact: true}).click();
      await page.locator('.archive-heading .settings-back').waitFor(); await page.waitForTimeout(950);
      await page.mouse.move(0, 0); await page.waitForTimeout(300);
    };
    const back = () => page.locator('.archive-heading .settings-back');
    await savePreset('high'); await openArchive(); const highIdle = (await styles()).back;
    await back().hover(); await page.waitForTimeout(300); const highHover = (await styles()).back;
    await back().click(); await page.locator('.menu-layout').waitFor();
    await savePreset('smooth'); await openArchive(); const idle = await snapshot('archive-back-off-idle', true);
    check(idle.back.background === 'rgb(16, 28, 39)' && idle.back.backdropFilter === 'none', 'glass off: archive back idle background alpha=1 and no backdrop', idle.back);
    await back().hover(); await page.waitForTimeout(300); const hover = await snapshot('archive-back-off-hover', true);
    check(hover.back.background === 'rgb(31, 55, 68)' && hover.back.backdropFilter === 'none', 'glass off: archive back hover background alpha=1 and no backdrop', hover.back);
    await page.keyboard.press('Tab'); await back().focus();
    const focusStyle = await back().evaluate(node => ({focused: node === document.activeElement, outline: getComputedStyle(node).outlineStyle}));
    check(focusStyle.focused && focusStyle.outline === 'solid', 'archive back retains keyboard focus feedback', focusStyle);
    await page.keyboard.press('Enter'); await page.locator('.menu-layout').waitFor(); check(true, 'archive back activates through keyboard');
    await savePreset('high'); await openArchive(); assert.deepEqual((await styles()).back, highIdle);
    await back().hover(); await page.waitForTimeout(300); assert.deepEqual((await styles()).back, highHover);
    check(true, 'changing back to high restores original idle and hover cascade', {highIdle, highHover});
    await back().click(); await page.locator('.menu-layout').waitFor(); check(true, 'archive back remains clickable at high');
  }
  async function assertConsumers(id) {
    const state = await snapshot(`settings-${id}`, true); const motion = id === 'high' ? 'full' : id === 'balanced' ? 'reduced' : 'off';
    check(motion === 'off' ? stopped(state.environment) : !stopped(state.environment), `${id}: environment drift consumer`);
    check(motion === 'full' ? !stopped(state.atmosphere) : stopped(state.atmosphere), `${id}: atmosphere loop consumer`);
    // High inherits prepare.css's later baseline override; lowering graphics never rewrites it.
    check(state.settings.backdropFilter === (id === 'smooth' ? 'none' : id === 'balanced' ? 'blur(6px) saturate(1.1)' : 'blur(18px) saturate(1.28)'), `${id}: settings glass consumer`, state.settings);
    if (id === 'high') check(state.thinGlass.backdropFilter === 'blur(24px) saturate(1.26) contrast(1.035)', 'high: final thin-glass baseline is preserved', state.thinGlass);
    check(id === 'high' ? state.aura.filter.includes('blur(9px)') : state.aura.filter === 'none', `${id}: decoration blur consumer`, state.aura);
    if (id !== 'high') check(stopped(state.settingsSheen) && Number(state.settingsSheen.opacity) === 0, `${id}: continuous content sheen is invisible`);
  }
  async function media(motion, transparency) {
    await cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: motion ? 'reduce' : 'no-preference'}, {name: 'prefers-reduced-transparency', value: transparency ? 'reduce' : 'no-preference'}]});
    await page.waitForTimeout(120);
  }
  async function sample(name, action) {
    await focus(); const before = await nativeState();
    await page.evaluate(() => {const s = window.__graphicsFocus = {active: true, frames: []}; function frame(t) {if (!s.active) return; s.frames.push({t, focused: document.hasFocus(), visibility: document.visibilityState}); requestAnimationFrame(frame);} requestAnimationFrame(frame);});
    let record;
    try {record = await segment(page, () => app.evaluate(({app}) => app.getAppMetrics()), report.segments, name, action);}
    finally {
      const focusFrames = await page.evaluate(() => {const s = window.__graphicsFocus; s.active = false; return s.frames;});
      record ??= report.segments.at(-1); Object.assign(record, {nativeBefore: before, nativeAfter: await nativeState(), focusFrames,
        focusValid: focusFrames.every(frame => frame.focused && frame.visibility === 'visible')});
      check(record.focusValid && record.nativeAfter.focused, `${name}: focus retained during sample`);
    }
  }
  async function wheelRegion(name, selector, measure = false) {
    const scroll = page.locator(selector); await scroll.evaluate(node => {node.scrollTop = 0;}); await scroll.hover(); await page.waitForTimeout(250);
    const state = () => scroll.evaluate(node => ({top: node.scrollTop, height: node.scrollHeight, client: node.clientHeight, focused: document.hasFocus(), visibility: document.visibilityState}));
    const record = {name, selector, before: await state(), wheels: []}; (report.scrollRegions ??= []).push(record);
    check(record.before.height > record.before.client, `${name}: real scroll range`);
    const action = async () => {for (let i = 0; i < 8; i++) {const wheel = {i, deltaY: i < 4 ? 500 : -500, before: await state()}; record.wheels.push(wheel);
      await page.mouse.wheel(0, wheel.deltaY); await page.waitForTimeout(180); wheel.after = await state(); wheel.native = await nativeState();
      check(wheel.after.focused && wheel.after.visibility === 'visible' && wheel.native.focused, `${name}: wheel ${i} remains focused`);}};
    if (measure) await sample(name, action); else {await focus(); await action();}
    check(record.wheels.some(wheel => wheel.deltaY > 0 && wheel.after.top > wheel.before.top), `${name}: positive wheel moves native scrollTop`);
    check(record.wheels.some(wheel => wheel.deltaY < 0 && wheel.after.top < wheel.before.top), `${name}: negative wheel moves native scrollTop`);
  }
  async function functional(wrapper, originalBytes) {
    await launch(wrapper);
    const first = await readProfile(); check(first.profile_version === 2, 'old v1 is normalized to usable v2 in memory'); assert.deepEqual(first.settings.graphics, graphicsForPreset('high'));
    check((await fs.readFile(path.join(directory, 'local-profile/profile.json'))).equals(originalBytes), 'v1 first read leaves original disk bytes unchanged');
    await enterStored(first.nickname); await openSettings();
    for (const id of ['high', 'balanced', 'smooth']) {await preset(id); await assertConsumers(id);}
    await preset('high'); await select('玻璃效果').selectOption('light'); check(await select('画面预设').inputValue() === 'custom', 'single-item change identifies custom');
    const customGlass = await snapshot('custom-glass', true);
    check(customGlass.settings.backdropFilter === 'blur(6px) saturate(1.1)' && !stopped(customGlass.environment) && customGlass.aura.filter === 'blur(9px)', 'custom glass changes its consumer while motion and decoration remain full');
    await select('玻璃效果').selectOption('full'); check(await select('画面预设').inputValue() === 'high', 'restoring exact values identifies preset');
    await select('动态效果').selectOption('reduced'); const customMotion = await snapshot('custom-motion');
    check(stopped(customMotion.atmosphere) && !stopped(customMotion.environment) && customMotion.settings.backdropFilter === 'blur(18px) saturate(1.28)' && customMotion.aura.filter === 'blur(9px)', 'custom motion changes its consumer while glass and decoration remain full');
    await select('动态效果').selectOption('full'); await select('装饰效果').selectOption('simple'); const customDecoration = await snapshot('custom-decoration');
    check(customDecoration.aura.filter === 'none' && !stopped(customDecoration.atmosphere) && customDecoration.settings.backdropFilter === 'blur(18px) saturate(1.28)', 'custom decoration changes its consumer while motion and glass remain full');
    await select('装饰效果').selectOption('full'); check(await select('画面预设').inputValue() === 'high', 'all custom controls restore high by field values');
    await preset('balanced'); await page.getByRole('button', {name: '声音 AUDIO', exact: true}).click(); await page.getByRole('slider', {name: '音乐音量', exact: true}).fill('31');
    await page.getByRole('button', {name: '昵称头像 PROFILE', exact: true}).click(); await page.getByRole('textbox', {name: '昵称', exact: true}).fill('跨分类草稿');
    await page.getByRole('button', {name: '画面 GRAPHICS', exact: true}).click(); check(await select('画面预设').inputValue() === 'balanced', 'graphics draft and preview survive category changes');
    assert.deepEqual((await readProfile()).settings.graphics, first.settings.graphics);
    await select('动态效果').focus();
    for (const [width, height] of [[1366, 768], [1000, 650], [1920, 1080], [1366, 768]]) {
      await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), {width, height}); await page.waitForTimeout(350);
      check(await select('画面预设').inputValue() === 'balanced', `${width}: draft survives continuous settings resize`);
      const geometry = await page.evaluate(() => ({viewport: [innerWidth, innerHeight], horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        focus: document.activeElement?.getAttribute('aria-label'), save: document.querySelector('.settings-save')?.getBoundingClientRect().toJSON(), scrollTop: document.querySelector('.app')?.scrollTop}));
      assert.deepEqual(geometry.viewport, [width, height]); check(!geometry.horizontalOverflow, `${width}: no new horizontal overflow`, geometry);
      check(geometry.focus === '动态效果', `${width}: current control retains focus`); await page.locator('.settings-save').scrollIntoViewIfNeeded(); check(await page.locator('.settings-save').isVisible(), `${width}: save remains reachable`);
      await snapshot(`resize-${width}`, width !== 1366);
    }
    const control = (failSave, delay = 700) => app.evaluate((_electron, value) => {global.__graphicsControl = {...value, calls: 0};}, {fail: failSave, delay});
    await control(false); await page.locator('.settings-layout .settings-back').click();
    let dialog = page.getByRole('dialog', {name: '还有未保存的修改', exact: true}); await dialog.waitFor();
    check((await styles()).dialog.backdropFilter === 'blur(6px) saturate(1.1)', 'settings Modal consumes preview glass level');
    await page.waitForTimeout(350); const lightModal = await snapshot('modal-balanced');
    check(['blur(4px)', 'blur(4px) saturate(1)'].includes(lightModal.backdrop.backdropFilter), 'settled balanced Modal backdrop consumes light 4px blur', lightModal.backdrop);
    await dialog.getByRole('button', {name: '继续编辑', exact: true}).click(); await dialog.waitFor({state: 'detached'}); check(await select('画面预设').inputValue() === 'balanced', 'continue editing retains draft');
    await page.locator('.settings-layout .settings-back').click(); await dialog.getByRole('button', {name: '保存关闭', exact: true}).focus();
    await page.keyboard.press('Escape'); await page.keyboard.press('Enter'); await dialog.waitFor({state: 'detached'});
    check(await app.evaluate(() => global.__graphicsControl.calls) === 0, 'closing Modal cannot execute focused save on Enter');
    check(await page.locator('.settings-layout .settings-back').evaluate(node => node === document.activeElement), 'settings Modal restores opener focus');
    await page.locator('.settings-layout .settings-back').click(); await dialog.getByRole('button', {name: '不保存关闭', exact: true}).click(); await page.locator('.app[data-page=menu]').waitFor();
    assert.deepEqual((await styles()).graphics, first.settings.graphics); check((await fs.readFile(path.join(directory, 'local-profile/profile.json'))).equals(originalBytes), 'discard restores saved effect with no disk write');
    await openSettings(); await preset('smooth'); await control(true); await page.locator('.settings-back').click(); await dialog.waitFor();
    const offModal = await snapshot('modal-smooth'); check(offBackdrop(offModal.dialog.backdropFilter) && offBackdrop(offModal.backdrop.backdropFilter), 'smooth Modal has no effective backdrop filter', offModal.backdrop);
    await dialog.getByRole('button', {name: '保存关闭', exact: true}).click(); await page.waitForTimeout(100);
    check(await select('画面预设').isDisabled(), 'save delay disables graphics editing'); check(await page.locator('.settings-layout>nav button').evaluateAll(nodes => nodes.every(node => node.disabled)), 'save delay disables category changes');
    check(await page.locator('.settings-back').isDisabled() && await page.locator('.settings-close').isDisabled() && await page.locator('.settings-save').isDisabled() && await dialog.locator('.dialog-close').isDisabled(), 'save delay disables duplicate save and leaving');
    await page.keyboard.press('Escape'); await page.waitForTimeout(800); await dialog.getByRole('alert').waitFor();
    check(await select('画面预设').inputValue() === 'smooth', 'save failure retains draft and preview for retry'); assert.deepEqual((await readProfile()).settings.graphics, first.settings.graphics);
    check((await fs.readFile(path.join(directory, 'local-profile/profile.json'))).equals(originalBytes), 'failure injected before write preserves old disk bytes');
    check(await app.evaluate(() => global.__graphicsControl.calls) === 1, 'delayed failing save called once'); await snapshot('save-failure', true);
    await control(false); await dialog.getByRole('button', {name: '保存关闭', exact: true}).click(); await page.locator('.app[data-page=menu]').waitFor(); const saved = await readProfile();
    check(saved.profile_version === 2 && saved.local_id === first.local_id && saved.nickname === first.nickname && saved.avatar_id === first.avatar_id, 'successful retry writes v2 preserving identity');
    assert.deepEqual(saved.settings, {...first.settings, graphics: graphicsForPreset('smooth')});
    await close(); await launch(); dialog = page.getByRole('dialog', {name: '还有未保存的修改', exact: true});
    await enterStored(saved.nickname); assert.deepEqual(await readProfile(), saved); assert.deepEqual((await styles()).graphics, saved.settings.graphics); check(true, 'full process restart retains saved graphics');
    await openSettings();
    for (const [id, motion, transparency] of [['high', true, false], ['high', false, true], ['high', true, true], ['balanced', true, true]]) {
      await preset(id); await media(motion, transparency); const state = await snapshot(`system-${id}-${Number(motion)}-${Number(transparency)}`, true);
      assert.deepEqual(state.preferences, {motion, transparency}); check(await select('画面预设').inputValue() === id, 'system preference never changes displayed preset');
      if (motion) check(stopped(state.environment) && stopped(state.atmosphere) && stopped(state.settingsSheen), `system reduced motion overrides ${id} consumers`);
      if (transparency) check(state.settings.backdropFilter === 'none' && state.thinGlass.backdropFilter === 'none' && state.back.backdropFilter === 'none', `system reduced transparency overrides ${id} consumers`);
      await page.locator('.settings-back').click(); await dialog.waitFor(); const modal = await styles();
      if (transparency) check(offBackdrop(modal.dialog.backdropFilter) && offBackdrop(modal.backdrop.backdropFilter), `system reduced transparency overrides ${id} Modal`, {dialog: modal.dialog, backdrop: modal.backdrop});
      await page.keyboard.press('Escape'); await dialog.waitFor({state: 'detached'}); assert.deepEqual(await readProfile(), saved);
    }
    await media(false, false); await page.locator('.settings-back').click(); await dialog.getByRole('button', {name: '不保存关闭', exact: true}).click(); await page.locator('.menu-layout').waitFor();
    await page.getByRole('button', {name: '经典规则手册 R', exact: true}).click(); await page.locator('.archive-stack').waitFor();
    await page.locator('.archive-stack').evaluate(node => {node.dataset.graphicsProbe = 'same-native-node';});
    await page.getByRole('textbox', {name: '搜索招式', exact: true}).fill('E33'); check(await page.locator('.archive-stack-item').count() === 1, 'archive search narrows result');
    await page.getByRole('button', {name: '清空搜索', exact: true}).click(); check(await page.locator('.archive-stack-item').count() === 33, 'archive clear restores cards');
    check(await page.locator('.archive-stack').getAttribute('data-graphics-probe') === 'same-native-node', 'search preserves native list node');
    await page.locator('.archive-stack').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.locator('.archive-card-detail[data-entry=Bi]').waitFor();
    await wheelRegion('functional-list', '.archive-stack'); await wheelRegion('functional-detail', '.archive-detail-scroll');
    await page.locator('.archive-stack').evaluate(node => {node.scrollTop = 0;}); await page.waitForTimeout(300);
    const bounds = await page.locator('.archive-stack').boundingBox(); await page.mouse.move(bounds.x + bounds.width - 6, bounds.y + 12); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width - 6, bounds.y + 100, {steps: 10}); await page.mouse.up();
    check(await page.locator('.archive-stack').evaluate(node => node.scrollTop > 0), 'native scrollbar remains draggable');
    const scrollbar = await page.locator('.archive-stack').evaluate(node => {const bar = getComputedStyle(node, '::-webkit-scrollbar'), thumb = getComputedStyle(node, '::-webkit-scrollbar-thumb'); return {width: bar.width, border: thumb.borderWidth, clip: thumb.backgroundClip};});
    assert.deepEqual(scrollbar, {width: '12px', border: '3px', clip: 'padding-box'}); check(true, 'native scrollbar retains 12px drag region and 6px line');
    check((await styles()).stack.maskImage === 'none', 'removed four-edge card-list mask stays absent');
    await page.getByRole('button', {name: '切换为图标显示', exact: true}).click(); await page.locator('.archive-icon-tile[data-entry=Bi]').click(); check(await page.locator('.archive-card-detail').getAttribute('data-entry') === 'Bi', 'icon selection updates same card detail');
    const icons = await styles(); check(icons.icons.maskImage !== 'none' && icons.rail.maskImage !== 'none', 'existing icon and scene-rail masks remain');
    await page.getByRole('button', {name: '切换为卡牌显示', exact: true}).click();
    await page.locator('.archive-stack').evaluate(node => {node.scrollTop = 0;}); await page.mouse.move(0, 0); await page.waitForTimeout(150);
    const idleCard = await styles(); check(stopped(idleCard.cardSheen) && Number(idleCard.cardSheen.opacity) === 0, 'low-motion selected card continuous sheen is invisible at rest');
    await page.locator('.archive-stack-item[data-selected=true]').hover(); const hoverCard = await styles();
    check(hoverCard.cardSheen.animationName === 'archive-card-glint' && hoverCard.cardSheen.animationDuration === '1.1s', 'low-motion card retains single hover sheen');
    await media(true, false); const reducedCard = await styles(); check(stopped(reducedCard.cardSheen), 'system reduced motion stops single hover sheen'); await media(false, false);
    const rules = page.getByRole('button', {name: '完整规则', exact: true}); await rules.click(); await page.getByRole('dialog', {name: '完整规则', exact: true}).waitFor();
    const archiveModal = await styles(); check(offBackdrop(archiveModal.dialog.backdropFilter) && offBackdrop(archiveModal.backdrop.backdropFilter), 'archive rules Modal consumes saved off glass', {dialog: archiveModal.dialog, backdrop: archiveModal.backdrop}); await page.keyboard.press('Escape'); await page.locator('dialog').waitFor({state: 'detached'});
    check(await rules.evaluate(node => node === document.activeElement), 'archive Modal restores opener focus'); check(await page.locator('.archive-card-detail').getAttribute('data-entry') === 'Bi', 'archive selected detail survives Modal');
    const archive = await snapshot('archive-smooth', true); check([archive.environment, archive.atmosphere, archive.aura, archive.particles].every(stopped), 'archive four background loops remain paused');
    await page.locator('.archive-heading .settings-back').click(); await page.locator('.menu-layout').waitFor(); await archiveBack();
  }
  async function measure() {
    await launch(); await focus(); await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setContentSize(1920, 1080));
    const welcome = async (name, replay) => {
      if (replay) await page.getByRole('button', {name: '重播开场', exact: true}).click();
      await sample(name, async () => {await page.locator('.welcome-scene[data-stage=title]').waitFor({timeout: 20000});});
      const video = await page.locator('.welcome-film').evaluate(node => ({currentTime: node.currentTime, ended: node.ended, paused: node.paused, width: node.videoWidth, height: node.videoHeight, error: node.error?.message || null}));
      (report.welcome ??= []).push({name, video, processPid: app.process().pid});
      check(video.ended && video.paused && video.width === 1920 && video.height === 1080 && !video.error, `${name}: actual opening naturally ends`);
    };
    if (!settingsOnly) {
      await welcome('fresh-process-natural-welcome', false); await welcome('same-process-natural-replay', true);
    }
    await enterStored('画面对照');
    if (!settingsOnly) {
      await page.getByRole('button', {name: '开发预览', exact: true}).click(); await page.getByRole('button', {name: 'P01 · 首次进入／欢迎建档', exact: true}).click();
      await page.locator('.welcome-scene').waitFor(); await sample('p01-return', async () => {await page.getByRole('button', {name: '结束预览，返回主菜单', exact: true}).click(); await page.locator('.menu-layout').waitFor();});
      check((await readProfile()).nickname === '画面对照', 'P01 return leaves saved configuration and identity');
    }
    for (const id of ['high', 'balanced', 'smooth']) {
      await openSettings(); await preset(id); if (await page.locator('.settings-save').isEnabled()) {await page.locator('.settings-save').click(); await page.locator('.menu-layout').waitFor();} else {await page.locator('.settings-back').click(); await page.locator('.menu-layout').waitFor();}
      if (!settingsOnly) {
        await page.mouse.move(0, 0); await page.waitForTimeout(1800); await snapshot(`hall-${id}`, true);
        await sample(`hall-${id}-30s`, () => page.waitForTimeout(30000));
      }
      await openSettings(); await page.mouse.move(0, 0); await page.waitForTimeout(1400); await snapshot(`stable-settings-${id}`, true);
      await sample(`settings-${id}-stable`, () => page.waitForTimeout(1200)); await page.locator('.settings-back').click(); await page.locator('.menu-layout').waitFor();
      if (!settingsOnly) {
        await page.getByRole('button', {name: '经典规则手册 R', exact: true}).click(); await page.locator('.archive-card-detail[data-entry=Bi]').waitFor();
        await page.waitForTimeout(1000); await page.getByRole('tab', {name: '先看懂', exact: true}).click();
        check(await page.locator('.archive-card-detail').getAttribute('data-entry') === 'Bi', `${id}: identical measured card and reading mode`);
        await snapshot(`archive-${id}`, true); await wheelRegion(`archive-${id}-list`, '.archive-stack', true); await wheelRegion(`archive-${id}-detail`, '.archive-detail-scroll', true);
        await page.getByRole('button', {name: /返回主菜单/}).click(); await page.locator('.menu-layout').waitFor();
      }
    }
    check(report.snapshots.every(state => state.viewport[0] === 1920 && state.viewport[1] === 1080), 'comparison uses actual 1920×1080 throughout');
    check(new Set(report.snapshots.map(state => state.native.display.id)).size === 1 && new Set(report.snapshots.map(state => state.dpr)).size === 1, 'comparison stays on one native display and DPR');
  }
  try {
    await fs.mkdir(output, {recursive: true});
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'deidei-graphics-'));
    if (measuring) {await new ProfileStore(path.join(directory, 'local-profile')).save('create', {nickname: '画面对照', avatar_id: 'leaf'}); await measure();}
    else {
      const v1 = {profile_version: 1, local_id: '12345678-1234-4123-8123-123456789abc', nickname: '画面验收', avatar_id: 'leaf', settings: {music: 55, effects: 66, fullscreen: false}};
      const bytes = Buffer.from(JSON.stringify(v1, null, 2) + '\n'); await fs.mkdir(path.join(directory, 'local-profile')); await fs.writeFile(path.join(directory, 'local-profile/profile.json'), bytes);
      report.originalProfile = {version: 1, sha256: hash(bytes)};
      if (archiveBackOnly) {await launch(); await focus(); await enterStored('画面验收'); await archiveBack();}
      else {
        const wrapper = path.join(output, 'controlled-main.cjs'); await fs.writeFile(wrapper, `const {ipcMain}=require('electron');\nglobal.__graphicsControl={delay:0,fail:false,calls:0};\nconst handle=ipcMain.handle.bind(ipcMain);\nipcMain.handle=(channel,fn)=>handle(channel,async(...args)=>{if(channel==='settings.apply'){const c=global.__graphicsControl;c.calls++;await new Promise(r=>setTimeout(r,c.delay));if(c.fail)return {ok:false,error:'SAVE_FAILED'};}return fn(...args);});\nrequire(${JSON.stringify(path.join(__dirname, 'main.cjs'))});\n`);
        await functional(wrapper, bytes);
      }
    }
    check(report.rendererErrors.length === 0, 'no renderer page errors');
  } catch (error) {fail(error, 'scenario');}
  finally {
    if (page && !page.isClosed()) {try {report.diagnostics = await captureDiagnostics(page); await snapshot(report.failure ? 'failure' : 'final', true);} catch (error) {fail(error, 'final-diagnostics');}}
    try {await persist();} catch (error) {fail(error, 'evidence-before-cleanup');}
    try {await close();} catch (error) {fail(error, 'application-cleanup');}
    if (directory) try {await fs.rm(directory, {recursive: true, force: true}); report.profileRemoved = !fsSync.existsSync(directory); check(report.profileRemoved, 'owned temporary profile removed');} catch (error) {fail(error, 'profile-cleanup');}
    report.status = report.failure ? 'FAIL' : 'PASS'; report.finishedAt = new Date().toISOString();
    try {await persist(); const saved = JSON.parse(await fs.readFile(path.join(output, 'checks.json'), 'utf8')); for (const record of saved.segments) {const {frames, ...summary} = frameSummary(record.frameTimestamps); assert.equal(record.frameCount, frames); for (const [key, value] of Object.entries(summary)) assert.equal(record[key], value); assert.equal(record.active, false);} report.evidenceReadBack = true; await persist();} catch (error) {fail(error, 'evidence-read-back'); report.status = 'FAIL'; try {await persist();} catch (writeError) {fail(writeError, 'failure-evidence-write');}}
  }
  console.log(JSON.stringify({status: report.status, mode: report.mode, output, checks: report.checks.length,
    segments: report.segments.map(({name, p95, max, over50ms, frameCount, focusValid, viewport, dpr}) => ({name, p95, max, over50ms, frameCount, focusValid, viewport, dpr})), failure: report.failure, cleanup: report.cleanup}, null, 2));
}

if (process.argv.includes('--self-check')) {
  assert.equal(stopped({animationName: 'none', animationPlayState: 'running'}), true);
  assert.equal(stopped({animationName: 'drift', animationPlayState: 'paused'}), true);
  assert.equal(stopped({animationName: 'drift', animationPlayState: 'running'}), false);
  for (const value of ['none', 'blur(0px) saturate(1)']) assert.equal(offBackdrop(value), true);
  for (const value of ['blur(0.01px) saturate(1)', 'blur(0px) saturate(1.01)', 'blur(4px)', 'blur(0px) saturate(0.99)']) assert.equal(offBackdrop(value), false);
  assert.deepEqual(frameSummary([0, 16, 32, 92]), {frames: 4, p50: 16, p95: 60, p99: 60, over50ms: 1, max: 60});
  console.log('PASS stopped-animation, strict no-effect backdrop values, and recorded rAF summary contract; no GUI launched');
} else main().catch(error => {console.error(error.stack || error.message); process.exitCode = 1;});
