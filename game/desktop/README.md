# R02 本地单人对局

单人入口已连接本机 Python worker 与 classic-1.0.1 核心，对手标明为「临时随机对手」。33 张牌的资格、费用、胜负和曾义休整来自真实规则。开发预览仍为明确标注的 fixture 固定脚本；切换会结束当前场。

## 从源码运行

需要本机 Python 3.11+、Node/npm；推荐沿用已经验证的 Node 24.12.0 / npm 11.6.2。没有免环境安装包。先在仓库根目录准备环境：

```sh
python3 -m venv game/runtime/.venv
npm --prefix game/desktop ci
DEIDEI_PYTHON="$PWD/game/runtime/.venv/bin/python" npm --prefix game/desktop start
```

Python 包只用标准库，无需 pip 安装。已有 Python 可以直接指定其绝对路径：

```sh
DEIDEI_PYTHON=/absolute/path/to/python3 npm --prefix game/desktop start
```

前端连续调整时使用开发监听：

```sh
DEIDEI_PYTHON=/absolute/path/to/python3 npm --prefix game/desktop run dev
```

它沿用现有 esbuild 和 Electron，修改 renderer、样式、在线页面源码或 `assets/menu` 下的 PNG / WebP 后自动重新构建并刷新窗口。修改 `main.cjs`、`preload.cjs`、worker 或规则代码时仍需退出后重新启动；关闭 Electron 窗口会同时结束监听进程。

Windows 源码步骤（本包未实机验证）：

```powershell
py -3.11 -m venv game/runtime/.venv
npm --prefix game/desktop ci
$env:DEIDEI_PYTHON = (Resolve-Path game/runtime/.venv/Scripts/python.exe).Path
npm --prefix game/desktop start
```

`DEIDEI_PYTHON` 仅由本机启动环境提供，renderer 不接收路径。未指定时尝试 PATH 中的 `python3`。缺运行时、超时或进程退出时显示「本场中断，可重新开始」，需自行退出本场并重开；不会恢复丢失的对局，也不会替换成演示数据。

依赖和锁保持原版本：Electron 44.3.0、React 19.3.0、TypeScript 7.0.2、esbuild 0.28.2、Forge 7.11.2、Playwright-core 1.63.0。输入交付记录中的 **23 项开发工具链告警尚未处理**，没有执行 audit fix、Forge package/make 或发布。本包只验收本机源码运行。

## 操作与验证

先选牌，再点提交；数字键 1–0 选中，Enter 提交。选择时栅格竞技台虚化为背景，待选大卡居中，左侧保留最多八拍历史；本人五类资源以独立图标、名称和准确数量显示，和出牌时间、三行牌组、确认按钮共同组成操作区。提交后大卡旋转收进本人席位，整个操作区向下退场并景深虚化，竞技台扩大后恢复清晰，牌组不会向上补位。对手在本拍开始、接收玩家输入前固定出招。本地双方揭晓后真实保留 3 秒结算展示，顶栏同时显示进入下一回合的秒数；席位保留最近三拍正式卡面，再进入下一拍。顶部“局势”集中展示所有玩家资源、逐回合出招和淘汰状态；旧资源详情窗已移除。单人“暂停”和“冻结”停止前端轮询、操作及场景动画，冻结不打开弹窗；多人菜单不暂停服务端牌局且冻结禁用，房间设置当前只是只读 UI。曾义休整无需点灰牌。档案和设置保存在 Electron userData 的 local-profile/profile.json，与 worker 生命周期独立。

从仓库根目录：

```sh
npm --prefix game/desktop test                         # 类型检查、构建；桌面 9 + 通信 9 + 导航 4 项
node game/desktop/smoke-live.cjs                       # 当前真实 Electron 验收
PYTHONPATH=game/core:game/runtime python3 -m unittest discover -s game/runtime/tests -v
```

窗口测试用独立临时档案和专用启动器 `smoke-live-main.cjs`，固定 Random(2) 与独立分支 Random(999)，仍调用真实核心；保存实际 ledger 和截图至 `docs/results/R02-T04-a`。它会终止自己启动的测试 worker 验证中断，不修改网络或系统权限。`npm --prefix game/desktop run smoke` 同样运行当前窗口验收。旧 `smoke.cjs` 保留为 T03 历史脚本，含已变更的演示按钮和固定结果预期；当前 UI 验收使用 `smoke-live.cjs`。

R02-T04-b 开场和场景切换期间，返回、标题等导航暂时禁用，成功或失败后恢复。专项窗口复测与原回归可从根目录运行：

```sh
node game/desktop/smoke-live-b.cjs
DEIDEI_SMOKE_OUTPUT=docs/results/R02-T04-b/regression node game/desktop/smoke-live.cjs
```

专项脚本在独立临时档案中延迟开场成功/失败、验证返回与标题、重试重开及预览切换；用 Random(13) 产生真实攒/云账目。延迟与失败注入只在专用测试启动器中。截图和账目写入 `docs/results/R02-T04-b`；原回归用输出目录覆盖参数，避免改写 a 包结果。

## 来源与边界

输入集成 SHA `41029218df420985ec06c01f27d4620fd8f35a16`；桌面 tree 来自 `b65842a8e2fcaebf0ddef74c4f3cf4ca5aa366d1`。新 `worker-bridge.cjs` 取自 `135b938fcfe0486895adfeea37fab73ee5f881dd:experiments/r01-t02-b/bridge.cjs`，改为 1MiB 帧并补 idle-exit 状态。署名仍归 DeiDei contributors，不新增许可证。

renderer 保持沙箱与隔离，IPC 只开放固定操作；只有 app:// 的本地资源可以加载。worker 使用 shell:false，最多 16 个待答请求、10 秒超时，按进程隔离请求并等待 close 回收。没有网络服务、旧模型、训练、正式动画、安装包、签名或部署。

手绘纸色与三类 18/9/6、三排十一列沿用已交付原型。1920×1080 证据为开发视口，非该尺寸物理显示器；物理断网和 Windows 仍需真人复测，步骤见本包 TEST-MATRIX。

## R03-T02-b 好友房桌面客户端（rooms-1.1）

主菜单的好友联机现已接入 `online/NetworkRoomPort`，通过主进程全局 WebSocket 连接开发服务。正式启动默认没有服务器地址；没有配置时显示「联机服务尚未配置」，原离线单人仍可用。连接只在进入好友房时建立，临时会话凭证仅留在主进程内存，退出不修改本机档案格式。

热更新 `npm run dev` 在未配置 `DEIDEI_ROOM_URL` 时自动使用仓库已有的 scripted fake socket，可直接查看创建房间、加入房间、大厅和牌桌；界面会明确标记「开发预览 · MOCK · 脚本化 socket」。这只用于前端迭代，不代表真实联机。配置地址后，热更新会改走真实开发服务：

```bash
DEIDEI_ROOM_URL=ws://127.0.0.1:8765/rooms-v1 npm --prefix game/desktop run dev
```

正式界面路径为「L01 联机前厅 → L02 房间部署／L03 房间接入 → L04 房间大厅 → L05 多人入场 → L06 正式战局 → L07 联机结算」。多人战局复用本地正式 `.battle-table` 与共享 `BattleStage`，不再渲染旧 `.online-table`；房主可从结算返回大厅准备下一局，普通成员等待房主。无服务的 `npm run dev` 只提供这条路径的本机 UI 预览，真实房间仍须配置 `DEIDEI_ROOM_URL` 并单独验收。

后续集成包准备好真实服务后，开发启动方式为：

```sh
DEIDEI_ROOM_URL=ws://127.0.0.1:8765/rooms-v1 npm --prefix game/desktop start
```

启动环境只接受 `ws://127.0.0.1:<port>/rooms-v1` 或 `ws://[::1]:<port>/rooms-v1`，拒绝用户名、查询、片段和公网地址。页面没有 URL 输入或凭证接口。CSP、沙箱、本地资源协议、IPC sender/frame 校验保持；原 worker 不处理网络消息。

创建表单从服务 hello 读取默认和范围。房间选项及身份来自服务；33 项卡牌资格/费用来自 self.options，卡面文字来自本地 catalog。DD 使用整数分数字形，揭晓资源取 ledger，观众与淘汰者没有选牌区。准备、房主开始、满员后主动改观战、房主缺席提示、重连、结果/下一场和离房均有独立状态。

每次只发一个待确认意图。断线后按 1/2/4/8 秒带抖动重连，resume 后保留原请求 ID/序号/内容重试；明确失败的操作不自动重发。收到旧连接或旧快照不会覆盖新状态。正常离房等确认后关闭连接；网络断开时主动离开会停止重连，原席位由服务的掉线策略处理。系统关窗确认后最多等待 3 秒发送/确认离房，网络无法确认时仍允许退出。

```sh
npm --prefix game/desktop test          # 原有 25 项保留，包含构建与类型检查
npm --prefix game/desktop run test:online
npm --prefix game/desktop run smoke:online
```

开发热更新和新窗口测试通过 `tests-online/smoke-main.cjs` 注入 scripted fake socket，界面标记「开发预览 · MOCK」，截图不代表真实联网。`smoke:online` 另外启动普通 main 验证无配置提示和真实离线 worker。结果见 `docs/results/R03-T02-b/`，没有接入任务01服务、改变打包路线或进行公网部署。

本任务使用输入锁定的 React 19.3.0、Electron 44.3.0、TypeScript 7.0.2、esbuild 0.28.2、Playwright-core 1.63.0 和 @electron/packager 20.3.0，未改直接依赖或 package-lock。上方 R02-T04-a 的 Forge/23 项告警文字是历史交付记录，不能当作本次依赖现状。

rooms-1.1 默认每拍 10 秒，可选 5/8/10/12/20/30 秒；旧版本 hello 显示明确不兼容。房主可在大厅、选择、揭晓、结果阶段调整之后每拍时限，自然淘汰后仍可调整。当前拍时限、截止时间与已交牌保留，只有新快照更新待生效设置。

房主缺席不暂停牌局：页面分别显示连续缺席次数或恢复剩余秒数；pending_close 显示本拍关闭安排并隐藏受限操作。membership.ended 自动返回联机入口，保留本机档案与临时身份，丢弃旧房操作和迟到消息。

`tests-online/room-results-v11.json` 是任务01 b 的实际 Room/core 输出（含完整 last_turn）；内含来源 HEAD、是否有未提交修改及源码 SHA256。使用合成时钟/会话容器，不代表 socket 联调。可在获准的服务 checkout 上重新生成：

```sh
python3 game/desktop/tests-online/capture-room-results.py /path/to/service-checkout > /tmp/room-results-v11.json
```

采集脚本只读外部源码，不替换本项目服务，也不修改解码字段。终局 `to_game_id` 必须是与 effective_state.game_id 相等的字符串；单元检查覆盖规则/退赛导致一人或无人存活，拒绝 null、错误游戏标识和私密字段。

## 新手实战教程（本地）

规则图鉴右上角「新手实战」进入同一真实牌桌与 Python 规则核心。第一场跟随界面指示，亲手完成攒 → 防 → bi 三拍；结算后手动点继续。第二场明确重开、双方资源归零，撤掉选牌指示，从三张牌里自行选择，赢下练习即完成；可请求提示，输了直接重试独立场。教学对手在玩家提交前固定合法出招，明确标注，普通单人的随机对手与 33 牌不变。

教程不计出牌时间、不保存进度或新增档案字段，可用暂停菜单退出。进阶资源仍按真实核心变化，完整数据可从局势查看，但基础三牌教程只重点显示 DD。本次新增本地固定教学 IPC 与 worker 会话，未增加 renderer 权限、网络接口、规则判定或依赖。旧开发窗口需重启一次，随后 TutorialCoach/CSS 可热更新。

```sh
node game/desktop/smoke-tutorial.cjs
PYTHONPATH=game/core:game/runtime python3 -m unittest discover -s game/runtime/tests -v
```

PRD/分镜及实际截图、核心账目在 `docs/results/R04-T01-b/tutorial/`。教程效果仍需新玩家试玩；未验收 Windows 或安装包。

图鉴右上角的「先看三张牌／常见问题／完整规则」使用独立原生弹窗，关闭后保留档案与滚动位置；内部卡牌链接关闭弹窗并定位对应招式。

开发预览新增 `P01 · 首次进入／欢迎建档`，复用真实初次建档页面；可以试填昵称、选头像，但不写档案，结束预览返回菜单。主菜单退出应用与牌桌退出本场都先确认，取消保留当前页面／选牌。


欢迎流程已接入真实首次建档页面：DeiDei 标题与右侧牌背 → 点击进入牌厅，翻牌至中央 → 填写昵称／头像 → 新手实战或主菜单。已有档案从「开发预览 → P01」重播，预览不写档案。`WelcomeEntrance.tsx` 和 `welcome.css` 已加入 `npm run dev` 热更新监听，界面不增加依赖；6 秒 AI 片段生成包位于 `docs/results/R04-T01-b/opening-3d/combat-6s/BRIEF.md`，用户回传的 4:3 成片已上下各裁 180px，得到 1920×1080／6.584 秒，保留音轨并接入开场；自动静音播放，可开启声音／跳过，标题页可重播。播放结束淡入标题／牌背；减少动态直接到标题，媒体失败回退标题。视频仅由本地精确资产白名单与 media-src self 提供。
