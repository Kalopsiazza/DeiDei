# R04-T03-a 当前收尾入口｜2026-10-04

[Issue #35](https://github.com/Kalopsiazza/DeiDei/issues/35)，精确起点 `1f30a2449dddbe98144b7e98e0dc0a8e76b977ca`；分支 `work/r04-t03-a-frontend-completion`；草稿PR base `codex/r04-t02-e-real-rooms`。候选产品 `edbb85a664bde73bc74160f00bb38e15d5634908`。里程碑一完成，二／三未完成：Mac锁屏阻碍原生拖窗／全屏／双屏及最终聚焦图鉴；联机转场长帧和控件补测仍在。旧工作和失败保留，未进入第二轮；Kimi未调用。

[工作单](docs/tasks/R04/R04-T03-a.md) · [实际报告](docs/results/R04-T03-a/REPORT.md) · [遗留终态](docs/results/R04-T03-a/REMAINDERS.md)

---

# DeiDei｜当前工作入口

ChatGPT · 2026-09-29

**当前优先：Teddy 与 Codex／DeepSeek 在本地直接迭代真实前端。先打开游戏，再边看边改；不等待 PR #30/#31，也不要求先交视觉方案。**

阅读 [任务 R04-T01-b](docs/tasks/R04/R04-T01-b.md) 与 [协作方式 v2](docs/production/WORKFLOW.md)。一个页面或一段体验值得保留时，再交 ChatGPT 做适量代码审阅。

- 工作分支：`work/r04-t01-b-frontend-live`。
- 阶段结果 PR 目标：`integration/r04-ui`，未到阶段不必开 PR。
- 产品起点：此前接受的 `d0c96408a3aa8c14174099da4247bcac953fb9f7`；新前端起步提交只在它之上更新文档，不带入 #30/#31 的代码。
- 技术记录仍在 `integration/r03-live`；它和 `main` 都不作为本轮前端的起步代码。

首次进入先检查现有本地工作，使用新前端工作分支或独立 worktree，读 `game/desktop/README.md` 的源码启动部分。不要覆盖已有改动、重做整个项目或等待所有平台环境。

[当前进度](docs/production/STATUS.md)记录：#30 已收到，待测试工具小修；#31 的 wss 与旧测试问题已答复，最终实现仍待审阅。公网、跨电脑真人及安装信任未通过。旧视觉任务 R04-T01-a 已由 b 接续，不需要再按旧流程提交一份只含讨论的结果。

本次发布任务与文档不表示已经启动了本地应用，也没有自动启动执行线程、合并 PR 或部署。
