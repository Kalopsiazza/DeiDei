# R04-T02-d 结果

远端交付状态：**本机候选已交付，待源码验收**。以下为执行者检查记录，保留原检查输入／失败／未验事项；完整来源、集成提交和最终 head 的对应关系见 [VERSIONS.md](../R04-T02/VERSIONS.md)。本报告中的“未推送”指初轮记录时，后续由集成分支统一交付。

代码：`91c15b3850c10123023bc2afe56d0f9f0972f4e1`，基于 B `852a211cb3801b98fee9c39e5e58db23d29c3e17`。真实 Electron 固定代码检查开始时 Git 干净；后续只补本报告与 DESIGN 的“两至三行”准确表述。独立 worktree `.worktrees/r04-t02-d`、分支 `codex/r04-t02-d-shared-style` 保留，未归档、未 push/merge/PR。根执行者负责设计复核与集成。VEW 中风险前端流程；未调用 Kimi。

## 实现

- 12 个连续场景／职责源文件保留既有 cascade 顺序，末尾独立 preferences；欢迎仍独立。esbuild 展开源码导入，运行端仍两份 CSS，生成 CSS 无 `@import`、素材 URL 未改路径。
- 原四个 type tokens 实际消费；菜单／设置／准备横向安全边、联机紧凑边、大厅／人物／竞技台／欢迎裁切焦点使用同值 CSS 变量。无新 JS 坐标、框架或依赖。
- 删除会命中现代 portal/control 的旧 `.online:not(.online-table)` 皮肤及旧非牌桌 dialog 皮肤；保留 tech-dialog primary/danger，迁移必要的场景选择态。通用 hover 排除 primary/danger；准备主动作 hover 使用既有浅红边。
- 默认本地手牌名最小 12px（DESIGN 关键操作默认 12–16px），1366 为 13.66px，1920 为 14px；长名自然换行，最小窄窗可两至三行，完整文字不再 ellipse。联机既有 16px、教程既有 19px 不缩小。
- dev watcher 覆盖职责 CSS、SharedUI.tsx、useSoloSession.ts；主进程／preload／白名单／worker 仍重启。旧中庭源资产保留，最终集成 build 保留 A 已移除的正式旧素材复制。

## 实测与命令

在本 worktree 根执行；原 Node/npm/依赖未升级，node_modules 复用 r04-t01-b。仅隔离临时档案／自有 Electron；联机入口和六人快照明确为既有 MOCK。

| 命令 | 退出／结论 |
| --- | --- |
| `npm --prefix game/desktop test` | 固定代码 exit 0，65/65（含类型／构建） |
| `DEIDEI_STYLE_OUTPUT=.local-outputs/R04-T02-d/final-head node game/desktop/smoke-style.cjs` | 固定代码 exit 0；10 控件 default/hover/active/focus-visible/disabled/busy，加 disabledPressed；72 内容尺寸场景全部通过；未触发强制 cleanup |
| `node --check game/desktop/{smoke-style,build,dev}.cjs`（分别执行） | 各 exit 0 |
| watcher 匹配定向核对、生成 CSS 导入／URL 核对、`git diff --check` | exit 0；13 职责 CSS + C 共享 UI 监视，生成 CSS 无运行导入 |
| `node game/desktop/smoke-r04-battle.cjs` | exit 1，停在已过时的“见习：观察节奏”定位；后续未执行，未删除断言／改产品满足旧脚本 |

完整日志、computed、实际截图保留在 ignored `.local-outputs/R04-T02-d/`。固定 SHA 的 `final-head/computed.json` 记录 clean、PASS、Electron PID38533；驱动完整退出，最终落盘 2026-10-03 13:25:11 +08:00。13:26:06 +08:00 复查该 PID、自有 driver 和旧挂起 PID 均不存在。root E 后续 GUI 开始前后的短暂并行记录在其结果中，本包不提供性能结论。

尺寸：1000×650、1060×650、1366×768、1920×1080、1280×800（16:10）、2560×1080（超宽）。菜单、Dialog、准备、图鉴、可滚动规则 Dialog、教程、联机前厅／创建、双／六人选牌与揭晓均有代表截图。每种默认选牌 33 张仍三行，完整名称 Range 位于 strong 内容区、canvas 字形高度可容纳、无页面溢出；教程 3 张完整可达。双人揭晓使用真实普通 worker 与既有 UI“冻结”保持画面，六人使用 MOCK 的公开 revealing 快照，各六尺寸无席位碰撞。冻结检查不证明运行时时钟暂停。

原生：初始 1366×768、DPR2；实际 macOS 全屏 inner 2304×1536、DPR2，外接 MateStation X。Electron 记录同时连接内建 1710×1112、DPR2 显示器，未实际跨屏。系统工具报告外接 2304×1536 @60Hz。内容尺寸矩阵为 renderer 模拟且当时 DPR1；另明确模拟 1366×768 DPR1/2。上述均不证明面板物理 4K。

减少动态／透明度同时模拟时：settings scene transition `0s`、内容 backdrop `none`、深色背景 `rgb(11,20,29)`；信息与控件完整。偏好在六人常规揭晓复测前恢复。

## 对照、失败与边界

稳定前样式取 B worktree，虽 HEAD 为 docs 后续提交 `f8d4779`，CSS 字节与 B 852a211 完全一致（SHA256 `6717c464703ab3bc92511add8d8308456f120bfa349c33aedd26f3738f42e23f`）。9 控件×6 态前后对照使用 250ms 稳定采样：[摘要](computed-summary.csv)。菜单主动作、设置输入／保存、HUD 各态无差；有意差异是危险确认恢复红色（旧默认灰、hover 青）、联机创建恢复主红／真实 disabled，返回恢复工具玻璃，prepare hover 旧绿边恢复浅红；容器与 Dialog 退出旧皮肤。当前输入哈希见 [清单](css-inputs.sha256)，72 场景见 [摘要](layout-summary.csv)。

早期 probe 的错误离开定位、选牌阶段模糊席位几何误用、多人禁止冻结、未改设置的保存按钮禁用、教程放大字号上限误用均保留日志与失败截图，随后按真实 UI／阶段归属修正 QA。首次旧 driver graceful close 挂起，仅终止确认的自有 PID35514/35585；新版先落证据再 bounded app.exit，仅作用于自己的测试进程。最终完整 driver 的 exit 0 独立核验，未把 stdout PASS 代替退出码。

仍待验：物理 4K／跨屏切换／Windows／HDR／不同系统缩放，所有视频宽高比末帧的逐帧视觉接受，正式服务／跨设备真人。现暂停 CSS 主要暂停 animation，伪元素 transition 的完整暂停语义仍需另定位；未以此做性能优化。图鉴 1920 绘制慢没有因果定位，本包未改渲染、时序或 blur 强度。根集成后继续当前真实 GUI 与最终成包；本报告不宣称发行或真人视觉接受。


## PR #34 · R34-02（2026-10-03）

三处局部消费者修正：共享tech-dialog原生select提供dark表面／浅字／焦点／disabled；battle通用hover排除primary/danger；reduce准确命中standard扫描与intro article::before。13份职责CSS顺序、欢迎独立、两份运行样式、既有共用tokens保留。原72布局场景与10控件数据仍按上文原来源，不作为本轮重跑。

真CLI＋普通main＋一个合成Peer，原生CUA方向键/Return操作大厅10→30s、战局30→20s；系统区域展开图已经本地Codex看图，实际policy确认，driver0、普通应用close0、服务SIGINT0、后代结束与profile删除。输入clean4bdd35df036e622d0cc3cdb53aa6849e7f003160；战局Dialog在selecting打开，服务持续，Apply时result，本轮没有重验当前deadline。

自动targeted实际起点4739d6c8f6e9a19d51ec28370c6dfa92e68d78d5、仅F诊断脚本dirty：四个暂停按钮、两处select、三组motion通过，driver0、pageErrors=[]、layouts=0。所有9项D/main/生成输入与最终源码3006f0a42bece4d702c5a7ba48af9d0d0fafbfc8字节一致。本地实际worker；在线为既有MOCK；disabled/busy属性是CSS合成取样，当前实际select无自然disabled状态。此脚本既有app.exit(0)仅测试退出，不当作正常关闭验收。

首轮Home/End与CDP原生事件诊断、首次CUA控制等待超时均失败保留。自动脚本native PENDING/NOT_RUN由独立真实原生证据补充，没有伪改状态。0面积／缺卡名／缺席位部件／常驻阴影假焦点及缺类别反例均拒绝；类型构建exit0，reduce为none/1，恢复偏好为原infinite。

[修正报告、截图、逐状态计算值与精确输入](../R04-T02/R34-REPAIRS.md)。全页面七态、动态resize／全屏序列／物理跨DPI／最小支持尺寸等上文未验事项原样保留；没有为了局部小修重做整个适配包。未调用Kimi。
