# R02 本地会话

从仓库根目录运行，Python 3.11+ 标准库，无新依赖：

```sh
PYTHONPATH=game/core:game/runtime python3 -m unittest discover -s game/runtime/tests -v
PYTHONPATH=game/core:game/runtime python3 -u -m deidei_runtime.worker
```

Windows PowerShell 的 `PYTHONPATH` 分隔符为 `;`。桌面主进程自动设置固定的核心与 runtime 路径。

- `MatchSession(initial_state, context=None, max_cached=128)` 验证、复制初态；`snapshot()` / `context_snapshot()` 返回独立副本。`apply_round(request_id, expected, submissions, choice_tokens)` 返回核心 Resolution 或拒收；成功请求 FIFO 缓存，同 ID 同载荷只应用一次，冲突与过期拒收，`close()` 永久关闭。由 worker 串行调用，不支持多个线程同时修改会话。
- `SoloGame` 使用公开 API 决定资格和结算。每拍先固定临时随机对手（`random-legal-v1`）出招；默认 `SystemRandom` 等概率挑选合法入口，分支 token 使用独立随机源。普通入口不加载旧模型；测试可注入 `Random` 与 monotonic clock。
- 提交 200ms 后揭晓，再保留 800ms；每次读取至多推进一个可见阶段。自动休整使用同一循环。揭晓资源取 ledger，下一拍取 next_state，整场结果只取 transition。完整实际 Resolution 保留在当前 `SoloGame.resolutions`，离开后不持久恢复。
- `view.py` 的文字映射读取既有 `game/desktop/catalog.json`；资格、门槛和支出只取核心。`entry-map.json` 原样来自交接原包 CONTRACT-R02 映射，SHA256 `326fee0497535b8451b92960705c135a2f50e1f82f277ee9eb13e5ad69ca547c`。未修改规则、原样本或映射。

JSONL 请求 `{v:1,id,op,payload}`，每帧含换行最多 1MiB。仅允许 `health/start_solo/submit/get_view/leave/shutdown`，精确字段白名单；stdout 只写协议。示例：

```json
{"v":1,"id":"health-1","op":"health","payload":{}}
{"v":1,"id":"start-1","op":"start_solo","payload":{"profile_id":"local-example","nickname":"同学","avatar_id":"leaf"}}
```

`submit` 仅接受 `{view_id,entry_id}`。成功请求以选择视图 ID 去重，重试返回当前可见阶段；不会把旧视图推回桌面。离开或 worker 退出后需显式开始另一场，没有隐式续局。

测试 S01—S08 位于 `tests/test_runtime.py`；S09—S10 与真实子进程测试位于 `game/desktop/test-live.cjs`。C065/C074/C081 只读用于来源明确的新增检查；原独立驱动两份 session 项仍为 NOT_RUN。`tests/seeded_worker.py` 仅由窗口测试专用启动器调用，以固定随机种子记录真实核心账目，不进入普通产品启动路径。

R02-T04-b 摘要只将 `applied` 事件解释为资源变动；取消的攒显示“本次攒未生效，DD没有增加”。DD 增减按精确玩家单位显示，其他资源使用中文名称，回合事件保留在重开清零说明之前。`tests/test_summary.py` 的 8 项回归检查真实核心账目、精确符号/分数/大整数及调用前后 Resolution 不变；其中未生效事件的兜底文案单列为格式层防御用例。`tests/summary_worker.py` 仅用于专项窗口复测。
