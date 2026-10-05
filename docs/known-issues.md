# 已知问题

2026-10-06，两份前端迭代与返回按钮统一见 [本轮整合记录](results/frontend-main-20261006/README.md)。历史报告按对应版本保留，不作为本轮复测。

- 单人难度和时限未下传 runtime，仍为 random-legal-v1 临时随机对手。
- 外部设备、跨 DPI、Windows、干净机、新安装包与系统信任未验；回环联机不代表公网可玩。
- 欢迎历史长帧与完整页面进出仍待后续处理。图鉴最高档景深／退场、高窗口堆叠及共享返回按钮已纳入本次整合；最高档尚未作完整性能验收。
- 写盘后 setFullScreen 异常事务未处理；现有保存失败注入发生在写盘前。
- 独立规则样本的 session 项保留原未覆盖结果，基础绿色不代表所有玩法或网络场景验收。

## 保全旧环境的问题

[#1](https://github.com/Kalopsiazza/DeiDei/issues/1)：旧 simulate_turn 共用 bombPending 列表，仍由 [原测试](../legacy/rl/tests/test_known_regressions.py) 的 expectedFailure 记录；断言保留，不是现版问题修复。不得给其他失败新增跳过或预期失败。

#6 的旧 GUI 问题因旧产品退出而不再验收，不能写成已修复，不自动关闭。旧部分专属防御文字与代码不同、模型训练复现及效果资料不足，后续研究另行确认；详见 [旧 AI](../legacy/rl/README.md) 与 [模型说明](model-card.md)。
