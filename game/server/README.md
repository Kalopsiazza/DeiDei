# R03 好友房服务（R03-T01-b）

Python 3.11+，协议 `rooms-1.2`、规则 `configured-1.0.0`（基础 `classic-1.0.1`），默认仅监听 `127.0.0.1:8765`。
服务直接调用 `game/core` 的公开 API，独立于桌面、旧模型和离线 runtime。
不提供公网部署、数据库、账号或安装包。

从仓库根目录建立专用环境（不要使用已有桌面打包环境）：

```sh
python3 -m venv game/server/.venv
game/server/.venv/bin/python -m pip install --require-hashes -r game/server/requirements.lock
PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m deidei_server
```

PowerShell：

```powershell
py -3.11 -m venv game/server/.venv
game/server/.venv/Scripts/python -m pip install --require-hashes -r game/server/requirements.lock
$env:PYTHONPATH = "game/core;game/server"
game/server/.venv/Scripts/python -m deidei_server
```

端点 `ws://127.0.0.1:8765/rooms-v1`，子协议 `deidei.rooms.v1`，客户端不得发送网页 Origin。
`--host` 接受 IP 字面量，默认回环；非回环必须同时启用 TLS 与 `--allow-remote`。`--port 0` 选择动态端口。
`--policy <JSON路径>` 仅接受 `turn_ms / early_reveal / spectator_cap / host_disconnect_grace_ms`
四项覆盖，其余继承默认。仅在有用户明确答复时把生效配置放进结果目录并使用该参数。
`--host-leave-timing after_turn|immediate` 是独立本地开关，不能放进 public policy。
after_turn 与 early_reveal=true 已由用户确认；10 秒和局中改时限保持既有设定。
服务端默认让共同揭晓阶段保留 5 秒，客户端不显示额外的结算倒计时。
确认记录见 `docs/results/R03-T01-b/DECISIONS.md`，生效配置为同目录 `policy-effective.json`。

每连接先读 `hello`，再 `session.open`；保存其返回的临时身份后才能创建或加入房间。
重连使用原 `session_id/resume_token`，随后按 `last_command_seq` 发新意图；丢失确认则重试原请求。
出牌命令仍只接受入口名称，不接受玩家状态、余额或随机种子。规则命令新增有界声明式 request/manifest，字段见下方 1.2；原 NET-R03 1.1 文档用于未改变的传输、期限和重连行为。
服务日志只记录事件与错误代码，不开启 WebSocket 帧/请求日志。

## 1.2 规则与准备

hello 的 protocol 为 `rooms-1.2`、rules_version 为 `configured-1.0.0`；capabilities 另声明 rules_schema=1、core_state_schema=2、rules_pack_api=`deidei.rules-pack.v1`、max_pack_bytes=8192。外层 `v:1`、端点和子协议不变；旧客户端须明确拒绝新 hello，不维护双套服务。

| 命令 | 新增的精确字段 |
| --- | --- |
| `room.create` | `rules_request`、`rule_pack_manifests=[]或[完整manifest]`。 |
| `room.set_rules` | `room_id/rules_request/rule_pack_manifests/expected_rules_revision/expected_rules_hash`。 |
| `room.ready` | 在原 room_id/ready 外带 expected_rules_revision/expected_rules_hash，包括取消准备。 |
| `room.start` | 在原 room_id 外带 expected_rules_revision/expected_rules_hash。 |

服务独立编译并核验快照/包身份；unknown 能力、篡改内容和不完整引用拒绝。只有已连接房主在 lobby 可改规则；先验证后替换。同 hash 是无操作；真实改变才增加 rules_revision 并清 ready/ready_rules_hash。迟到旧 ready/start 返回 RULES_STALE；开场再确认所有参赛者准备的 hash，不能只靠清准备通过。room.set_rules ACK 是 room_id/rules_revision/rules_hash；ready ACK 增加 nullable ready_rules_hash。客户端只用新 snapshot 更新显示，旧 ACK 不能覆盖新规则。

view 包含 rules_snapshot/rules_revision/完整 rule_pack_manifests，成员包含 ready_rules_hash。开始后规则固定整场；回大厅保留规则、清准备。普通续拍、核心存活者重开、弃权重建以及公开 effective_state 回写都保留快照/hash。贷款每个新 game 只发一次开局 DD；读取/重试/重连不发放。mode_at_start 的 duel/multiplayer 与玩法 preset 分开，时限 policy_revision 也不进入 rules_hash。

公开 v2 账目 whitelist 增加 base_move/upgrade，保留原入口、实际招式、来源与支出；不发未来 token、seed、暗牌或模型分布。私有 Room.replay_inputs 记录冻结规则、match/game/turn、实际提交/消费 token 与弃权，不出现在 snapshot。每拍选择前在三条独立流中分别固定代选、分支和幸运；实际消费集合由 core `required_tokens` 决定。

## 延续的时间与连接行为

默认每拍 10 秒，可选 5/8/10/12/20/30 秒。
房主用 `room.set_turn_limit` 携带 `room_id / turn_ms / expected_policy_revision` 修改下一选择阶段时限；
版本从字符串 `"1"` 起，真实变更才递增。同值新请求仅 ACK，原请求重试返回原 ACK 和当前视图。
当拍截止、选牌、随机令牌与准备状态保持原值，截止时刻先处理计时再处理命令。

房主掉线不暂停全场。参战房主前三次缺席代攒 Charge，第四次截止在调用核心前关闭；
强制休整不改成 Charge，在线休整不增加或清零缺席。重连不清零，成功手动提交才清零。
淘汰者保留参战席位和房主身份；大厅、结果或淘汰后的离线房主使用独立恢复期限，其他人继续游戏。
`after_turn` 主动退出立即撤销房主会话资格，当前选择阶段结算一次后关房；揭晓阶段等揭晓结束。
`immediate` 直接关闭。两种模式均不因关房宣判新的赢家。

普通玩家第三次缺席结算后移除；大厅、结果、淘汰者及独立观众离线 30 秒后释放资格。
服务定向发送 `membership.ended`，离线时保留最近回执，重连 ACK 后重送。成功进入新房清除旧回执；
客户端仍须按 room_id/player_id 过滤已在网络中发送的旧消息。自然淘汰、主动离开及整房关闭不发此回执。

## 自测与独立测试入口

```sh
PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m unittest discover -s game/server/tests -v
PYTHONPATH=game/core game/server/.venv/bin/python -m unittest discover -s game/core/tests -v
game/server/.venv/bin/python tests/rules_v1_001/run_acceptance.py --core game/core
game/server/.venv/bin/python scripts/check.py
```

`deidei_server.testing.create_test_server(policy=None, *, clock=None, new_match_factory=None,
timeout_chooser=None, rng=None, host_leave_timing='after_turn')` 返回异步上下文管理器。进入后有 `url`，并支持异步
`advance_ms(ms)`、`drain()`、`close()`。底层是同一真实 loopback 服务。
`clock` 约定同步 `now_ms()/wall_ms()/advance_ms(ms)`；无注入时使用真实时钟，不能 advance。
`new_match_factory(ids, match_id, rules_snapshot)` 默认核心 `new_match`，替换值必须保留 v2 快照/hash，仍经核心公开 API 验证。
`timeout_chooser(start_state, legal_options)` 只收到开始状态及合法选项，返回入口字符串。
`rng` 支持标准库 `Random`，分出独立代理、分支和幸运流；默认三者均为 `SystemRandom`。
这些注入仅供 Python 导入，CLI 和网络协议没有状态/随机/执行后门。

## 实现边界

房间操作和计时在单一 asyncio 事件循环中同步串行提交；密码 scrypt 在最多两条工作线程运行，
返回后重查世代、成员、容量和截止。网络写入由各连接有界队列处理，不在房间事务内等待。
服务上限 64 个活动房、1024 连接；另限制无房临时会话 4096 个以控制短连接资源占用。
房间关闭保留 60 秒说明，空会话 10 分钟回收，大厅/result 空闲两小时关闭。

自测包含真实 socket；慢消费者使用真实 socket 加阻塞 writer 注入，可复现队列上限和隔离，
不宣称实体网络故障或吞吐压测。独立 T03、桌面集成、跨电脑、Windows 和真人验收尚未运行。
完整命令、退出码、版本、覆盖和限制见本任务结果目录。

`tests/test_rules_12.py` 使用真实 loopback socket 验证规则权限/原子替换、旧 ready/start 两种到达次序、旧 ACK、两条贷款重开、重连/回大厅、包资源与 100% 幸运、观察者保密及多房配置隔离。既有 1.1 行为测试只更新协议/配置输入，不降低结果、期限或保密断言；这层不代表普通 Electron、公网或真人跨设备完成。

## 可选 TLS（R03-T06-a）

`--tls-cert-file` 与 `--tls-key-file` 必须成对提供，启动前加载并检查匹配，最低 TLS 1.2。
默认无新参数时仍保持原明文回环。非回环参数只完成无网络校验，未部署或实际对外监听。
只读桌面配置、前台启动与临时 CA 联测命令见 [当前 TLS 接入与验证](../../docs/results/R04-T02-e/TLS.md)。
