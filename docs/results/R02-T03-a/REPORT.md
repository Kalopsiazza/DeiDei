# R02-T03-a｜桌面流程与牌区可点击原型

状态：**PARTIAL，等待依赖风险处理与规划者验收**。本包实现、类型检查、构建和 macOS 窗口交互已通过；锁定开发工具链的依赖审计未通过。本结论不表示真实游戏、跨平台分发或新规则引擎通过。

## 做了什么

- `game/desktop/` 独立 Electron + React/TypeScript 项目；P01/P02/P03/P06/P09/P10/P11 可操作。P04/P05 明示尚未加入联机；P07/P08 由开发预览进入。
- 本机档案、头像、昵称、音量、全屏设置真实保存。主进程创建 local_id；昵称按 Unicode 码点检查；原子替换失败保留旧档案与编辑输入。损坏档案明确确认后先备份再重建。
- 三类 18/9/6 张，6/3/2 列，每组三行；33 张同时显示。初始 A 12 可用、中局 B 26 可用，合法性仅为作者给定静态样例。十个键位按分类阅读顺序绑定，数字键只选中，Enter/按钮提交；灰牌可读原因。
- FixturePort 在主进程返回合同 DesktopView。等待、选中、已提交、揭晓、结果、拒绝后重试、普通观众、淘汰后观战与存活者新局均有脚本；对手未揭晓选择不出现在视图中。单人结果使用同一份两人名单，六人结果只在预览中。
- 本地手册提供 33 招名称搜索、分类、持有门槛、费用和 R01—R28 条款；强化削和复制聂湘的费用说明分开。SVG 为本任务占位图形，无角色资产或字体文件复制。

## 固定输入和代码

- input_code_sha：`3a81daf0f42416ccb73a5a69748655145e6f2f0c`。
- tested_code_sha：`499fb8ad07f92e8ce583741a47b7d5969c140913`；报告/截图记录随后提交，不改变受测代码。
- 本地分支：`codex/r02-t03-a-desktop`；工作树：`/Users/zengchongtai/develop/DeiDei-r02-t03-a`。原 DeiDei 工作树保持不动。
- 交接 ZIP SHA256：`f5e97fe4395f6f3d5552c30b1fe0052563e75c7d7e5d07c97bb78b960fa554b1`。附件解包在工作树外，36 项大小与 SHA256 全部匹配；逐项见 `input-check.json`。
- PRD-R02 / ARC-R02 / CONTRACT-R02 / UI-R02 均为 1.0；规则为 classic-1.0.1；入口映射版本 1。
- 依赖与锁来自固定 `135b938fcfe0486895adfeea37fab73ee5f881dd:experiments/r01-t02-b`，全部依赖条目保持一致，只改局部项目名称、说明与脚本。安全主进程、预加载、同目录替换方式读取该固定版本后重写；不含 bridge、worker 或旧引擎。没有读取其他 R02 线程实现。
- 允许路径仅 `game/desktop/**` 与本结果目录；无 core/runtime、独立规则测试、根依赖、原 CI 或正式规划变更。`catalog.json` 是从指定规范摘取并转成应用数据的本地手册，未复制规划文档目录。

## 实际验证

命令和退出码见 `commands.json`、`desktop-tests.txt`、`desktop-smoke.txt`、`legacy-check.txt`；所有玩法内容均未当作真实规则测试。

| 检查 | 实际结果 |
| --- | --- |
| `npm test` | 类型检查、构建和 9 项自测通过；0 skip。覆盖档案合法输入、读写/恢复/并发/符号链接、写入及替换故障、静态牌表、键位、状态/重复/过期提交、观战与结果。 |
| `npm run smoke` | 真实 Electron 窗口自动化通过。保存权限失败时字节不变且输入保留；继续编辑/放弃/保存、真实全屏切换、启动恢复、键鼠与弹窗、灰牌原因、重试、两类结果和观战等有证据。 |
| IPC / 本地资源 | 非所属 renderer 被拒；未知字段、超长载荷、非法设置被拒；未列出的资源、POST 和新窗口被拒。沙箱、隔离、webSecurity 为 true，Node 为 false。 |
| 两种内容视口 | 1366×768、1920×1080 各 33 张可见、三行、无页面溢出；牌名至少 16px，费用至少 12px。 |
| `python3 scripts/check.py` | 32 项：31 通过、1 项已有 expectedFailure；10 个 Python 文件语法通过。未修改旧测试。 |
| `npm audit --json` | 退出 1：3 low、19 high、1 critical，共 23，见 `dependency-audit.json`。 |
| `npm audit --omit=dev --json` | 退出 0，生产依赖审计为 0 项，见 `dependency-audit-production.json`；不替代 Electron 整体安全审查。 |

环境：macOS 27.0（26A5425a）、arm64；开发 Node 24.12.0 / npm 11.6.2，系统 Python 3.13.7（仅运行旧基础检查）；Electron 44.3.0 内置 Node 24.20.0、Chromium 152.0.7977.78。类型/构建/测试依赖沿用任务要求。

本机显示工作区为 1710×1027 DIP，显示缩放 2；原生测试窗口内容区为 1366×768。1920×1080 使用 Playwright 调整 Electron renderer 的开发视口，截图按 CSS 像素输出，**不是 1920×1080 的物理屏幕实测**。详细窗口/显示/版本/截图参数见 `ui-evidence.json`。该文件的 uncommitted 包含当时尚未提交的结果文件；受测 game/desktop 代码已固定在上述 SHA。

## 截图索引

- P01-native、P02-menu、P03-prepare：首次档案、主菜单与双人准备。
- P06-selected / submitted / revealed、P09-solo-winner：真实可点击双人脚本及两人结果。
- P07-midgame-1366x768 / 1920x1080、P07-initial-1366x768、P07-submit-error：密度、静态样例和拒绝状态。
- P08-spectator / eliminated / restart：普通观众、本人淘汰及存活者新局。
- P09-draw / six-winner、P10-save-failure、P11-manual：两类结果、保存负例、本地手册。

截图均来自本次原型的合成档案和演示场景。Codex 已查看主菜单及两种 P07 密度图；保留纸色与简单手绘占位图形，不声称正式美术或角色一致性验收。

## 待处理和未运行

1. **依赖风险待规划者处理**：告警集中在 Forge/打包工具的传递依赖（包括 tar）。任务指定锁版本并要求发现重大风险返回，故没有 `npm audit fix`、私改大版本或运行 Forge 分发；当前实现留作本地审查。需要后续给出受审的依赖调整方案再考虑分发。
2. 真实规则、WorkerPort、AI、多人联机、物理断网、Windows、安装包与签名均 NOT_RUN，本包无相关集成授权。音量可保存，音源尚未加入。
3. 目标尺寸以下显示调大窗口/调整缩放提示，保持字号，可滚动；没有把小屏强行压缩为不可读布局。
4. PR 未创建、未 push：本次只完成本地任务。附件内远程命令不作为新增远程写入授权；未尝试操作，亦无网络失败可报告。已备 `PR-BODY.md`，预期 base 为本任务明确指定的 `docs/design-discussion-20260911`；R02-START 的另一处 integration/r02 文字与此冲突，未采用。

迭代中修复了 app:// 的 Node URL origin 校验不适用问题，以及两个视口各 16/15px 的底部溢出；未降低布局断言。两处自动化等待/执行上下文问题也修复后重跑。最终记录来自固定代码提交，不把早期失败当通过。

复核：Codex 自审完成；未使用子代理或外部审查，未调用 Kimi（技能规定暂停）。没有合并、发布或启动后续集成包。
