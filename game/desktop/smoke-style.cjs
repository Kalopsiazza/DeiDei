// Isolated CSS/layout QA; online uses existing MOCK, no service acceptance.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "../.."), out = path.resolve(process.env.DEIDEI_STYLE_OUTPUT || path.join(root, ".local-outputs/R04-T02-d/style-check"));
const positiveArea = (box) => Number.isFinite(box.left) && Number.isFinite(box.top) && Number.isFinite(box.right) && Number.isFinite(box.bottom) && box.right > box.left && box.bottom > box.top;
const visibleFocus = (normal, focused) => {
  const a = normal.style, b = focused.style;
  const changedOutline = b.outlineStyle !== "none" && parseFloat(b.outlineWidth) > 0 && ["outlineStyle", "outlineWidth", "outlineColor"].some((key) => a[key] !== b[key]);
  return focused.focusVisible === true && focused.box.width > 0 && focused.box.height > 0 && (changedOutline || b.boxShadow !== "none" && b.boxShadow !== a.boxShadow || b.borderColor !== a.borderColor);
};
const layoutVerdict = (value, { cards, seats, seatGeometry = false } = {}, width, height) => {
  const parts = [...value.controls, ...(seats ? value.seatParts : [])];
  const outside = parts.filter((r) => r.left < -1 || r.top < -1 || r.right > width + 1 || r.bottom > height + 1);
  const invalidArea = parts.filter((r) => !positiveArea(r));
  const controlsPresent = value.controlGroups.length > 0 && value.controlGroups.every((group) => group.count > 0);
  const namesPresent = !cards || value.cardCount === cards && value.glyphs.length === cards && value.glyphs.every((g) => g.name.trim().length > 0);
  const seatsPresent = !seats || value.seatCount === seats && value.seatParts.length === seats * 2 && Array.from({ length: seats }, (_, index) => ["profile", "move"].every((kind) => value.seatParts.filter((part) => part.index === index && part.kind === kind).length === 1)).every(Boolean);
  const ok = value.controls.length > 0 && controlsPresent && namesPresent && seatsPresent && !invalidArea.length && !outside.length && (!seatGeometry || !value.overlaps) && value.glyphs.every((g) => g.font >= 12 && (cards !== 33 || g.font <= 16) && g.width > 0 && g.height > 0 && g.height + 0.5 >= g.inkHeight && g.nameFits) && value.scroll[0] <= width && value.scroll[1] <= height;
  return { ok, outside, invalidArea, controlsPresent, namesPresent, seatsPresent };
};
const selfCheck = () => {
  const options = { cards: 33, seats: 6, seatGeometry: true };
  const box = { left: 10, top: 10, right: 50, bottom: 30 };
  const valid = { controls: [box], controlGroups: [{ selector: "fixture", count: 1 }], glyphs: Array.from({ length: 33 }, () => ({ name: "招式", font: 14, width: 40, height: 16, inkHeight: 12, nameFits: true })), cardCount: 33, seatCount: 6, seatParts: Array.from({ length: 6 }, (_, index) => ["profile", "move"].map((kind) => ({ index, kind, ...box }))).flat(), overlaps: false, scroll: [800, 600] };
  assert.equal(layoutVerdict(valid, options, 800, 600).ok, true, "complete positive-area fixture passes");
  const cases = {
    "zero-area control": { ...valid, controls: [{ ...box, right: box.left, bottom: box.top }] },
    "33 cards without names": { ...valid, glyphs: [] },
    "6 seats without parts": { ...valid, seatParts: [] },
    "missing control category": { ...valid, controlGroups: [{ selector: "fixture", count: 0 }] },
  };
  for (const [name, value] of Object.entries(cases)) assert.equal(layoutVerdict(value, options, 800, 600).ok, false, name + " is rejected");
  const normal = { style: { outlineStyle: "none", outlineWidth: "0px", outlineColor: "rgb(1, 2, 3)", boxShadow: "rgb(0, 0, 0) 0px 12px 24px", borderColor: "rgb(4, 5, 6)" }, box: { width: 40, height: 20 }, focusVisible: false };
  assert.equal(visibleFocus(normal, { ...normal, focusVisible: true }), false, "constant decorative shadow is not focus");
  assert.equal(visibleFocus(normal, { ...normal, focusVisible: true, style: { ...normal.style, outlineStyle: "solid", outlineWidth: "3px" } }), true, "dedicated focus outline passes");
  assert.equal(visibleFocus(normal, { ...normal, focusVisible: true, style: { ...normal.style, boxShadow: "rgb(140, 234, 243) 0px 0px 0px 3px" } }), true, "focus shadow changed from default passes");
  console.log(JSON.stringify({ status: "PASS", rejected: [...Object.keys(cases), "constant decorative shadow"], positive: ["complete layout", "focus outline", "changed focus shadow"] }));
};
if (process.argv.includes("--self-check")) { selfCheck(); return; }
const { _electron: electron } = require(path.join(root, "game/desktop/node_modules/playwright-core"));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "deidei-d-style-"));
  const env = { ...process.env, DEIDEI_TEST_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.DEIDEI_ROOM_URL;
  const report = { code_sha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), dirty: execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim(), kind: "actual Electron; online MOCK; six-state attrs synthesized for CSS sampling", elements: {}, layouts: [], failures: [] };
  report.cssInputs = Object.fromEntries(["foundation", "battle", "prepare", "preferences"].map((name) => [name, require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(__dirname, "styles", name + ".css"))).digest("hex")]));
  let app, page;
  const sample = async (locator) => locator.evaluate((node) => {
    const s = getComputedStyle(node), r = node.getBoundingClientRect(), style = {};
    for (const k of ["fontSize", "fontWeight", "color", "backgroundColor", "backgroundImage", "borderColor", "outlineColor", "outlineWidth", "outlineStyle", "boxShadow", "minHeight", "minWidth", "padding", "backdropFilter", "filter", "opacity", "clipPath", "transform", "transitionDuration", "animationName", "animationIterationCount", "colorScheme"]) style[k] = s[k];
    return { style, box: { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }, focusVisible: node.matches(":focus-visible"), disabled: node.matches(":disabled"), busy: node.getAttribute("aria-busy") };
  });
  const states = async (name, selector, { semantic = false, disabledClick = false } = {}) => {
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
    if (disabledClick) {
      await l.evaluate((n) => { n.dataset.styleClicks = "0"; n.addEventListener("click", () => { n.dataset.styleClicks = String(Number(n.dataset.styleClicks) + 1); }, { once: true }); });
      const box = await l.boundingBox();
      assert.ok(box && box.width > 0 && box.height > 0, name + " has a disabled pointer target");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await l.getAttribute("data-style-clicks"), "0", name + " disabled pointer click has no action");
      await l.evaluate((n) => delete n.dataset.styleClicks);
    }
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
    report.elements[name] = { selector, source: "actual component; disabled/aria-busy attributes synthesized for CSS sampling", states: values };
    assert.equal(values.focusVisible.focusVisible, true, name + " gets keyboard focus");
    assert.ok(visibleFocus(values.default, values.focusVisible), name + " has focus feedback distinct from its decorative default");
    for (const [state, value] of Object.entries(values)) assert.ok(value.box.width > 0 && value.box.height > 0, name + " " + state + " has positive area");
    if (semantic) for (const state of ["hover", "active", "focusVisible"]) for (const key of ["color", "backgroundImage", "borderColor"]) assert.equal(values[state].style[key], values.default.style[key], name + " " + state + " retains semantic " + key);
    assert.equal(values.disabledPressed.style.transform, values.disabled.style.transform, name + " disabled pointer press cannot activate transform");
    return values;
  };
  const screenshot = async (name) => page.screenshot({ path: path.join(out, name + ".png"), scale: "css" });
  // This entry samples only the reviewed consumers; it does not rerun or replace the historical 72 layouts.
  const targeted = async () => {
    report.kind = "R34-02 targeted actual Electron components; local worker and online MOCK; synthesized disabled attrs are CSS-only";
    report.targeted = { selects: {}, pause: {}, motion: {}, nativePopupVisualAcceptance: "pending screenshot inspection" };
    await page.setViewportSize({ width: 1366, height: 768 });
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus(); });
    if (await page.getByRole("button", { name: "跳过开场", exact: true }).isVisible()) await page.getByRole("button", { name: "跳过开场", exact: true }).click();
    await page.getByRole("button", { name: "进入牌厅", exact: true }).click();
    await page.getByRole("textbox", { name: "昵称", exact: true }).fill("局部样式验收");
    await page.getByRole("button", { name: "确认名字", exact: true }).click();
    await page.getByRole("button", { name: "进入主菜单", exact: true }).click();
    await page.locator(".app[data-page=menu]").waitFor();
    const motion = async (name, selector, pseudo, count, expectedName) => {
      const capture = () => page.locator(selector).evaluateAll((nodes, pseudo) => nodes.map((node) => {
        const style = getComputedStyle(node, pseudo);
        return { name: style.animationName, iterations: style.animationIterationCount, transform: style.transform, content: style.content };
      }), pseudo);
      const values = {};
      for (const [state, preference] of [["normal", "no-preference"], ["reduced", "reduce"], ["restored", "no-preference"]]) {
        await page.emulateMedia({ reducedMotion: preference });
        values[state] = await capture();
        assert.equal(values[state].length, count, name + " has all expected parts");
        assert.ok(values[state].every((item) => item.name === (state === "reduced" ? "none" : expectedName)), name + " " + state + " animation selector applies");
        if (state !== "reduced") assert.ok(values[state].every((item) => item.iterations === "infinite"), name + " restores ordinary loop");
        await screenshot(name + "-" + state);
      }
      report.targeted.motion[name] = { source: "actual ordinary local preparation/intro", selector, pseudo, states: values };
    };
    await page.getByRole("button", { name: /^单人对局/ }).click();
    await page.locator('.prepare-signal[data-level="standard"]').waitFor();
    await motion("prepare-standard-scan", '.prepare-signal[data-level="standard"]>span', null, 3, "prepare-scan");
    await motion("prepare-orbit", ".prepare-signal>i", null, 1, "prepare-orbit");
    await page.getByRole("button", { name: /开始对局/ }).click();
    await page.locator(".match-intro .intro-versus").waitFor();
    await motion("intro-sigil", ".match-intro .intro-versus article", "::before", 2, "intro-sigil-pulse");
    await page.locator(".cinematic-skip").click();
    await page.locator(".battle-table[data-ready=true]").waitFor();
    const pause = async (name, source) => {
      await page.locator(".battle-pause").click();
      await page.locator("dialog.battle-dialog.pause-dialog").waitFor();
      await page.waitForTimeout(400);
      for (const role of ["primary", "danger"]) {
        const values = await states(name + "-" + role, ".pause-dialog button." + role, { semantic: true, disabledClick: true });
        assert.equal(values.default.style.color, role === "primary" ? "rgb(7, 16, 24)" : "rgb(255, 155, 166)", name + " " + role + " semantic default");
        report.targeted.pause[name + "-" + role] = { source, disabled: "attribute synthesized on actual button; physical pointer click generates no action" };
        await page.locator(".pause-dialog button." + role).hover();
        await page.waitForTimeout(250);
        await screenshot(name + "-" + role + "-hover");
      }
      await page.locator(".pause-dialog .primary").click();
      await page.locator(".pause-dialog").waitFor({ state: "detached" });
      await page.locator(".battle-pause").click();
      await page.locator(".pause-dialog .danger").click();
      const confirm = page.getByRole("dialog", { name: name === "local-pause" ? "离开当前对局" : "结束整个房间？", exact: true });
      await confirm.waitFor();
      assert.equal(await confirm.locator("button.primary").isEnabled(), true, name + " exit confirmation is reachable by ordinary click");
      await screenshot(name + "-exit-confirm-reachable");
      report.targeted.pause[name + "-danger"].enabledClick = "actual enabled danger click reaches exit confirmation; cancel returns to the same battle";
      await confirm.getByRole("button", { name: name === "local-pause" ? "继续对局" : "留在房间", exact: true }).click();
      await confirm.waitFor({ state: "detached" });
      await page.locator(".battle-table[data-ready=true]").waitFor();
    };
    await pause("local-pause", "ordinary local worker match");
    await leave();
    await page.getByRole("button", { name: /^好友联机/ }).click();
    await page.getByText("已连接", { exact: true }).waitFor();
    await page.getByRole("button", { name: "创建房间", exact: true }).click();
    await page.locator(".online-deploy-submit").click();
    await page.locator(".online-lobby").waitFor();
    const contrast = (text, surface) => {
      const luminance = (rgb) => {
        const channels = rgb.match(/[\d.]+/g).slice(0, 3).map((x) => Number(x) / 255).map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const a = luminance(text), b = luminance(surface);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const select = async (name) => {
      await page.getByRole("button", { name: "调整时限", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "调整之后每拍时限", exact: true }), control = dialog.getByRole("combobox", { name: "之后每拍时限", exact: true });
      await control.waitFor();
      await page.waitForTimeout(400);
      const values = { source: "actual OnlineRoom consumer; online MOCK", default: await sample(control), originalValue: await control.inputValue() };
      assert.ok(contrast(values.default.style.color, values.default.style.backgroundColor) >= 4.5, name + " closed select has readable contrast");
      await page.keyboard.press("Tab");
      await control.focus();
      values.focusVisible = await sample(control);
      assert.ok(visibleFocus(values.default, values.focusVisible), name + " keyboard select focus is distinct");
      values.displayedValue = await control.inputValue();
      // CDP events did not operate macOS's platform popup. Actual native open/key
      // acceptance is supplied by the separate real-service CUA sample.
      values.nativeKeyboardAcceptance = { status: "PENDING", reason: "DOM focus/style sampling cannot prove native popup operation or keyboard choice" };
      values.options = await control.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, text: node.textContent, color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor })));
      assert.equal(values.options.length, 6, name + " has the six advertised options");
      assert.ok(values.options.every((option) => contrast(option.color, option.background) >= 4.5), name + " option DOM styles have readable contrast");
      await screenshot(name + "-closed-focus");
      values.nativePopupScreenshot = { status: "NOT_RUN", reason: "native platform popup requires actual CUA operation and OS screenshot; option DOM colors alone are insufficient" };
      await control.evaluate((node) => { node.disabled = true; });
      values.disabled = { ...await sample(control), source: "disabled attribute synthesized for CSS-only sampling; current OnlineRoom does not disable this select" };
      const before = await control.inputValue(), box = await control.boundingBox();
      assert.ok(box && box.width > 0 && box.height > 0, name + " disabled select has positive area");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.press("ArrowDown");
      assert.equal(await control.inputValue(), before, name + " disabled select cannot change via pointer/keyboard");
      assert.ok(contrast(values.disabled.style.color, values.disabled.style.backgroundColor) >= 4.5, name + " disabled select remains readable");
      assert.notEqual(values.disabled.style.color, values.default.style.color, name + " disabled appearance is distinct");
      await screenshot(name + "-disabled");
      await control.evaluate((node) => { node.disabled = false; });
      report.targeted.selects[name] = values;
      await dialog.getByRole("button", { name: "应用到之后每拍", exact: true }).click();
      await dialog.waitFor({ state: "detached" });
      values.applied = await page.evaluate(async () => { const state = (await window.desktop.online.read()).data; return { source: state.source, phase: state.snapshot.view.phase, turn_ms: state.snapshot.view.policy.turn_ms }; });
      assert.equal(values.applied.source, "fixture", name + " evidence retains MOCK source");
      assert.equal(values.applied.turn_ms, Number(values.displayedValue), name + " ordinary apply click retains the displayed choice; native keyboard change is separately pending");
    };
    await select("lobby-limit");
    await page.getByRole("button", { name: "准备", exact: true }).click();
    await page.getByRole("button", { name: "取消准备", exact: true }).waitFor();
    await page.getByRole("button", { name: "开始对局", exact: true }).click();
    await page.locator(".online-intro").waitFor();
    await page.locator(".online-intro .cinematic-skip").click();
    await page.locator(".battle-table[data-mode=online][data-ready=true]").waitFor();
    await select("battle-limit");
    await pause("online-pause", "online MOCK transport; actual OnlineRoom pause menu");
    assert.deepEqual(report.pageErrors, [], "targeted consumers have no renderer errors");
    report.status = "PASS";
  };
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
        const controlGroups = selector2.split(",").map((part) => ({ selector: part, count: document.querySelectorAll(part).length }));
        const seatParts = seats2 ? [...document.querySelectorAll(".arena-seat")].flatMap((n, index) => [["profile", n.querySelector(".seat-profile")], ["move", n.querySelector(".move-card.current,.move-card.active")]].filter(([, node]) => node).map(([kind, n2]) => ({ index, kind, ...box(n2) }))) : [];
        const overlaps = seatParts.some((a, i) => seatParts.slice(i + 1).some((b) => a.index !== b.index && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4));
        const context = document.createElement("canvas").getContext("2d");
        const glyphs = cards2 ? [...document.querySelectorAll(".battle-cards .card-name")].map((n) => {
          const style = getComputedStyle(n), r = n.getBoundingClientRect();
          context.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
          const m = context.measureText(n.textContent), copy = n.closest("strong").getBoundingClientRect(), range = document.createRange();
          range.selectNodeContents(n);
          const text = range.getBoundingClientRect();
          return { nameFits: text.left >= copy.left - 1 && text.right <= copy.right + 1 && text.top >= copy.top - 1 && text.bottom <= copy.bottom + 1, name: n.textContent, font: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), width: r.width, height: r.height, inkHeight: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, textOverflow: style.textOverflow };
        }) : [];
        return { glyphs, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], controls, controlGroups, cardCount: cards2 ? document.querySelectorAll(".battle-cards .card").length : null, seatCount: seats2 ? document.querySelectorAll(".arena-seat").length : null, seatParts, overlaps };
      }, { selector, cards, seats });
      const verdict = layoutVerdict(value, { cards, seats, seatGeometry }, width, height), { ok } = verdict;
      report.layouts.push({ name, method: "Electron renderer content-size simulation; DPR reported separately", seatGeometry, ...verdict, ...value });
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
    report.pageErrors = [];
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.setDefaultTimeout(12e3);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    report.displays = await app.evaluate(({ screen }) => screen.getAllDisplays().map((d) => ({ bounds: d.bounds, workArea: d.workArea, scaleFactor: d.scaleFactor, size: d.size, internal: d.internal, label: d.label })));
    if (process.argv.includes("--targeted")) { await targeted(); console.log(JSON.stringify({ status: report.status, kind: report.kind, nativePopupVisualAcceptance: report.targeted.nativePopupVisualAcceptance })); return; }
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
    await layouts("prepare", ".prepare-start,.prepare-back,.prepare-time button");
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
