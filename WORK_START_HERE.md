# DeiDei｜工作入口

计划版本：R01-v1 · 2026-09-11  
计划、PRD、架构与工作包作者：ChatGPT；产品决定与最终合入：Teddy。

## 先确认自己的角色

**Codex 执行线程**：只领取一个已发出的工作包。讨论文档仅供理解背景，不授予写游戏代码的权限。没有对应 PRD、架构说明和工作包，先停下报告，不替 ChatGPT 编写这些材料。

**ChatGPT 规划／验收会话**：先读进度板，再看各包结果 PR 的实际变更、测试与证据；更新 PRD、架构和下一包。Codex 提交 PR 不代表任务已验收。

## 当前可领取

| 工作包 | 线程名 | 当前状态 |
| --- | --- | --- |
| [R01-T01-a](docs/tasks/R01/R01-T01-a.md) | 第一轮｜任务 01｜a｜游戏规则详细确认 | 可领取；读取与取证，不改规则 |
| [R01-T02-a](docs/tasks/R01/R01-T02-a.md) | 第一轮｜任务 02｜a｜技术框架实机验证 | 可领取；只做已设计的独立实验 |
| [R01-T03-a](docs/tasks/R01/R01-T03-a.md) | 第一轮｜任务 03｜a｜基础页面布局确认 | 可领取；出布局图，不开发游戏页面 |

三包可并行。第二、三包无需等待第一包确认所有招式。没有发出的 b、c 包不得自行启动。

## 阅读入口

- [协作流程与命名](docs/production/WORKFLOW.md)
- [六轮总计划](docs/production/ROADMAP.md)
- [当前进度与阻碍](docs/production/STATUS.md)
- [第一轮详细 PRD](docs/prd/R01-foundation-prd.md)
- [第一轮验证架构](docs/architecture/R01-validation-architecture.md)
- [页面信息安排](docs/design/R01-page-briefs.md)
- [结果模板](docs/templates/task-result.md)
- [方向讨论，仅供参考](docs/game-design-discussion.md)

## Git 起点

第一批三个线程都从 `plan/r01-v1` 开始；它是本次材料快照，不作为结果合入目标。开始时记录该引用实际指向的完整 SHA。结果 PR 的目标为 `docs/design-discussion-20260911`。不要从只包含旧原型的 main 开始，也不要往计划快照分支推送。

每个线程使用自己的分支和工作目录。普通贡献的默认 main 流程仍在 CONTRIBUTING.md；本次具名工作包采用上述专门流程。

## 美术参考附件

Teddy 已选择第二张概念图的画风，未批准图中的人物 IP、猫咪、人数或功能。任务 03 的交接附件 `deidei-r01-handoff.zip` 含 `references/approved-style-02.png` 与原始布局白板；图片未上传 GitHub。拿不到附件时可以先读页面安排，但在取得参考图前不声称已按原图完成视觉验证。
