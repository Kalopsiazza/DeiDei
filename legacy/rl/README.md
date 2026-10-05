# 旧机器学习 AI 保全

2026-10-05，Issue #39 包 A。来自 main `889162fc90000919004f498b27cffbd5fa4cbe45`，8 项文件原字节保留，见 [PRESERVE.json](PRESERVE.json)。原作者、导入来源及许可状态见 [CREDITS](../../CREDITS.md)，模型事实与未验证内容见 [模型说明](../../docs/model-card.md)。旧 Tkinter 产品及启动脚本已退出。

从仓库根目录执行 `python3 legacy/rl/check.py`；绝对脚本路径也不依赖工作目录。标准库检查依次校验字节及旧规则测试，缺文件、内容变化、零用例或意外失败均非零退出；原 #1 的 expectedFailure 与断言不变。这不代表模型已加载或效果已验证，不安装 torch/gym，也不反序列化 ZIP/pickle。

后续研究使用独立进程，将工作目录和搜索路径指向本目录，模块名称仍为 `deidei_env`、`deidei_gym_env`、`rl_ai`，不是 `legacy.rl.*`。不要给现版 worker 注入旧目录。`rl_ai.py` 同目录的 `rl_checkpoints/latest.zip` 相对位置不变；GUI 中文名导入失败已有 Enum 名称回退，不恢复 GUI 或添加同名假模块。

旧环境有 31 个可选动作，双人观测为 `2 × (14 + 32 × 2) = 156` 维。DD、雷电、使用次数等编码按各自上限截断到 0—1，状态编码与动作顺序保持原样。旧规则源在 [deidei_env.py](deidei_env.py)，已有案例在 [tests/test_core.py](tests/test_core.py)；模拟共用炸药列表的 #1 仍在 [test_known_regressions.py](tests/test_known_regressions.py) 中记录。

现版使用独立的 [game/core](../../game/core/) 33 招核心，规则也有差别；单人对手为 `random-legal-v1`，没有调用旧模型。难度与时限尚未下传 runtime。本轮不训练、不换模型、不改编码或接入 AI。

仓库未提供完整训练入口、训练记录或可复查评测。依赖只给版本下限，序列化内部引用尚未验证，不据此宣称可重训、加载成功或达到某种水平。后续模型接入另开任务；二进制仅作保全校验。
