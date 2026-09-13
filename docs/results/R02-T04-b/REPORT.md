# R02-T04-b｜单人摘要与等待导航修订

F01、F02 和标准测试入口已完成；本机源码验证 PASS，提交维护者验收。真实 Electron 窗口复测与单元测试分列记录，不代表 Windows、物理断网或发布验收。

## 固定来源与增量

- `plan_sha`：`20312a2244ff0447593f22fde41b9b8bb960da9a`。
- `input_sha`：`980a019d9a1410bf3ee72263d90397023696f32b`，来自仍 OPEN 的 [PR #16](https://github.com/Kalopsiazza/DeiDei/pull/16)。
- `tested_code_sha`：`9e8ab22cb19b59a4edb52194206d280119eeb960`。最终全部检查在此提交运行，之后只补交付证据。
- 独立工作树：`/Users/zengchongtai/develop/DeiDei-r02-t04-b`；分支 `codex/r02-t04-b-live-fixes`，直接从 input SHA 建立。
- 四份指定规划通过 `git show plan_sha:path` 只读查看；附件 25 项哈希与大小校验通过，四份规划与 Git 固定提交逐字节相同。见 [provenance.json](provenance.json)。附件中的规划者复测未计入本包测试。
- PR 目标 `integration/r02`。PR 自然包含尚未合入的 a 包祖先；以下内容只算 `980a019 → b` 新增，不重写、不重新归属 a 包成果。

## 修订

F01：`view.py` 先检查事件 `result`。取消的攒明确说明“本次攒未生效，DD没有增加”；其他未生效资源事件使用兜底说明。已生效 DD 先取符号、再按绝对值精确约分，显示 `+1 DD`、`-1/3 DD`、`-1/2 DD` 等中文账目；其他计数保持精确。省略零变动，保留事件顺序，再显示存活者重开清零说明。

F02：`renderer.tsx` 用同步 `sceneChangePending` ref 保护开场与预览切换；准备页返回、标题、菜单、离场等普通导航同时设置 disabled 并在处理函数检查。成功或失败在 finally 解除标志，保留 generation、离场确认和原窗口关闭回收路径。

标准 `npm test` 现运行原桌面 9 项、通信 9 项和新增导航 4 项。新增 runtime 摘要 8 项；原 13 项保持不变。没有新增产品模块或依赖。

## 前后证据

| 发现 | 修改前：input SHA | 修改后：tested code SHA |
| --- | --- | --- |
| F01 | [真实窗口](F01-cancelled-charge-before.png)显示本人余额 0，却出现 `DD 6（六分之一单位） · resource_gain` | [真实窗口](F01-cancelled-charge-after.png)显示“本次攒未生效，DD没有增加”，余额仍 0 |
| F02 | [等待时](F02-pending-success-before.png)返回与标题仍可操作；[返回菜单](F02-left-while-pending-before.png)后，[迟到成功](F02-late-return-before.png)重新进入牌桌 | [等待时](F02-pending-success-after.png)返回/标题 disabled，实际鼠标点击不离页；[成功后](F02-success-after.png)正常进入牌桌并恢复导航 |
| 失败恢复 | 原缺陷未以失败路径冒充复现 | [延迟失败等待](F02-pending-failure-back-after.png)、[失败提示及恢复](F02-failure-recovered-back-after.png)，分别验证直接重试、返回后重开 |
| 场景切换 | 沿用 a 包预览能力 | [预览等待](F02-preview-pending-after.png)关闭按钮禁用、Esc 不关闭；[成功恢复](F02-preview-restored-after.png)仍明确标注演示数据 |

[F01-before.json](F01-before.json) 与 [F01-after.json](F01-after.json) 对同一真实核心输入重新结算，完整 Resolution 完全相同；规范 JSON SHA256 为 `1703e5b38ad80369f5dbb5da505880ab168406826d6e5c9228d2b105df20ea7e`。格式化前后也做深拷贝和哈希比较。

[window-before.json](window-before.json) 记录 `backDisabled=false / brandDisabled=false` 及 prepare→menu→table 回跳；[window-after.json](window-after.json) 记录二者为 true、控制恢复和独立新 match ID。截图为实际 Electron 内容区，禁用状态另有 DOM 断言与鼠标点击验证，不能仅凭截图判断。测试档案均使用临时目录和合成昵称，清理后不影响个人档案。

## 验证

本机 macOS 27 arm64，Python 3.13.7、Node 24.12.0、npm 11.6.2、Electron 44.3.0。复用已安装依赖目录，无安装、升级或 lock 改动。

完整命令、环境覆盖、退出码与耗时见 [validation.json](validation.json)，可从根目录运行 `python3 docs/results/R02-T04-b/validate.py`。九条最终检查全部退出 0：

| 检查 | 结果 |
| --- | --- |
| 默认 npm test（含类型检查、构建） | 22/22 PASS：9 原桌面 + 9 通信 + 4 新导航 |
| runtime | 21/21 PASS：13 原有 + 8 新摘要 |
| core | 174/174 PASS |
| 独立规则样本 | 192 PASS、469 次 resolve；原 2 项 session 继续 NOT_RUN |
| 样本结构与驱动工具 | 结构校验 PASS；8/8 工具自测 PASS |
| scripts/check.py | 40 项：39 PASS + 已存在的 #1 expectedFailure 1；未改变标记 |
| b 专项 Electron | 延迟开场成功/失败、真实取消攒、返回/标题、离场、重试重开、预览切换 PASS |
| 既有 Electron 回归 | 两场各 5 拍完整结算、曾义自动休整、读取失败恢复、worker 中断、档案设置、fixture/观战、两尺寸布局 PASS |

原窗口回归通过 `DEIDEI_SMOKE_OUTPUT=docs/results/R02-T04-b/regression` 写入 [regression/](regression/)，没有覆写 a 包结果。实际账目为 [live-window-ledger.jsonl](regression/live-window-ledger.jsonl)。已查看摘要前后、等待、失败恢复、预览等待及 1920×1080 实际截图；牌名布局保持。1920×1080 为开发视口，宿主显示器读取值是 1710×1112 @2。

开发期命令另记 [development-checks.json](development-checks.json)：修改前摘要用例曾失败，原日志保留；最终结果以受测 SHA 的 validation.json 为准。格式层兜底用例明确使用真实账目的独立拷贝修改 reason，不冒充核心自然产生的事件。

## 增量文件与只读检查

产品与测试增量仅 11 个文件，完整清单和哈希见 [MANIFEST.json](MANIFEST.json)：

- `game/runtime/deidei_runtime/view.py`；`game/runtime/tests/test_summary.py`、`summary_worker.py`；runtime README。
- `game/desktop/renderer.tsx`、`package.json`（只改 test 脚本）、`test-navigation.cjs`、`smoke-live-b.cjs`、`smoke-live-b-main.cjs`、`smoke-live.cjs`（仅测试输出目录覆盖）及 desktop README。
- `docs/results/R02-T04-b/**`：本包报告、测试日志、来源及真实截图。

[scope-check.json](scope-check.json) 验证 input SHA 至本包代码提交：原 core、独立预期/驱动、Session/solo/opponent/worker、桥接逻辑、依赖/lock、build、CI 和 a 包结果均未变化。原工作树仍为干净的 `codex/github-maintainer-results`；未切换或覆盖原树。

## 已知边界与交付

Windows、Python 3.11 单独实机、物理断网、用户本人手动对局为 NOT_RUN；没有把窗口自动化称为这些验收。原独立 2 项 session 占位仍为 NOT_RUN；规划者提供的独立 6 项复测另属附件。旧 23 项工具链审计告警沿用 a 包记录，本包未重新 audit、换依赖或处理告警。

按指定路径与已有测试进行了自审，未调用 Kimi（已暂停）。本包只提交源码修订与本机证据；不合并 PR、不关闭 PR #16、不发下一包、不分发或发布。PR 创建与回读另见后续提交记录。
