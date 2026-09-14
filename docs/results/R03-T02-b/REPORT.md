# R03-T02-b 交付

rooms-1.1 桌面修订已实现。房主在大厅、选择、揭晓和结果阶段可调整未来每拍时限；自然淘汰保留管理权限。当前拍时限、截止时间与已确认招式不被设置 ack 改写。房主缺席提示与牌局倒计时并行；自动移出通知返回联机入口，保留临时身份，迟到旧房事件不恢复旧页面。

## 输入与范围

- 产品输入：`72266fbc63e4982738ae83eee99e9001a6872d6f`（PR #21）。独立分支 `codex/r03-t02-b-online-desktop`，独立 worktree，原 a 未改。
- 受测源码：`19e75c0d3f3ca8423733538a57ef071ad808a713`。之后提交只补本结果目录的文档和证据。
- 规划：附件 `deidei-r03-b-handoff-v1.zip`，`R03-plan-1.1-b`。26 项清单逐项大小/hash 校验通过；PLAN-MANIFEST SHA256 `3b5f1fdf74e2c236768216d27edbd1bffa67bb57577c21c2b38504d6edac7d2c`。未提供单独的上传 plan_sha，保持 null。
- 开始时远端 integration/r03 `7ed0c388149dcd8caa7436e4a4574f2343eff9c9`；main `889162fc90000919004f498b27cffbd5fa4cbe45`，仅作只读上下文。
- PR 目标 integration/r03。PR 含尚未合入的 a 祖先；本次增量单独用 `git diff 72266fbc63e4982738ae83eee99e9001a6872d6f 19e75c0d3f3ca8423733538a57ef071ad808a713` 查看。
- 只改 desktop 在线模块、命名 IPC、局部样式、相关测试/README 与本结果目录。服务、核心、单人 runtime、模型、依赖锁、打包和其他结果均未修改。没有正式新 PRD/架构或额外参数裁定。

## 关键修订

`wire.cjs` 读取 rooms-1.1 的六档时间、policy_revision/current_turn_ms、host_recovery/pending_close、membership.ended 和精确异常 ack；拒绝旧 hello、paused 和未知字段。`effective_transition.to_game_id` 仍是字符串并必须等于 effective_state.game_id，core_resolution 同样校验对应关系。

`network-room-port.cjs` 将快照作为时限设置事实来源，旧 ack 不回滚新 policy。房主恢复时间独立计算；相同 seq/server_time 的重复快照不重新开始倒计时。定向移出校验本人、当前房、事件 ID 和 seq，只取消旧房待确认命令、清理旧页面与确认牌，保留内存身份。新房请求、旧连接、迟到 ack/snapshot/event 有隔离测试。自审另复现旧房高序号快照挤掉新房确认前快照的问题，补入旧房过滤后同一用例通过。

`OnlineRoom.tsx` 显示本拍/之后时限差异，配置弹窗带预期 revision；自然淘汰房主仍有设置入口，非房主与 pending_close 不暴露该入口。房主缺席不暂停出牌；移出后显示旧房号与原因。局部样式让恢复提示和摘要入口在 1366×768 保持可读，沿用原三排 33 张牌。

## 验证来源与限制

真实命令、退出码、平台见 validation.json 与 TEST-MATRIX。原桌面 25 项、在线 28 项（a 为 18 项，按 1.1 更新旧暂停预期并新增 10 项）、根 40 项（保留 1 个历史 expectedFailure）、真实 Electron MOCK 窗口与真实离线 worker 窗口均通过。首次新增测试在实现前为 7 失败/1 通过，保留 before-v11.txt；旧客户端不接受新版 hello，因此部分失败发生在握手前置步骤。没有降低断言或给新失败加 skip。

真实结果额外取自 `/Users/zengchongtai/develop/DeiDei-r03-t01-b` 当时的 Room/core 源码，容器中的会话、时钟与固定输入为合成数据。采集时该分支 HEAD 仍为 `0f114284492417ec61634895c485d73417ff1b49`，有未提交 b 修改，所以不能把它称为该 a SHA 的结果。`tests-online/room-results-v11.json` 记录全部来源文件 SHA256，采集前后逐项一致。Room SHA256 为 `90396c19ee497822ce4edf44db28d6393a8152f66a33f80dd9cbc12b08f88cb6`；protocol 为 `a604a984c135903f39e72d9bc83e414a78d9592bc280ac0e9ca2f9a7cb2f0fc8`。

采集命令：`python3 game/desktop/tests-online/capture-room-results.py /Users/zengchongtai/develop/DeiDei-r03-t01-b > game/desktop/tests-online/room-results-v11.json`，退出 0。10 个未经改写的 Room DTO 经 readMessage 接受，包含普通揭晓/下一拍，以及规则和退赛导致唯一胜者或无人获胜的揭晓/完整 result。负例仅在测试副本中把 to_game_id 改成 null/错误 ID、添加私密字段，均拒绝。没有删除 last_turn 以绕过解码问题。

这只是实际 Room → core → DTO → 客户端解码的本地调用链。真实 socket、Electron 连接真实服务、多设备真人联机、物理断网、Windows、安装包与发布均 NOT_RUN。来源 checkout 会继续变化，后续集成须固定最终服务 SHA 再联调；本包没有替换或合入服务。核心174、独立核心192/469、runtime23、打包工具8未重跑：相关源码无改动，本次按职责验证桌面与离线运行链。

## 截图

- 调整前：[mock-limit-before.png](mock-limit-before.png)；选择 5 秒：[mock-limit-dialog.png](mock-limit-dialog.png)；本拍10/之后5：[mock-limit-next5.png](mock-limit-next5.png)；本拍5/之后30：[mock-limit-next30.png](mock-limit-next30.png)。
- 不暂停：[mock-host-continues.png](mock-host-continues.png)；恢复倒计时：[mock-host-grace-continues.png](mock-host-grace-continues.png)；淘汰房主：[mock-eliminated-host-setting.png](mock-eliminated-host-setting.png)。
- 待关闭：[mock-pending-close.png](mock-pending-close.png)；自动移出：[mock-membership-ended.png](mock-membership-ended.png)；旧事件后新房：[mock-new-room-old-event.png](mock-new-room-old-event.png)。
- 完整结果：[mock-result.png](mock-result.png)；原单人实际窗口：[offline-regression/live-table-1366x768.png](offline-regression/live-table-1366x768.png)。

以上 mock-* 均是实际 macOS Electron 开发窗口配脚本化 socket，画面明确标记 MOCK；1920×1080 是开发视口，不代表同分辨率物理显示器。

## 审查与提交

按 vibe-engineering-workflow 的实现/前端/重点自审路径执行。重点复核精确 DTO、凭证仅主进程、旧消息隔离、倒计时与权限、原单人回归及变更路径。未调用 Kimi（保持暂停）；无外部审查通过声明。

未自动合入、关闭 PR #21、部署、发布或下发下一包。PR： https://github.com/Kalopsiazza/DeiDei/pull/24 ，已回读 OPEN、base=integration/r03、head=codex/r03-t02-b-online-desktop，创建时 head=c717881fbbff21790eb5d3a0e8b7db551178f541；后续仅补本远端回执。
