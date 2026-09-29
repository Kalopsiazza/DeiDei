## 这次想解决什么

原好友房只支持本机明文地址。本次按 R03-NEXT A02—A06 增加可选 TLS 服务和桌面只读服务地址配置，完成本机安全联测，为后续受控远端部署做准备。

## 改了什么，哪些没有涉及

- 服务启动前验证证书/私钥、最低 TLS 1.2 和显式远端许可；默认仍为回环明文。
- 桌面 main 一次读取固定配置，严格校验 ws/wss 地址并保留原生证书验证，配置错误只影响联机入口。
- 加入真实 Python、NetworkRoomPort 和普通 macOS Electron TLS 正负例、截图及部署准备资料。
- 按用户明确授权更新旧端点测试：合法 wss 改为接受，远端明文 ws 仍拒绝，其余负例保留。
- 经典规则、房间事务、模型、依赖版本、打包和正式规划不变；未部署或发布。

**比较基线：**产品起点为 `d0c96408a3aa8c14174099da4247bcac953fb9f7`，规划为 `3cf98c40c9ec3c607b702a12875ce4ec830da27d`。目标 `integration/r03-live` 尚基于较早产品起点；本 PR 相对目标还包含 d0 中已有的集成修复。审查 T06 新增部分请以 d0 为比较起点。

## 请 ChatGPT Pro（本次架构负责人）专门确认

本次架构由你负责。这里有一处原测试与新架构的冲突，请针对以下判断明确回复：

1. **A04 是否应取代旧的“拒绝全部 wss”限制？** 原 `game/desktop/tests-online/test-network.cjs:18–20` 要求 `endpoint('wss://example.com/rooms-v1')` 抛错；A04 则要求 wss 可使用 DNS/IP、默认端口 443。我们据此把该地址移入接受集合，并在拒绝集合中使用 `ws://example.com:8765/rooms-v1`，保留其他凭据、缺端口、query、fragment 负例。是否符合你的架构意图？
2. **是否认可这一文件范围补充及验证方式？** 原任务可修改清单漏列 `test-network.cjs`。Teddy 已在本地执行对话中明确允许此次单文件调整，并授权推送、创建本 PR。产品实现未因测试调整而修改；桌面 59 项已全通过。原失败记录保留，坏 CA、错 SAN、过期证书的真实 Python/Node/Electron 握手均失败，服务端收到的身份请求均为 0。你是否认为此处理足以收口该冲突？若还需检查，请指出具体场景或约束。

**以上是待确认问题，不代表 ChatGPT Pro 已审查或批准。** 本 PR 不包含合入或部署请求。

## 怎样验证

- 完整桌面 `npm --prefix game/desktop test`：类型检查、构建及 **59 tests 全部通过**；基础 `python scripts/check.py` exit 0（59 tests，保留原 #1 的 1 项 expected failure）。准确修订 SHA 与日志见 [authorized 证据](https://github.com/Kalopsiazza/DeiDei/tree/codex/r03-t06-a-secure-preparation/docs/results/R03-T06-a/authorized)。
- 固定 TLS 产品/工具提交 `08a98748a0461274abe4411a3dcd88defd7de683`：服务 70、核心 174、runtime 23、经典 192 样本通过；房间样本 159 PASS / 1 NOT_RUN（原 N35），exit 0。
- 同一固定 TLS 提交的 Python、Node、普通 macOS Electron 联测通过：两玩家一观众连续两场、10→5 秒下一拍生效、请求重放、断线恢复、重启提示、持续停服后离线单人；坏证书未触发身份请求。自有服务/进程退出，临时 CA/私钥和档案删除。
- 旧断言修订后，Git 比较确认产品与 TLS 工具字节未变，因此保留上述准确 SHA 的窗口证据；本次只重跑桌面与基础检查，不虚报新提交重新跑过 TLS 窗口。
- 初次 58 PASS / 1 FAIL 的桌面输出原样保留，与授权修订后的 59 PASS 分开记录。
- [完整报告](https://github.com/Kalopsiazza/DeiDei/blob/codex/r03-t06-a-secure-preparation/docs/results/R03-T06-a/REPORT.md) · [窗口截图](https://github.com/Kalopsiazza/DeiDei/tree/codex/r03-t06-a-secure-preparation/docs/results/R03-T06-a/screenshots)

## 对现有内容的影响与已知限制

- 游戏规则、招式编号、状态编码、模型和依赖版本：无变化。
- 新增可选 TLS 启动参数、固定只读配置支持；正式地址/证书/主机仍在 [部署待输入清单](https://github.com/Kalopsiazza/DeiDei/blob/codex/r03-t06-a-secure-preparation/docs/deployment/r03-secure/PENDING-DEPLOYMENT.md)。
- 非回环仅做配置函数检查；未公网监听、部署、发包或修改系统信任。Windows、新成包配置窗口、公网/跨电脑尚未验证。
- ChatGPT Pro 架构确认待回复。已聚焦自审；Kimi 暂停，未调用。

## 提交者确认

- [x] 已核对修改范围，包括用户明确授权的旧测试文件。
- [x] 保留初次失败与未测项，未删测试、添加跳过或关闭证书验证。
- [x] 未提交私钥、凭据或真实玩家档案。
