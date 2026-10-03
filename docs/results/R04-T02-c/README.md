# C 交互恢复与会话归属

源头88185af，采用B公开定义852a211。`useSoloSession`拥有本地view、generation/readSlot/submit/scene lock和轮询；`useOnlineSession`拥有联机state/revision、命令锁、离房意图、时间收据与表单草稿。页面保留持续舞台和转场呈现，无全局store，无新依赖。

同结果页的明确拒绝/抛错/迟到服务错误/断线均恢复退场状态；房主与成员终场退出先确认，取消不发命令。离线出口可作废在途IPC并停止重连。转场计时器发令前复核room/match/phase/status，卸载回收。原单人5s入场、720ms落桌/返回、650ms结果遮罩和联机2600/650/650/720ms（减少动效300/30/100/150ms）保留。

Avatar、Identity、native Modal与MatchResult共用；观众终场为“整场结束”。Modal以组件requestClose处理关闭、忙碌和减少动效，原生焦点回归不再通过全局click查询。普通button Enter使用原生激活；出牌快捷键仅在允许出牌的目标上生效。

搜索证明根renderer的detail/rule入口只剩自身旧模态，没有实际消费者；已删除。`ManualArchive`的牌卡详情与独立setRuleFocus保留。根旧room-settings仅由不可达的本地multiplayer分支打开，真实OnlineRoom设置保留。暂停文案明确只暂停输入/读取，运行时计时继续，没有声称冻结核心时间。

独立Codex复核发现原有旧leave失败可能污染新场；已按generation保护catch，当前离场失败仍显示，旧失败不写入新场。Kimi未调用。

验证：
- `npm --prefix game/desktop run build`：类型与构建通过。
- `node --test game/desktop/test-navigation.cjs`：5项通过，包括旧leave迟到失败→新场不被污染。
- `node --test game/desktop/tests-online/test-session-recovery.cjs game/desktop/tests-online/test-model.cjs`：在线恢复与adapter/model定向16项通过。
- `node game/desktop/smoke-recovery.cjs`：普通main/公开fixture场景，10项通过，普通按钮Enter不提交、focus恢复、持续DOM、共享结果/背景；不是网络证据。
- `node game/desktop/tests-online/smoke-recovery.cjs`：MOCK Electron 5组通过，明确拒绝/重试、房主成员确认/取消、断线slow IPC离房、旧timer失效、普通Enter和退场断线回退。

证据分别在本worktree忽略目录 `.local-outputs/recovery` 和 `.local-outputs/r04-t02-c/online-recovery`，包含截图、受控失败与实际输入记录。前述smoke取样为B HEAD加明确dirty工作区；集成E的清洁提交真实网络另验。未把MOCK、类型构建或静态截图当作真实联机、动态跨屏或人类视觉验收。最初测试选择器误用和六人禁用freeze目标已经按实际源码修正，产品断言不删减。

## 最终集成复验

真实服务发现已失成员后确认退出仍可能停留前厅：snapshot 已清空，但 ROOM_NOT_MEMBER/ROOM_GONE 与离房意图同时到达。`8a65b881e64a15c18a218e59ed3130fa48babe01` 仅将此确定失成员情况完成退出；普通拒绝仍恢复操作，不误导航。6项 hook 回归及独立 Codex 审查通过。

集成工作区 `.worktrees/r04-t02-e`：真实房间 13 组通过（725ec1f），本地恢复 12 项通过（74fbf36），MOCK 恢复 5 组通过（8647ac5），完整旧擂台 smoke 通过（8647ac5）。本地六席 preview 的暂停/局势按明确 mode 核验，原淘汰记录栏断言移到真正 OnlineRoom 的 MOCK 情境，仍保留在线覆盖。真实网络退出/迟到回复和恢复见 E RESULT。证据分别为 `.local-outputs/recovery`、`.local-outputs/r04-t02/online-recovery-final`、`.local-outputs/r04-t02/battle-final.log`、`.local-outputs/r04-t02/real-gui/`。
