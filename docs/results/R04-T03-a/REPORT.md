# R04-T03-a：本机执行与增量交付完成

2026-10-04，执行 [Issue #35](https://github.com/Kalopsiazza/DeiDei/issues/35) 和 [工作单](../../tasks/R04/R04-T03-a.md)。里程碑一、二及三的本机执行和交付已完成；第二轮仍待 ChatGPT 增量复核、Teddy 实际体验及外部条件安排确认。保留历史失败和未复现结论，不宣布所有性能、发行或跨设备验收通过。

| 输入 | 完整 SHA／范围 |
|---|---|
| 精确起点／起点产品 | `1f30a2449dddbe98144b7e98e0dc0a8e76b977ca`／`3006f0a42bece4d702c5a7ba48af9d0d0fafbfc8` |
| M1 | `af5cd5214014bf68601abd95b89e8de8873b08a6` |
| P1／P2 | `1b2b7a182e53e7f61b563638f58622893c5fa4b1`／`edbb85a664bde73bc74160f00bb38e15d5634908` |
| P3／P4 | `9b1d500b4fbd6166d6faa195b2d34e1e8d06a601`／`ac012f979b7351ae2100b51731842b5b765020b3` |
| 最终产品 P5 | `dc38024a91818c3e2a2ca537675549409cfca620` |
| 最后完整动态／在线输入 | clean `63496395b59af71998a47a1e183e509c8472865b`；P5之后仅 QA、文档、证据 |
| 最终 head | PR 正文和交付回传给完整 head；本报告不自嵌自身提交 SHA |
| 增量 Draft PR | [#36](https://github.com/Kalopsiazza/DeiDei/pull/36)，`work/r04-t03-a-frontend-completion` → `codex/r04-t02-e-real-rooms`；base 仍为精确起点 |

产品修改保持现有视觉方向：FixturePort 使用模块级唯一场次身份；SharedUI 同步关闭守卫、inert 与最新回调；布局使用共同安全边、实际 arena／独立目标 ResizeObserver；图鉴局部减轻重复滤镜／背景开销，保留文字和前景演出。P3 将设置装饰容器 overflow 改为 clip，对应旧实际 scrollLeft=256/167；P4 本人席位 height:auto 修复真实三人最小揭晓头像超出 arena 2px；P5 为欢迎昵称补 2px 键盘焦点 outline。没有改变规则、DD、招式编号、胜负、ledger、计时／deadline、模型、网络协议、TLS、CSP、sender／frame 检查、白名单或依赖。

## 实际运行及可复查输入

运行原件根目录 R=`/Users/zengchongtai/develop/DeiDei/.local-outputs/r04-t03-a/`。下表链接是远端可查看的精选副本；[MANIFEST](evidence/MANIFEST.json) 同时给原件／副本 SHA256 和未发布大文件的精确来源。不同 dirty 输入没有合并成一个 clean 提交已跑。

| 证据 | 结果与适用范围 |
|---|---|
| [M1预览／关闭14项](evidence/completion-product.json)；[SharedUI两props合同](evidence/modal-contract.json) | winner→defeat→draw→winner 与同场去重；实际 App trusted Escape→Enter、迟延成功／失败。真实 SharedUI export 下83.6ms busy翻转取消closing、82.3ms替换callback只调用最新，action0；产品相关源码与P5一致。写盘失败仍执行owned清理的两种 EACCES 注入自检亦通过。 |
| [最终完整动态](evidence/dynamic-final-p5.json) | clean6349639，PASS10路线／189条控件记录；欢迎视频／标题／昵称、菜单、设置、准备、真实worker单人、图鉴、教程、本地fixture结果。每段12步连续 native content resize，四停点；solo／archive另补宽矮、窄高、16:10、超宽，共50个停点均native/document聚焦可见。1000×650真实内容区、转场resize、三高风险减少动态／透明度、prepare伪元素及1000×560 CDP正文滚动／关闭均通过。停点焦点不是逐帧原生证明；超桌面和CDP来源明确标记，不宣称移动端／物理4K。 |
| [实际联机17项](evidence/online-unlocked.json) | 普通main＋owned CLI本机服务，同host6→3→4→5→2及六人观众；N2/N6完整动态与提交飞牌2px容差，N3/4/5最小拥挤揭晓身份有界。30s当前拍opening／Apply／after均selecting，deadline／accepted不变；新policy20s/revision+1，下一拍20s。真实结果→返厅→退出，双app／service正常0。源P3＋待提交P4/QA；renderer/style/main与P5完全相同，welcome.css旧版。 |
| [六批原App控件](CONTROL-STATES.md)；[图鉴附加](evidence/controls-archive-extra-final.json)；[initial loading](evidence/controls-loading-final.json) | 原六批88/141/55/167/141/50记录，补图鉴88／loading7；真实hover／down／Tab、业务disabled／busy、合法命名IPC迟延失败和NA原因。AE5/LD2是H989＋两QA dirty，运行产物同P5；组入口与结束有原生焦点断言，不冒充等待全程连续焦点。五类反例继续拒绝。 |
| [最终在线控件](evidence/controls-online-final.json) | clean6349639，66/66 verified、796 natural样本；11类请求busy严格断言全部满足，host结果3动作／guest review和exit／guest WAITING disabled、返厅和双方leave真实完成。最后双方Charge以同一新turn＋原公开last_turn／Charge／human核验，避免查询已进入下一拍的旧按钮；无deadline重置。原JSON applicableOnlineDOMConsumersComplete=true、controlStatesComplete=false保持，原生接受另证。 |
| [原生select接受](evidence/native-select-accepted.json)；[接受后画面](evidence/final-native-select-accepted.png)；[母运行FAIL](evidence/controls-online-v7-failure.json) | 实际CUA Up高亮20→Return，popup关闭、父dialog仍开，driver读option20000；marker仅恢复驱动。v7整体FAIL不变；该独立P5原生动作和v13 DOM控件联合关闭原生控件缺口。接受20不等于这次已应用policy20，当前拍语义由上方OU单独证明。 |
| [最终欢迎调查](evidence/welcome-final-p5.json) | clean2c5b0b896a31331d12627b471647a70d9223c8c0，PASS37／11segments：新进程、同PID重播／P01／返菜单、实际dev watcher reload；profile前后不变、document身份更新、9指纹一致，视频1920×1080自然结束6.584s，无人物／媒体／资源错误。原main由明确MOCK socket测试wrapper加载，不当真实联机接受。正常0、owned childgone／profile删除。历史人物失败本轮未复现，未宣称找到原因。 |
| [最终严格图鉴](evidence/archive-final-p5.json) | P5普通main、native1920×1080/DPR2；列表／详情各4×+500及4×−500 wheel、间隔180ms。101＋100 RAF全部有独立聚焦可见样本配对，native前后及每wheel聚焦、无blur；两区均0个>50ms，正常0／5childgone／profile删除。输入2c5＋两个QA dirty，default运行未使用native hold。 |
| [原生P5过程](evidence/native-explicit-p5.json)；[P4真实下限](evidence/native-p4-minimum.png) | P5普通main PASS7，全屏一进一退、display2→1→2、Charge保持→Tab Cloud→Space Cloud，213hold samples聚焦可见；录像stop38.600s后close1.190s正常0。P4实际CUA拖到1000×650/DPR2，outer1000×682；P4整体录像清理FAIL明确保留。当前两屏都DPR2。 |
| [最后clean构建／守卫](evidence/checks-final-qa.json)；[P5必要检查](evidence/checks-p5.json) | clean6349639 build及style/performance/archive/geometry/completion实际guard self-checks均0，产物字节与P5一致。未修改规则／服务的Node76 fail0/skip0、Python67语法／59测试／既有expectedFailure1沿用明确P5输入；没有套用旧206/207计数。远端CI0项记NOT_RUN。 |

## 性能结论与历史失败

| 同机严格1920协议 | list p95／max／>50 | detail p95／max／>50 |
|---|---|---|
| 历史有效before | 265.8／266.6ms／12 | 250.6／266.8ms／6 |
| 历史局部处理after | 17.7／33.4ms／0 | 17.5／17.6ms／0 |
| P2解锁复验 | 32.5／49.0ms／0 | 17.5／17.6ms／0 |
| 最终P5 v4 | 17.7／33.6ms／0（100间隔） | 17.6／17.7ms／0（99间隔） |

原长帧已通过局部视觉处理和同机有效对照处理，最终P5未出现同量级停顿；不从短React handler推导GPU根因。v4 CPU timeDelta有97／77条负值，只作诊断，不算利用率或React占比；detail trace processor metadata `traced_chunks_discarded=16`，虽然两buffer loss字段为0，也不写trace完整无损。详情／列表操作和焦点协议保持原8wheel，未换轻场景或关闭全部效果。

旧两人严重停顿按工作单做有限同host复用调查：此前6/3/4/5人历史，固定1366×768/DPR2；389phaseRAF／388独立focusRAF聚焦可见、native无blur，晚揭晓>1s的239间隔p95/max18.2/18.6ms、>50=0，旧200–267ms未复现。恢复选卡仍有7个51–83ms，保留未复现边界。最终欢迎调查保留同PID自然重播p95=83.5ms／max150.2ms／131个>50ms、返菜单max183.7ms及重播checkpoint的69个 droppedVideoFrames，不能把37功能检查通过写成全产品性能通过。

[完整动态v1 FAIL](evidence/dynamic-final-p5-v1-failure.json) 的图鉴1248→1314偏移保留；[正常起步诊断](evidence/archive-scroll-diagnose.json)和[最小起步诊断](evidence/archive-scroll-diagnose-minimum.json)均1248不变，未定位原66px原因。最终full v2仅给mount/wheel建立500ms实际稳定baseline，保留原strict deepEqual和全部路线，不改产品scroll、不重置位置／放宽容差；本轮该偏移未复现。在线v7–v12的已卸载按钮、异步native focus及移动目标旧坐标等收集器失败原样保留；v13原hover/active/焦点／自然busy断言不降低。[严格图鉴v2 FAIL](evidence/archive-final-p5-v2-failure.json)有hold超时／6500ms强制退出；[v3 FAIL](evidence/archive-final-p5-v3-failure.json)有实际native失焦与317.4ms partial峰值，不用无效焦点数据冒充最终有效测量。所有raw失败、first error、非零driver、正常/强制清理均在R和manifest保留。

[15秒全屏/入场片](evidence/native-fullscreen-entry.renderer.mp4)为P4连续41–56s；[25.040秒尺寸/跨屏片](evidence/native-size-display-selection.renderer.montage.mp4)为P4 THREE-CUT 60–64.5／214.5–219／246.5–262.5s。renderer-only H2641920×1080/25fps、无音轨、灰边不等于原生frame；来源整次FAIL及末帧Charge选择说明不变，须结合native原件。当前P5正常退出另有独立记录。

## 工作位置和外部接受

保留原21个worktree HEAD与完整porcelain状态，主目录 `c9b79e2e2e5b22071feb7d10a64634806b67aeb0`／status空。任务树 `/Users/zengchongtai/develop/DeiDei/.worktrees/r04-t03-a`保持活动；原件R保持，未新增任务恢复归档或移动/删除旧目录，已有历史归档未改。git排除worktrees／outputs／archive，build／stage明确文件集合；未打新包、merge、main push、tag、release、部署或改CI设置。Kimi继续暂停，未调用；本地增量源码／证据复核使用code-review及只读子代理。

普通开发入口：`DEIDEI_PYTHON=/Users/zengchongtai/develop/DeiDei/.venv/bin/python npm --prefix game/desktop run dev`（从本任务根运行）。无地址路径仍明确MOCK；真实本机服务命令及 `DEIDEI_ROOM_URL` 见 [desktop README](../../../game/desktop/README.md)。fixture先完整build/restart；main/preload/worker/白名单修改继续完整重启。

| 缺少的具体条件 | 交接操作与接受点 |
|---|---|
| 不同DPR屏／物理4K／系统缩放组合 | 记录native像素、DPR／系统缩放、native content及inner；跨屏往返、Tab/选牌保持、resize/飞行终点及原生短录像。当前两屏均DPR2，截图尺寸不替代设备。 |
| Windows图形host、干净设备/账户、初次真人玩家 | 同产品SHA构建或独立获准新包，欢迎→建档→真实教程→单人/两人房；记录规则理解、实际操作/文字/失败，由Teddy安排。 |
| 新包/系统信任/物理断网/跨设备公网TLS | 独立发行验收用同SHA新包、第二电脑、公网服务/证书；实际断网恢复→再入场，核ACK/deadline及揭晓前保密。旧ZIP `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`不代表本轮。 |
| 新能力／第二轮 | AI强度/本地时限、多身份、音频另行开发。ChatGPT增量复核＋Teddy实际体验和外部安排确认后，再从最后确认SHA进入第二轮。 |

[前次未完成交付](https://github.com/Kalopsiazza/DeiDei/blob/98955894b432f1f12d4bdf36f0a4697cdf95aeb7/docs/results/R04-T03-a/REPORT.md)和[更早记录](https://github.com/Kalopsiazza/DeiDei/blob/6eb652d088ffdf1f9e047bb14b9d48acf5037885/docs/results/R04-T03-a/REPORT.md)保持历史属性。[遗留终态](REMAINDERS.md)覆盖原要求，[控件表](CONTROL-STATES.md)给真实适用性；本包本机执行/交付完成，外部设备与进入第二轮确认仍待安排。
