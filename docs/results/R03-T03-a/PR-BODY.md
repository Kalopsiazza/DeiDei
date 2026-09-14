标题：`[R03-T03-a] 独立房间验收样本｜提交验收`

目标：`integration/r03` ← `codex/r03-t03-a-room-tests`。此文件是待提交正文，尚无远端 PR。

## 这次想解决什么

为好友房提供独立消息/状态预期和真实 loopback 验收驱动，防止以服务自身输出或模拟
界面作为正确答案，也防止缺服务时把测试误报为通过。

## 改了什么，哪些没有涉及

- `tests/rooms_v1/`：96 个 N01—N36 参数化样本、严格校验器、A08 socket 驱动、15 个工具自测。
- `docs/results/R03-T03-a/`：覆盖、运行证据、输入与文件清单。
- 未改变规则、服务、桌面、模型、根依赖、旧独立样本或总进度。

## 怎样验证

- `python3 tests/rooms_v1/validate.py`：96 样本结构/覆盖通过。
- `python3 -m unittest tests.rooms_v1.test_harness -v`：15 方法通过，包含坏传输/预期和固定核心核对。
- `python3 scripts/check.py`：55 测试，保留原有 1 个 expectedFailure。
- 驱动指向基线 `game/server` / `game/core`：退出 2，真实服务 NOT_RUN，0 项服务通过。
- 完整命令和退出码见 CHECKS.json；未运行 GUI/真人/跨机/Windows 验收。

## 对现有内容的影响

不改经典规则/模型/依赖。真实候选需使用固定 websockets 17.0.1 环境，本次未安装。
仅新增本任务允许目录；未复制规划正文。

## 已知问题

REPORT 列出权限错误码、无 request_id 坏 JSON 回应及慢消费者队列阈值验证边界。
N31 有限慢读验证不等于已经证明 32 条/2MiB 队列上限；N35 留后续真实 Electron 联测。

## 提交者确认

- [x] 检查了允许目录和相关差异。
- [x] 如实区分样本、自测、固定核心与服务未测，未删改旧失败/占位测试。
- [x] 未提交凭据、私人资料、运行环境或大运行包；Kimi 未调用。
