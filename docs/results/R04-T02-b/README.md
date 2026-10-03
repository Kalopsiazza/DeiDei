# R04-T02-B：公开牌局数据与显示

代码输入：`88185af2c9372b2f1d88707218cafee590b94018`。实现提交：`852a211cb3801b98fee9c39e5e58db23d29c3e17`；后续证据提交只加入此说明与定向 smoke。

## 改动

- `DesktopView.public_round` 默认 null；只在揭晓/结果复制公开 ledger 的 match/game/turn 身份及按 player_id 索引的 entry_id、actual_move、branch、is_recovery。联机 turn_id 直接使用 last_turn，next_* 只预告阶段推进。
- 联机本拍编号取 ledger，余额取 post_turn_players，存活取 effective_state。mode、self_role、self_participation 与 game_index 来自实际模式/身份/状态，揭晓无 options 不再表示淘汰。
- 两条前端路径使用同一历史处理；按 match/game/turn 去重，采集保留本局全部已收到记录，席位/侧栏分别展示最近 3/8 拍。局势显示全部，首次接入、漏拍重连及缺失跨局衔接显示缺口；不补造服务器未提供的回放。
- 正式单人准备如实显示随机合法对手、不限时，撤下未接通的强度/回合时限控制。fixture 明确提供演示公开字段。core、wire、网络时限、依赖与模型未变。

## 验证

- `npm --prefix game/desktop run build`：类型检查与构建通过。
- `node --test game/desktop/tests-online/test-view-adapter.cjs game/desktop/tests-online/test-model.cjs`：11 项通过；覆盖八种错图标、同名异牌、ledger 身份、普通下一拍/淘汰重开、恢复/复制分支、角色、隐私、10 拍/重复/缺口。
- `node --test game/desktop/test.cjs game/desktop/test-live.cjs game/desktop/test-navigation.cjs game/desktop/tests-online/test-*.cjs`：56 项通过，保留既有子进程、重连、保密与请求恢复检查。
- `PYTHONPATH=game/core:game/runtime python3 -m unittest discover -s game/runtime/tests -v`：27 项通过。
- `DEIDEI_PYTHON=/absolute/path/to/python3 node game/desktop/smoke-public-round.cjs`：隔离 Electron 的真实本地 seeded random-legal/core 完整牌局，以及明确 MOCK 的八种图标、同名异牌、活跃揭晓、10 拍记录、8/3 显示上限、重复快照、漏拍和重开编号通过。使用 1366×768 CSS 内容区、减少动态；不是物理屏幕/跨设备验收。

本机图片、实际核心 ledger 与 evidence.json 在忽略的 `.local-outputs/r04-t02-b/public-smoke/`。最初 smoke 的菜单/开场按钮精确名称定位两次失败，按真实 accessible name 修正；断言未降低。测试关闭时等待离房 ack，再明确终止本脚本的隔离 Electron，避免把原生关闭确认算进本项牌局 smoke；只清理本脚本的临时档案和窗口。

## 剩余边界

- MOCK 不代表真实房间服务。任务 E 仍需在普通 main、真实 socket/server 链路复核同一字段与状态。
- 共享终场的观众文案及本地/联机统一结果组件由任务 C 继续完成；本任务已提供角色字段。
- 未跑全量 core/根检查、跨平台包、跨设备真人或长压；本任务只改公开显示映射。没有推送、合并或发布。Kimi 未调用（暂停）。

继续路径：`.worktrees/r04-t02-b`，分支 `codex/r04-t02-b-public-view`；本地保留，未归档。`node_modules` 仅链接已有 r04-t01-b 的依赖，不加入提交。
