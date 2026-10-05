# 现版规则与旧 AI 来源

2026-10-05。现版 classic-1.0.1 使用独立 33 招核心，权威规则、招式与契约见 [docs/rules/v1](rules/v1/)，实现见 [game/core](../game/core/)；桌面、worker、服务均使用它。DD 使用整数单位，界面不得另造胜负判定。修改具体规则需列出输入局面、原结果、希望结果，并由维护者确认。

旧机器学习 AI 使用不同的 31 动作环境，原始代码和旧测试保留于 [legacy/rl](../legacy/rl/README.md)。原规则来源为导入提交 `d4b943f5e47df272bef84b11524e8388fef18f49`，代码见 [deidei_env.py](../legacy/rl/deidei_env.py)，案例见 [test_core.py](../legacy/rl/tests/test_core.py)。旧 #1 共用炸药列表仍是已知失败，不据此改变当前规则。历史口头规则与代码不同的地方仍需维护者确认。

旧模型的动作顺序、截断观测与当前核心并不相同，禁止把旧 AI 直接接入当前 worker。后续接入需单独说明兼容性与评测，见 [模型说明](model-card.md)。
