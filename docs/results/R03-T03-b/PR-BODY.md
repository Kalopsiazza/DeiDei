## 这次想解决什么

依据 R03 1.1 补全独立预期，并让固定服务的真实结果进入固定桌面解码器。160例实跑156通过、3失败、1未测；11个补充服务→桌面交叉场景通过。测试交付不代表产品全量验收通过。

## 改了什么，哪些没有涉及

从 PR #20 的 `378ab28b814cdbc0d798bd7dff22a7fdad5fdf90` 新建 b 分支。保留96个既有 case_id，新增64个子例，修正入口配置/UUID/身份集合规范化，新增1.1字段、时限、房主缺席/退出、成员终止、Unicode和真实解码检查。

本 PR 自然包含尚未合入的 a 祖先；**b 增量仅 input_sha→本分支**，只涉及 `tests/rooms_v1/**` 与 `docs/results/R03-T03-b/**`。不把 a 工作归功为 b 重写。

## 怎样验证

- 测试源码 `fe6163ae52ed8e353b3a3ae51174a2a4f018b33d`；服务 `c4b27b1b358a4823e65d92e0b035be3e18438c60`；桌面 `1dbe1e4f8de28410dc42946efddffc011966cc3a`，候选原样实跑。
- 160个独立样本：156 PASS、3 FAIL、N35 NOT_RUN；11个真实socket→readMessage场景 PASS。未改a驱动/产品失败原输出保留。
- `python3 scripts/check.py`：59 tests，保留1个历史 expectedFailure。rooms工具19、核心174、独立核心192/469、runtime23、桌面25、原工具8均通过。
- 完整命令、退出码、来源映射、原日志见本分支 [REPORT](https://github.com/Kalopsiazza/DeiDei/blob/codex/r03-t03-b-room-tests/docs/results/R03-T03-b/REPORT.md)、TEST-MATRIX、MANIFEST、CHECKS。

## 对现有内容的影响

不改规则、招式、状态编码、模型、产品、依赖锁、CI或正式规划。仅在外部venv安装既定websockets hashlock。plan_sha未由转交提供，附件26项及SHA256已核验。

## 已知问题

- N33合法请求的限流ack使用null request_id，无法关联在途命令。
- N36/N48真实时钟下同序号deadline出现约1ms差异，严格一致性断言失败；尚未证明实际结算时序错误。
- N31精确队列阈值 NOT_PROVEN；N35 Electron/Windows/跨机器/运行包留集成验收。任务01新记录 b40996e 已确认 after_turn/early_reveal=true；该提交仅文档改动，服务代码与受测c4b27b1一致。
- 未调用Kimi；不合并、不部署、不关闭a PR。

## 提交者确认

- [x] 只提交授权测试与结果范围。
- [x] 如实保留失败与未测，未新增skip或降低核心断言。
- [x] 未提交凭证、私人资料、依赖环境或运行包。
