# R03-T03-a：独立房间验收

本目录交付 96 个展开样本，覆盖 N01—N36。`cases.json` 是驱动唯一读取的预期；
`author_cases.py` 是人工编写的展开底稿，不导入房间服务，不运行规则引擎生成答案。
**样本/工具验证通过不代表房间服务通过。此次 server_status=NOT_RUN。**

## 本次验证

从本工作树根目录，用 Python 3.11+：

```sh
python3 tests/rooms_v1/validate.py
python3 -m unittest tests.rooms_v1.test_harness -v
python3 scripts/check.py
```

以上只需标准库与固定基线中的独立规则校验器。15 个自测方法包含坏样本、漏 ack、
旧 turn、重复奖励、权限、泄露、消息串房、完整响应解析、缓存模块路径错配、
A08 调用编排和 N21/N34 固定核心预期映射。内存传输替身只回放两条手写交换，
不提供房间状态机，也不计为真实 socket 或服务器通过。

## 后续固定版本服务联测

本 a 包不读取其他浮动服务分支。拿到另一个获准联测包后，用候选服务已经固定的
`websockets==17.0.1` 环境启动；本次未安装该依赖，也未改任何 requirements/lock。

```sh
/path/to/candidate-venv/bin/python tests/rooms_v1/run_acceptance.py \
  --server-path /path/to/candidate/game/server \
  --core-path /path/to/candidate/game/core \
  --tested-code-sha FULL_CANDIDATE_GIT_SHA \
  --output /tmp/r03-room-acceptance.json
```

可重复添加 `--case N12` 或 `--case N12/at`。选择 N10 的任一子例会自动包括秘密牌
对照的两例，不能只执行一侧就声称非泄露。驱动核对显式模块位置、整个包的导入
来源、两目录干净状态和固定 SHA，并记录各自源码 SHA256；不会寻找旧模块兜底。

服务入口必须是 ARC A08 的 `deidei_server.testing.create_test_server`；实际连接
`ws://127.0.0.1:<动态端口>/rooms-v1`，使用子协议 `deidei.rooms.v1`。
测试初始化由导入工厂注入，不向产品发送测试后门；N32 中的 set_state/debug/seed
是预期必须拒绝的恶意输入。大部分样本注入 ManualClock；N36 另有不注入时钟的
真实 5 秒超时用例。30ms 的 transport settle 仅等待回环 I/O，不改变测试时钟。

| 退出码 | 含义 |
| --- | --- |
| 0 | 样本校验/工具自测成功，或所选真实 socket 检查成功；报告区分二者 |
| 1 | 坏样本、导入/版本/执行错误、ack/snapshot/预期不符 |
| 2 | 缺显式服务或核心，或缺固定且干净的受测 SHA；真实服务 NOT_RUN |
| 3 | 只有 GUI 等不可执行项；不算通过 |

GUI 用例始终单列 NOT_RUN，不阻止其他协议用例；全部未运行时绝不退出 0。
服务错误记录步骤号和异常类型，不将原始错误、密码、token 或未揭晓消息写入报告。

## 样本表达

- 每例写明 P/W/A 条款、六项完整 policy、合成人员、初始化状态、身份变更消息、
  相对时间推进、ack、关键公开/私有快照预期和禁止泄露内容。
- `$room.room_id`、`$match.turn_id`、`$h.player_id` 等为服务生成身份的绑定；
  `command_seq="@next"` 展开为该 session 严格递增十进制字符串。`replay` 保留原
  request_id、command_seq 和 payload。`fresh` 单独测试新请求包装的旧 turn。
- 每条快照都做完整字段、类型、身份、容量、私有资格、核心公共格式和 seq 检查。
  `view.expect` 进一步逐路径核对关键业务值；字典是局部预期，列表长度与顺序完整。
  生成的玩家 ID 归一为样本别名，集合名单排序后比较；不会把资源转换为浮点数。
- N10 比较观察者完整 JSON，只归一实例/玩家 ID、房号、server_time 和绝对 deadline。
  remaining_ms、seq、self、公开资源和所有其他内容都必须一致；覆盖 sync、resume、
  失败回复之后的快照。错误字段只允许命令字段名，不能携带调试文本。
- N21 复用固定基线 C026/C050/C043 的独立预期，N34 展开 C065 七拍和 C074，
  检查完整核心账目、作用、淘汰、奖励与推进；不改旧规则样本或会话占位状态。

## 已知边界

1. N31 的有限慢读用例验证其他房仍能收到响应、无串房；它尚不证明 32 条/2MiB
   队列阈值。A08 没有队列观察接口，普通快照又允许合并，不能以发送 80 条命令
   冒称触发了上限。该阈值需后续服务自测证据或明确的有限测试接口。
2. 本批不跑 1024 连接耗尽、IP 限流负载、公网扫描或压力测试。N33 覆盖 45 条有限
   burst 与 64 房容量边界，仍全部未执行。
3. W07 未逐一固定权限失败的错误码映射和坏 JSON 无 request_id 时的回包关联。
   详见结果 REPORT 的最小例子；不改规划正文，不将实现输出抄回预期。
4. N35 实际 Electron、跨机器真人、Windows 和新运行包留后续；本任务不改变这些状态。

覆盖与逐项状态见 `docs/results/R03-T03-a/CASE-MAP.md` 和 `TEST-MATRIX.md`。
