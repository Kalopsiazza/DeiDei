# R02-T02-a：经典规则 1.0.1 独立验收

本目录是规则预期与测试工具，不包含新版游戏核心。输入为交接附件
`deidei-r02-handoff-v1.zip` 的规则 1.0.1 / CONTRACT-R02 1.0；附件 SHA256
`f5e97fe4395f6f3d5552c30b1fe0052563e75c7d7e5d07c97bb78b960fa554b1`。
仓库旧版 1.0 和旧 `simulate_turn` 不提供本套预期。

## 执行

从仓库根目录使用 Python 3.11 标准库，无需安装依赖：

```sh
python3.11 tests/rules_v1_001/validate_fixtures.py
python3.11 -m unittest discover -s tests/rules_v1_001 -p 'test_*.py' -v
python3.11 scripts/check.py
```

得到已验收的固定核心 SHA 后，由联测包明确指定其 `game/core` 路径：

```sh
python3.11 tests/rules_v1_001/run_acceptance.py --core /path/to/accepted-checkout/game/core
python3.11 tests/rules_v1_001/run_acceptance.py --core /path/to/accepted-checkout/game/core --case C063
python3.11 tests/rules_v1_001/mutation_check.py
```

不会搜索其他工作树、加载旧引擎、自动拉取 T01 分支或以测试替身冒充核心。
`--case` 可多次使用，接受 C 编号或 `C编号/variant`；运行前仍校验完整样本库。

| 命令 / 结果 | 退出码 | 含义 |
| --- | --- | --- |
| 校验器 `FIXTURES_VALID` | 0 | 样本结构、覆盖、账目完整性一致；真实引擎通过数仍为 0 |
| 校验器 `INVALID_FIXTURES` | 1 | 缺字段、缺子例、格式/时序/推进自相矛盾 |
| 驱动 `ENGINE_NOT_AVAILABLE` | 2 | 指定目录没有 `deidei_core/api.py`，`engine_run=NOT_RUN` |
| 驱动 `ENGINE_IMPORT_ERROR` | 1 | 找到了核心文件，但导入或公开 API 有问题，不能按“缺核心”跳过 |
| 驱动 `FAIL` | 1 | 实际输出、完整账目、事件或性质断言失败 |
| 驱动 `CORE_CHECKS_PASS_SESSION_NOT_RUN` | 0 | 可运行的核心样本通过，会话项仍明确待测 |
| 驱动 `CORE_CHECKS_PASS` | 0 | 所选核心样本通过；不能据此推定未选择样本通过 |
| 仅选择会话项 `SESSION_NOT_AVAILABLE` | 3 | 尚无获准会话 API，不能把纯函数重试当作应用去重 |

## 样本与预期形成

194 个 JSON fixture 覆盖 C001—C082；参数逐项展开。109 个 core、78 个 property、
5 个 sequence、2 个 session。可执行部分包含 205 份完整回合预期（含拒收），
不是 205 次真实引擎测试通过。详见结果目录的 `coverage.tsv`。

`author_fixtures.py` 是可审阅的人工预期底稿，明确写入每例击杀、存活名单、分支、
余额与次数；辅助函数仅展开 wire 字段、六分之一整数算术、明确指定的推进方式。
它不计算攻击匹配、分支评分或胜负，不导入任何生产实现。JSON 是驱动唯一读取的答案。
自检会校对底稿与 JSON 一致；修改预期必须附规则条款与原因，不按实际结果自动更新。

```sh
# 仅在规则审阅认可预期修订后重新展开；驱动不会执行它。
python3.11 tests/rules_v1_001/author_fixtures.py
```

成功预期包含每位参战者完整的 post_turn_players、完整 next_state、所有人的 kills、
淘汰集合、推进与赢家；每个动作明确完整身份、入口、来源、分支、条件、攻防、一次支出。
条件招还明确 eligible_targets。事件使用 required_events 精确计数和 forbidden_events，
没有声明的事件不默认不存在。缺少这些容器或完整账目即报 `INCOMPLETE_EXPECTATION`。

驱动逐轮调用公开的 `new_match / list_options / resolve_round`；连续例只沿实际返回状态推进，
拒收后保持原状态，不能每步重新喂答案。所有 `list_options` 输出都检查 33 项顺序和完整字段，
对选用入口另检查可用性、原因、持有门槛和支出；强制休整的 33 项逐项禁用。

合同未固定每种防御使用哪个 `match_rule` 引用、非条件招 `eligible_targets` 的表示方式、
错误的具体 `field` 文本，因此只校验其合同类型/范围；条件目标和已规定的攻防值严格比较。
合同允许淘汰者的 next_state 玩法数据用于显示：驱动校验其完整字段和类型，
淘汰者的权威账目严格比较 ledger，不限制之后未参战者展示数据的保留策略。
名单/条件目标按身份比较，事件与击杀仍遵守合同要求的稳定排序和去重。

## 连续与性质检查边界

- C054：从合成的第 1 回合 DD=1/0 起，连续放置、成熟、兑换；不宣称从零自然形成初始资源。
- C064：合成第 6 回合发动、第 7 回合休整，到期第 10 回合末，保留使用记录。
- C065/C079：真实 `new_match` 全零开局，分别走奖励/复制链和云首次免费/不足拒收/再次收费链。
- C069：先实际结算淘汰和重开，再在返回的新局出历强；不借旧历史。
- C073：重试、JSON 往返、座位顺序、入参隔离、独立可变列表、两个选择者的四种 token 组合、六人结算。
  2—5 人性质样本枚举全部座位排列；六人枚举反序和五个轮换，范围明确有限。
- 每份成功预期严格检查一次 spend 与最终账目；C004/C026/C043/C050/C060 检查同轮死者的后续作用。
- C074：完整玩法重置为核心性质项；房间模式与缺席次数为单列 session 项。
- C075：60 个有限域公开 API 探针，覆盖 33 入口、9 种有效复制身份、强化削及复合招两种 token。
  对反弹时复合招按规则选择成功自 bi；对扇贝的并列局面补普通/失败自 bi 分支。
  检查每条实际回击的来源、原值和 P3 防御。不伪造 P1 属性，不声称穷尽任意资源/历史状态。
- C076：六组完整输入，经公开 API 观察属性和高阶记录；不是额外公开属性 API，亦非自然对局覆盖声明。
- C081：精确复用 C065 第 5 回合状态；纯函数重复输出单独执行。应用去重、消费后旧请求、缓存淘汰和载荷冲突待真实会话适配器。
- C082：到期奖励在账目中恰好一次，再由存活者新局清除；保留发奖事件供解释。

## 缺陷注入

`mutation_check.py` 内置六项计划：提前跳过死者、恢复 P3 对撞盾、复制重复收费、
休整算重复、奖励旧请求重放、漏记共同击杀。当前全部 `NOT_RUN`，杀死缺陷数为 0。

核心获验收后，人工对其确切 SHA 为五个 core 项绑定一处最小替换：

```json
{
  "accepted_sha": "实际验收的完整提交SHA",
  "mutations": {
    "skip_dead_actor": {"path": "deidei_core/实际文件.py", "find": "原始准确片段", "replace": "有缺陷片段"}
  }
}
```

示意仅展示一个条目，执行文件必须提供脚本列出的全部五个 core ID。使用：

```sh
python3.11 tests/rules_v1_001/mutation_check.py --core /path/to/accepted-checkout/game/core --bindings /path/to/reviewed-bindings.json
```

脚本要求核心目录干净、SHA 一致、原版全套先通过；复制到临时目录后逐项替换，
检查目标路径不越界且上下文恰好匹配一次，最后核对原始源码 hash 未变。
只有行为测试 `FAIL` 才计为 `KILLED`；语法/导入失败记 `INVALID_MUTATION`。
没有源码绑定返回 3；没有核心返回 2；奖励重放属于 session，始终等待集成适配，
不能用“纯函数第二次仍返回奖励”制造假缺陷。此时五个核心突变即使通过，也仍保留会话待测。

自检中的 `ChargeTransportDouble` 只检验驱动是否拒绝不完整/错误输出，
不会出现在验收驱动的核心选择路径，也不计入任何真实引擎通过数。
