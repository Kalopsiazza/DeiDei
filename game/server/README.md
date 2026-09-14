# R03 好友房服务（R03-T01-a）

Python 3.11+，经典规则 `classic-1.0.1`，默认仅监听 `127.0.0.1:8765`。
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
`--host` 仅接受 `127.0.0.1` 或 `::1`；`--port 0` 选择动态端口。
`--policy <JSON路径>` 仅接受 `turn_ms / early_reveal / spectator_cap / host_disconnect_grace_ms`
四项覆盖，其余继承默认。仅在有用户明确答复时把生效配置放进结果目录并使用该参数。
当前选择状态见 `docs/results/R03-T01-a/DECISIONS.md`；没有回复不代表确认。

每连接先读 `hello`，再 `session.open`；保存其返回的临时身份后才能创建或加入房间。
重连使用原 `session_id/resume_token`，随后按 `last_command_seq` 发新意图；丢失确认则重试原请求。
房间/出牌命令字段遵循附件 NET-R03 1.0。服务只接受入口名称，不接受玩家状态、余额或随机种子。
服务日志只记录事件与错误代码，不开启 WebSocket 帧/请求日志。

## 自测与独立测试入口

```sh
PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m unittest discover -s game/server/tests -v
PYTHONPATH=game/core game/server/.venv/bin/python -m unittest discover -s game/core/tests -v
game/server/.venv/bin/python tests/rules_v1_001/run_acceptance.py --core game/core
game/server/.venv/bin/python scripts/check.py
```

`deidei_server.testing.create_test_server(policy=None, *, clock=None, new_match_factory=None,
timeout_chooser=None, rng=None)` 返回异步上下文管理器。进入后有 `url`，并支持异步
`advance_ms(ms)`、`drain()`、`close()`。底层是同一真实 loopback 服务。
`clock` 约定同步 `now_ms()/wall_ms()/advance_ms(ms)`；无注入时使用真实时钟，不能 advance。
`new_match_factory(ids, match_id)` 默认核心 `new_match`，替换值仍经核心公开 API 验证。
`timeout_chooser(start_state, legal_options)` 只收到开始状态及合法选项，返回入口字符串。
`rng` 支持标准库 `Random`，分出独立代理和分支流；默认两者均为 `SystemRandom`。
这些注入仅供 Python 导入，CLI 和网络协议没有状态/随机/执行后门。

## 实现边界

房间操作和计时在单一 asyncio 事件循环中同步串行提交；密码 scrypt 在最多两条工作线程运行，
返回后重查世代、成员、容量和截止。网络写入由各连接有界队列处理，不在房间事务内等待。
服务上限 64 个活动房、1024 连接；另限制无房临时会话 4096 个以控制短连接资源占用。
房间关闭保留 60 秒说明，空会话 10 分钟回收，大厅/result 空闲两小时关闭。

自测包含真实 socket；慢消费者使用真实 socket 加阻塞 writer 注入，可复现队列上限和隔离，
不宣称实体网络故障或吞吐压测。独立 T03、桌面集成、跨电脑、Windows 和真人验收尚未运行。
完整命令、退出码、版本、覆盖和限制见本任务结果目录。
