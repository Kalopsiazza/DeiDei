# R04 真实房间与 TLS

技术来源：已逐项审读候选 `4df3287e793223f776208f72dbd07c8a32062e33` 相对产品 `d0c96408` 的 15 个 game 文件。保留 `service-config`、地址校验、传输 TLS 与对应负例；对新版 main/model 只接入所需行，保留媒体白名单、教程、热更新、固定 IPC 和沙箱。没有整棵替换旧 UI。

源码通过 `DEIDEI_ROOM_URL` 选择合法回环 ws 或 WSS。成包只读取固定 `resources/service-config.json`（最多 4096 字节、严格 UTF-8、拒绝重复键）：

```json
{"schema_version":1,"room_url":"wss://rooms.example.com/rooms-v1"}
```

`room_url:null` 明确停用联机。错误文件不回退；文件不存在只接受环境中的显式 IP 回环诊断。renderer 没有 URL 输入、证书或恢复凭据接口。

服务默认明文回环；可用 `--tls-cert-file` 与 `--tls-key-file` 成对启用 TLS 1.2 以上。非回环监听必须同时显式传 `--allow-remote` 与 TLS；本轮只在回环运行，未部署公网。

定向命令（使用现有含 websockets 的 Python 环境）：

```sh
node --test game/desktop/tests-online/test-service-config.cjs game/desktop/tests-online/test-network.cjs game/integration/test-gui-actions.cjs
PYTHONPATH=game/core:game/server:. python game/integration/secure/run.py --output .local-outputs/tls --electron
DEIDEI_PYTHON=/path/to/isolated/python DEIDEI_INTEGRATION_OUTPUT=.local-outputs/real-rooms node game/integration/gui.cjs
```

真实 GUI 工具沿用普通 main/preload/NetworkRoomPort/Python CLI、错误注入代理与原隐私/坏包断言，已更新欢迎、radio 加入角色、共享擂台、终场及退出定位。零匹配 selector 会失败并打印目标。序列按服务真实 reveal deadline 前进，不再假设 1500ms。旧 Room 样本保留；新采集拒绝 dirty service/core 输入并新增三人 `restart_survivors`，来源仍标注合成时钟/会话，不冒充 socket。

最终证据及未测项见本目录 RESULT.md；跨设备真人需要受控服务、有效证书与两台设备，未由本机 TLS 推导通过。Kimi 未调用。


## PR #34 复核补充（2026-10-03）

R34-03只修检查清理判据：secure/clients.cjs的app.close异常、等待失败、强制终止、非零正常退出都会使最终FAIL；记录原异常／exit_code／signal，并把清理错误与首个测试失败分列。正常exit0才可PASS。实际源码VM含wait_error边界及首错保留通过；GUI工具也复用F有界close，自有子进程清理失败不能掩盖其他资源回收。

源码产品3006f0a42bece4d702c5a7ba48af9d0d0fafbfc8；本轮没有重跑TLS全套，原生WSS验证、坏CA/SAN/过期断言和敏感字段边界未改。跨设备／正式信任仍未验，原28组证据继续绑定原输入。[R34报告与证据](../R04-T02/R34-REPAIRS.md)。未调用Kimi。
