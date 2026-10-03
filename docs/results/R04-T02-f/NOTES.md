# R04-T02-f · 欢迎可靠性与性能基线

远端交付状态：**本机候选已交付，待源码验收**。以下为执行者检查记录，保留原检查输入／失败／未验事项；完整来源、集成提交和最终 head 的对应关系见 [VERSIONS.md](../R04-T02/VERSIONS.md)。本报告中的“未推送”指初轮记录时，后续由集成分支统一交付。

输入产品：`88185af2c9372b2f1d88707218cafee590b94018`；本工作区 `codex/r04-t02-f-performance`。本次只新增诊断/取样脚本，未优化生产源码、改规则或服务器计时。使用 VEW，未调用 Kimi。

## 条件与预算

Apple M2 / 8 CPU 核 / 16 GB，macOS，外接 MateStation X 主屏，系统报告 2304×1536 CSS / 4608×3072 物理像素、60 Hz、原生 DPR2。Electron 44.3.0，源构建，隔离临时档案，正式 `main.cjs`/真实视频；原欢迎 smoke 使用已有 seeded worker 启动器，媒体仍是真实本地白名单。DPR1 使用 CDP 仿真，不是另一块物理屏幕。启动前没有正在运行的用户 Electron/dev 窗口；其他代理仅做非 GUI 工作，系统仍是共享桌面，未锁定系统负载。预算以 16.7ms/帧、>50ms 记停顿为诊断阈值，不把一次取样写成发行验收。

新进程首次跳过按钮可操作：首次原生样本 980ms，DPR1 1486ms，原生复测 1741ms；均未清除操作系统磁盘缓存。RAF 是 renderer 回调间隔，不是 GPU 呈现时间。CPU/RSS 来自 Electron `app.getAppMetrics`；GPU 进程 CPU/RSS 可得，GPU 利用率、显存和呈现帧时间不可得。

## 同机取样

原生复测（2026-10-03，开始 UTC 2026-10-03T04:32:13.908Z），单位 ms。样本量、RAF 分位数与逐进程 CPU、RSS 在 JSON 中。原 solo 脚本将帧数组覆盖为帧数，未保存逐帧时间戳；真实房间脚本另保存原始 RAF。

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


## D/E 集成后最终复测

结论：原欢迎 52 项通过；1920 图鉴滚动长帧仍可复现，未定位原因；本次持续原生焦点下的短真实 2 人揭晓没有复现先前严重停顿。未改变任何生产代码，不宣称性能已改善或历史异常已修复。使用 VEW，未调用 Kimi。

四次运行启动输入均为 E clean `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`：欢迎 UTC `2026-10-03T06:27:07.249Z`；native `06:28:06.366Z`；DPR1 `06:29:53.746Z`；真实 2 人 `06:30:57.043Z`。E 有独立 node_modules；Electron 仍为 44.3.0。测试结束后 E 的后续提交仅为交付报告，未改本次生产输入。所有媒体和 UI 来自真实源构建；正常视频未用模拟替代。

实际 main/preload/白名单/build renderer/build CSS/视频/既有诊断脚本的 SHA256 在各份 input 中。最终文件哈希映射以 key 排序、紧凑 JSON UTF-8 编码后 SHA256 为 `ee90d427acfd33c677f55146add8a3761755fc1a22cc6fa292568fcafb06b5b7`。其中 renderer=`c6e863200c7c15cbd2f6d047a4c3916dd49e4da1c0299942f55ac1a4e58f87d2`；style=`28a43d585b1f741bcb03a6ab2a02543dc79e2b0fa15f4893e26ee9d6cacff16f`；welcome=`530cd5bebdb0a86dcb07eeb756b654c9d5b3604c1f50ccf1e7980aa505b2b921`；视频=`903aac82723b9974887c2cc8603017cd44f11481907d43ab8f832133c393730f`。

### 可比的同协议对照

同一 M2/16GB/外接 60Hz 显示器，普通 main、单独临时档案、默认 backgroundThrottling、无其他自有 GUI/构建任务争用。baseline 为上文 `native-repeat`，产品 HEAD `88185af2c9372b2f1d88707218cafee590b94018`，仅两个诊断脚本 dirty；其实际文件哈希映射 SHA256 为 `b6d0432f72f39f5a115f55400615bc4ca8a5096b840e62acd32d8d8424227918`。使用相同滚动区、8 次 wheel 和同一场景等待协议。系统后台负载不锁定；每次仅一轮，不计算改善百分比或显著性。单位 ms，N 为 RAF 回调数，p50/p95/p99 为回调间隔而非 GPU 呈现时间。

|场景|CSS/DPR|N 前→后|前 p50/p95/p99|前 >50|后 p50/p95/p99|后 >50|
|---|---|---:|---|---:|---|---:|
|first-normal-video|1366×768/2|411→410|16.7/17.6/17.7|0|16.7/18.6/18.6|0|
|normal-replay-1|1366×768/2|412→412|16.7/17.6/17.7|0|16.7/18.5/18.6|0|
|normal-replay-2|1366×768/2|413→414|16.7/17.6/17.7|0|16.7/18.5/18.7|0|
|replay-then-skip|1366×768/2|41→41|16.7/17.6/17.7|0|16.6/18.6/18.6|0|
|unknown-media-fallback|1366×768/2|4→4|16.7/16.7/16.7|0|16.6/16.6/16.6|0|
|name-flip|1366×768/2|145→201|16.7/17.6/17.6|0|16.7/18.5/18.6|0|
|welcome-hall-handoff|1366×768/2|212→214|16.7/17.6/17.7|0|16.7/18.5/18.6|0|
|menu-idle-1366|1366×768/2|180→181|16.7/17.6/17.7|0|16.7/18.6/18.7|0|
|welcome-return-1366|1366×768/2|80→80|16.7/17.5/17.6|0|16.7/18.5/18.7|0|
|menu-idle-1920|1920×1080/2|180→180|16.7/17.6/17.7|0|16.7/18.5/18.7|0|
|welcome-return-1920|1920×1080/2|77→77|16.7/33.4/50.1|1|16.7/31.6/35.0|0|
|manual-stack-scroll|1920×1080/2|31→30|17.4/234.3/265.9|8|33.4/251.3/268.6|9|
|manual-detail-scroll|1920×1080/2|69→65|16.7/100.9/233.4|7|16.7/133.4/200.0|5|
|native-fullscreen-menu|2304×1536/2|180→180|16.7/17.6/17.7|0|16.7/18.5/18.7|0|

DPR1 仅为同机 CDP 仿真对照，不是物理显示器验收：1920 welcome-return 前 p95/p99=32.5/33.4、0 次 >50，后 33.3/34.5、0；stack 前 233.7/250.1、11，后 249.2/250.0、11；detail 前 116.8/182.5、7，后 116.7/266.2、6。最终 DPR1 的 1920 idle 和恢复原生 DPR2 的 fullscreen 各有 1 次 >50ms；保留原值。新进程首次跳过按钮可操作 native 997ms/DPR1 1167ms；没有清 OS 缓存，不能当作冷磁盘启动优化。

最终 native stack 取样 2.471s：renderer 累计 CPU +0.379s/RSS 246.9MiB，GPU 进程 CPU +0.881s/RSS161.3MiB；detail 1.934s：renderer +0.234s/RSS239.6MiB，GPU +0.856s/RSS155.6MiB。stack JS profile 2.515s 中 idle2316ms/program179ms/onScroll4.2ms；DPR1 idle2161ms/program155ms/onScroll7.0ms。未出现可据以修改 React 或滚动控制逻辑的明确热点；GPU 进程 CPU 不等于 GPU 利用率。重播两次总 RSS native731→715MiB、DPR1 717→727MiB，样本短，均不能证明或排除长期泄漏。

### 欢迎可靠性与暂停实际行为

`smoke-entry.cjs` 原 52 断言 exit0，page errors=0，finally diagnostics 保存最终 route/styles/pseudo/animations/media。正常开场、两次自然重播、跳过、未知媒体回退都完成。历史人物入场偶发失败本次仍未复现；原注入拒绝媒体的失败与截图原样保留，不以这次成功消除历史失败。仍只测新 main 进程，没有旧热更新窗口样本。

暂停/冻结时 `showcase-swap`、`tutorial-guide` CSSAnimation 为 paused；伪元素和 transition 另行检查。暂停后 `battle-table::after` opacity 和 battle-operation filter/transform 仍继续；冻结前 `battle-arena::after` 的 backdrop-filter transition 运行，500ms 后结束。front-stage 的 menu-world/aura/particles/atmosphere 持续动画继续计时。它们不是全部暂停语义，也没有被此次 profile 证明是滚动长帧原因。暂停仍是本地前端轮询/操作状态，不等于冻结 runtime 时钟；联机菜单不暂停服务时钟。

### 原真实 6/2 人样本与一次有界核查

保留 E `.local-outputs/r04-t02/real-gui/gui.json` 原件，SHA `725ec1f1186e63673563a3a7d7e1409f28ea0756`、真实 loopback、普通 main、backgroundThrottling=false、1366×768 DPR2。6 人 3 个 Electron 窗口：revealed185帧，p50/p95/p99=17.2/66.8/116.2ms，12 次 >50。房主进程失联后 2 人样本：49帧，83.2/250.6/317.4ms，46 次 >50。6/2 的总 RAF 跨度为5.318/6.451s，renderer CPU增0.986/1.062s、RSS188.6→240.2/195.2→221.5MiB；这些进程指标不足以定位长帧。无 pre-D 同场真实基线，不能写 D 使性能变差。原 submit 步骤 document.hasFocus=true，但未持续记录揭晓期 native focus/可见性/遮挡。

F ignored wrapper 仅建一个新房间，两个参战加一个观战、三个普通 Electron；测试房主进程 SIGKILL 后保留玩家/观战窗口，真实 Def/自动 Charge 的5秒揭晓取一次。显式 app.focus/window.focus；native content1366×768、原生DPR2、窗口可见未最小化、native focus before/after=true，期间 native 无 blur；499 条完整流程 RAF 都 document.hasFocus=true/visibility=visible。5秒 revealed300帧，p50/p95/p99=16.7/18.3/18.7ms、0 次 >50。此样本有 profiler/trace 开销且为 fresh 房间；原725样本经历多场与服务重建，不能算优化百分比、证明原异常消失、或归因为 focus。

renderer CPU profile 8.911s/7253采样：idle7053ms、program1541ms，单个应用函数没有突出消耗。约41MiB trace有243314事件；renderer 主线程完整 RunTask 最大11.14ms、0 次 >50，Layout最大2.29ms、Paint最大1.05ms。只做此有界摘要，嵌套事件时长不相加当作独占CPU；平稳样本不能解释未捕获的旧停顿，原因仍未定位。本次 renderer CPU增1.821s/RSS232.7→279.7MiB，GPU进程CPU增1.726s/RSS174.3→153.9MiB；不提供显存/利用率/GPU FPS。

揭晓留证：玩家 role=player/participation=active，`.battle-status` 为“第 1 回合／擂台结算”，`.spectating` 为“本拍已揭晓，等待下一拍”，没有“已淘汰”；观战端 role=spectator/participation=spectating，明确“你正在观战”。两端 state.match.turn_id、last_turn.turn_id 同为 `cd5e4376-7f5f-4e01-a9cf-2f22ac6ad777:g1:t1`，core ledger game_id 为对应 g1、turn_index=1，public_state也是g1/1；此标题对应当前 ledger 拍，不指下一拍。

这是完成的诊断样本，不新增一套功能 PASS。wrapper 原始取样版本 SHA256=`32148c2ee7bf5056299dae01957f1f7dd1d288fbd68d2a3e7edf14633a7ce03e`，保留为 `two-player-probe.sampled.cjs`。清理遇到 ordinary main before-quit 对 active online 拦截：先 SIGTERM，仅观战进程正常 exit0；随后核实父 PID 和路径，对残留玩家进程 SIGKILL，driver继续finally保存JSON；启动器当时仅保存stdout而漏存session ID，driver系统退出码未记录，不当作套件exit0。最终 host50405=测试SIGKILL、guest50428=清理SIGKILL、viewer50448=exit0、service50404=exit0；临时 profile删除，ps核对自有 Electron/server残留0。后续 ignored wrapper 改成 app.exit(0) 清理，未重采/覆盖此样本；不称本次全部干净exit0。

### 证据、未验与交付边界

新原件仅位于 F `.local-outputs/final-performance/`：entry52/diagnostics/截图，native和dpr1 performance.json/CPU profile，真实two-player evidence.json/原始逐帧RAF/CPU profile/trace/analysis/截图、实际采样wrapper及日志。旧 `.local-outputs/performance-baseline/` 和 E 真实房间原件未覆盖。生产源码未修改，没有全面memo/cache、效果关闭、规则/依赖/计时改动；最终提交仅此文档。

专用物理3840×2160或跨屏/系统缩放、Windows、跨设备、公网正式CA部署、GPU显存/利用率/实际呈现帧、长期泄漏、旧热更新main、历史人物失败均未验。真实 E13 和TLS28功能证据由根代理保留，本 F 样本不替代它们，也不晋升为发布验收。worktree `.worktrees/r04-t02-f` 保留，ignored证据未归档；未push/merge/release，未调用Kimi。


## PR #34 · R34-03 故障留证（2026-10-03）

最新源码产品3006f0a42bece4d702c5a7ba48af9d0d0fafbfc8。segment在finally停止RAF、保存部分frameTimestamps／frameCount及原异常，后续指标／清理失败单列；正常关闭先走有界close/before-quit，强杀不能记正常PASS。读回失败另尽力有界回写FAIL；该路径的实际finally自检保留首错，最终文件FAIL。旧样本没有原始帧时间戳，不补造数据；frameSummary数字frames契约保留。

普通main／真实WorkerPort tutorial已selecting/live后，clean3006独占GUI分别注入throw及150ms locator timeout：driver实际均exit1（预期）；9／18个部分帧、原Error／TimeoutError、active=false及读回重算一致。新完整帧样本见远端[CHECKS.json](../R04-T02/R34-evidence/CHECKS.json)，本机原件在E .local-outputs/r34-03-f/{throw,timeout}/performance.json及verification.json。

throw首次可操作1473ms、1366×768原生DPR2，在CDP override前记录；其后失败段DPR1。timeout首次926ms、原生DPR2，失败段也为原生DPR2。未清OS缓存，不是冷磁盘启动、性能基线或GPU呈现帧时间。

Electron93440／93546普通close正常exit0、signal=null、forced=false；真实worker93457／93560及全部自有后代OS PID不存在，临时profile删除，driver无强杀。worker自身退出码接口未暴露，不写为exit0。原异常优先，新的清理VM／读回自检及相关51项通过；旧读回PASS反例、首次自检匹配错误与普通修正提交保留。

这是诊断工具可靠性修正，未优化生产渲染。1920图鉴长帧、旧两人停顿及欢迎历史偶发、物理屏幕／长期泄漏／GPU不可得指标和原强制回收记录继续保留。没有重跑旧性能矩阵、欢迎52或压力套件。[完整版本关系与命令](../R04-T02/R34-REPAIRS.md)。原0a37a89安装包不包含此轮C/D修正；未调用Kimi。
