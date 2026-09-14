## 这次想解决什么

按 R03-T01-b 修订 rooms-1.1：房主掉线不暂停全场，前三次代攒、第四次截止在核心结算前关房；默认 10 秒且局中改时限从下一拍生效，自动移除成员收到可重送回执。

## 改了什么，哪些没有涉及

- 服务增加版本化时限命令、非参战房主恢复期限及 after_turn/immediate 主动离开分支。
- membership.ended 定向发送、resume 重送并隔离新房／新连接；修复弃权 to_game_id、Unicode 资料验证和错误码。
- 保留 a 的 42 个回归，按 1.1 条款更新 N26/N27，新增 19 个回归；README 和 b 结果同步。
- 输入 `0f114284492417ec61634895c485d73417ff1b49`（PR #22），受测 `02c6c06f5a26149de31c17954f03657289ac23cc`。本 PR 包含尚未合入的 a 祖先，b 增量仅 `git diff 0f114284492417ec61634895c485d73417ff1b49...HEAD`；未改 a 分支/结果。

## 怎样验证

最终固定受测代码 `02c6c06f5a26149de31c17954f03657289ac23cc`：服务 **61/61 PASS**，核心 **174/174 PASS**，独立核心 **192/192 PASS、469 次 resolve**，运行层 **23/23 PASS**，独立工具 **8/8 PASS**；根检查 **40 项（39 PASS、1 原有 expectedFailure）**。pip check 与 CLI help 退出 0。桌面 **25/25 PASS**，typecheck/build 退出 0；后者是只读输入的临时副本，非 rooms-1.1 桌面联调。


- 统一命令：`/tmp/deidei-r03-t01-venv/bin/python docs/results/R03-T01-b/validate.py`；逐条子命令/退出码/哈希见 MANIFEST.json。
- macOS arm64；真实 loopback WebSocket + 经典核心，六人两观众动态改时限连续三场。大多数测试注入时钟，另有真实时钟截止。
- 桌面测试命令 `node --test test.cjs test-live.cjs test-navigation.cjs test-packaging.cjs`，运行于固定输入的临时归档副本。
- 首次完整回归发现计时测试随机进入休整；固定测试代理输入，保留断言与首次失败证据。未改服务行为以迁就测试。

## 对现有内容的影响

- 经典规则 / 招式编号 / 状态编码 / 模型：无变更。房间协议升级 rooms-1.1，旧客户端应明确报告版本不兼容。
- 新依赖：无；websockets hash lock 未改。没有部署、合并或发布。
- 规划只读：附件清单 26 项校验；plan_sha 未提供，MANIFEST 中为 null，规划上下文提交另列。

## 已知问题

- 参数 APPROVED：用户回复“按这个”，确认 after_turn 与 early_reveal=true，无剩余参数问题；见 DECISIONS.md / policy-effective.json。确认后只更新记录、配置文件名与说明，服务逻辑不变。
- 独立 T03 房间验收、rooms-1.1 桌面/GUI 对接、Windows、跨电脑、真人及物理弱网 NOT_RUN。尚无固定 T02-b 分支，不把旧解码器删字段适配当通过。
- 独立核心驱动的 C074/C081 session 项仍 NOT_RUN。未调用 Kimi。

## 提交者确认

- [x] 本次增量仅 game/server/** 与 docs/results/R03-T01-b/**。
- [x] 真实运行结果、首次失败及未测边界均已记录，未增加 skip 或删除断言隐藏失败。
- [x] 未提交密钥、临时身份凭证、环境、运行包或私人材料。
