# R04-T03-a 遗留核对与实际终态

2026-10-04。起点 `1f30a2449dddbe98144b7e98e0dc0a8e76b977ca`；当前产品 `dc38024a91818c3e2a2ca537675549409cfca620`。三个里程碑的本机执行／交付完成；第二轮待增量复核与Teddy实际体验/外部安排确认。下表状态沿工作单六种值，输入／dirty／失败边界与可查看副本见 [REPORT](REPORT.md) 和 [CONTROL-STATES](CONTROL-STATES.md)。

| 原要求 | 实际入口／当前实现 | 实际证据与本次处理 | 状态 |
|---|---|---|---|
| 预览身份及同场去重 | 普通main每次new FixturePort、模块级场次序号 | completion14 winner→defeat→draw→winner、同场回执去重通过；实现至P5一致 | 已修并验证 |
| Modal关闭竞态 | 真实preview/未保存settings；同步closing/inert/latest callback | completion14真实trusted键盘／迟延成功失败；actual SharedUI两prop合同PASS，83ms内busy翻转取消关闭与替换callback只调用最新；scope不扩大为全页面新GUI | 已修并验证 |
| 开发监听／来源及README旧句 | 实际dev watcher；fixture需完整build/restart | 同PID真实reload/P01记录；README给MOCK/ordinary真实服务、暂停不停止全部计时动态、真实后拍时限说明 | 已验证可用 |
| 共用尺寸／实际消费者／飞行终点 | 实际arena/独立move-target ResizeObserver、共同安全边、welcome DOM与online作用域 | N2/N6严格动态飞牌2px容差PASS；P5 clean6349639完整10路线189条控件记录/50聚焦停点，偏好与短空间检查完成 | 已修并验证 |
| 真实1000×650及更小空间 | BrowserWindow content/inner、outer1000×682/DPR2；更小正文滚动 | P4 CUA真正宽高拖到1000×650、截图2000×1300；P4cleanupFAIL明确保留，P5正常退出另有证据；P2自动1000×560CDP页尾关闭完成，不宣称移动端 | 已修并验证 |
| 设置偏移 | 装饰MAIN曾scrollLeft256/167；overflowclip保留窄/低阅读回退 | 未改变滚动offset的真实pointer/key基线本次未复现；P3后1route/21控件实际容器offset0、值保持。旧垂直偏移owner未确认，保留历史失败 | 已修并验证 |
| 本人底部席位 | height:auto按history＋gap＋identity bottom锚定 | 旧真实N3最小2px越界FAIL；P4后N6/3/4/5/2最小身份与严格N2/N6飞行PASS17 | 已修并验证 |
| 欢迎昵称键盘焦点 | 实际Welcome Identity input、范围内2px outline | front-v1真实Tab反馈缺失FAIL；P5前同指纹front-v2 PASS88/2business | 已修并验证 |
| 每家族持续resize及偏好 | 欢迎/菜单设置/prepare/worker solo/manual/tutorial/result/dialog | P5 clean6349639普通main完整10路线/189条控件记录，三高风险偏好/prepare伪元素及1000×560CDP正文滚动关闭完成；超物理范围明确模拟来源 | 已验证可用 |
| 当前原生全屏／双屏／转场 | CUA真实Ctrl+Cmd+F、Window跨屏、选择与Tab/Space | P4真实下限/fullscreen/跨屏及短renderer录像；P5普通main fullscreen一进一退、display2→1→2、选择保持、正常exit0；两屏均DPR2，物理边框由原生事件/观察补充 | 已验证可用 |
| 真实worker／本机联机完整流 | ordinarymain＋真实worker/owned CLI loopback service | 当前local/tutorial batch实际worker；online17实际大厅→选择→揭晓→结果→返回/退出，无合成产品状态 | 已验证可用 |
| N2/N6全动态、N3/4/5拥挤揭晓、N6viewer | 同host实际6→3→4→5→2及真实观众GUI | online-unlocked-bottom-auto17PASS、N3头像修正；sourceP3+dirtyP4与P5 renderer/style/main一致；普通双app/service正常退出 | 已修并验证 |
| 时限当前拍／后拍 | 真实selectOption/Apply | OU actual selecting opening/Apply/after，当前30s deadline/accepted不变，下一拍20s；N7独立CUA Up→Return接受20，popup关闭/dialog仍开，母运行FAIL保留 | 已验证可用 |
| 七态／业务锁／反例拒绝 | 原App不同class/fieldset、实际hover/down/Tab及合法IPC迟延失败 | 六批PASS；AE5图鉴88/LD2 loading7；cleanO13全部66verified/796natural、11请求busy、guestWAITING/结果/return/leave完成；原生接受N7另证；NA及共享复用见CONTROL-STATES | 已验证可用 |
| 欢迎历史人物/视频/同dev刷新 | fresh/同PID重播/P01/returning/真实watcherreload | P5 clean2c5最终37checks/11segments，fresh/同PID/P01/replay/return/真实watcherreload，无人物媒体资源错误，normal0/childgone/profile删除；历史失败原因未定位，返菜单max183.7ms及同PID自然重播131个>50ms保留 | 本轮未复现 |
| 旧两人复用严重晚揭晓 | 普通聚焦同host依次多人后复用2人、固定1366×768/DPR2短profile | 389phaseRAF／388独立focusRAF全部聚焦可见、无nativeblur；晚揭晓239间隔p95/max18.2/18.6ms、>50=0，旧200–267ms峰值未复现；选卡恢复7个51–83ms仍保留，不宣称所有性能修复 | 本轮未复现 |
| 1920图鉴固定8wheel长帧 | ordinarymain、native/docfocus、各区4×+500后4×−500、180ms | 历史同机有效before/after局部处理；最终P5严格两区各8wheel，list17.7/33.6/>50=0、detail17.6/17.7/>50=0，全201focus配对/native无blur，正常清理；负CPUdelta/trace discarded16保留 | 已修并验证 |
| 不同DPI／物理4K／系统缩放 | 当前两屏确实均DPR2 | 需不同DPR屏/实际4K模式和缩放组合；原生往返、文字/焦点/选牌/飞行及短录像步骤见REPORT | 缺少具体条件 |
| Windows／干净机／新玩家真人 | 当前可调用macOS本机 | 需Windows图形host、干净设备/账户和首次玩家；欢迎→教程→单人/两人实际短流程，由Teddy安排人员 | 缺少具体条件 |
| 新包/成包GUI/信任/物理断网/跨设备公网 | 旧ZIP0a37a89不含本轮代码；独立发行/设备验收 | 需本轮同SHA新包、第二电脑及公网TLS证书、实际断网恢复；本轮未扩大成整套发行工程 | 缺少具体条件 |
| 最终build／检查／CI／Draft／证据／保护原工作 | 当前P5与最终H，Draft36 base精确起点 | clean634 build及五guard0、P5 Node76/Python59精确继承；所有最终GUI及PNG/JSON/短片viewable/manifest校验，原21worktree未变，Draft36增量更新，CI0 NOT_RUN；最终head在PR及回传 | 已验证可用 |
| AI强度/本地时限、多身份、音频新增能力 | 当前产品边界 | 保留独立需求，不新增规则/模型/协议/依赖 | 另行开发 |

| 图鉴首次完整动态滚动偏移 | 实际stack/RO/overflow-anchor:none；无resize scroll写入 | 原full v1实际1248→1314保留；正常/最小起步被动诊断均1248，最终full v2实际稳定baseline后精确保持1248；未找到原66px原因，无产品scroll reset或容差放宽 | 本轮未复现 |
