// Isolated CSS/layout QA; online uses existing MOCK, no service acceptance.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../.."), out = path.resolve(process.env.DEIDEI_STYLE_OUTPUT || path.join(root, ".local-outputs/R04-T02-d/style-check"));
const { _electron: electron } = require(path.join(root, "game/desktop/node_modules/playwright-core"));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "deidei-d-style-"));
  const env = { ...process.env, DEIDEI_TEST_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.DEIDEI_ROOM_URL;
  const report = { code_sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), dirty: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim(), kind: "actual Electron; online MOCK; six-state attrs synthesized for CSS sampling", elements: {}, layouts: [], failures: [] };
  let app, page;
  const sample = async (locator) => locator.evaluate((node) => {
    const s = getComputedStyle(node), r = node.getBoundingClientRect(), style = {};
    for (const k of ["fontSize", "fontWeight", "color", "backgroundColor", "backgroundImage", "borderColor", "outlineColor", "outlineWidth", "outlineStyle", "boxShadow", "minHeight", "minWidth", "padding", "backdropFilter", "filter", "opacity", "clipPath", "transform", "transitionDuration", "animationName"]) style[k] = s[k];
    return { style, box: { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }, focusVisible: node.matches(":focus-visible"), disabled: node.matches(":disabled"), busy: node.getAttribute("aria-busy") };
  });
  const states = async (name, selector) => {
    const l = page.locator(selector).first();
    await l.waitFor();
    await page.mouse.move(0, 0);
    await l.evaluate((n) => n.blur());
    await page.waitForTimeout(250);
    const values = { default: await sample(l) };
    await l.hover();
    await page.waitForTimeout(250);
    values.hover = await sample(l);
    await page.mouse.down();
    await page.waitForTimeout(250);
    values.active = await sample(l);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await page.keyboard.press("Tab");
    await l.focus();
    await page.waitForTimeout(250);
    values.focusVisible = await sample(l);
    await l.evaluate((n) => {
      n.dataset.savedDisabled = String(n.hasAttribute("disabled"));
      n.setAttribute("disabled", "");
    });
    await page.waitForTimeout(250);
    values.disabled = await sample(l);
    await l.hover({ force: true });
    await page.mouse.down();
    await page.waitForTimeout(250);
    values.disabledPressed = await sample(l);
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await l.evaluate((n) => {
      if (n.dataset.savedDisabled === "false") n.removeAttribute("disabled");
      delete n.dataset.savedDisabled;
      n.dataset.savedBusy = n.getAttribute("aria-busy") ?? "";
      n.setAttribute("aria-busy", "true");
    });
    await page.waitForTimeout(250);
    values.busy = await sample(l);
    await l.evaluate((n) => {
      const v = n.dataset.savedBusy;
      if (v) n.setAttribute("aria-busy", v);
      else n.removeAttribute("aria-busy");
      delete n.dataset.savedBusy;
    });
    report.elements[name] = { selector, states: values };
    assert.equal(values.focusVisible.focusVisible, true, name + " gets keyboard focus");
    assert.ok(values.focusVisible.style.outlineStyle !== "none" && parseFloat(values.focusVisible.style.outlineWidth) > 0 || values.focusVisible.style.boxShadow !== "none" || values.focusVisible.style.borderColor !== values.default.style.borderColor, name + " retains a visible focus indicator");
    assert.equal(values.disabledPressed.style.transform, values.disabled.style.transform, name + " disabled pointer press cannot activate transform");
  };
  const screenshot = async (name) => page.screenshot({ path: path.join(out, name + ".png"), scale: "css" });
  const dimensions = [[1e3, 650], [1060, 650], [1366, 768], [1920, 1080], [1280, 800], [2560, 1080]];
  const layouts = async (name, selector, { cards, seats, seatGeometry = false } = {}) => {
    for (const [width, height] of dimensions) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(1e3);
      const value = await page.evaluate(({ selector: selector2, cards: cards2, seats: seats2 }) => {
        const box = (n) => {
          const r = n.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        };
        const controls = [...document.querySelectorAll(selector2)].map((n) => ({ text: n.getAttribute("aria-label") || n.textContent.trim().slice(0, 40), ...box(n) }));
        const seatParts = seats2 ? [...document.querySelectorAll(".arena-seat")].flatMap((n, index) => [n.querySelector(".seat-profile"), n.querySelector(".move-card.current,.move-card.active")].filter(Boolean).map((n2) => ({ index, ...box(n2) }))) : [];
        const overlaps = seatParts.some((a, i) => seatParts.slice(i + 1).some((b) => a.index !== b.index && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4));
        const context = document.createElement("canvas").getContext("2d");
        const glyphs = cards2 ? [...document.querySelectorAll(".battle-cards .card-name")].map((n) => {
          const style = getComputedStyle(n), r = n.getBoundingClientRect();
          context.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
          const m = context.measureText(n.textContent), copy = n.closest("strong").getBoundingClientRect(), range = document.createRange();
          range.selectNodeContents(n);
          const text = range.getBoundingClientRect();
          return { nameFits: text.left >= copy.left - 1 && text.right <= copy.right + 1 && text.top >= copy.top - 1 && text.bottom <= copy.bottom + 1, name: n.textContent, font: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), height: r.height, inkHeight: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, textOverflow: style.textOverflow };
        }) : [];
        return { glyphs, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], controls, cardCount: cards2 ? document.querySelectorAll(".battle-cards .card").length : null, seatCount: seats2 ? document.querySelectorAll(".arena-seat").length : null, seatParts, overlaps };
      }, { selector, cards, seats });
      const outside = [...value.controls, ...seatGeometry ? value.seatParts : []].filter((r) => r.left < -1 || r.top < -1 || r.right > width + 1 || r.bottom > height + 1);
      const ok = value.controls.length > 0 && !outside.length && (!seatGeometry || !value.overlaps) && value.glyphs.every((g) => g.font >= 12 && (cards !== 33 || g.font <= 16) && g.height + 0.5 >= g.inkHeight && g.nameFits) && (!cards || value.cardCount === cards) && (!seats || value.seatCount === seats) && value.scroll[0] <= width && value.scroll[1] <= height;
      report.layouts.push({ name, method: "Electron renderer content-size simulation; DPR reported separately", seatGeometry, ok, outside, ...value });
      if (!ok) report.failures.push(name + " " + width + "x" + height);
      if (width === 1e3 || width === 1920 || !ok) await screenshot(name + "-" + width + "x" + height);
    }
    console.log("LAYOUT", name, report.layouts.filter((x) => x.name === name).map((x) => [x.viewport.width, x.ok]));
    await page.setViewportSize({ width: 1366, height: 768 });
  };
  const leave = async () => {
    await page.getByRole("button", { name: /^暂停/ }).click();
    await page.getByRole("button", { name: /^退出游戏/ }).click();
    await page.getByRole("dialog", { name: "\u79BB\u5F00\u5F53\u524D\u5BF9\u5C40", exact: true }).getByRole("button", { name: "\u79BB\u5F00", exact: true }).click();
    await page.locator(".app[data-page=menu]").waitFor();
  };
  try {
    app = await electron.launch({ args: [path.join(root, "game/desktop/tests-online/smoke-main.cjs")], env });
    report.electron_pid = app.process().pid;
    page = await app.firstWindow();
    page.setDefaultTimeout(12e3);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    report.displays = await app.evaluate(({ screen }) => screen.getAllDisplays().map((d) => ({ bounds: d.bounds, workArea: d.workArea, scaleFactor: d.scaleFactor, size: d.size, internal: d.internal, label: d.label })));
    if (await page.getByRole("button", { name: "\u8DF3\u8FC7\u5F00\u573A", exact: true }).isVisible()) await page.getByRole("button", { name: "\u8DF3\u8FC7\u5F00\u573A", exact: true }).click();
    await states("title-primary", ".welcome-title .welcome-action");
    report.title = await sample(page.locator(".welcome-title h1"));
    await screenshot("title");
    report.nativeWindow = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds());
    await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("fullscreen entry timeout")), 5e3);
        w.once("enter-full-screen", () => {
          clearTimeout(timer);
          resolve();
        });
        w.setFullScreen(true);
      });
    });
    await page.waitForTimeout(400);
    report.nativeFullscreen = { viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })), window: await app.evaluate(({ BrowserWindow }) => ({ bounds: BrowserWindow.getAllWindows()[0].getContentBounds(), fullscreen: BrowserWindow.getAllWindows()[0].isFullScreen() })) };
    await screenshot("native-fullscreen-title");
    await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("fullscreen exit timeout")), 5e3);
        w.once("leave-full-screen", () => {
          clearTimeout(timer);
          resolve();
        });
        w.setFullScreen(false);
      });
    });
    await page.getByRole("button", { name: "\u8FDB\u5165\u724C\u5385", exact: true }).click();
    await page.getByRole("textbox", { name: "\u6635\u79F0", exact: true }).fill("\u6837\u5F0F\u57FA\u7EBF");
    await page.getByRole("button", { name: "\u786E\u8BA4\u540D\u5B57", exact: true }).click();
    await page.getByRole("button", { name: "\u8FDB\u5165\u4E3B\u83DC\u5355", exact: true }).click();
    await page.locator(".app[data-page=menu]").waitFor();
    report.viewport = await page.evaluate(() => ({ innerWidth, innerHeight, devicePixelRatio }));
    await states("menu-primary", ".menu-option-primary");
    await screenshot("menu");
    await layouts("menu", ".menu-rail button,.menu-preview");
    const cdp = await page.context().newCDPSession(page);
    report.simulatedDpr = [];
    for (const dpr of [1, 2]) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: dpr, mobile: false });
      report.simulatedDpr.push(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })));
      await screenshot("menu-simulated-dpr-" + dpr);
    }
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.detach();
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole("button", { name: /^退出(?:\s+Q)?$/ }).click();
    await page.getByRole("dialog").waitFor();
    await states("danger-confirm", "dialog .danger");
    report.dialog = await sample(page.locator("dialog"));
    await screenshot("dialog");
    await layouts("dialog", "dialog .dialog-close,dialog button.danger");
    await page.getByRole("button", { name: "\u5173\u95ED\u5F39\u7A97", exact: true }).click();
    await page.getByRole("button", { name: /^设置(?:\s+S)?$/ }).click();
    await states("settings-input", ".settings-range input");
    await states("settings-save", ".settings-save");
    await page.getByRole("button", { name: "\u4FDD\u5B58\u5E76\u5173\u95ED", exact: true }).click();
    await page.locator(".app[data-page=menu]").waitFor();
    await page.getByRole("button", { name: /^单人对局/ }).click();
    await states("prepare-start", ".prepare-start");
    await screenshot("prepare");
    await layouts("prepare", ".prepare-start,.prepare-back,.prepare-config button,.difficulty-selector button");
    await page.getByRole("button", { name: /开始对局/ }).click();
    await page.locator(".match-intro").waitFor();
    await page.locator(".cinematic-skip").click();
    await page.locator(".battle-table[data-ready=true]").waitFor();
    await layouts("battle-two-selecting", ".battle-hud-button,.battle-cards .card-pick,.battle-actions button", { cards: 33, seats: 2 });
    await page.locator("[data-entry=Cloud] .card-pick").click();
    await page.locator(".battle-actions button").click();
    await page.locator(".battle-table[data-phase=revealed]").waitFor();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "\u51BB\u7ED3", exact: true }).click();
    await layouts("battle-two-reveal-frozen", ".battle-hud-button", { seats: 2, seatGeometry: true });
    await leave();
    await page.getByRole("button", { name: /^经典规则手册/ }).click();
    await page.locator(".archive-screen").waitFor();
    await layouts("archive", ".archive-heading button,.archive-search input");
    await page.getByRole("button", { name: "\u5B8C\u6574\u89C4\u5219", exact: true }).click();
    await page.locator(".archive-dialog").waitFor();
    await layouts("archive-dialog", ".archive-dialog .dialog-close");
    report.archiveDialogScroll = await page.locator(".archive-dialog-scroll").evaluate((n) => {
      n.scrollTop = n.scrollHeight;
      return { client: n.clientHeight, scroll: n.scrollHeight, position: n.scrollTop, overflow: getComputedStyle(n).overflowY };
    });
    assert.ok(report.archiveDialogScroll.position > 0, "archive dialog can scroll");
    await page.getByRole("button", { name: "\u5173\u95ED\u5F39\u7A97", exact: true }).click();
    await page.getByRole("button", { name: "\u65B0\u624B\u5B9E\u6218", exact: true }).click();
    await page.locator(".battle-table[data-tutorial=true][data-ready=true]").waitFor();
    await layouts("tutorial", ".tutorial-coach,.battle-cards .card-pick,.battle-actions button", { cards: 3, seats: 2 });
    await leave();
    await page.getByRole("button", { name: /^好友联机/ }).click();
    await page.getByText("\u5DF2\u8FDE\u63A5", { exact: true }).waitFor();
    await states("online-return", ".online-portal-nav .settings-back");
    await states("online-create-entry", ".online-front-actions .menu-option-primary");
    await screenshot("online-front");
    await layouts("online-front", ".online-portal-nav button,.online-front-actions button");
    await page.getByRole("button", { name: "\u521B\u5EFA\u623F\u95F4", exact: true }).click();
    await states("online-create-submit", ".online-deploy-submit");
    await screenshot("online-create");
    await layouts("online-create", ".online-portal-nav button,.online-deploy input,.online-deploy button");
    await page.getByRole("button", { name: "\u8FD4\u56DE\u8054\u673A\u524D\u5385", exact: true }).click();
    await page.getByRole("button", { name: "\u8FD4\u56DE\u4E3B\u83DC\u5355", exact: true }).click();
    await page.getByRole("button", { name: "\u5F00\u53D1\u9884\u89C8", exact: true }).click();
    await page.getByRole("button", { name: /^P07 · 初始/ }).click();
    await page.locator(".battle-table[data-ready=true]").waitFor();
    await states("hud-pause", ".battle-hud-button");
    await screenshot("battle");
    await layouts("battle-six-selecting", ".battle-hud-button,.battle-cards .card-pick,.battle-actions button", { cards: 33, seats: 6 });
    await leave();
    await page.getByRole("button", { name: /^设置(?:\s+S)?$/ }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const cdpPreferences = await page.context().newCDPSession(page);
    await cdpPreferences.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-reduced-transparency", value: "reduce" }] });
    report.preferences = await page.evaluate(() => ({ motion: matchMedia("(prefers-reduced-motion: reduce)").matches, transparency: matchMedia("(prefers-reduced-transparency: reduce)").matches, sceneTransition: getComputedStyle(document.querySelector(".scene-plane")).transitionDuration, contentBackdrop: getComputedStyle(document.querySelector(".settings-content")).backdropFilter, contentBackground: getComputedStyle(document.querySelector(".settings-content")).backgroundColor }));
    assert.equal(report.preferences.motion, true);
    assert.equal(report.preferences.transparency, true);
    assert.equal(report.preferences.sceneTransition, "0s");
    assert.equal(report.preferences.contentBackdrop, "none");
    assert.equal(report.preferences.contentBackground, "rgb(11, 20, 29)");
    await screenshot("reduced-preferences-settings");
    await cdpPreferences.send("Emulation.setEmulatedMedia", { features: [] });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await cdpPreferences.detach();
    await page.locator(".settings-heading .settings-back").click();
    await page.getByRole("button", { name: /^好友联机/ }).click();
    await page.getByText("\u5DF2\u8FDE\u63A5", { exact: true }).waitFor();
    await page.getByRole("button", { name: "\u521B\u5EFA\u623F\u95F4", exact: true }).click();
    await page.locator(".online-deploy-submit").click();
    await page.locator(".online-lobby").waitFor();
    await app.evaluate(() => {
      const ctl = global.__onlineTest;
      ctl.view = global.__onlineSamples.snapshot("revealing", String(BigInt(ctl.view.seq) + 1n));
      ctl.socket.message(ctl.view);
    });
    await page.locator(".battle-table[data-mode=online][data-phase=revealed][data-ready=true]").waitFor();
    await layouts("battle-six-reveal-mock", ".battle-hud-button", { seats: 6, seatGeometry: true });
    assert.deepEqual(report.failures, [], "all bounded layout cases fit");
    report.status = "PASS";
  } catch (error) {
    report.status = "FAIL";
    report.error = String(error);
    if (page) await screenshot("failure").catch(() => {
    });
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, "computed.json"), JSON.stringify(report, null, 2) + "\n");
    if (app) {
      await app.evaluate(({ app: app2 }) => app2.exit(0)).catch(() => {
      });
      await app.close().catch(() => {
      });
    }
    fs.rmSync(profile, { recursive: true, force: true });
    fs.writeFileSync(path.join(out, "computed.json"), JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify({ status: report.status, elements: Object.keys(report.elements), viewport: report.viewport, displays: report.displays }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
