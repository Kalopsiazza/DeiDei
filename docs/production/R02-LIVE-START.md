# 第二轮｜真实单人集成入口

2026-09-13。当前是第二轮中段；纯规则与独立样本已经真实联测，桌面仍需指定修订。本轮只有R02-T04-a一份新实现包，尚未自动启动任何线程。

先读[验收记录](../reviews/R02-FIRST-DELIVERIES.md)，再读[集成PRD](../prd/R02-LIVE-PRD.md)、[集成架构](../architecture/R02-LIVE-ARCHITECTURE.md)和[任务04-a](../tasks/R02/R02-T04-a.md)。ChatGPT负责设计和验收，Codex执行；规则问题交回规划者。

integration/r02只是隔离工作起点，core/tests/desktop沿用SOURCE-MANIFEST的准确tree。它不代表三个原PR已合入，也不代表本地游戏已经可玩；main和旧规划分支不因此改变。

原R02完整规划与classic-1.0.1仍在本次附件的original-r02-input.zip。开始前解到工作树外，核对SHA及内置PLAN-MANIFEST。新集成要求优先于原a包“不得写runtime”的任务限制；核心格式、规则和测试预期不变。不要读取仓库旧进度而重复开展第一轮。

状态：R02-T01-a纯核心接受；R02-T02-a独立测试工具接受；R02-T03-a原型有来源证据但保留公开资源/格式/异步状态/工具链问题；R02-T04-a已发、未执行；R02尚未整体结束。Windows同学复测与选做素材工具不作为主线等待条件。

本轮只从源码完成本机实算。正式安装包、无系统运行时、签名、工具链风险、联网与动画分别留后续明确工作。不要把“source=live”当成完整发布验收。
