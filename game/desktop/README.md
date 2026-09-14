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

先选牌，再点提交；数字键 1–0 选中，Enter 提交。对手在本拍开始、接收玩家输入前固定出招。双方揭晓后约 800ms 进入下一拍；曾义休整无需点灰牌。点击席位资源可读准确数量与进度，大数不会通过 Number 丢精度。档案和设置保存在 Electron userData 的 local-profile/profile.json，与 worker 生命周期独立。

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

## R03-T02-a 好友房桌面客户端

主菜单的好友联机现已接入 `online/NetworkRoomPort`，通过主进程全局 WebSocket 连接开发服务。默认没有服务器地址；没有配置时显示「联机服务尚未配置」，原离线单人仍可用。连接只在进入好友房时建立，临时会话凭证仅留在主进程内存，退出不修改本机档案格式。

后续集成包准备好真实服务后，开发启动方式为：

```sh
DEIDEI_ROOM_URL=ws://127.0.0.1:8765/rooms-v1 npm --prefix game/desktop start
```

启动环境只接受 `ws://127.0.0.1:<port>/rooms-v1` 或 `ws://[::1]:<port>/rooms-v1`，拒绝用户名、查询、片段和公网地址。页面没有 URL 输入或凭证接口。CSP、沙箱、本地资源协议、IPC sender/frame 校验保持；原 worker 不处理网络消息。

创建表单从服务 hello 读取默认和范围。房间选项及身份来自服务；33 项卡牌资格/费用来自 self.options，卡面文字来自本地 catalog。DD 使用整数分数字形，揭晓资源取 ledger，观众与淘汰者没有选牌区。准备、房主开始、满员后主动改观战、暂停、重连、结果/下一场和离房均有独立状态。

每次只发一个待确认意图。断线后按 1/2/4/8 秒带抖动重连，resume 后保留原请求 ID/序号/内容重试；明确失败的操作不自动重发。收到旧连接或旧快照不会覆盖新状态。正常离房等确认后关闭连接；网络断开时主动离开会停止重连，原席位由服务的掉线策略处理。系统关窗确认后最多等待 3 秒发送/确认离房，网络无法确认时仍允许退出。

```sh
npm --prefix game/desktop test          # 原有 25 项保留，包含构建与类型检查
npm --prefix game/desktop run test:online
npm --prefix game/desktop run smoke:online
```

新窗口测试只在 `tests-online/smoke-main.cjs` 注入 scripted fake socket，界面标记「开发预览 · MOCK」，截图不代表真实联网。`smoke:online` 另外启动普通 main 验证无配置提示和真实离线 worker。结果见 `docs/results/R03-T02-a/`，没有接入任务01服务、改变打包路线或进行公网部署。

本任务使用输入锁定的 React 19.3.0、Electron 44.3.0、TypeScript 7.0.2、esbuild 0.28.2、Playwright-core 1.63.0 和 @electron/packager 20.3.0，未改直接依赖或 package-lock。上方 R02-T04-a 的 Forge/23 项告警文字是历史交付记录，不能当作本次依赖现状。
