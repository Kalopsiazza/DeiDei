# DeiDei R04 阶段审读与 Codex 任务包

日期：2026-10-03  
状态：Teddy 已于 2026-10-03 授权按 VEW 执行 A—F。执行者：Codex。规划与审读：ChatGPT。

原审读证据保持历史来源；执行进度见 ../../results/R04-T02/PROGRESS.md。任务授权仅包含本机实现与验证，发布、合并和公网仍由 Teddy 决定。  
建议归档位置：docs/superpowers/plans/2026-10-03-deidei-r04-next-stage.md

DeiDei 已经具备真实离线牌局、真实教程、完整图鉴内容与房间服务代码。下一阶段优先处理玩家会读错、无法退出或无法恢复的情况，再逐步整理共享界面与屏幕适配。发行清单和真实联调工具也已落后于产品代码，需要分别修正。性能工作从取样开始，只改有证据的热点。

这份文档包含当前能力判断、源码问题、工作顺序及六个可交给 Codex 的任务包。确认前维持规划状态；本次未更改仓库、发送评论或启动实施。

## 审读使用的版本与证据

| 项目 | 本次核对 |
| --- | --- |
| 仓库 | Kalopsiazza/DeiDei |
| PR | [#33][pr33]，open、draft，未合并 |
| head 分支 | work/r04-t01-b-frontend-live |
| 完整 head | 88185af2c9372b2f1d88707218cafee590b94018 |
| base | integration/r04-ui |
| base SHA | 7ec4e246f057545bcd5ffdb929ca1d43b50f1c45 |
| PR 提交数 | 31 |
| PR 文件列表 | 分页工具取得 126 项，去重后仍为 126；与 CHANGED-FILES.txt 无差异 |
| Git 文件树 | 781 项，truncated=false |
| 取件核验 | 166 份文本源码、配置、说明与必要测试数据，合计 2,441,025 字节；逐份以 Git blob SHA-1 与 UTF-8 字节数比对 |
| 126 项变更的覆盖 | 70 份文本全量取得；56 项图片、视频或截图核对树内路径、对象 SHA 和字节数，本次未解码或视觉验收 |

GitHub 插件支持指定 ref 与完整文本读取；本次没有用默认 main 的搜索结果代替源码，也没有用 diff 代替文件正文。八份指定文件均已完整审读，长 CSS 由并行审查按连续区段覆盖。图片和视频的清单核对不证明裁切、画质或播放可靠性。

先读的五份资料是 STAGE-HANDOFF-2026-10-02.md、CHANGED-FILES.txt、desktop README、DESIGN.md 和 R04-ONLINE-CONTINUITY-PRD.md。之后完整审读 renderer.tsx、style.css、welcome.css、BattleStage.tsx、online/OnlineRoom.tsx、ManualArchive.tsx、WelcomeEntrance.tsx、TutorialCoach.tsx，以及涉及的 main/preload/worker、online、runtime/core/server、图鉴数据和校验器。打包、集成工具、现有测试、工作流与阶段记录也按需要追踪。[交接入口][handoff] · [完整变更清单][changed]

交接中提到的 online/client.cjs、online/decode.cjs 在本次树中不存在；真实引用为 online/network-room-port.cjs、online/wire.cjs。这个差别已按 main.cjs 的实际引用处理。

### 本次执行与沿用记录

| 证据 | 状态 | 可支持的结论 |
| --- | --- | --- |
| core unittest discover | 本次执行，174/174，通过 | 当前固定源码的已有规则单测通过 |
| runtime unittest discover | 本次首次 4 error，均为尚未取回 C065/C074 测试数据；取得同 SHA 数据后 26/26，通过 | 当前固定源码的已有 runtime/教程单测通过；未改源码与断言 |
| 33 项名称匹配复算 | 本次执行，发现 8 项错误命中 | 现有历史反查方法存在常态错误 |
| 桌面 61 项、服务端 67 项 | 沿用交接记录，本次未重跑 | 不扩展为当前环境、GUI 或跨设备验证 |
| 联机 GUI 13 组、48 张图 | 历史 scripted fake socket / MOCK | 证明相应演示流程曾在 Electron 运行 |
| 图鉴 298 项、教程 GUI 80 项与 9 份 core 账目 | 历史专项记录 | 9 份含 3 次跟随、2 次失败、3 次重试与 1 次普通单人；本次没有重跑这两套 GUI |
| 欢迎 smoke 先失败后通过 | 历史记录保留 | 可靠性仍待定位 |
| GitHub CI | 自动触发目标为 main；旧打包流程还限定 integration/r02 与旧 head 分支 | 两者均不自动覆盖 PR #33，缺少检查不能记通过 |
| 实机 GUI、物理 4K/DPI、Windows、发行包、TLS、公网与跨设备真人 | 本次未运行 | 保持待验状态 |

CI 的判断来自 [ci.yml][ci] 与 [旧打包工作流][package-ci] 的实际触发配置。

本次 Python 复验在本地源码副本完成，不代表 Teddy 的电脑或成包环境。图鉴 check_content.py 会生成并写回 content.json 与 REVIEW.md，本次没有在审读副本中直接运行它。

## 当前成果与能力范围

| 范围 | 确认事实 | 尚未证明或尚未完成 |
| --- | --- | --- |
| 离线单人 | renderer → 固定 IPC → WorkerPort → JSONL worker → SoloGame → core；对手在玩家输入前选定合法招式；33 招式费用与胜负由核心计算 | AI 强度和选择时限仅为界面局部状态；实际为随机合法对手、不限时选择 |
| 新手教程 | TutorialGame 复用 SoloGame/MatchSession 与真实核心；跟随和独立练习真实结算、手动继续 | 新玩家教学效果、Windows/发行包体验未验证 |
| 图鉴 | 33 卡、10 主题、28 原条款、21 术语、10 问题、36 示例；播放消费预生成的公开账目 | 检索和浏览不等于所有教学文案均已由真人验证 |
| 欢迎与大厅 | 本地视频、静音播放/声音开关/跳过/重播/错误回退；单档案；欢迎至菜单及联机 L01—L04 使用持续舞台 | 偶发欢迎检查失败、旧窗口卡顿根因未确定；多身份与普通游戏音源未接 |
| 共享战局 | 单人和联机共用 BattleStage、SituationDialog；MatchResult 已存在 | 本地终场仍复制了一套结果 JSX；历史、身份与揭晓编号有确定错误 |
| 好友房服务 | 真实 NetworkRoomPort、wire 解码、Python Room/server 均存在；rooms-1.1、2—6 玩家、观众、准备/开局/揭晓/结果/重连 | 当前 head 客户端只接受本机回环 ws；本阶段 GUI 证据为 MOCK；现有真实 GUI harness 已过时 |
| UI 基础 | 已有 DESIGN.md、变量、共用类名与素材白名单 | 旧选择器仍覆盖新按钮/弹窗；字体变量、减少动态/透明度规则未完整生效 |
| 交付 | 构建脚本可生成本地 UI；既有发行路线与检查存在 | 发行 stage 漏主进程依赖、新样式/媒体；旧发行 GUI 定位仍指向 R02 画面 |

依据：[桌面与运行入口][desktop-readme]、[WorkerPort][worker-port]、[worker][worker]、[SoloGame][solo]、[图鉴][manual]、[TutorialGame][tutorial]、[联机传输][network]、[服务][server]。

### 后续任务保留的游戏与网络行为

- classic-1.0.1、33 个 entry_id、DD 六分之一单位、动作顺序、费用、资格、复制/派生、淘汰与存活者新局流程继续取自 core。
- 本地正式揭晓默认 3 秒；当前服务默认共同揭晓 5 秒。教程手动继续；联机 UI 演出不停止服务器计时。
- 揭晓前，只能显示自己的确认招式与公开提交状态；其他人的招式、私有输入、随机 token 不进入 renderer。
- 会话恢复凭证留在主进程内存；renderer 保留沙箱、contextIsolation、CSP、固定 IPC、sender/frame 校验；不获得任意网络或文件能力。
- 当前连接只接受 ws://127.0.0.1:<port>/rooms-v1 或 ws://[::1]:<port>/rooms-v1。后续 WSS 使用既有技术候选审查，远端明文 ws 继续拒绝，原生证书验证保留。
- 一次一个待确认房间意图；重连按现有 1/2/4/8 秒及抖动；恢复后对待确认请求沿用原 request_id、command_seq、内容；明确失败不自动重发。
- 旧连接、旧 revision/seq 的回复不覆盖新状态；主动断线退出停止重连；正常离房等确认；系统关窗保留最多 3 秒的离房等待。
- 普通成员连续三拍缺席与房主连续第四拍缺席按现服务策略处理；成员/房主缺席不让其他人的牌局暂停。观众只读，人数上限与时限范围来自服务 hello。
- 本地 generation、共享 readSlot、提交与场景切换保护继续存在；重构不可让旧 worker 回复复活已退出页面。
- 原作者署名、既有测试、失败记录及未测项保留；不更换依赖或框架。

## 新发现中最值得先处理的事项

### 玩家会读到错误牌局

**确认：历史图标反查有 8 项常态错误。** renderer 和 OnlineRoom 用昵称找中文摘要，再用“相等或前缀”寻找 catalog 第一项。三雷防会命中三雷，Pragon 防会命中 Pragon；三种炸药兑换会命中炸药。合法重名还会让两位玩家取到同一条摘要。应使用公开 ledger 的 player_id 与 entry_id，中文只用于显示。[本地历史][renderer-history] · [联机历史][online-history]

| 招式 | 应使用 | 当前方法命中 |
| --- | --- | --- |
| 三雷防 | ThreeDef | Three |
| Pragon 防 | PragonDef | Pragon |
| 沃尔沃防 | VolvoDef | Volvo |
| 聂湘防 | NieXiangDef | NieXiang |
| 炸药·Pragon | BombPragon | Bomb |
| 炸药·沃尔沃 | BombVolvo | Bomb |
| 炸药·翻转沃尔沃 | BombFlipVolvo | Bomb |
| 曾义赠送·大 bi | ZengRewardBigBi | ZengYi |

**确认：联机揭晓编号提前了一拍，淘汰重开还会提前换局。** onlineBattleView 在 revealing 使用 last_turn.effective_state 的 game_id/turn_index；这份状态已代表下一步。本拍身份位于 last_turn.turn_id 与 core_resolution.ledger。已有 ordinary_reveal 样本明确是 public_state/ledger=g1:t1、effective_state=g1:t2。此样本来自早期合成时钟/会话，支持字段关系，不冒充当前 5 秒服务实测。[适配代码][online-model] · [历史样本][room-samples]

**确认：参与状态被手牌有无、人数代替。** 联机揭晓期间 options 为空是正确行为，BattleStage 却将“有 self 且没 options”写成已淘汰；观众 self_id=null，有赢家时 MatchResult 会显示“阵亡”。两人联机也不应通过 participants.length>2 判断模式。[共享战局][battle]

**确认：局势记录只保留每人最近八拍。** 选卡堆叠的八拍上限可以保留；同一缓存被局势时间轴直接使用，导致较早记录丢失。重连期间未收到的历史要显示缺口，现有 last_turn 不能恢复整场所有历史。

### 操作失败后缺少恢复出口

**确认：结果退场状态不会随命令明确失败而恢复。** transitionResult 先设置 resultLeaving，再调用 returnLobby/leave；run 的失败分支只写错误，未清除 resultLeaving。若房间仍在同一 result，三个结果动作继续禁用，CSS 还将结果内容淡出。网络拒绝或错误响应足以触发这条路径。[终场动作][online-result]

**确认：大厅/同步状态断线时退出按钮被禁用。** blocked 包含未连接，页面拿它禁止主动退出；主进程本来支持断线停止重连。终场直接退出又绕过已有的房主结束房间确认。[房间出口][online-room]

**确认：本地 Enter 会抢走普通按钮的键盘激活。** renderer 的全局快捷键未排除普通 button，焦点在暂停/冻结/局势上时仍 preventDefault 并尝试提交。联机已有 button:not(.card-pick) 的排除写法可参照。[本地快捷键][renderer-keys]

**确认但需要产品选择：本地“暂停”当前停轮询与输入，未暂停单调时钟。** 在 revealed 暂停超过三秒，恢复首读即可进入下一拍；在 submitting 暂停，恢复首读才开始三秒揭晓。现逻辑每次读只前进一步，没有后台多拍追赶。完整计时暂停建议与真正单人时限一起设计；本轮不得将当前语义写成已经冻结运行时。[SoloGame][solo]

### 发行包有比缺图更早的失败点

**确认：STAGE_FILES 缺失主进程依赖。** main.cjs 顶层加载 online/network-room-port.cjs，后者加载 wire.cjs，wire 再读取 desktop/catalog.json；三项都没进入 stage。按现清单生成的程序可在窗口出现前遭遇模块缺失。另缺 welcome.css、欢迎视频/牌背、两张擂台 WebP。现桌面 test-packaging 只验证开发构建资源和部分隔离行为，未验证发行 stage 完整性。[主进程][main] · [发行清单][packaging]

**确认：图鉴 JSON 是产品编译输入，却没进入完整输入追踪。** ManualArchive 直接导入 docs/results/.../content.json；发行脚本的干净工作区检查和 input_files_sha256 主要覆盖 game/.github，漏掉这份 docs 输入。后续应拒绝或清楚记录未提交的真实编译输入。[图鉴导入][manual] · [发行输入][pack-inputs]

**确认：真实回环 GUI 与成包 GUI 测试入口都落后于当前界面。** 仍定位旧“保存，进入课间 →”、.lobby-seats、combobox 加入身份、.online-table/.results 等。sequences.py 还只推进 1500ms，而当前默认揭晓 5000ms。应修定位和状态等待，并保留真实服务、错误、隐私、坏包等原有断言。[真实联调入口][integration-gui] · [回环序列][integration-seq] · [成包检查][package-check]

### 样式、适配与性能如何定级

**确认：CSS 里存在仍会命中新页面的旧高特异性选择器。** 旧 .online 非 online-table 容器规则会覆盖新 portal 的 max-width/padding；旧在线 hover 规则覆盖 menu-option、settings-back、prepare-start 的新样式。弹窗通用 hover 同样会覆盖 primary/danger。四个字体变量里，type-control/type-label/type-meta 在 style/welcome 中没有实际消费。后写规则还重新开启了部分减少动态/透明度效果。[CSS][style]

**推断，待实际 computed style/窗口复核：** 准备页在约 1051—1071 CSS px 宽时，固定最小轨道与边距可能溢出；高 DPI、大宽高比、视频 cover 与舞台独立缩放可能使构图漂移。这些不写成“4K 已失败”。

**未知：** 大窗口帧率、GPU/显存占用、长期内存趋势、视频退出后的解码资源是否及时释放。多层 blur/filter、动画滤镜、持续氛围和每 100ms 的联机计时更新都是取样位置，静态代码不足以判定谁是主要瓶颈。

欢迎失败需要单独留证。smoke-entry 第 98 行断言发生在媒体错误回退后的开发预览流程；失败早于后面的诊断写盘。应先把失败时的页面、人物透明度、动画和媒体状态写下来，保留原断言，不能靠延长 400ms 等待把失败隐藏。[欢迎测试][smoke-entry]

## 工作顺序

阶段资料整理已经在这份审读中完成，不再给 Codex 发一个单独的大盘点任务。执行时只需复核工作区与输入 SHA，修正文档中的当前入口。

| 任务 | 优先级与依赖 | 可并行内容 |
| --- | --- | --- |
| A 交付与输入完整性 | 高；无代码前置依赖 | 与 B、F 的基线采样并行 |
| B 公开牌局数据与显示正确性 | 最高；直接基于指定 head | 与 A 并行 |
| C 交互恢复与状态归属 | 高；采用 B 的公开数据定义 | 失败复现可提前，提取和最终验收在 B 之后 |
| D 最小 UI 规则与屏幕适配 | C 的共享部件稳定后迁移 | CSS 盘点、实际样式采集可提前 |
| E 真实房间联调与安全候选接入 | 最终使用 B+C；成包检查还需 A | 旧 harness 修复与 #31 只读审查可提前，不等 D |
| F 性能与欢迎可靠性 | 基线无前置；修正使用当时已审查版本 | 从当前 head 取样，随 D/E 只复测受影响场景 |

A 的全部成包验证不会成为每次前端修改的前置条件。F 的“先取基线”也不会变成先做一轮优化。D 只把实际使用的共用规则迁入清晰位置，避免先生成一套大而空的组件库。

# Codex 执行共同约定

六包均是待确认提案。确认后，每包一个可独立审查的分支/PR；分支名可用 work/r04-t02-a-delivery 至 work/r04-t02-f-performance。有依赖的包注明实际采用的前置提交。以 88185af2c9372b2f1d88707218cafee590b94018 为源头，不从旧 main 重新起步，不自动把 PR #30/#31 的整棵旧树替换进来。

先检查现有分支、未提交内容和本地环境；保留用户与其他线程的工作。可用独立 worktree，一个目录只有一个写入者。若原分支已有新提交，保留它们并说明相对本审读的变化；不 reset 回审读 SHA。

每包交付：实际代码/工具、小而可恢复的提交、准确 head、实际命令及退出码、少量必要截图/日志、仍未验证的事项。拟用 docs/results/R04-T02-a 至 R04-T02-f 记录，各包一份简短结果说明即可。截图来自实际 Electron；概念图与 MOCK 标记保留。

每包开始阅读 AGENTS.md、WORK_START_HERE.md、本任务相关源码、DESIGN.md 与最新联机连续镜头 PRD。可使用 superpowers:subagent-driven-development 或 superpowers:executing-plans，但本轮确认的范围与以下检查粒度优先。

- 纯视觉微调：看目标页面、检查相关点击；阶段提交执行类型检查/构建。
- 数据、状态、错误恢复变化：增加能够失败、能够证明改正的定向检查，沿用现有 Node/Python/Electron 工具。
- 不为每个小修改重复 900 秒、全量核心、TLS或多平台打包。
- 不删除有效断言、不用 skip/expectedFailure 掩盖新失败。旧定位和外观预期可按当前已接受画面修改，并说明原因。
- 不新增依赖、不改模型、规则、招式编号、存档格式或 Electron 权限。新的本地公开显示字段属于 B 的具名范围；E 的 WSS 候选整合属于 E 的具名范围。
- 合并、公开部署、发行与服务购买继续由 Teddy 决定；任务包确认本身只启动包内实现与验证。

## 任务 A 交付与输入完整性

**目标**：现有发行流程完整携带产品实际使用的主进程模块、编译数据、样式与媒体；产物能在离开源码目录后启动。修好输入与资源完整性，不更换打包工具链。

**范围与关键文件**

game/packaging/build.py、pack.mjs、check-package.cjs、check-worker.cjs；game/desktop/ui-assets.cjs、build.cjs、test-packaging.cjs、main.cjs；ManualArchive.tsx 的编译输入；相关 README/当前进度。

**依赖**：无。后续 B—E 增加的真实运行依赖继续接受本包检查。

**保留项**：现有 native 构建路线、锁文件、干净输入检查、无开发 Python 依赖、资源精确允许列表、签名/信任结果如实记录；不放宽任意路径，不运行 audit fix，不更换依赖。

**执行内容**

- [ ] 建立现有 UI_ASSETS 与发行 stage 的对应检查；遗漏列出具体路径并失败。UI 资源从一个现有产品清单派生，主进程运行模块另列明确名单；无需通用依赖框架。
- [ ] 纳入 network-room-port.cjs、wire.cjs、catalog.json，以及 welcome.css、欢迎视频/牌背、两张擂台图。旧中庭资产先检查源码、测试、文档用途；可退出正式分发清单，原文件按现 PRD 保留。
- [ ] 将 docs/results/R04-T01-b/manual-content/content.json 纳入真实编译输入的干净状态与摘要追踪。更新 build-info 的本次来源说明，保留历史证据文件。
- [ ] 只更新 check-package 的页面路径与语义定位；保留禁用开发 Python、隐藏源码、真实 worker、重启、子进程回收、坏包检查。
- [ ] 修正 README/进度中的当前模块名称与验证范围；不把旧 R02/R03 文本重写成当前通过证明。

**验收场景**

成包从非仓库目录启动；不依赖 DEIDEI_PYTHON、开发 venv 或源码；首次/已有档案欢迎、主菜单、真实单人、真实教程、图鉴、无联机配置提示均可进入；新媒体不存在时能检测到包不完整。对 stage 缺文件和图鉴编译输入未提交的情况给出明确失败。

**必要检查**

沿用 npm --prefix game/desktop test；对修正后的 stage 做依赖解析与资源完整性定向检查；在已有可用的原生平台运行一次现有打包与 check-package 路径。Windows/干净机/系统信任若无环境，明确记未测，不能借开发目录启动代替。

**交付物**：A 分支/PR，资源与运行依赖检查、更新后的打包脚本、一个原生平台的真实产物验证记录及未测列表。安装包本体按既有交付方式提供，不放进普通源码提交。

## 任务 B 公开牌局数据与显示正确性

**目标**：当前揭晓、招式图、玩家身份与局势记录来自稳定的公开字段；消除文案反解析和下一拍编号误用。

**范围与关键文件**

game/desktop/types.ts、online/types.ts、online/model.ts、renderer.tsx、online/OnlineRoom.tsx、BattleStage.tsx、fixture.ts；game/runtime/deidei_runtime/view.py、solo.py、tutorial.py；tests-online/test-view-adapter.cjs、test-model.cjs、runtime/tests/test_summary.py/test_runtime.py/test_tutorial.py。

**依赖**：无。供 C 使用的公开数据定义在本包明确。

**保留项**：网络 wire 不变；core 与结算不变；选择/提交阶段不暴露对手招式。历史显示最近八拍、席位最近三拍可以继续，完整已接收记录不在采集处截掉。

**执行内容**

- [ ] 给 DesktopView 增加少量公开本拍数据 public_round；默认 null，仅在已揭晓/result 提供。字段至少包括 match_id、game_id、turn_index、turn_id，以及以 player_id 索引的 entry_id/actual_move/branch/is_recovery；本地 turn_id 可使用现 view_id，联机直接取 last_turn.turn_id。
- [ ] 联机揭晓身份取 core_resolution.ledger 的本拍 ID，余额取 post_turn_players，存活结果取 effective_state.active_ids；下一状态只参与阶段推进。online/types.ts 加上 wire 已验证、但 TS 省略的 ledger 身份字段。
- [ ] 本地由现有 resolution 生成同一公开形态，不把完整私有会话或尚未揭晓动作交给 renderer。fixture 同步提供明确的演示字段。
- [ ] 用 player_id 与 entry_id 记录历史；summary 继续供阅读。记录按 match/game/turn 去重；到真实下一局才切换局内记录；显示层分别取八拍/三拍。
- [ ] 显式根据模式、角色、alive/participation、phase 决定观战、淘汰、揭晓和结果文案，不从 options.length 或人数猜身份。
- [ ] 没收到的历史显示缺口；不在本包增加服务器整场回放服务。
- [ ] 正式单人准备显示当前真正生效的“随机合法对手 / 不限时”。原三档/四档选择仅留明确演示用途，或停用并说明未接通；不伪造不同 AI 策略或倒计时。

**验收场景**

8 种此前命中错误的派生牌；两人同名但出不同牌；普通 g1:t1 揭晓后进入 g1:t2；三人以上淘汰重开 g2:t1；曾义休整、复制/分支；活跃玩家揭晓无 options；观众和淘汰玩家终场；连续十拍后局势可见全部已接收记录；重复快照不重复追加；漏拍重连不伪造记录。

**必要检查**

扩展现有适配单测，精确断言本拍 ID、entry_id、role、私密字段缺席；沿用 runtime 的对应测试；桌面类型/构建；一次真实本地牌局与 MOCK 联机的目标画面检查。仅改变显示数据映射时不重跑全部核心案例。E 再用真实服务覆盖同一场景。

**交付物**：B 分支/PR，少量明确的公开字段、公共历史处理、正确身份/回合展示和定向回归证据。

## 任务 C 交互恢复与状态归属

**目标**：失败后还能操作、断线后能主动离开，键盘保持正常；让状态由负责该流程的代码持有，使后续视觉修改容易审查。

**范围与关键文件**

renderer.tsx、online/OnlineRoom.tsx、BattleStage.tsx、interaction.ts、view-loop.ts；tests-online/fake.cjs 与 smoke.cjs；test-navigation.cjs、smoke-r04-battle.cjs。按职责新增少量本地控制文件与 UI 文件，名称由本包确定并在交付中记录。

**依赖**：B 的公开牌局数据定义。A 独立推进。

**保留项**：既有 generation/readSlot/提交保护、服务快照优先、断线停止重连、离房确认、持续舞台与键盘原生语义；不改变规则、服务器计时或存档格式。

**状态归属**

| 持有者 | 负责内容 |
| --- | --- |
| App/页面壳 | 档案、顶层导航、设置草稿、持续 front-stage |
| 本地会话控制 | generation、readSlot、提交/切场保护、worker 回复、重试/退出/教程命令 |
| 联机会话控制 | OnlineState、revision/receipt、串行命令、输入草稿、离房意图 |
| 联机演出控制 | 入场、结果遮蔽、退场及 timer 的取消/结束；以当前 match/phase 为依据 |
| 共享显示部件 | Avatar、Identity、原生 Dialog、BattleStage、SituationDialog、MatchResult；消费数据与回调 |

不把上述所有状态放进一个全局 store，不把一个巨型 busy 换成另一个全局 busy。

**执行内容**

- [ ] 先为结果退场失败、断线大厅退出、键盘 Enter、终场房主确认建立定向复现。
- [ ] 让结果动作明确处理成功、错误、断线、取消与组件退出。明确失败后恢复同一结果页和按钮，保留错误；成功只跟随最新服务快照。
- [ ] 大厅/同步/战局/终场都有可达的主动退出；断线时保留“停止重连、服务按掉线策略处理席位”的现行为。取消保留原页面；房主终场退出也确认影响。
- [ ] 本地快捷键排除普通按钮的原生激活，保留卡区数字键与 Enter 提交。
- [ ] 提取本地/联机控制和共享部件；让本地终场复用已有 MatchResult。Dialog 仍用原生 dialog，明确 requestClose、忙碌、焦点返回和减少动态行为；移除通过 document.querySelector 点击全局关闭按钮的间接控制。
- [ ] 欢迎与连续舞台保留 DOM 持续性；不要在 refactor 中随意调整 5 秒单人入场、2.6 秒联机入场、650ms 遮蔽/战局接入和 720ms 退场。
- [ ] 先检索 setDetail/setRule 等入口、import、测试和构建用途，再决定旧弹窗代码是否删除。每项删除写出原消费者去向，避免批量格式化掩盖语义改动。

**验收场景**

returnLobby/leave 明确拒绝与网络断开；退场途中收到结果/大厅的新快照；连续点击；组件退出后迟到回复；大厅重连时停止重连；房主/普通成员取消退出；Tab 到暂停、冻结、局势后 Enter；切场读取未完成时退出；新局旧选牌不复活；单人和联机结果共用画面行为。

本地暂停仍明确记录为当前停轮询/输入的语义。完整运行时时钟暂停放在后续单人时限任务中；本包不偷偷改变它。场景动效暂停的覆盖由 D/F 实测确认。

**必要检查**

沿用导航、在线命令、适配与相关 Electron smoke；错误注入使用现有 fake，仍标 MOCK。阶段执行桌面类型/构建；不因移动 JSX 触发全量服务端或打包长跑。

**交付物**：C 分支/PR，可恢复的交互、职责清楚的少量文件、一处共享结果/弹窗实现、状态归属与删除清单及目标场景证据。

## 任务 D 最小 UI 规则与屏幕适配

**目标**：把现有 DESIGN.md 变成实际生效的最小共用规则，消除旧 CSS 覆盖；不同内容尺寸、DPR 和宽高比共享可解释的布局与媒体裁切办法。

**范围与关键文件**

DESIGN.md、style.css、welcome.css、C 的共享部件、renderer/OnlineRoom 的场景外壳、BattleStage/ManualArchive/WelcomeEntrance 的布局容器、build.cjs、dev.cjs、ui-assets.cjs 与相关 smoke。

**依赖**：C 的共享部件和状态归属。只读样式采集可提前。

**保留项**：当前红黑/冰青、轻玻璃与位图大厅；原生按钮/表单/dialog/键盘行为；33 招式可达；持续舞台；减少动态/透明度；不换 UI 或动画库。

**执行内容**

- [ ] 在真实 Electron 记录少量代表元素的 computed style：菜单主动作、联机创建/返回、prepare-start、危险确认、Dialog、设置输入、HUD。覆盖 default/hover/active/focus-visible/disabled/busy。
- [ ] 复用并修订最小 tokens：语义颜色、正文/操作/标签字号、页面安全边距、点击区、玻璃表面、层级和动效时长。先让 type-body/control/label/meta 实际被消费，不先造大规模 token 表。
- [ ] 去除仍命中新页的旧在线容器/hover 覆盖；primary/danger 的各态保留各自语义；减少动态和透明度规则放到不会被普通后写规则重新开启的位置。
- [ ] 按场景和共用职责迁移 CSS：基础 tokens、共用控件/弹窗、持续舞台、战局、图鉴、联机、欢迎。先确定最终生效规则和 keyframes，再迁移；构建可继续产出既有 style.css/welcome.css，避免增加运行时加载复杂度。
- [ ] 说明 CSS 内容尺寸、DPR、物理像素分别用于什么。内容布局使用 CSS px；DPR 用于资源/清晰度测量；不把整屏 transform 缩放当唯一适配手段。
- [ ] 共用安全区与场景锚点；菜单、竞技台、人物、欢迎视频分别明确 contain/cover、焦点位置与可裁区域。文字/按钮位于安全内容区，装饰允许裁切；视频末帧与标题交接按真实素材核验。
- [ ] 更新 dev watcher 对新职责文件的覆盖；保持主进程与白名单改动需要重启的事实。
- [ ] 清理前搜源码、构建、白名单、smoke、打包和文档。旧中庭源资产按现 PRD保留，正式引用可退出；不按行数机械切文件。

**验收场景**

1000×650、1060×650、1366×768、1920×1080；16:10 和超宽至少各一例；可用设备上的 4K/DPI/全屏，记录 innerWidth/innerHeight、devicePixelRatio、系统缩放和真实显示器信息。前述内容尺寸或 DPR 模拟不能替代物理屏幕验收。

重点看：所有主动作首屏可达、关键文字清楚、33 卡/教程指导不被裁、2/6 席位不碰撞、Dialog 可滚动且关闭可达、视频/场景切换无错位闪帧、减少动态/透明度偏好有效。

**必要检查**

类型/构建；目标状态截图和 computed style；使用已有 prepare-layout、smoke-entry、smoke-manual、smoke-r04-battle、online smoke 中与改动有关的场景。F 提供同场景性能前后对照；不把每个 viewport 组合扩展成全量测试矩阵。

**交付物**：D 分支/PR，简短可执行的 DESIGN 修订、实际消费的 tokens、按职责迁移的样式、内容/媒体适配办法与代表性证据。

## 任务 E 真实房间联调与安全候选接入

**目标**：当前共享界面可通过普通 Electron 主进程连接真实房间服务；在保留既有安全规则的前提下审查并接入已经提交的 WSS 技术成果。

**范围与关键文件**

game/integration/gui.cjs、peer.cjs、run.py、sequences.py；game/desktop/tests-online/capture-room-results.py；desktop main.cjs、online/network-room-port.cjs、wire.cjs、model.ts、types.ts、tests-online；server 的相关启动与传输文件。候选 #31 还涉及 online/service-config.cjs、server/transport_tls.py、integration/secure 及对应测试。新运行模块同步纳入 A 的分发检查。

**依赖**：最终 GUI 联调使用 B+C；成包验证使用 A。harness 定位修复和候选只读审查可以先做，不等 D。

**保留项**：rooms-1.1、揭晓前保密、请求原样恢复、服务端计时与离房策略、原生证书验证、主进程持有恢复凭证、renderer 沙箱与固定 IPC；不部署公网或扩大 renderer 权限。

**已核对的技术候选**

- PR #30：4e5c37e4417be80fe0130ffcab24eb75cf6bee7e，仍开放；为独立最终候选/测试工具线，已有零匹配 selector 误报 PASS 待处理记录。
- PR #31：4df3287e793223f776208f72dbd07c8a32062e33，仍开放；安全远端连接候选。
- 两者未包含在本次 #33 head。此审读核对了当前元数据与 #31 相对已接受产品 d0c96408a3aa8c14174099da4247bcac953fb9f7 的 15 项 game 文件清单，没有对两份完整候选作最终接受。

**执行内容**

- [ ] 先修真实回环工具的过时界面定位与 1500ms 假设。按服务实际 deadline/phase 等待 5 秒揭晓，保留真实 server/socket，不能换 fake 让 smoke 通过。选择器零匹配时失败并打印目标，不记 PASS。
- [ ] 从固定干净源码重新采集公开 Room/core 样本，记录 SHA/dirty/来源；加三人以上 restart_survivors。现旧样本仍留作历史，不能覆盖其来源标识。
- [ ] 用普通 main、真实 NetworkRoomPort、真实 Python 服务跑两名玩家与观众，连玩两场；覆盖 2/6 玩家、定时/提前揭晓、退场、房主缺席、断线恢复、服务重启、停服后离线单人。
- [ ] 完整读取 #31 指定 head 的新增/修改文件及依赖，相对 d0 比较真正技术增量；重新审查配置来源、地址解析、证书失败路径和测试。使用明确的代码变更整合到当前 R04 衍生分支，不整文件覆盖新版 main/model，不带回旧页面。
- [ ] 保留合法 WSS 配置、证书/SAN/过期/信任链验证，远端明文 ws 拒绝；证书失败前不发送身份与房间凭据。renderer 不增加 URL 输入或新权限。
- [ ] 若复用 #30 测试工具，只取已核查修正；核对零匹配选择器失败处理，不重复旧 900 秒任务作为本包默认动作。

**验收场景**

正确 CA 的本机 WSS 正例；坏 CA/错 SAN/过期证书均失败且服务端身份请求计数为零；无服务/错误配置不妨碍离线；重连前后请求 ID/序号/内容不变；旧消息失效；提前揭晓前他人招式不可见；观众无提交能力；时限改动只作用于之后选择阶段；房主/成员主动退出和强制离房符合现服务语义。最短 5 秒回合中，在入场演出尚未结束时到达的揭晓/结果仍以最新服务快照为准；不暂停服务去迁就演出。

**必要检查**

沿用 online、server 与候选 TLS 的定向检查；真实回环 Electron smoke 是包内关键证据。当前 5 秒揭晓、B 的回合/身份修正及 C 的失败恢复都在同一真实链路验收一次。

跨设备真人还需要实际受控服务地址、有效证书及两台设备；能先完成的代码与本机验证全部交付。没有这些外部条件时状态写“真实回环/本机 TLS 已验，跨设备未验”。不启动公网部署、购买或绕过信任设置。

**交付物**：E 分支/PR，能运行的真实联调工具、当前 R04 的真实房间证据、#31逐项审查结果与经过审查的整合代码、配置示例及待真人验收事项。

## 任务 F 性能与欢迎可靠性

**目标**：回答卡顿发生在哪一段、欢迎失败属于哪一类，再做有证据的小改动。基线可先于 B—E 采集，修正以当时已审查输入为准。

**范围与关键文件**

WelcomeEntrance.tsx、welcome.css、renderer 的欢迎/舞台生命周期、OnlineRoom 计时更新、BattleStage、ManualArchive；smoke-entry.cjs 及必要诊断脚本。只有取样指向主进程媒体读取时才进入 main.cjs。

**依赖**：基线无；最终对照使用 D，真实联机热点使用 E。每次注明精确输入，避免混用前后版本。

**保留项**：原欢迎断言、媒体错误回退、跳过/重播/声音、减少动态、持续舞台、焦点与 inert；不修改核心或服务器时限，不靠全面 memo/cache 或关掉所有效果伪装改善。

**执行内容**

- [ ] 用相同机器/刷新率/内容尺寸/DPR记录冷启动、首次视频、重播/跳过/失败回退、页面往返、2/6人揭晓和大窗口。记录首个可操作时间、帧间隔 p50/p95/p99、超过50ms停顿次数、CPU/内存与可获得的GPU指标。无法取得的指标写不可得。
- [ ] 先保留一份当前欢迎失败流程的基线。smoke-entry 即使在第98行之前失败，也在 finally 或独立异常处理里保存页面/人物透明度/卡片及场景transform、动画currentTime/playState、媒体currentTime/readyState/networkState/error与当前路由；记录测量起点和输入。
- [ ] 把正常媒体与人为unknown.mp4的失败回退分别记录；区分新主进程和旧热更新窗口。不要以“重启后视频能播”推导“旧窗口卡顿已解决”。
- [ ] 只有 profile 指向的热点才处理：例如滤镜动画、隐藏场景持续工作、重复适配/全页计时渲染、媒体释放、错误的timer生命周期。不要预先指定这些都是根因。
- [ ] 在同条件下记录改前/改后；最多用少量连续重播/往返验证资源趋势，不自行扩成长时间压力工程。若未复现，交付诊断与未解结论，保留原失败。
- [ ] 核验暂停时场景/伪元素/transition实际是否停止，保持本地和联机语义不同；若需要改变运行时时钟暂停，转入后续单人时限设计。

**验收场景**

正常欢迎、声音切换、跳过、重播、媒体拒绝、已有/无档案、连续返回、减少动态；图鉴滚动；2/6人揭晓；低/高DPR和全屏。关键操作不依赖动画结束才能解除一个已失败的动作。

**必要检查**

沿用 smoke-entry 和具体受影响 smoke；保留失败采样。性能判据以可重复数据为准，先给出明确的测量预算/硬件条件再谈优化幅度。未测过的 4K、显存与长期泄漏不写通过。

**交付物**：F 分支/PR，精确版本的基线与对照、欢迎失败可留证的检查、已定位问题的小修正或明确未定位结论。

## 本阶段暂不扩大实施的功能

单人三档强度的策略含义、原计划 1—10 级与当前三档的关系、超时如何处理、真正暂停如何影响时钟，还需要一个短的玩法决定。单纯加两个 IPC 参数不能完成这些功能。当前任务先如实显示随机合法对手与不限时，不接模型或暗中改成超时自动出牌。

普通音源、多档案、AI 问答/复盘、多人 AI、聊天/好友系统不加入 A—F。跨设备真人与可分享发行也有各自尚未取得的证据，不从本次审读推算完成百分比。

## 来源链接

本次源码链接均固定到审读 head；PR #30/#31 的状态引用为本次实际读取的 PR 元数据。下列源码可以逐项复核正文和任务包中的事实。

[pr33]: https://github.com/Kalopsiazza/DeiDei/pull/33
[handoff]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/docs/results/R04-T01-b/STAGE-HANDOFF-2026-10-02.md
[changed]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/docs/results/R04-T01-b/CHANGED-FILES.txt
[desktop-readme]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/README.md
[worker-port]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/worker-port.cjs
[worker]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/runtime/deidei_runtime/worker.py
[solo]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/runtime/deidei_runtime/solo.py
[manual]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/ManualArchive.tsx
[tutorial]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/runtime/deidei_runtime/tutorial.py
[network]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/online/network-room-port.cjs
[server]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/server/deidei_server/server.py
[renderer-history]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/renderer.tsx#L107-L120
[online-history]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/online/OnlineRoom.tsx#L71-L83
[online-model]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/online/model.ts#L62-L78
[room-samples]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/tests-online/room-results-v11.json
[battle]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/BattleStage.tsx
[online-result]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/online/OnlineRoom.tsx#L94-L113
[online-room]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/online/OnlineRoom.tsx#L151-L198
[renderer-keys]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/renderer.tsx#L66-L74
[main]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/main.cjs
[packaging]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/packaging/build.py#L24-L36
[pack-inputs]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/packaging/build.py#L145-L160
[integration-gui]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/integration/gui.cjs
[integration-seq]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/integration/sequences.py
[package-check]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/packaging/check-package.cjs
[style]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/style.css
[smoke-entry]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/game/desktop/smoke-entry.cjs

[ci]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/.github/workflows/ci.yml
[package-ci]: https://github.com/Kalopsiazza/DeiDei/blob/88185af2c9372b2f1d88707218cafee590b94018/.github/workflows/r02-t05-package.yml
