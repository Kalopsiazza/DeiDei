# R03-T01-a 交付报告

**本地实现完成，固定提交自测通过；交付状态 PARTIAL。** 参数答复仍为 PROVISIONAL，未推送分支或创建 PR。
这两项不冒充已完成；不涉及公网、桌面集成或真人验收。

## 输入与变更

- 产品起点：`23520350393ba43384c20b60bef7d6dbd89fc142`。
- 受测代码：`417ae52f50fb806d1205381a4a148bc96117c7d6`。
- 本地分支：`codex/r03-t01-a-room-service`；结果目标 `integration/r03`。
- 完整规划只读自附件，18 个文件逐项校验通过；`plan_sha=null`。
- PLAN-MANIFEST SHA256：`4442d966b87b477c111f9b99ae9e3444ccfe94dd8338ab5a1910b4e3acd88684`。
- 简短远端入口 `context_plan_sha=51432688cf1bbdb1765e59af3540342599a71bc4`，不当作完整规划提交。

只增加 `game/server/**` 和 `docs/results/R03-T01-a/**`；核心、runtime、desktop、旧测试、packaging、CI 和规划均未修改。

`protocol.py` 严格验证请求与配置；`room.py` 调用既有核心并维护阶段、缺席/离开和个人公共视图；
`server.py` 负责临时身份、密码、缓存、世代、串行处理与有界 WebSocket 传输；
`testing.py` 提供附件 A08 的 import-only 真 socket 测试入口；`__main__.py` 仅有 loopback 启动参数。

## 验证

运行 `python docs/results/R03-T01-a/validate.py`，实际解释器为专用 venv 的 Python 3.13.7，macOS arm64。
完整命令参数、退出码、时间、环境和逐文件 SHA256 在 `MANIFEST.json`，原始去敏输出在 `evidence/`。

| 检查 | 结果 |
| --- | --- |
| 服务自测 | 42 tests，全部通过；含真实 socket、六人+两观众连续三场及真实时钟截止 |
| 既有核心 | 174 tests，通过 |
| 既有独立核心 | 192 fixtures / 469 resolve calls，通过；独立 session 两项仍 NOT_RUN |
| 独立验收工具 | 8 tests，通过 |
| 根目录 scripts/check.py | 40 tests，39 通过 + 1 原有 expected failure |
| 专用环境 pip check | 通过 |
| 生产 CLI 参数入口 | --help 通过；测试注入不在参数列表 |
| 修改范围 | 获准路径外无差异 |

N01—N36 的具体自测与未测项见 `TEST-MATRIX.md`。原 expectedFailure 原样保留，无新增 skip 或降低既有断言。

## 自查修正

初轮联测发现无限防御 DTO 与有限防御字段不一致，已按核心真实格式修正。
同时补齐揭晓期自然淘汰者退出、终态过期返回 ROOM_GONE、密码指纹只存摘要、
未来核心私有字段显式剔除、代理与分支 RNG 隔离、重开后保留缺席的回归。
自 bi 只影响合格目标：修正自测输入为自 bi/反弹/吸收，保持唯一赢家断言，不改核心规则。
高频拒收和慢消费者分别测试，避免把慢队列断开误当速率限制响应。

## 依赖与安全

仅新增独立 `websockets==17.0.1`，精确 PyPI 哈希锁，专用环境安装，无桌面依赖变更。
查询 PyPI 精确版本元数据和 OSV：查询时未列出该版本已知漏洞；记录在 `dependency-security.json`，不保证不存在未知漏洞。
本机 Python urllib 缺少 CA 配置，改用正常验证 TLS 的系统 curl 查询，未关闭校验或修改系统防护。

密码为随机 salt + scrypt，resume token 仅保存 SHA256 摘要；幂等指纹也只存摘要。
连接写入不持有房间执行权，迟到命令先处理到期阶段，再检查当前世代/成员/回合。
所有快照逐接收者生成；日志无密码、凭证、未揭晓动作或任意对象 dump。

## 尚未完成/不在本包

- 尚无房间参数答复：`DECISIONS.md` / `decisions.json` 保持 PROVISIONAL，未生成 confirmed-policy.json。
- 未推送、未创建 PR；附件中的命令未当作用户额外 Git 授权。`PR-BODY.md` 已备好可审阅说明。
- 任务 03 独立房间验收 NOT_RUN；未读取其浮动分支，也未替其宣布通过。
- Electron 集成、Windows、跨电脑、真实弱网、六真人、安装包、TLS/公网部署全部 NOT_RUN。
- 慢消费者为真 socket + 阻塞 writer 注入；容量为注册表边界注入，未声称吞吐压力测试。
- R02 的 Windows 真人/干净机/系统信任剩余项保持原状态。

Codex 已自查。**未调用 Kimi（按技能暂停要求）。** a 包到此停止，不发 b、不合入、不发布。
