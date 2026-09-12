# DeiDei｜工作入口

更新：2026-09-12。计划 R01-v1；新增经典规则规范 1.0。计划、PRD、架构、工作包与验收由 ChatGPT 负责；产品选择、最终合入和发布由 Teddy 决定。

## 当前先看哪里

先读 [进度板](docs/production/STATUS.md)。三个 a 包都已提交；任务 01 的规则资料已经正式验收。阅读 [规则包 1.0](docs/rules/v1/README.md)取得新写的玩家说明、完整规范、案例和程序设计。

| 工作包 | 当前状态 | 结果 |
| --- | --- | --- |
| R01-T01-a | ACCEPTED：取证与确认材料通过，新引擎未实现 | [PR #8](https://github.com/Kalopsiazza/DeiDei/pull/8)、[验收文档](docs/reviews/R01-T01-a.md) |
| R01-T02-a | PARTIAL：Mac 实验已有证据，其他缺项待核 | [PR #7](https://github.com/Kalopsiazza/DeiDei/pull/7) |
| R01-T03-a | SUBMITTED：Teddy 通过布局，规划者验收另行进行 | [PR #9](https://github.com/Kalopsiazza/DeiDei/pull/9) |

## Codex 执行要求

只开展已发出的编号工作包。讨论记录只帮助理解背景，不能直接据此写新游戏。新的规则规范和数据设计也不自动授权编码；等 ChatGPT 下发具体实现包。不得自行写正式 PRD、改架构、发 b/c 包、合入或发布。

每个线程保留自己的结果目录与分支。报告实际提交、测试、图片、缺项与环境；结果提交不等于验收。ChatGPT 读取真实结果和代码后更新本入口与进度。

## 规划资料

- [六轮总计划](docs/production/ROADMAP.md)
- [分工与命名](docs/production/WORKFLOW.md)
- [第一轮前期 PRD](docs/prd/R01-foundation-prd.md)
- [第一轮技术验证设计](docs/architecture/R01-validation-architecture.md)
- [首批页面信息](docs/design/R01-page-briefs.md)
- [经典规则 PRD](docs/prd/PRD-RULES-v1.0.md)
- [规则引擎设计](docs/architecture/RULE-ENGINE-v1.0.md)
- [结果模板](docs/templates/task-result.md)
- [方向讨论，仅作背景](docs/game-design-discussion.md)

## 快照、结果与图片

`plan/r01-v1` 保留首次发包的 aeabaf681197eb110da919e310ad1f4833433bba，不往快照写结果。三个 a 包原结果 PR 目标仍为 `docs/design-discussion-20260911`；当前规划更新也在该分支。本次没有合入 task PR 或 main。

第二张概念图仅被选为画风参照，不自动批准人物、猫咪、人数和功能。原白板与已选图在交接附件 `deidei-r01-handoff.zip`；任务 03 返回的新图在其结果分支。后续使用前读取真实素材，不能凭文件名声称完成视觉核验。
