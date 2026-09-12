# DeiDei｜当前工作入口

更新：2026-09-13。项目进入第二轮本地真实单人集成。先读[当前进度](docs/production/STATUS.md)。

**新执行起点：[integration/r02](https://github.com/Kalopsiazza/DeiDei/blob/integration/r02/docs/production/R02-LIVE-START.md)，固定提交41029218df420985ec06c01f27d4620fd8f35a16。**

核心PR13与独立测试PR14已完成固定版本联测：192份独立核心样本通过、两份会话样本未运行。桌面远端分支有代码与Mac证据，当前仍有指定修订且尚未找到对应PR。详细验收、新PRD、架构和R02-T04-a均已放到新起点。

原PR与main均未合入。integration/r02只是准确目录的隔离副本，便于下一线程不用手工拼接多条分支。新包结果PR投integration/r02；旧a包的目标仍保留原样。

classic-1.0.1和原R02合同以交接附件original-r02-input.zip为准；不能从本分支历史1.0正文覆盖它。此次只发一份R02-T04-a，尚未自动执行。Windows同学复测独立进行，不等交期。

ChatGPT负责正式PRD、架构、编号工作包与验收，Codex按包实现和测试；只读讨论不能直接作为写游戏的许可。Teddy决定最终产品取舍、合入与发布。

## 历史规划

[六轮总计划](docs/production/ROADMAP.md)、[分工与命名](docs/production/WORKFLOW.md)、[第一轮前期PRD](docs/prd/R01-foundation-prd.md)、[方向讨论](docs/game-design-discussion.md)保留作追溯。plan/r01-v1与plan/r01-friend-v1保持各自原用途，不往其中写新实现。
