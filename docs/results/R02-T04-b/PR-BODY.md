## 这次想解决什么

修复取消的攒仍被摘要显示为 DD 增长，以及开场等待时返回菜单、迟到成功又跳回牌桌的问题。资源摘要与实际余额保持一致；开场/切换完成前普通导航暂时禁用，成功或失败后恢复。

## 改了什么，哪些没有涉及

- F01：摘要读取事件是否生效，使用中文说明与精确 DD 玩家单位；零变动省略，原账目和事件顺序保持。
- F02：renderer 同步 ref 与 disabled 双重保护返回/标题等导航，保留旧 generation 和离场回收。
- npm test 默认执行原桌面 9、通信 9、新导航 4 项；runtime 新增 8 项摘要回归。
- 专用窗口测试覆盖延迟成功/失败与恢复；原 smoke 只增加输出目录覆盖，避免改写 a 结果。

产品输入 `980a019d9a1410bf3ee72263d90397023696f32b`（PR #16），规划只读 SHA `20312a2244ff0447593f22fde41b9b8bb960da9a`。本分支直接从产品输入建立；目标 integration/r02 尚未合入 a，PR 自然含 a 包祖先。本包新增仅 `980a019 → b` 的 11 个产品/测试/README 文件及 `docs/results/R02-T04-b/**`；a 成果未重写。完整增量与哈希在 MANIFEST.json。

## 怎样验证

精确 `tested_code_sha`：`9e8ab22cb19b59a4edb52194206d280119eeb960`。后续提交仅交付资料。

- `python3 scripts/check.py`：40 项，39 PASS + 已存在的 #1 expectedFailure 1。
- `npm --prefix game/desktop test`：类型检查/构建和 22 项测试全部通过。
- runtime：21 PASS；core：174 PASS；独立规则样本：192 PASS / 469 resolve；工具 8 PASS。
- 真实 macOS Electron：延迟开场成功/失败、返回/标题保护、取消攒、离场、重试重开、预览等待均通过。原完整窗口回归通过，两场各 5 拍实际结算，并复测曾义休整、读取错误、worker 中断和两尺寸布局。
- 原 Resolution 前后完全相同且格式化不修改输入，详见 F01-before/after.json。

[报告](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t04-b-live-fixes/docs/results/R02-T04-b/REPORT.md) · [测试矩阵](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t04-b-live-fixes/docs/results/R02-T04-b/TEST-MATRIX.md) · [命令/退出码](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t04-b-live-fixes/docs/results/R02-T04-b/validation.json)

实际窗口截图：[取消攒修改前](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t04-b-live-fixes/docs/results/R02-T04-b/F01-cancelled-charge-before.png)、[修改后](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t04-b-live-fixes/docs/results/R02-T04-b/F01-cancelled-charge-after.png)、[等待期间](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t04-b-live-fixes/docs/results/R02-T04-b/F02-pending-success-after.png)、[失败恢复](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t04-b-live-fixes/docs/results/R02-T04-b/F02-failure-recovered-back-after.png)。禁用状态另有 DOM 与实际鼠标断言，不单靠截图。

## 对现有内容的影响

- 游戏规则、编号、状态编码、core、独立预期、Session/worker/对手逻辑：未改。
- 模型、依赖版本/lock、build、CI：未改；不含联网或发布。
- 文档来源：固定规划仅只读；附件规划者复测未计作本包结果。a 包结果保持原样。

## 已知问题

原 2 项独立 session 仍 NOT_RUN；Windows、物理断网、Python 3.11 单独实机与用户本人手动对局未测。1920×1080 为实际 Electron 开发视口，非 1080p 物理显示器验收。原 23 项开发工具链告警沿用 a 包记录，未重新 audit。Kimi 已暂停，本包未调用；已完成聚焦自审。

本 PR 提交验收，不自动合入，不关闭 PR #16，不发下一包或发布。

## 提交者确认

- [x] 我检查过本次改动，确认 AI 没有混入无关内容。
- [x] 我如实记录了实际验证结果，没有通过删测试或跳过检查隐藏问题。
- [x] 我没有提交密钥、个人资料或无分享权限的材料。
