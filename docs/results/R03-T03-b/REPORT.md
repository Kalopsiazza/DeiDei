# R03-T03-b 交付报告

已完成独立 1.1 样本、驱动修订及固定候选实跑。**测试任务完成，b 产品不能据此判全量通过**：160 例中 156 PASS、3 FAIL、1 NOT_RUN；补充 11 场景的真实服务 → 真实桌面 readMessage 全部通过。

## 输入与范围

- input_sha：`378ab28b814cdbc0d798bd7dff22a7fdad5fdf90`（PR #20）；测试源码：`fe6163ae52ed8e353b3a3ae51174a2a4f018b33d`。
- 规划：R03-plan-1.1-b 附件的26项清单逐项核验；plan_sha=null，转交未给 Git 规划 SHA。附件与清单 hash 见 MANIFEST.json。
- 固定 a：服务 `0f114284492417ec61634895c485d73417ff1b49`、桌面 `72266fbc63e4982738ae83eee99e9001a6872d6f`、样本 `378ab28b814cdbc0d798bd7dff22a7fdad5fdf90`。
- 固定 b：服务 `c4b27b1b358a4823e65d92e0b035be3e18438c60`（PR #23）、桌面 `1dbe1e4f8de28410dc42946efddffc011966cc3a`（PR #24）。独立 detached 工作树，不合并产品以凑兼容。
- 只改 tests/rooms_v1 与本结果目录。保留 a 分支、a 结果、核心、旧独立样本、runtime、桌面产品、依赖锁、CI、正式规划。

## 实跑结论

未改 a 驱动使用实际指定入口时，95个可执行样本在传入六字段 policy 的工厂阶段失败，0通过，N35未测。这不是95个协议交互失败。它还使用不合约的非 UUID 请求 ID。原输出保存在 a-original-*，没有覆盖原 a 分支的报告。

补充独立桥接使用真正 WebSocket 与固定桌面 readMessage。a 复现5个场景失败：主动退场、第三次超时移除、弃权后无人存活的 to_game_id=null；空白/U+200B 昵称被接受并公开后遭桌面拒收。第三次移除还缺本人通知。b 同样11场景全通过，含无弃权揭晓/胜利/全员出局正控制与合法中文/emoji。

最终完整 b 套件保留的失败：

1. **N33/burst_limit：限流 ack 无法关联请求。** 逐个接收回复后快速发送合法 UUID 的 room.sync，排除突发堆满 writer 队列的干扰。服务返回 `request_id:null / RATE_LIMITED / retryable:true`。这不是 W12 定义的无UUID坏消息 `INVALID_MESSAGE`，也不能完成当前合法请求。服务在解析 request_id 前限流（server.py handler）。驱动保留 FAIL，没有接受任意错误或吞掉缺 ack。
2. **N36/real_clock、N48/real_clock：同序号截止值变化。** 无注入时钟的六玩家两观众运行中，同 room/seq 的 deadline_at_ms 出现约1ms差异；源码每次用 wall_ms + deadline - now 重算，两个时钟分次取整。测试仍严格保留 deadline 不变断言。尚未证明实际结算提前/延迟；该两例在启动快照一致性处停止，不能宣称它们已完成真实5秒超时代理。修复或明确规范容差需维护者判断，本任务不修改产品或规划。

失败的安全摘录在 b-acceptance.json.observed，保留 seq/时间/错误，未记录凭证或未揭晓选择。完整逐例状态见 TEST-MATRIX.md。

## 新增覆盖与自检

160例保留原96个 case_id，增加64个子例。覆盖默认10秒与12秒兼容、本拍deadline和current_turn_ms固定/下一拍生效、精确版本与权限错误、重放和同值不广播、房主前三次Charge/第四次核心调用前关闭、forced与断线计数、30秒一次宽限、after_turn/immediate、0/1/2人弃权终局的击杀/移除/重开、定向移除与恢复回执、新房旧消息隔离、Unicode资料/密码。

N10 在秘密牌仍未揭晓时比较 sync/resume/错误后完整观察者 JSON，并比较临时观众宽限结束的定向回执；身份集合先映射别名再规范排序，不让随机UUID次序制造误报。N44 真实结果进入真实解码器，显式核对击杀和弃权名单，防止把弃权伪造成击杀。N46 运行真实 NetworkRoomPort，传输为脚本可控，不能计为窗口实机。

工厂只收4项可配字段、请求ID改UUID；其余预期修改及理由逐项列于 CASE-MAP.md。19项工具自测涵盖格式突变、消息关联、秘密差分、身份排序、宽限倒计时和核心完整账目。没有以产品输出来生成正确答案。

## 验证与限制

根检查59项（保留1个历史 expectedFailure）；核心174；独立核心192样本/469次调用；runtime23；桌面25；原独立工具8，全部通过。实际命令、退出码和平台见 CHECKS.json，各 stdout/stderr 原样留存。macOS arm64 / Python 3.13.7；桌面 npm test 使用候选既有 node_modules，只生成被忽略的构建产物，不改锁或产品源码。

websockets==17.0.1 来自既定 hashlock 的独立 venv，wheel hash 与安全查询回执见 dependency-security.json；没有新增依赖或版本变更。OSV查询未返回已知记录不表示绝对安全。

N31有限慢读已执行，但32条/2MiB精确阈值仍 NOT_PROVEN；N35实际 Electron、公网、跨机器真人、Windows、新运行包未测。原独立核心两个session占位不作本包通过数。交付前回读 PR #23 已到 `b40996e833297e24817b9c24b7830ed2941d9c3d`，其 decisions.json 记录 after_turn 与 early_reveal=true 已确认（原话“按这个”）。该提交仅改决策文档及服务 README，受测服务包 Git tree 与 c4b27b1 完全相同；实际执行 SHA 仍记 c4b27b1，不冒称已在新提交重跑。见 CANDIDATE-HEADS.json。

未调用 Kimi。未合并、部署、发布或关闭旧PR。本结果只交源码和证据。
