# R03-T02-a｜桌面联机流程与消息适配

本地实现与验收完成。好友房入口、创建/加入、六席大厅、准备/角色切换、在线牌桌、观战/淘汰、重连/房主暂停、结果/下一场均已实现。实际 Electron 验证使用明确标记的 MOCK transport；没有连接任务01真实服务，不能据此宣称多人联网验收完成。

## 输入与范围

- 产品 input_sha：`23520350393ba43384c20b60bef7d6dbd89fc142`。
- 受测代码 SHA：`f43f80f53a3f635d0b0de4730e545def60259488`；后续提交只保存本结果目录，产品代码不变。
- 分支：`codex/r03-t02-a-online-desktop`；预备 PR base：`integration/r03`。
- 完整规划来自 `deidei-r03-a-handoff-v1.zip`，在工作树外读取，18 个清单条目逐个校验通过。
- plan_sha：`null`；PLAN-MANIFEST.json SHA256：`4442d966b87b477c111f9b99ae9e3444ccfe94dd8338ab5a1910b4e3acd88684`。
- context_plan_sha：`51432688cf1bbdb1765e59af3540342599a71bc4`（只读回查的 integration/r03 简短交付入口）。main：`889162fc90000919004f498b27cffbd5fa4cbe45`，未修改。
- 只改桌面获准路径和本结果目录。没有复制整批规划，没有改 core/runtime/server/packaging、原测试、ProfileStore、锁文件或 CI。

## 关键实现

- `online/network-room-port.cjs`：主进程全局 WebSocket；串行 command_seq、原请求重试、世代隔离、seq 大整数比较、单调时钟估算。凭证只留主进程内存，read/onChange 没有 token、密码或本机 local_id。
- `online/wire.cjs`：明确 loopback endpoint；完整公开 DTO 白名单、额外字段/重复键/超限帧拒绝、本人/观众选项边界。未知私有字段不会进入 renderer。
- `online/OnlineRoom.tsx` / `model.ts`：U01—U07 页面，服务 policy 驱动选项；本地 catalog 只补文字，资格/费用用服务值。DD 用 BigInt 分数，揭晓显示 ledger 资源，下一局才切换公开初值。
- `main.cjs` / `preload.cjs`：具名 IPC 与过滤订阅，沿用 sender/frame、沙箱、CSP 和本地资源限制；原单人开场保持独立。关窗确认后等候离房确认，最多 3 秒后允许系统退出。
- `tests-online/`：fake socket、公开核心样本、网络/展示/预载测试和真实 Electron 专用启动器。产品 main 不导入 fake，普通入口没有预设联网演示。

## 实际验证

以本目录 `validate.py` 汇总重跑，完整命令、工作目录、退出码、受测 SHA 在 [validation.json](validation.json)。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 原 `npm test` + build/typecheck | PASS，25/25 | [desktop-baseline.txt](desktop-baseline.txt) |
| `npm run test:online` + build/typecheck | PASS，18/18 | [online-unit.txt](online-unit.txt) |
| 主进程 WebSocket 探针 | PASS，Electron 44.3.0 / Node 24.20.0 / darwin arm64 / function | [websocket-probe.txt](websocket-probe.txt) |
| `npm run smoke:online` | PASS，实际 Electron，MOCK + 无配置普通 main | [online-smoke.json](online-smoke.json) |
| 原 `smoke-live.cjs` | PASS，真实 Python worker/规则，两场完整比赛与故障恢复 | [offline-regression/live-smoke.json](offline-regression/live-smoke.json) |
| `python3 scripts/check.py` | PASS，40 项，保留原 1 项 expectedFailure | [root.txt](root.txt) |

1366×768 与 1920×1080 的牌区均为 33 张、三排；卡名字号分别至少 16px/21px，没有页面溢出。大厅准备和角色按钮在实际 Electron 中点击验证。截图为开发视口，不宣称对应尺寸的实体显示器验收。

- [1366 大厅](mock-lobby-1366x768.png) / [1920 大厅](mock-lobby-1920x1080.png)
- [1366 牌桌](mock-table-1366x768.png) / [1920 牌桌](mock-table-1920x1080.png)
- [观众大厅](mock-spectator-lobby.png) / [观战](mock-spectating.png) / [房主暂停](mock-host-paused.png)
- [重连](mock-reconnecting.png) / [结果](mock-result.png) / [无服务配置](unconfigured-real-main.png)

## 未验证与限制

- 真实任务01服务、真实 socket 房间对接、两人/六人真人、跨电脑、Windows：NOT_RUN；本包未自动集成服务。
- 单调时间是界面估算，服务仍负责权威截止判定；客户端不放宽迟到出牌。
- 断线时主动离开会停止重连，原席位按服务掉线策略处理。系统关窗无法在 3 秒内确认离房时也如此；不能声称服务已立即清退所有人。
- 没有新增安装包、签名、证书、公网 URL、服务器或部署；不改变 R02 的 Windows/干净机待验收事项。
- 直接依赖与 package-lock 均未改变，未执行 npm audit fix；本次未做新的依赖安全公告审计。

## 审查与提交状态

已做聚焦自审：IPC/凭证边界、乱序/重试/退出、公开资源与单人兼容；Kimi 未调用（按技能停用要求）。没有外部审查结论。

用户后续明确回复「授权」，已推送任务分支并创建 [PR #21](https://github.com/Kalopsiazza/DeiDei/pull/21)。创建后回读确认：base=`integration/r03`，head=`codex/r03-t02-a-online-desktop`，初次 head SHA=`c9242a2afc377c833f6e4e04c4540132c59fb1ca`，状态 OPEN。此后只补充本次提交记录；受测产品代码不变。未合入。
