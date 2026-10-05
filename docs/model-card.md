# 旧 AI 与模型保全

2026-10-05。当前桌面单人对手为 `game/runtime/deidei_runtime/opponent.py` 的 `random-legal-v1`，只从当前合法选项随机选择，不加载下列模型。难度／时限尚未下传。旧 AI 与现版独立 33 招核心不共用状态编码或全部规则。

## 已确认的旧实现

原代码、模型、依赖与旧规则测试移至 [legacy/rl](../legacy/rl/README.md)，8 项逐字节保全，原／新路径、来源 commit、Git blob、字节和文件 SHA-256 见 [PRESERVE.json](../legacy/rl/PRESERVE.json)。原作者与上传授权见 [CREDITS](../CREDITS.md)，本轮没有新增许可证。

旧简单策略是人工规则与随机数；普通策略枚举单回合收益并做局面估值、regret matching，不能据此宣称整个游戏最优。`legacy/rl/rl_ai.py` 优先 MaskablePPO，保留 PPO 路径并做人工概率修正与失败回退。模块名仍为 deidei_env、deidei_gym_env、rl_ai，应在独立进程中使用旧目录；删除 GUI 后已有 ImportError 回退使用 Enum 名称。

模型相对位置仍为 rl_ai.py 同目录的 `rl_checkpoints/latest.zip`。原权重 2,676,022 字节，Git blob `a7dbf0ddfb1507c2c123dae1c22531b103b5c235`；Git blob 不是文件 SHA-256。opponent_pool.pkl 原文件也保留，二进制只做字节校验，不反序列化。旧环境 31 动作，双人观测 `2 × (14 + 32 × 2) = 156` 维，资源按各自上限截断到 0—1。

## 未验证与后续

`python3 legacy/rl/check.py` 只做保全与旧规则标准库测试，#1 原 expectedFailure 不变，不证明模型可加载。仓库没有完整训练入口、训练记录或可复查评测；旧自博弈、853 万步或水平评价不作为结论。依赖只给下限，序列化内部引用与跨系统精确环境尚未验证。本轮不训练、不换模型、不调编码。

后续 AI 接入单独任务：确认来源与许可，记录规则／动作／状态兼容性、精确依赖、随机种子、训练入口和评测条件，列出胜负平超时及总局数、人工修正和回退状态。不要自动加载不可信 pickle，不把挑选胜局或成功加载当作更强证据。
