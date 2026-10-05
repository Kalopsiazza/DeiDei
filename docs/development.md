# 现版开发起点

2026-10-05，R04 main 整合候选已交付，待最终源码确认；未合入或发布。历史报告只证明其各自版本，后续前端仍在原分支快速试改。

| 路径 | 职责 |
| --- | --- |
| `game/core/deidei_core` | classic-1.0.1 的 33 招规则，输入校验与确定性结算 |
| `game/runtime/deidei_runtime` | 本机 worker、会话与 random-legal-v1 对手 |
| `game/server/deidei_server` | rooms-1.1 服务端判定、去重、保密、时限和重连 |
| `game/desktop` | React/Electron 前端、主进程、沙箱 IPC 与网络客户端 |
| `legacy/rl` | 原机器学习 AI 的独立保全材料，不参与现版运行 |

启动见 [根 README](../README.md) 与 [桌面 README](../game/desktop/README.md)。worker 只用标准库，服务单独按锁安装，ML 依赖仅供旧 AI 研究。界面调用真实核心，不复制判定；保留 sandbox、contextIsolation、CSP、发送方校验、证书验证与精确资源白名单。

## 检查

根目录 `python3 scripts/check.py`：语法检查后以独立进程依次运行根 tests 递归发现（维护工具、规则/房间 harness 等）、game/core/tests、game/runtime/tests、独立规则驱动和 legacy/rl/check.py。各组按 os.pathsep 设置自己的 PYTHONPATH；旧模块不进入现版会话。输出组名、发现用例与结果，空组／导入失败／非零退出让总检查失败。独立样本中尚未支持的 session 项如实显示。

`npm --prefix game/desktop test` 已含类型检查、构建、Node 桌面／联机及 stage 检查，不需重复 build。main PR/push/手动 CI 保留 job/check 名 `core-tests`，Node 24.12.0、Python 3.11 和已有 lock。

GUI 修改实际打开、用自建档案验证并附截图。网络变动补揭晓前保密、重复提交、断线案例；规则变动补具体局面。失败不得靠删断言、skip 或新增 expectedFailure 隐藏。旧 #1 的原 expectedFailure 仅属于 legacy。窗口、原生包、网络长测及 ML 不加入每次 CI；R02 专用打包工作流保持历史用途，不算现版 main CI 覆盖。

## 协作与交付

按 [WORKFLOW](production/WORKFLOW.md) 做影响范围检查与阶段提交。技术行为变化另作任务，不借视觉试改改玩法、安全、网络或发布。使用 PR 模板，实际执行与未测事项分开记录。现版规则见 [game-rules](game-rules.md)，AI 来源与兼容性见 [model-card](model-card.md)。main 合入、管理设置、关闭旧 PR、删除分支和发布需维护者明确授权。
