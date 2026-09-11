# R01-T01-a 只读取证

从仓库根目录运行 `python3 experiments/r01-t01-a/observe.py`，stdout 是 JSON；保存位置为 `docs/results/R01-T01-a/observations.json`。仅使用标准库，导入既有 deidei_env；GUI 名称／说明用 AST 读取，不启动 GUI、不导入 RL 或模型、不访问网络。用 `python3 scripts/check.py` 运行原有检查。

输入为 plan/r01-v1，完整 SHA `aeabaf681197eb110da919e310ad1f4833433bba`。脚本中的断言只保护目录与关键观察，记录的是旧实现，不是正式规则测试；输入快照改变后应重新审查观察结论。

每个独立案例使用新建／深复制状态，防止已知 bombPending 副作用污染其他案例；`repeated_bomb` 刻意在同一原输入上连续调用两次，以暴露副作用，不修复引擎。JSON 保留调用前状态、合法性、历强判定前 Action、返回状态及输入是否被改写。没有拼接双人函数推导多人结果。
