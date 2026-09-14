# R01-T01-a 只读取证

从仓库根目录运行 `python3 experiments/r01-t01-a/observe.py`，stdout 是 JSON；保存位置为 `docs/results/R01-T01-a/observations.json`。仅使用标准库，导入既有 deidei_env；GUI 名称／说明用 AST 读取，不启动 GUI、不导入 RL 或模型、不访问网络。用 `python3 scripts/check.py` 运行原有检查。

输入为 plan/r01-v1，完整 SHA `aeabaf681197eb110da919e310ad1f4833433bba`。脚本中的断言只保护目录与关键观察，记录的是旧实现，不是正式规则测试；输入快照改变后应重新审查观察结论。

每个独立案例使用新建／深复制状态，防止已知 bombPending 副作用污染其他案例；`repeated_bomb` 刻意在同一原输入上连续调用两次，以暴露副作用，不修复引擎。JSON 保留调用前状态、合法性、历强判定前 Action、返回状态及输入是否被改写。没有拼接双人函数推导多人结果。

## 旧分支方案的评分表检查（备查）

运行 `python3 experiments/r01-t01-a/check_branch_tables.py`，stdout对应`docs/results/R01-T01-a/branch-case-checks.json`，人类可读案例见同目录`BRANCH-CASES.md`。它只在给定评分表上检查单方改选是否能获益，使用标准库、不导入游戏引擎或AI、不修改资源、不抽签。包含明确标注的抽象结构，不能用其通过结果宣称真实招式能产生这些评分或新多人规则已经实现。

第十五轮已采用限定评价范围方案，替代上述全场组合筛选。该脚本和输出只保留为前一方案的分析证据，不是当前选择算法、也不用于证明新规则实现。

## 当前规则目录的文档检查

从仓库根目录运行：

```sh
python3 experiments/r01-t01-a/check_rule_catalog.py
```

检查MOVE-CATALOG.json的31项旧映射及2项新增未编号讨论条目、阶段字段、直接淘汰类型、来源/分支引用、证据状态以及主文档生成区的一致性；不导入游戏引擎或模型，不模拟战斗。render_moves函数仅供更新目录后重建主文档对应生成区。此前check_branch_tables.py继续只代表已归档的旧全组合方案。
