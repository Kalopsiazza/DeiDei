# R02-T02-a｜独立样本与验收工具本地交付

2026-09-13 · **本包本地工作完成；提交状态 PARTIAL（尚未推送/创建 PR，等待授权）**。
新核心联测按 a 包约定保留 NOT_RUN，不属于本次越界补做的工作。

- 分支：`codex/r02-t02-a-tests`，独立工作树；原工作目录保持原样。
- 输入代码：`3a81daf0f42416ccb73a5a69748655145e6f2f0c`。
- 实际受测的样本/驱动代码：`380ca1fef0cbaac3359c1dc7177bb6d5eea7202c`。
- 真实规则核心 SHA：无；未读取或拉取未验收 T01 实现。
- 输入版本：R02-v1 / PRD-R02 1.0 / ARC-R02 1.0 / CONTRACT-R02 1.0 / classic-1.0.1。
- 输入 ZIP SHA256：`f5e97fe4395f6f3d5552c30b1fe0052563e75c7d7e5d07c97bb78b960fa554b1`。
  附件解包到工作树外；36 个 manifest 文件 hash 和长度全部复核一致。
  结果仅保存校验元数据，不复制正式规划、图片或旧结果。

## 完成内容

`tests/rules_v1_001/fixtures/` 有 **194 个样本，覆盖 82 个 C 编号和 33 个 E 入口**；
参数子例逐项展开，成功样本含全部账目、次数、历史、分支、条件目标、推进结果。
109 core / 78 property / 5 sequence / 2 session；可执行部分含 205 份回合预期。

`author_fixtures.py` 保存人工预期底稿，格式辅助不判胜负，不读取实现生成答案。
`validate_fixtures.py` 检查必填字段、规范数字、时间、推进、覆盖及参数完整性。
`run_acceptance.py` 只加载显式指定路径的公开 API，检查选牌、完整输出、事件与性质。
`mutation_check.py` 提供六项缺陷计划及五项核心缺陷的临时副本绑定/执行工具；
会话重放缺陷单列待集成。`test_harness.py` 验证工具自身的拒错能力。

特别复核 C004/C031/C032/C047/C074 的共同击杀，C066/C067 的休整历史及条件目标，
C054/C057/C064/C068/C071 的时点，C081 的纯计算/会话区分与 C082 的先发奖后重开。
C073 另补两个选择者的四种 token 组合与六人输入。具体边界、命令见测试目录 README；
逐样本索引见 [coverage.tsv](coverage.tsv)。

## 实际验证

环境：macOS 27.0 / arm64 / CPython 3.11.15，均使用现有运行时与标准库，无新增依赖。
命令及退出码详见 [commands.json](commands.json)，每条对应完整 stdout/stderr。

| 检查 | 退出码 | 结果 |
| --- | --- | --- |
| `python3.11 tests/rules_v1_001/validate_fixtures.py` | 0 | 82 组 / 194 样本 / 33 入口，完整性通过 |
| `python3.11 -m unittest discover -s tests/rules_v1_001 -p 'test_*.py' -v` | 0 | 8 项工具自检通过；不代表玩法通过 |
| `python3.11 scripts/check.py` | 0 | 16 个 Python 文件语法通过；40 项测试中 39 通过，1 项既有 expectedFailure |
| 临时副本删除 C001 的 `cloud_uses` 后运行校验器 | 1 | 正确拒绝，报 INCOMPLETE_EXPECTATION；原样本未改 |
| 驱动 `--core game/core` | 2 | ENGINE_NOT_AVAILABLE，engine_run=NOT_RUN，engine_passed=0 |
| 驱动仅选 `C081/session_request_replay` | 3 | SESSION_NOT_AVAILABLE；不计纯核心通过 |
| 缺陷计划脚本，无核心 | 2 | 六项 NOT_RUN；mutations_killed=0 |
| `git diff --cached --check` 与允许目录检查 | 0 | 本地提交仅包含授权目录 |

缺字段、缺参数、重复 JSON 键、数字冒充、错误炸药局号、休整历史遗漏、到期值遗漏、
bool token、错误输出、输入突变、共享列表、错回击引用及重复发奖事件均有工具自检。
测试替身仅用于这些自检，验收命令没有替身后门。

## 验收解释与尚未验证

- **真实新版核心运行/通过数均为 0；实际缺陷注入也为 0。** 当前提交已提供待联测输入和工具，不能据此称新版游戏通过。
- C075 是明确的 60 个有限输入探针，覆盖入口/复制身份/分支和可回击路径；不声称穷尽任意资源及历史组合。
- C076 使用六份完整公开输入观察属性，不构造未约定的属性 API，也不把合成局面说成自然对局。
- 合同未规定的非条件目标表示、具体 match_rule 归属和 error.field 文本，只检查合法结构；已明确的条件目标/数值/支出严格比较。
- next_state 的淘汰者展示数据按合同允许保留策略；其完整权威账目在 ledger 严格比较。未降低任何既有测试断言。
- C074 房间状态和 C081 请求应用去重缺少已授权真实 API，保留两项 session 待测。消费后旧请求和缓存淘汰的验收步骤已写入样本。
- 未测 GUI、安装版、Windows、物理断网、模型或网络会话；本包没有这些实现改动。没有调用 Kimi；单 Codex 执行并自审，无外部模型审查声明。

没有修改正式规则、PRD、架构、核心、桌面、旧测试或模型，没有新增根依赖。

## 提交与继续

PR 正文已经写入 [PR-BODY.md](PR-BODY.md)，目标是 `docs/design-discussion-20260911`，
不是 main。只读观察到远端目标已前进到 `b1f6f660b3a50225f2d4fa67c96c45a2cf3173b7`；
本包按明确固定的 3a81daf 输入开发，没有自动追随、合并或 rebase。

未 push、未创建 PR、未合入、未发布。用户 AGENTS.md 要求 Git 推送有明确授权，
本次附档中的推送步骤不单独视为授权；本地成果可先完整审阅。
等待用户决定远端提交，以及规划者评审后给出固定核心 SHA 和联测包；不自动进入 b 包或集成。
