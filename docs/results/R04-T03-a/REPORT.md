# R04-T03-a 增量交付：里程碑一完成，二／三未完成

2026-10-04。执行 [Issue #35](https://github.com/Kalopsiazza/DeiDei/issues/35) 与 [工作单](../../tasks/R04/R04-T03-a.md)。本包已有代码修改和实际 Electron 运行，尚未满足全部完成条件：Mac 锁屏阻止原生拖窗、完整全屏往返、现有双屏往返及最终严格聚焦图鉴复测；联机选卡转场仍有明显长帧，控件状态还有补测项。未进入第二轮，也未取得 ChatGPT／Teddy 的最终接受。Kimi 未调用。

| 版本／位置 | 实际值 |
|---|---|
| 精确起点 | `1f30a2449dddbe98144b7e98e0dc0a8e76b977ca` |
| 起点产品 | `3006f0a42bece4d702c5a7ba48af9d0d0fafbfc8` |
| M1 提交 | `af5cd5214014bf68601abd95b89e8de8873b08a6` |
| P1，主要布局／图鉴候选 | `1b2b7a182e53e7f61b563638f58622893c5fa4b1` |
| P2，当前产品候选 | `edbb85a664bde73bc74160f00bb38e15d5634908` |
| 最终 head H | 草稿 PR 正文和最终交付列出完整 H；本报告属于该文档提交，不自嵌自身 Git SHA。P2→H 仅 QA／文档／证据变化。 |
| 分支／PR base | `work/r04-t03-a-frontend-completion` → `codex/r04-t02-e-real-rooms`；base 仍为上述精确起点 |
| 任务 worktree | `/Users/zengchongtai/develop/DeiDei/.worktrees/r04-t03-a`；保持活动，未归档 |
| 本机原始输出 R | `/Users/zengchongtai/develop/DeiDei/.local-outputs/r04-t03-a/`；忽略目录，原 FAIL／日志／大 trace 保留 |
| 恢复档／目录保留 | 原有21个 worktree 的 HEAD 和状态快照一致；主目录 HEAD `c9b79e2e2e5b22071feb7d10a64634806b67aeb0`、状态不变。`.local-archive` 未启用；未删除或移动旧目录。 |
| 旧安装包 | `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`，不含本轮代码。本轮未打新包、未部署／合并／发版。 |

## 产品修改与来源

- `fixture.ts`：模块级新场次序号覆盖真实 main 每次 `new FixturePort` 的路径，防止预览场次复用历史；同场公开回执去重保持。
- `SharedUI.tsx`：请求关闭时同步 closing／inert，捕获后续 Escape／Enter／点击；延迟结束读取最新 callback 和 closeDisabled，忙碌时取消关闭并恢复可操作状态。
- `BattleStage.tsx` 与职责 CSS：ResizeObserver 测量实际本人 `.move-target` 与 arena，飞行终点随真实元素几何更新；marker 独立于历史卡数。最小内容区修正33牌文字、席位、确认区，共享安全边和实际欢迎 DOM；修正 online 对本地牌桌的未限定规则。减少动态／透明度与短空间滚动命中实际消费者。
- 图鉴：只在 manual 降低静态背景、深度叠牌、遮罩／backdrop 和背景 filter／transform 插值的组合成本；保留阅读、前景入场、hover／示例播放。没有更换视觉方向。
- P2 联机局部处理：保留全屏渐变和明暗层，只取消 online `.battle-table::before` 的1.5px backdrop blur。隔离对照改善晚揭晓稳态，但选卡转场仍未解决；不是全场关闭动效。后景略锐利，解锁后须确认现场可读性。

未改变规则、DD、33招式编号、胜负、ledger、计时／deadline、ACK重发或退出语义；未改模型、协议、TLS、CSP／隔离／资源白名单；无新依赖。README 明确 fixture 改动需完整构建／重启，MOCK 与真实回环服务分开，暂停／冻结不停止运行时或所有背景动态，后续拍时限已可调整。

## 实际运行与验收范围

下表保留每个原件的输入和整体状态。远端可查看副本在 [evidence](evidence/README.md)，[MANIFEST](evidence/MANIFEST.json) 给出原件／副本 SHA256；副本去掉诊断 HTML 与凭据字段，大 trace／CPU profile 仅留本机原件及哈希。没有把旧 FAIL 改为 PASS。

| 记录（相对 R） | 输入／入口 | 实际结果 |
|---|---|---|
| `completion-product/checks.json` | P1 clean；普通 main，测试 wrapper 仅控制700ms IPC迟延／失败 | 14 PASS：winner→defeat→draw→winner 各场身份／历史／动作／结果正确；四组 trusted Escape→Enter 小于240ms，关闭后调用0次，延迟动作调用1次；成功／失败后父页面与焦点一致。普通exit0，无force。 |
| `completion-final-product/checks.json` | P2＋QA／文档dirty，产品编译与P2一致 | 最终候选再次14 PASS，普通exit0、无force。只声明此14项行为通过，不扩大成物理动态接受。 |
| `dynamic-product/dynamic.json` | P1＋QA dirty；普通 main／真实 worker | FAIL，8路线117记录。图鉴纯resize保持 Bi／stack1248／detail0；随后键盘遍历把详情页签滚到视口外，驱动未显式导航。修的是该长详情导航，不改布局掩盖失败。 |
| `dynamic-product-v2/dynamic.json` | P1＋QA dirty | FAIL，10路线188记录；教程、长规则、结果、偏好均已执行，末项560高空间已看到页尾关闭，却误点屏外页首返回。修为点击刚验证的页尾关闭。 |
| `dynamic-final-product/dynamic.json` | P2 clean | FAIL，设置页第四停点1366×768整体偏移，返回按钮 `x204.203/y−78.156`，相对初次同尺寸移动 `−195.5/−143.5`。不是已确认的驱动误点。短路径诊断 `settings-diagnose.json` 未复现；新增祖先滚动采样，不猜 owner／不改CSS。 |
| `dynamic-final-product-v2/dynamic.json` | P2＋QA／文档 dirty；产品编译指纹与P2一致 | PASS，10路线189记录，普通exit0／无force。真实worker会话／选牌保持、图鉴选择／阅读位置保持、教程／本地结果／短长弹窗、三个高风险偏好与1000×560页尾关闭返回完成；上述设置偏移本次未再现，不能称根因已修。 |
| `online-v7/checks.json` | af5＋dirty，renderer/CSS与P1匹配；普通 main＋实际 owned CLI 回环服务＋合成对手 | 整体FAIL：Charge public reveal超时。观战路线置于已提交后的当拍窗口，会占用服务时限；原件未存完整arm时钟，不把所有超时原因归定。六人最小33牌／姓名、观战、selecting时限Apply有部分正向证据。旧FAIL保留；后续driver把观战检查移到host提交前。 |
| `online-final-product/checks.json` | P2＋QA／文档dirty | FAIL：名为selecting的停点实际已revealed，隐藏选牌的命中检查失败；不能当成选择阶段裁剪缺陷。驱动增加实际selecting前置条件。 |
| `online-final-product-v2/checks.json` | P2＋QA／文档dirty；两档33牌copy与几何已检查 | FAIL：返回终点native1366×768时CSS仍1458×820且已revealed；真正CSS终点到达时飞牌已移除，缺少最终稳定submitting帧。8个completed after-RO样本均命中（最大\|dy\|0.555px），仅是部分证据。首错、raw RAF／RO、正常双app／service清理保留，不降低稳定断言。 |
| `online-steady-product-v2/checks.json` | P1＋两QA dirty；同host顺序复用6／3／4／5／2，固定1366×768，DPR2 | 流程15 PASS：真实下一拍、无人存活结果、返回大厅；不是动态路线PASS。两人明显长帧，native焦点false，性能未完成。 |
| `online-ambient-ab/checks.json` | P1编译单项override；四背景循环暂停 | 流程15 PASS，性能未完成；没有整体收益，变体未保留。 |
| `online-backdrop-ab/checks.json` | P1编译单项override；只移除online全屏backdrop | 流程15 PASS，晚揭晓局部改善、转场仍重；该编译CSS与P2输出逐字节相同。native焦点false，不代替最终前台接受。 |
| `welcome-product/welcome-native.json` | P1 clean；真实dev watcher，scripted socket明确MOCK | 37 PASS／11分段：fresh、同进程跳过／自然重播、建档、设置返回、P01不写档、真实build后`.reload`触发reloadIgnoringCache、已有身份开场／重播／菜单。PID38275保持、document ID变化；无失败资产／page／console错误，普通exit0／children退出／profile删除。历史人物异常本轮未复现，不称已找到原因。 |
| `archive-focused-before`／`archive-static-backdrop` | af5＋旧dirty／隔离CSS对照；1920×1080、native DPR2、native/document焦点均true | 旧严格对照局部改善成立，最终P2严格聚焦复测未完成。不能继承为最终产品PASS。 |

本地自动动态路线每段12步连续 native setContentSize，四停点1366×768→1000×650→1920×1080→1366×768，并在两个停点实际操作；联机动态每段6步。solo／archive另测1600×650、1000×1000、1920×1200、2560×1080；超显示器可用区逐样本标明 oversized，不能当物理超宽／4K。实际下限 outer1000×682、content／inner1000×650、DPR2。短空间1000×560为CDP内容模拟，不宣称移动端。native setContentSize、设置全屏checkbox、自动截图均不替代原生拖窗／全屏录屏。

最后的QA guard另要求当前仍submitting、飞牌仍存在、DOM及采样均在预期终点；补有界观察前的当前phase／飞牌／frame age，以及之后运行的服务deadline记录。VM自检拒绝revealed、移除飞牌、错误终点和移动epoch的历史样本；该新guard未重新完成GUI整条联机，仍以上述FAIL为实际结果。pre-RO RAF与after-RO数据分开，不把前者暂态误差当永久呈现偏差，也不把后者部分命中冒充最终稳态。

七态适用性及缺口见 [CONTROL-STATES](CONTROL-STATES.md)。真实 pointer/down/Tab 有8个代表控件四态；业务 busy／disabled 来源为真实迟延IPC或自然React／IPC pending。输入的禁用字段集、select无disabled等按真实源码逐项区分NA，未测消费者不自动继承PASS。Modal 240ms内closeDisabled变化分支有源码处理，额外持久GUI回归仍待补。

## 性能：局部改善不等于完成

严格图鉴协议：普通 main、当前可见未最小化窗口，1920×1080/native DPR2；列表／详情各8次wheel（四次+500，四次−500），每次180ms，实际scrollTop；每次断言native与document焦点；两区保存RAF／CPU profile／有界CDP trace并正常清理。

| 历史严格图鉴区 | 改前 p95／max／>50ms | 局部处理后 p95／max／>50ms |
|---|---:|---:|
| 列表 |265.8／266.6／12|17.7／33.4／0|
| 详情 |250.6／266.8／6|17.5／17.6／0|

两侧旧global compiled CSS `4e9fcf…`／`54b91d…` 均不同于P2 `5ec254…`，虽然图鉴源码处理已进入P1/P2，仍需最终聚焦重跑。原始trace的Dawn／CALayer背压是wall等待，不能当GPU硬件利用率或唯一CSS归因；父子嵌套耗时不能相加。

| 固定两人复用诊断（ms） | P1基线 | 暂停背景循环 | 取消全屏backdrop（P2） |
|---|---:|---:|---:|
| profile段 p95／max／>50 |117.6／200.6／38|133.9／201.4／33|100.0／216.7／19|
| 晚揭晓>1s p95／max／>50 |65.3／67.9／24|64.7／151.1／20|33.7／66.6／1|

三组相同1366×768/native DPR2、相同host复用顺序，但native focused=false／document=true，不能视为严格前台接受；不据锁屏臆测停顿原因。取消backdrop的CA max58.509→34.296ms、>50事件5→0，选卡216.7ms区间仍与Dawn101.143／raster107.749ms重合；末段另有266.7ms RAF在trace窗口外，不杜撰GPU关联。CPU profile存在负timeDeltas，不能据leaf累计宣称React耗时很低。RAF回调间隔并非屏幕呈现时间。原件／有效窗口／哈希见MANIFEST与诊断JSON。

## 检查、复现与继续条件

`CHECKS.json`保存实际命令、输入、结果和未完成状态。P2构建exit0，桌面Node76/76、fail0/skip0；`python scripts/check.py` 检查67个语法文件、59测试（既有#1 expected failure1）、exit0。style自检仍拒绝R34五反例；performance／archive helper自检验证采样停止、部分证据、首错／次错、普通与强制退出及trace IO回收，均exit0。这些自检不替代GUI。远端CI按实际head回读，0项是NOT_RUN，不能写PASS。

P2编译：renderer SHA256 `02623dff22676f84615e686a19e19a5bfd1e55fcb457cc853e2fc6ceb0581a90`；CSS `5ec2546dddebb8589a3f86ef7f65259c6d1bcd1c37eddfb129f939f477632ed9`；welcome CSS `530cd5bebdb0a86dcb07eeb756b654c9d5b3604c1f50ccf1e7980aa505b2b921`；MP4 `903aac82723b9974887c2cc8603017cd44f11481907d43ab8f832133c393730f`。main/preload/白名单hash与P1相同，详见evidence/product-final-input.json。P1欢迎功能证据单列，不能写成P2严格前台性能通过。

从任务worktree按 [desktop README](../../../game/desktop/README.md) 启动。真实worker解释器用本机已有3.13.7 venv；真实服务诊断用现有3.12.11/server venv（websockets17.0.1）；Node24.12.0／npm11.6.2、Apple Silicon macOS。未安装新依赖。每次新输出目录；旧FAIL、视频、CPU／trace不覆盖。

| 尚需条件／工作 | 直接执行与接受点 |
|---|---|
| 当前Mac解锁；原生过程及最终聚焦性能 | 用README `--native-only`＋`--native-hold`普通main，观察owned进程PID；先自然视频结束，再CUA连续拖宽／高，完整Ctrl+Cmd+F进入和退出，操作保持；窗口限定短录屏须实际覆盖动作。随后严格archive driver，用新OUT、native/page焦点true完成双区8wheel及原件回读。 |
| 当前实际双屏跨屏 | MateStation X id2：2304×1536逻辑／4608×3072 backing、DPR2；内建id1：1710×1112／3420×2224 backing、DPR2、x−1710。设备已具备，阻碍是锁屏。菜单／牌桌含焦点与选牌往返拖到两屏，记录displayID、bounds／content／DPR及操作；这是同DPR跨屏，不能称不同DPI通过。 |
| 联机停顿／偶发设置偏移／控件缺口 | 解锁后固定窗口复用同进程短调查，核native焦点，继续trace支持的局部处理；设置失败需实际scroll owner记录再决定clip，保留≤600的阅读滚动。按七态表补有业务条件而未测项和页面覆写；原生select键盘／popup另验。 |
| 不同DPI／物理4K／系统缩放 | 需可调用的不同DPR屏或实际4K模式；记录系统缩放、显示器native像素和content，然后同route往返并检查文字／牌名／焦点／出牌终点。当前两屏均DPR2，自动超大窗口不是此证据。 |
| Windows／干净机／新玩家 | 需Windows图形host、另一干净机／账户和对应本轮新包、首次接触规则的人。按欢迎→教学→单人、两人房完整短流程记录实际操作／文本／错误／安装信任；由Teddy安排真实参与者，AI或本机合成peer不冒充。 |
| 新包／物理断网／跨设备公网 | 本轮未打新包；旧包不使用。产品封板后另授权同SHA打包／启动／资源白名单／信任检查；真实房间另需第二电脑、公网TLS服务与证书，实际断网→恢复→再入场核ACK／deadline／保密。保持独立验收，不据本机回环宣称互联网可玩。 |
| 第二轮 | ChatGPT增量复核＋Teddy实际体验及外部安排确认后，从最后确认完整产品SHA起步；当前不自动开第二轮。 |

旧 `welcome-native-v1`／`native-v2`整体FAIL和媒体ERR_ABORTED保留。旧录屏有静态片段未覆盖拖窗时间，另一段可能含桌面背景；没有作为有效原生动作视频发布。此交付只有可查看截图和JSON，原生录屏缺口明确未完成。
