# R04-T03-a：恢复执行后的增量记录

2026-10-04，继续执行 [Issue #35](https://github.com/Kalopsiazza/DeiDei/issues/35) 和 [工作单](../../tasks/R04/R04-T03-a.md)。里程碑一已完成；本次已补齐真实联机动态路线、原生全屏／同 DPR 双屏往返和原生 1000×650 下限操作，但二／三仍未完成：最后原生 select Return、图鉴额外控件、在线控件后半及当前产品完整动态／欢迎／严格图鉴复验未完成。Mac 再次锁屏，在线 v6 在原生焦点检查退出，未放宽断言。以下为当前状态；后面的旧交付记录仅保留历史输入和失败。

| 版本 | 完整 SHA／范围 |
|---|---|
| 精确起点 | `1f30a2449dddbe98144b7e98e0dc0a8e76b977ca`；起点产品 `3006f0a42bece4d702c5a7ba48af9d0d0fafbfc8` |
| M1 | `af5cd5214014bf68601abd95b89e8de8873b08a6` |
| P1／P2 | `1b2b7a182e53e7f61b563638f58622893c5fa4b1`／`edbb85a664bde73bc74160f00bb38e15d5634908` |
| P3：设置装饰层不再是滚动容器 | `9b1d500b4fbd6166d6faa195b2d34e1e8d06a601` |
| P4：本人席位按真实内容定高 | `ac012f979b7351ae2100b51731842b5b765020b3` |
| P5：欢迎昵称键盘焦点 | `dc38024a91818c3e2a2ca537675549409cfca620`，当前产品 SHA |
| 最终 head | PR 正文／最终交付给完整 head；P5 后仅 QA、文档和证据。报告不自嵌自身提交 SHA。 |
| 增量 Draft PR | [#36](https://github.com/Kalopsiazza/DeiDei/pull/36)，`work/r04-t03-a-frontend-completion` → `codex/r04-t02-e-real-rooms`；base 保持精确起点 |

三个新增产品修改均是局部 CSS：设置 `.settings-layout` 的 `overflow:hidden` 改为 `clip`，对应旧记录中实际 `scrollLeft=256/167` 的装饰容器；本人席位 `height:auto` 解决真实三人最小揭晓头像超出 arena 2px，保留 bottom anchor 与实际 ResizeObserver 飞行终点；欢迎昵称补 2px `focus-visible` outline，解决真实 Tab 没有可见反馈。没有改变玩法、DD、招式编号、胜负、ledger、计时／deadline、模型、协议、TLS、CSP、sender／frame检查、资源白名单或依赖。

## 本次实际运行

运行原件根目录 R 为 `/Users/zengchongtai/develop/DeiDei/.local-outputs/r04-t03-a/`。精选可查看副本、精确输入与原件／副本 SHA256 在 [evidence](evidence/README.md) 和 [MANIFEST](evidence/MANIFEST.json)。表中 PASS 只表示相应检查完成；历史失败仍原样保留。源码与运行时指纹相同的继承范围逐项注明，未把 dirty 输入写成 clean 提交已跑。

| 原始目录 | 实际结果与边界 |
|---|---|
| `settings-unlocked-before-v1`／`settings-unlocked-keyboard-before-v1` | P2 普通 main 真实 pointer／Tab／Space 短路线。本次旧偏移未重现；旧动态记录实际水平滚动仍保留，不声称垂直失败原因已找到。 |
| `settings-unlocked-after-v1` | P2＋待提交 P3/QA，PASS 21 控件／1路线；实际四尺寸各停点 shell/content/app/body/html 滚动偏移均0，字段值保持，正常退出。 |
| `modal-contract-unlocked-v1` | 实际 SharedUI export、test-only React parent、原 main/preload/CSP；PASS 两 case。Escape 后83.6ms更新 busy 取消 closing，240ms后仍同dialog open/callback0，解锁后可再关；82.3ms替换 callback 后只调用最新callback1。trusted Escape→Enter 期间 action0，正常退出。SharedUI 与 P5逐字节相同。 |
| `online-unlocked-p3-v1` | FAIL：真实三人最小揭晓本人头像比 arena底部多2px；首错及截图保留。 |
| `online-unlocked-bottom-auto-v1` | P3＋待提交 P4/QA，普通 main＋实际 owned CLI 本机服务，同 host 6→3→4→5→2、六人观众，PASS17。N2/N6完整动态路线与严格提交飞牌终点2px容差，N3/4/5最小拥挤揭晓全部身份可读且有界；30s当拍 opening/Apply/after均selecting、deadline/accepted不变，后拍20s；真实结果→返厅→退出。普通host/viewer/service exit0、profile删除。renderer/style/main 与当前P5相同，welcome.css旧版。 |
| `controls-{front,settings,recover,local,archive,tutorial}-unlocked-*` | 六批原 App PASS：分别88/141/55/167/141/50条 controls，2/3/2/4/1/4条 business。真实hover/down/Tab，原生和document焦点、命中和面积断言；合法命名IPC迟延／失败，实际恢复／继续worker。不同class覆写、fieldsets禁用、只读焦点和NA原因见 [CONTROL-STATES](CONTROL-STATES.md)。 |
| `controls-front-unlocked-v1` | FAIL欢迎nickname真实Tab缺反馈；P5单行修复后v2 PASS。archive-v1只采INPUT遗漏实际focus-within owner，local-v1只采ARTICLE遗漏真实avatar/tooltip反馈，settings-v1在menu背景取样；这些驱动失败保留，不称产品bug。 |
| `controls-online-unlocked-v5` | 整体FAIL：原生popup marker180s超时。35条状态已采到大厅select，真实SERVER_RESTART／retry／connecting、create/join字段锁、两类容量满禁止IPC0、释放和role pending均有部分有效证据。CUA实际Up高亮20，Mac随后锁屏，未Return接受，不能写原生选值PASS。 |
| `controls-online-nohold-v6` | FAIL，checks0：锁屏时原生focus required，正常owned清理。后半ready/start/Apply/HUD/结果/leave仍待运行。 |
| `native-unlocked-p4-v1` | 原生CUA宽1366→1000、跨到内屏后高768→650、全屏一进一退、双屏往返；`native-builtin-selected.png`实际1000×650/DPR2。整体FAIL：自动录像停止前 app.close6500ms超时、main被强制回收，录像后完成；不重标正常退出。其他名含minimum图片实际1000×768。 |
| `native-explicit-p5-v1` | P5普通main PASS7：实际全屏进退、两屏往返、保留Charge、Tab聚焦Cloud／Space选Cloud；213 hold samples全部聚焦可见、非最小化。3次边缘拖动没有缩到下限，因此下限证据仍引用P4。公开screencast stop38.600s后普通app.close1.190s/exit0/no force，owned Electron/worker/recorder全退出，profile删除。 |
| `archive-unlocked-6eb652d-v1` | P2解锁严格1920×1080/DPR2、两区各8wheel、普通main，PASS；list p95/max/>50为32.5/49.0/0，detail17.5/17.6/0。独立焦点采样list首点未配对，CPU负timeDelta不能算利用率。最终P5同协议复验仍待运行。 |
| `checks-p5-unlocked-v1` | P5 build exit0；Node76/76、fail0/skip0；Python67语法文件、59测试、既有expected failure1、exit0；四组取样／清理／反例guards exit0。没有把这些非GUI检查当动态接受。 |

## 原生录像与性能限制

[15秒全屏／入场短片](evidence/native-fullscreen-entry.renderer.mp4) 是P4连续源41–56s；[25.040秒尺寸／跨屏三段剪辑](evidence/native-size-display-selection.renderer.montage.mp4) 来自60–64.5、214.5–219、246.5–262.5s，明确 THREE-CUT。两片为 renderer 内容、固定1920×1080/25fps/H.264、无音轨，灰边不等于窗口尺寸。原生frame、display与操作范围须结合 [P4原始状态副本](evidence/native-p4-failure.json)；原运行整体FAIL仍保留。末帧实际显示已选「攒」，不是已选云。当前P5原生正常退出与选择保持见 [独立记录](evidence/native-explicit-p5.json)，其完整webm原件12,647,496 B／SHA256 `116824269d75efaf97731720ea994f3c62cbeec9a7f5ea63d07f9204ce8eda97`保留在R。

真实复用两人的短调查仍是同一host、此前6/3/4/5人历史。首段含resize，66.7/115.5ms、>50ms15次不能当steady。第二段固定1366×768/DPR2，389条phase RAF和388条独立focus RAF全部聚焦可见且native无blur，profile p95/max34.1/83.4ms、>50ms7；揭晓超过1s的239间隔为18.2/18.6ms、>50ms0。本次没有复现旧200–267ms峰值和持续晚揭晓停顿，按工作单保留“本轮未复现”，不无限重跑。恢复选卡51–83ms间隔仍记录，后四次已在filter插值结束后，不能称filter唯一根因或全部性能PASS。CPU有315负timeDelta，trace无buffer-loss，原件／哈希与事件窗保留；不从负CPU数据构造React占比。

历史严格图鉴 before→after list p95/max/>50 265.8/266.6/12→17.7/33.4/0，detail250.6/266.8/6→17.5/17.6/0。P2解锁复验另有上表有效结果；当前P5完整CSS不同，最终严格复验不能由旧结果代替。

## 当前待完成与交接

Mac解锁后按唯一GUI操作者顺序：`smoke-control-states.cjs --batch=archive-extra`／`--batch=loading`、`smoke-online-dynamic.cjs --control-states-only --control-native-hold`（原生Up→Return另用CUA）、完整`smoke-dynamic.cjs`、`smoke-welcome-native.cjs`同PID watcher调查、`smoke-archive-performance.cjs <绝对desktop路径>`严格两区复验。每次新OUT、不覆写旧失败、不改变服务deadline、不把marker当接受。退出补测驱动已改为按实际modal卸载生命周期检查大厅禁用按钮；代码静态检查不代替该后半实际运行。

现有内外屏均DPR2：外屏逻辑2304×1536，内屏1710×1112。不同DPR屏／物理4K和系统缩放组合、Windows图形host、干净机器/账户、初次玩家真人教程、新包/系统信任/物理断网/第二电脑公网TLS仍缺具体条件，按下方操作清单由Teddy安排；本机合成peer不是跨设备真人，3840×2160截图不是物理4K。旧ZIP `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`不含本轮代码，未打新包、部署、merge、tag或release。远端CI按最终head回读，0项记NOT_RUN。

任务worktree `/Users/zengchongtai/develop/DeiDei/.worktrees/r04-t03-a`保持活动；R保留所有原FAIL、日志、CPU/trace及录像。2026-10-04复核原21个worktree的HEAD/完整status与初次快照一致，主目录HEAD `c9b79e2e2e5b22071feb7d10a64634806b67aeb0`且status为空；`.local-archive`未启用，未删/迁移旧目录。共享git info/exclude排除worktrees/outputs/archive；桌面构建和stage打包使用明确文件集合，未扩展依赖。Kimi继续暂停，未调用；本地审查使用code-review；发现completion证据写盘失败会跳过退出清理，已保证两次写盘错误仍执行owned close/profile删除，`--self-check`使用实际finally代码的两种EACCES注入均PASS；这不改变产品main。第二轮须ChatGPT增量复核＋Teddy真实体验/外部安排确认，当前不自行进入。

---

## 历史记录与外部接受步骤

[前次完整报告](https://github.com/Kalopsiazza/DeiDei/blob/6eb652d088ffdf1f9e047bb14b9d48acf5037885/docs/results/R04-T03-a/REPORT.md) 保持历史属性；所有前次失败 JSON 和原件仍在原目录／MANIFEST，不改状态。每次执行从明确完整 SHA 和实际 build 指纹开始，MOCK、真实 worker、本机服务与物理过程分开。

| 缺少的具体条件 | 执行及接受点 |
|---|---|
| 不同DPR屏／物理4K／系统缩放组合 | 记录显示器native像素、DPR、系统缩放、native content及inner size；菜单／牌桌跨屏往返、Tab/选牌保持、完整resize与提交飞行终点，保留实际原生短录像。当前两屏均DPR2，截图尺寸不代替设备。 |
| Windows图形host、干净机器／账户、初次玩家真人 | 用本轮同SHA构建或独立获准新包；欢迎→建档→真实教程→普通单人／两人房。记录安装信任、首次规则理解、实际操作/文字/失败；Teddy安排人员，AI/合成peer不替代。 |
| 新包／系统信任／物理断网／跨设备公网TLS | 产品封板后独立授权同SHA打包／成包GUI／资源白名单与信任；第二电脑／公网服务和证书、真实断网→恢复→再入场，核ACK、deadline与揭晓前保密。旧ZIP不可用于新代码接受。 |
| 后续能力 | 单人AI强度／时限、多身份、音源等保留另行开发，不借遗留核对新增产品能力。 |
| 第二轮 | ChatGPT增量代码/证据复核，Teddy真实体验和上述安排确认后，从最后确认完整产品SHA开始；当前不自行进入。 |
