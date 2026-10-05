# R02-T04-a 本地交付

状态：**LOCAL_SOURCE_PASS**。已完成真实单人循环、会话去重、自动休整、worker 通信及公开资源显示；不是 R02 整体结束、安装包或发布验收。

- 输入 `input_sha`：`41029218df420985ec06c01f27d4620fd8f35a16`（`integration/r02`）。
- 受测代码 `tested_code_sha`：`e340a2a20fa8d8274c995b3a17759abf3ade92b6`。
- 本地结果分支：`codex/r02-t04-a-live`；后续结果提交仅增加本目录证据，不改变受测代码。
- 用户明确授权后已推送并创建 [PR #16](https://github.com/Kalopsiazza/DeiDei/pull/16)，目标为 `integration/r02`。已回读 base/head/SHA；PR 为 OPEN，未合入。创建时的回读记录见 [PR-SUBMISSION.json](PR-SUBMISSION.json)。

## 解决什么、改了什么

原桌面使用固定脚本，不能实际对战。本包新增 Python 标准库 `game/runtime/deidei_runtime`：MatchSession 调用真实核心并仅应用一次成功请求；SoloGame 管理预先固定的随机出招、揭晓、下一拍与结束；view 按真实资格/费用和 ledger 生成公开视图；worker 只接受六种白名单 JSONL 操作。

`game/desktop/worker-bridge.cjs` / `worker-port.cjs` 接入本机受控子进程。单帧 1MiB、最多 16 个待答请求、10 秒超时，旧进程消息隔离并等待 close 回收。空闲退出也记为本场中断；读取或提交不会悄悄另开一场。桥接来源为 `135b938fcfe0486895adfeea37fab73ee5f881dd:experiments/r01-t02-b/bridge.cjs`，没有引入其旧裁判。

renderer 使用单个在途读取和本地世代检查，覆盖选牌、提交、休整、揭晓与观战；读取失败提供重新读取/退出。两方席位显示公开 DD、雷电、充能、成熟炸药和奖励，详情保留准确大数与公开次数。DD 采用 BigInt 精确分数；Python 格式化也覆盖 5000 位输入。牌区仍是三类 18/9/6、三排十一列。live/fixture 的入口、标题、结果和详情明确区分。

随机对手为 **临时随机对手 / random-legal-v1**：每拍在接收本人选择前，等概率挑选一个合法入口；默认 SystemRandom，分支 token 来自另一份 SystemRandom。没有旧模型或策略水平宣称。窗口验收使用专用测试入口的 Random(2) / 独立 Random(999)，仍是实际核心结算，不进入普通产品入口。

## 怎样验证

全部最终命令在固定受测代码上运行，退出码均为 0，见 [validation.json](validation.json)。一键复现：`python3 docs/results/R02-T04-a/validate.py`。

| 验证 | 结果 |
| --- | --- |
| 原独立样本 | 192 PASS，469 次 resolve；2 份原 session 样本仍 NOT_RUN |
| 核心自测 | 原 174 PASS |
| 独立工具自测 | 原 8 PASS |
| 新 runtime | 13 PASS，包含 S01—S08 和协议/可见性/显示 |
| 原桌面自测 | 原 9 PASS；类型检查与构建通过 |
| 新桌面/通信 | 9 PASS，包含 S09—S10、真实子进程、空闲退出与 5000 位精度 |
| 根基础检查 | 40 项，39 PASS + 原有 #1 的 1 项 expectedFailure |
| 连续随机单元对局 | seeds 0—11 共 12 场实际结束；回合数 21/2/12/1/1/6/14/1/1/2/3/1 |
| 真实 Electron | 两场完整 5 回合对局；重开、读取失败/重试、真实 worker 终止、自动休整、fixture/观战均通过 |

本机为 macOS 27.0 / Apple Silicon arm64，系统 Python 3.13.7，Node 24.12.0 / npm 11.6.2；Electron 44.3.0 内嵌 Node 24.20.0。依赖复用已有 T03 锁文件对应 node_modules，未重新安装或更换版本。Python 3.11 为源码支持下限，本次实际使用 3.13.7，未另作 3.11 实机复验。

图形证据来自实际打开的 Electron 窗口，由 Playwright 键鼠操作与截图；不是生成图。宿主显示器逻辑尺寸 1710×1112、缩放 2。1366×768 与 1920×1080 均为 renderer 开发视口，后者不代表物理 1080p 显示器。未声称用户本人手动验收。

- [1366×768](live-table-1366x768.png) / [1920×1080](live-table-1920x1080.png)
- [攒揭晓](live-charge-revealed.png) / [Bi 对防御](live-bi-defense-revealed.png) / [第二场结果](live-second-result.png)
- [自动休整](live-auto-recovery.png) / [读取失败](live-read-failure.png) / [进程中断](live-worker-interrupted.png)
- [实际 Resolution 账目](live-window-ledger.jsonl) / [窗口检查与环境](live-smoke.json)

## 对现有内容的影响

核心、独立样本、正式规划、旧源码/模型/测试、根依赖均只读；没有修改 CI。核心 tree 仍为 `628afbee9bd9d2c512c2b6d424a385f597025ebc`；样本 tree 仍为 `237a573d53b6182c6d15da2411e0aca33fa9ca85`。原始输入、来源 SHA/tree、样本与产物 hash 见 [MANIFEST.json](MANIFEST.json)。

桌面依赖版本与 package-lock 字节未变；只更新本地项目说明和 smoke 脚本入口。原 9 项自测及历史 smoke 源码保留，当前 `npm run smoke` 指向真实窗口验收。没有规则变化、模型变化、新依赖、联网、训练、正式动画、Forge 分发、证书或部署操作。

## 已知问题与未验证

- 原 T03 审计 **23 项**（3 low、19 high、1 critical）仍未处理；[继承的审计文件](dependency-audit-inherited.json) 来自固定 T03 提交，不是本次重新执行的 npm audit。没有因生产依赖统计而宣布整体安全。
- C074/room_state_preserved、C081/session_request_replay 两份原独立 session 样本仍 NOT_RUN；本包新增来源明确的 Session 检查，未修改原驱动标记充数。
- Windows、物理断网、用户手动验收、免 Python/Node 的分发、签名、旧模型均 NOT_RUN，详见 [TEST-MATRIX](TEST-MATRIX.md)。已有资料/配置和对局生命周期分离已经实际测试，不等于物理断网已验收。
- 揭晓节奏为本包的 200ms + 800ms 开发选择；无对局持久恢复，worker 中断后须重新开场。
- 开发阶段发现的空闲退出缺陷已修复并加入回归测试；保留首次失败截图和 [说明](INITIAL-FAILURE.md)，未计为最终通过证据。

已完成聚焦自审；Kimi 按停用约定未调用。没有外部审查通过声明。
