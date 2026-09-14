# R03-T03-b：独立房间验收 1.1

160 个展开样本覆盖 N01—N49，保留 a 的全部 96 个 case_id，增加 64 个子例。
`cases.json` 是驱动读取的独立预期；`author_cases.py` 只展开人工条款与旧独立核心预期，
不运行产品生成答案。新协议为 rooms-1.1，路径和子协议保持原值。

```sh
python3 tests/rooms_v1/validate.py
python3 -m unittest tests.rooms_v1.test_harness -v
python3 scripts/check.py
```

19 个自测方法验证坏样本、请求 UUID/重放、消息关联、秘密差分、真实核心账目映射、
严格 1.1 字段、Unicode 和恢复倒计时。内存传输仅检查驱动，不计为产品通过。

使用候选既定 websockets==17.0.1 hashlock 的独立环境；显式指定干净的完整受测 SHA：

```sh
/path/to/venv/bin/python tests/rooms_v1/run_acceptance.py \
  --server-path /path/to/service/game/server \
  --core-path /path/to/service/game/core \
  --tested-code-sha SERVICE_FULL_SHA \
  --desktop-path /path/to/desktop/game/desktop \
  --desktop-sha DESKTOP_FULL_SHA \
  --output /tmp/room-acceptance.json
```

可追加 `--case N38` 或 `--case N38/10000_to_5000`；N10 自动包含两侧秘密差分。
A08 工厂只收四项服务配置，固定展示值仍在完整 policy 中验证。请求 ID 使用稳定 UUID，
同一标签的重放保持原 ID/序号/载荷。房主离开两种配置均覆盖，after_turn 仍是规划提案。

多数样本使用 ManualClock 和固定随机种子，N36/N48 的 real_clock 子例不注入时钟。
`resolution_count` 用 Python profiler 观察实际公开核心函数调用，不修改产品函数；
第四次房主缺席必须在核心调用前关房。每条 snapshot 检查完整字段和公开账目；
同 seq 仅允许 remaining_ms 倒数变化，deadline 与其他字段仍严格一致。

N44/N48/N49 将服务实际快照送入候选 `online/wire.cjs` 的 `readMessage`。
N46 另将实际消息输入真实 NetworkRoomPort，脚本传输制造晚到旧事件/ack/snapshot；
这属于真实客户端模块检查，不是 Electron 窗口验收。

`crosscheck.py` 提供独立的 11 场景 socket → readMessage 桥接：

```sh
/path/to/venv/bin/python tests/rooms_v1/crosscheck.py \
  --server-path /path/to/service/game/server --core-path /path/to/service/game/core \
  --desktop-path /path/to/desktop/game/desktop \
  --server-sha SERVICE_FULL_SHA --desktop-sha DESKTOP_FULL_SHA \
  --tests-sha ORIGINAL_A_INPUT_SHA --output /tmp/crosscheck.json
```

`--tests-sha` 记录原 a 输入；driver 单独记录实际测试源码 SHA/内容哈希，不能冒称使用未改 a 驱动。
日志保留公开结果、错误、时限与调用模式，凭证和未揭晓选择不落盘。

退出码：0=已执行检查通过；1=执行或断言失败；2=缺显式/固定/干净候选；3=无可运行项。
缺桌面候选的交叉项和 N35 Electron 必须 NOT_RUN。部分可执行项通过不代表所有项通过。

N31 的有限慢读只证明其他房仍有响应，不证明 32 条/2MiB 阈值；该阈值仍 NOT_PROVEN。
N33 限流逐条等待回复以避免混入出站队列耗尽，最多发送 45 条，遇断言失败即停。
不运行公网、1024 连接负载、Windows 或安装包验收。

本次实际结果、全部来源映射与保留的 a 原日志见 `docs/results/R03-T03-b/`。
