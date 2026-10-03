# R04-T02-f · 欢迎可靠性与性能基线

输入产品：`88185af2c9372b2f1d88707218cafee590b94018`；本工作区 `codex/r04-t02-f-performance`。本次只新增诊断/取样脚本，未优化生产源码、改规则或服务器计时。使用 VEW，未调用 Kimi。

## 条件与预算

Apple M2 / 8 CPU 核 / 16 GB，macOS，外接 MateStation X 主屏，系统报告 2304×1536 CSS / 4608×3072 物理像素、60 Hz、原生 DPR2。Electron 44.3.0，源构建，隔离临时档案，正式 `main.cjs`/真实视频；原欢迎 smoke 使用已有 seeded worker 启动器，媒体仍是真实本地白名单。DPR1 使用 CDP 仿真，不是另一块物理屏幕。启动前没有正在运行的用户 Electron/dev 窗口；其他代理仅做非 GUI 工作，系统仍是共享桌面，未锁定系统负载。预算以 16.7ms/帧、>50ms 记停顿为诊断阈值，不把一次取样写成发行验收。

新进程首次跳过按钮可操作：首次原生样本 980ms，DPR1 1486ms，原生复测 1741ms；均未清除操作系统磁盘缓存。RAF 是 renderer 回调间隔，不是 GPU 呈现时间。CPU/RSS 来自 Electron `app.getAppMetrics`；GPU 进程 CPU/RSS 可得，GPU 利用率、显存和呈现帧时间不可得。

## 同机取样

原生复测（2026-10-03，开始 UTC 2026-10-03T04:32:13.908Z），单位 ms。样本量/原始 RAF 时间戳与逐进程 CPU、RSS 在 JSON 中。

|场景|CSS/DPR|p50|p95|p99|>50ms|
|---|---|---:|---:|---:|---:|
|first-normal-video|1366×768/2|16.7|17.6|17.7|0|
|normal-replay-1|1366×768/2|16.7|17.6|17.7|0|
|normal-replay-2|1366×768/2|16.7|17.6|17.7|0|
|replay-then-skip|1366×768/2|16.7|17.6|17.7|0|
|unknown-media-fallback|1366×768/2|16.7|16.7|16.7|0|
|name-flip|1366×768/2|16.7|17.6|17.6|0|
|welcome-hall-handoff|1366×768/2|16.7|17.6|17.7|0|
|menu-idle-1366|1366×768/2|16.7|17.6|17.7|0|
|welcome-return-1366|1366×768/2|16.7|17.5|17.6|0|
|menu-idle-1920|1920×1080/2|16.7|17.6|17.7|0|
|welcome-return-1920|1920×1080/2|16.7|33.4|50.1|1|
|manual-stack-scroll|1920×1080/2|17.4|234.3|265.9|8|
|manual-detail-scroll|1920×1080/2|16.7|100.9|233.4|7|
|native-fullscreen-menu|2304×1536/2|16.7|17.6|17.7|0|

DPR1 相同 1920×1080：欢迎往返 p95 32.5/p99 33.4、0 次 >50ms；图鉴层叠列表滚动 p95 233.7/p99 250.1、11 次；详情滚动 p95 116.8/p99 182.5、7 次。图鉴鼠标明确落在对应原生滚动区，列表具备滚动范围。最早 `native` 的单个 manual-scroll 未定位鼠标区域、第一次 `dpr1` 的大窗口仍固定仿真为1366，保留原件但不用于大窗口对照。

大窗口图鉴停顿已在 DPR1/DPR2 复现；JS CPU profile 中 `onScroll` 仅约 1.3/2.5ms，idle 约2272/2179ms、program 164/169ms，因此不能从本次证据推定 React 或计时重渲染是热点。需要渲染 trace 或 D 完成后的同条件对照再归因，当前不做全面 memo/cache 或关效果。两次原生连续重播总 RSS 715→695MiB，不支持单调资源增长或长期无泄漏结论；取样长度仅两个重播。

## 欢迎与暂停证据

- 原欢迎 smoke 保留全部52项断言，首次通过，历史人物入场偶发失败没有复现，不写已修复。正常媒体与 unknown.mp4 回退单独取样。
- 专项只在忽略目录中的临时测试 wrapper 人为拒绝 welcome 视频；原 smoke 在第18行/0项断言处超时、退出1，finally 仍保存 profile/title、人物/卡片/舞台 opacity/transform、动画 currentTime/playState、媒体 error(4)/readyState(0)/networkState(3)/currentTime(0) 和截图。它证明诊断覆盖早期失败，不等于复现历史人物入场失败。
- 新启动进程没有沿用旧热更新 main；本次无旧窗口可测。重启后媒体能播放不证明旧窗口卡顿解决。
- 本地暂停/冻结使选牌元素 CSS 动画 paused；`battle-table::after` opacity、battle-operation filter/transform 与冻结的 `battle-arena::after` backdrop-filter transition 仍继续到结束，暂停菜单/伪 backdrop 的入场动画也继续。持续 front-stage 的 world/aura/particles/atmosphere 背景动画 currentTime 继续推进；尚无它们导致停顿的 profile 证据。
- 单人只暂停前端轮询/操作，不宣称冻结运行时时钟。联机菜单不得暂停服务计时。真实2/6人揭晓的性能最终对照依赖 E，D/E 后对照待根代理安排。专用物理3840×2160、Windows、GPU显存与长期泄漏未验收。

## 复跑与保留

```sh
npm --prefix game/desktop run build
node game/desktop/smoke-performance.cjs --self-check
DEIDEI_SMOKE_OUTPUT="$PWD/.local-outputs/performance-baseline/entry-repeat" node game/desktop/smoke-entry.cjs
DEIDEI_PERF_OUTPUT="$PWD/.local-outputs/performance-baseline/native-repeat" node game/desktop/smoke-performance.cjs
DEIDEI_PERF_DPR=1 DEIDEI_PERF_OUTPUT="$PWD/.local-outputs/performance-baseline/dpr1-corrected" node game/desktop/smoke-performance.cjs
```

`DEIDEI_SMOKE_OUTPUT` 只改变测试产物位置。欢迎检查成功或失败都写 diagnostics.json；失败另存 failure.png，原始异常与断言不更改。每份输入记录 HEAD/dirty/UTC起点、main/preload/白名单/实际构建/视频/诊断脚本 SHA256（最早样本尚未加哈希，后续样本保留）。原始日志、帧数据、CPU profile、截图及注入 wrapper 均在本 worktree 忽略目录 `.local-outputs/performance-baseline/`，不上传。worktree与分支保留继续 D/E 对照，不归档。

检查：类型/构建通过；两个脚本 node --check、frameSummary 自检通过；根 python3 scripts/check.py 59项通过（保留历史预期失败1项）；欢迎原52项通过。人为媒体拒绝专项预期退出1，诊断结构/失败截图读回确认。未新增依赖。
