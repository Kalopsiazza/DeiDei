# 自愿参与的安装实例统计

独立 aiohttp 3.14.3 / Python 3.11 服务。默认回环、端口 0；桌面不会启动它。好友房 WS 与统计事务分开。服务与代理持久日志均不保留请求 body、Authorization 或 IP；网络仍会使用 IP。

```sh
uv venv --python 3.11 game/telemetry/.venv
uv pip sync --python game/telemetry/.venv/bin/python --require-hashes game/telemetry/requirements.lock
# 管理 token 文件由秘密管理提供，目录 700、文件 600；不要提交真实 token。
PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m deidei_stats --database /private/path/stats.sqlite3 --admin-token-file /private/path/admin.token
PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m deidei_stats.admin --origin https://stats.example.invalid --token-file /private/path/admin.token
PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m deidei_stats.admin --origin https://stats.example.invalid --token-file /private/path/admin.token --csv --output /private/path/summary.csv
PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m unittest discover -s game/telemetry/tests -v
node --test game/desktop/test-privacy.cjs
```

本机 CLI 夹具加 `--fixture --origin http://127.0.0.1:<实际端口>`。管理 token 不放 URL、客户端包或命令参数。TLS 代理与 systemd 模板在 `deploy/`，正式域名、证书、管理凭据由维护者末端配置。本任务没有公网部署/正式 TLS 验收。

固定路由：`GET /healthz`、`POST /stats/v1/enrollments`、`PUT /stats/v1/consent`、`POST /stats/v1/reports`、`POST /stats/v1/erasure`、`GET /admin/v1/summary`、`GET /admin/v1/export.csv`。管理日期限定最近 90 天，group 仅 day/app_version。API 请求 schema 在 `deidei_stats/schema.py`；额外字段、重复 JSON 键、未知维度、错误 preset、日期、计数和未同意 scope 均拒绝。

报告只有 preferences/performance 两组，按 installation+epoch+scope+UTC day+app_version 累计。报告 revision 相同且内容相同才幂等；更旧、相同 revision 异内容、同 epoch 累计回退均拒绝。更高 revision 替换日累计；新 epoch 保留旧贡献，因此同日清统计不会覆盖此前报告。管理“当前选择”按每个安装的最近有效快照计算，日使用量与推荐采用/展示按累计相加。它表示已上传的选择/使用比例，不代表所有玩家或满意度。

仅保留随机安装能力的 SHA256 摘要，能力不是 profile/硬件标识。单 writer 队列 64、并发 64、SQLite busy_timeout 1500ms，失败不回成功。安装上限 100000、每安装报告上限 256；单请求 32KiB。贡献 90 天，最小删除摘要 180 天，在同一事务中删除贡献和撤销能力；每次事务执行 TTL。旧能力不能自动重新注册。没有提供备份机制，避免恢复删除前的贡献；若运营方自行备份，保留最多 7 天且恢复前必须重放所有删除记录。主动导出的离线 CSV 无法由游戏开关收回。

实际本机证据在 ignored `.local-outputs/R05-T01-a/privacy-stats/`：`python-tests-6.log`（7 项）与 `node-tests-8.log`（隐私 10 项 + 推荐 3 项）。真实 HTTP/SQLite/admin/CSV、服务重启、DB 写锁失败、有限队列 429、90/180 天 TTL、客户端 ACK/停止/删除竞态通过。Node `node-tests-3.log` 的历史失败为快进夹具触发真实定时器；夹具固定 UTC 起点并暂停后台发送后通过，未删除失败日志。公网 TLS、运营日志策略、备份恢复和真人跨设备未运行。Kimi 未调用。

普通产品 main 与真实回环收集器的 GUI 证据见 `.local-outputs/R05-T01-a/telemetry-gui-4/`（30 项），入口 `game/integration/smoke-telemetry-major.cjs`。真实 native safeStorage、正式随机对手 solo、设置变化、可见推荐与保存采用、2+8 秒有效短测、一次自然 batch、admin 聚合与 CSV、停止/实际删除 ACK、同 userdata 冷启动均核对。测试通过固定 lifecycle 上下文暂缓首次空闲发送，最终普通菜单放行；未改时钟/限频/网络实现，不将夹具暂停当作正常用户行为。详细成功/失败/未运行状态见 `game/desktop/privacy/README.md`。

安装人口口径：summary.installations 为所选日期内任意 scope 的 DISTINCT 已上传贡献安装数；preferences_installations 为存在有效偏好快照的安装数，专用于当前选择分母。仅上传性能时为 1/0，两 scope 同一安装不会计两次。CSV 保留现有三段，末尾追加 population_totals/installations/preferences_installations；CLI 明示两个口径。真实 HTTP 的 performance-only 与双 scope 去重、CSV 无 IDs、CLI 两字段及 CSV 字节等值回归通过，见 python-tests-6.log。旧 performance-only-audit.log 的 0 安装口径已修复。
