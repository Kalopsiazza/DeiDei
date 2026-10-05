# DeiDei 规则核心（R02-T01-a）

实现交接包的 classic-1.0.1、CONTRACT-R02 1.0 和 RULE-ENGINE-v1.0，支持 2—6 人。仅用 Python 3.11+ 标准库，独立于旧规则、GUI、模型和网络。`pyproject.toml` 仅记录局部包信息；直接用 `PYTHONPATH` 导入，不需要安装依赖。

从仓库根目录执行（`python` 可替换成 `python3` 或本机 Python 3.11 路径）：

```sh
PYTHONPATH=game/core python -m unittest discover -s game/core/tests -v
```

PowerShell：

```powershell
$env:PYTHONPATH = "game/core"
python -m unittest discover -s game/core/tests -v
```

## 可运行示例

```sh
PYTHONPATH=game/core python - <<'PY'
from deidei_core.api import new_match, list_options, resolve_round

state = new_match(["A", "B"], "example")
assert len(list_options(state, "A")) == 33
round1 = resolve_round(state, {"A": "Charge", "B": "Charge"}, {})
assert round1["ok"]
assert state["players"]["A"]["dd6"] == "0"  # 输入不变
state = round1["next_state"]
round2 = resolve_round(state, {"A": "Bi", "B": "Def"}, {})
assert round2["ok"]
assert round2["ledger"]["post_turn_players"]["B"]["nx_charge"] == "2"
assert round2["transition"]["kind"] == "continue_game"
print("两回合完成；B 充能 = 2，双方存活")
PY
```

## 接口与边界

- `new_match(player_ids, match_id)`：2—6 个唯一玩家 ID；错误抛 `ValueError`。初始局号为 `<match_id>:g1`、局序号/回合序号为 `"1"`。
- `list_options(state, player_id)`：按 E01—E33 原顺序返回所有入口、资格原因、资源门槛和支出。已淘汰或已结束时全为 `NOT_ACTIVE`；休整时全为 `FORCED_RECOVERY` 且 `forced=true`。非法状态或不在 roster 的身份抛 `ValueError`。
- `resolve_round(state, submissions, choice_tokens)`：自由行动者各一份入口，休整者必须省略。每位实际复合招选择者必须提供独立整数 `0/1` token，包括复制/兑换来源；固定招不得带 token。返回合同规定的成功结果或错误字典，无部分状态。先验证整轮，再试算和执行。

所有数量使用规范非负十进制字符串，DD、攻击和有限防御采用六分之一单位：`"6"` 为 1 DD，`"2"` 为 1/3 DD，`"21"` 为 7/2；防御无穷为独立 `unbounded`。拒收浮点、布尔代数字、未知字段/招式和过期的活跃玩家待成熟/奖励时点。资源不设旧模型截断上限。

输入合成状态不要求证明自然可达。自定义非空 `game_id`（例如规范案例的 `game-1`）可用，但活跃玩家待成熟炸药必须属于当前局且时点正确。重开时使用 `<match_id>:g<game_index>`。淘汰者保留的旧账目不会用于后续判定，也不套用新局时点校验。

`ledger.post_turn_players` 保留本回合所有参与者的完整账目；`next_state.players` 保留整场 roster，重开时仅存活者初始化。事件 ID 按本轮标识、阶段、作用者、目标、资源/来源和固定区分项确定，排序与座位无关；`source_event_id` 将回击指回原始攻击。失败自 bi 的自身淘汰不算自杀击杀。

同一完整输入重复调用得到相同结果，不会扣改传入状态。**会话的“只应用一次”、request_id 缓存、过期请求拦截不属于此纯核心**；C081 只测纯计算部分。此包没有 worker、AI、桌面界面或联机代码。

## 文件与验证

`entries.py` 定义固定入口/费用；`wire.py` 校验、编解码；`engine.py` 实现来源后的属性、局部分支试算、P2/P3 作用和 P4 推进；`api.py` 是公开接口。不存在可运行的规则脚本插件或对旧裁判的调用。

自测的预期直接取自交接包案例，并另测异常输入、33 入口费用、原值回击可达性、顺序/重放/状态隔离、5000 位整数、固定种子六人连续局和无外部 IO 导入。案例参数分别注册为真实 unittest；方法内部的性质枚举不夸大成额外测试项。R10 的 100 上限及 C075 的固定分支枚举属于属性检查，不冒充新增可出招入口。

实际数量、环境、固定受测提交与限制见 [本包报告](../../docs/results/R02-T01-a/REPORT.md)。T02 独立样本、桌面/模型/安装包和会话去重需各自的后续验收；本包自测通过不等于全项目验收。
