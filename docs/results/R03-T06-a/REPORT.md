# R03-T06-a｜安全远端连接准备与本地 TLS 联测

## 结论

TLS、只读服务地址配置和本机 L1—L4 联测已实现。真实 Python、Node NetworkRoomPort、普通 macOS Electron 均通过证书验证与对局检查。
**本地实现与回归已完成。用户已明确允许调整清单外的旧 wss 断言；调整后桌面 59 项全部通过。原始失败证据保留，ChatGPT Pro 的架构确认仍待回复。**

用户已直接授权推送本任务分支并创建 PR，要求在 PR 中专门向架构负责人 ChatGPT Pro 询问本次测试调整。没有合入、部署或发包授权。本报告记录提交前验收；远端交付状态以 PR 和分支回读为准。

## 固定输入和修改范围

- 产品输入：`d0c96408a3aa8c14174099da4247bcac953fb9f7`。
- 规划输入：`3cf98c40c9ec3c607b702a12875ce4ec830da27d`，ZIP 清单全部哈希及规划文件 Git blob 已核对一致。
- 本地分支：`codex/r03-t06-a-secure-preparation`；worktree 为 `DeiDei-r03-t06-a`。
- `tested_code_sha` / `tool_sha`：`08a98748a0461274abe4411a3dcd88defd7de683`。产品与新增测试工具同一提交。
- 旧断言修订及桌面/基础复测提交：`dd6099a1d493c8da60ce6c5d2aac04a1f558e7f4`；仅改变 `game/desktop/tests-online/test-network.cjs`，TLS 产品与工具字节相对上述 SHA 不变。证据见 `authorized/`。
- 结果材料在源码之后单独提交；本报告不把自身提交算作重新测试过的源码。
- 本次检查到的 upstream main：`889162fc90000919004f498b27cffbd5fa4cbe45`；按任务指定产品 d0 开工，没有改用 main 或规划中的旧产品。

关键文件：

- `game/server/deidei_server/transport_tls.py`、`server.py`、`__main__.py`：成对证书、无交互加密私钥拒绝、最低 TLS 1.2、5 秒 TLS 握手、显式远端许可。构造器与 testing 工厂保持兼容。
- `game/desktop/online/service-config.cjs`、`main.cjs`：固定路径、最多 4096 字节、严格 JSON/重复键校验、配置优先级和一次启动读取。错误延迟至联机入口。
- `wire.cjs`、`network-room-port.cjs`、`model.ts`：严格 ws/wss URL、真实原生证书验证、现有状态区的通用安全连接错误提示。
- `test_transport_tls.py`、`test-service-config.cjs`、`game/integration/secure/`：负例、临时证书、真实客户端及窗口检查。
- `docs/deployment/r03-secure/`：关闭联机的示例 JSON、只读部署准备说明与待提供资源清单。

`game/core`、`game/runtime`、`room.py`、`protocol.py`、独立 `tests/`、依赖锁、打包目录和正式规划与 d0 无差异；逐文件新增/修改哈希见 `INPUTS.json`。
经典 `classic-1.0.1`、`rooms-1.1` 和房间字段未改变。没有新增依赖、CI、布局或牌图。

## 环境、命令与结果

macOS arm64，Python 3.13.7（专用临时 venv），websockets 17.0.1，Node 24.12.0，OpenSSL 3.6.3。
桌面原固定依赖复制至新 worktree，未改变版本或锁；Electron 44.3.0 的实际内置 Node 为 24.20.0，Chromium 152.0.7977.78。
准确运行时字段见 `INPUTS.json`、`secure/L4.json`。OpenSSL 每条证书生成/检查命令退出码均为 0，只保存公开指纹，不保存证书/私钥。

命令使用专用 `<python>`，从仓库根目录运行；完整参数、PYTHONPATH、耗时及退出码在 `regression/commands.json`。

| 检查 | 初始 d0 | 固定源码结果 |
| --- | --- | --- |
| 服务 unittest | 66 通过，exit 0 | 70 通过（含新增 4 项 TLS 启动检查），exit 0 |
| 核心 unittest | 174 通过，exit 0 | 174 通过，exit 0 |
| runtime unittest | 23 通过，exit 0 | 23 通过，exit 0 |
| 独立经典样本 | 192 通过 | 192 通过、469 次判定，exit 0；旧会话两项 NOT_RUN 保持 |
| `scripts/check.py` | 本包最终执行 | 59 tests，保留原 #1 的 1 项 expected failure，exit 0 |
| `npm --prefix game/desktop test` | 53 通过，exit 0 | 初次 58 通过、1 失败；授权更新旧断言后 59 通过、0 失败，exit 0，类型/构建通过 |
| 独立 160 房间样本 | 引用规划已有 d0 159 PASS + N35 NOT_RUN | 159 PASS、1 NOT_RUN（N35）、0 FAIL，exit 0；见 `regression/rooms160.json` |
| 新安全联测 | 本包新增 | `secure/secure.json` PASS，Node 和 Electron 子进程均 exit 0 |

固定源码安全联测命令：

```sh
DEIDEI_OPENSSL=<installed-openssl> PYTHONPATH=.:game/core:game/server <python> \
  game/integration/secure/run.py --electron --output <evidence>/secure
```

L1 单项命令：`node --test game/desktop/tests-online/test-service-config.cjs`（6 tests，已包含于 desktop）；
`PYTHONPATH=.:game/core:game/server <python> -m unittest discover -s game/server/tests -p 'test_transport_tls*.py' -v`（4 tests，已包含于 server）。
不把这两次单项检查重复加到总体数量中。

## S01—S18 分层证据

| 编号 | 层次 | 实际结果/范围 |
| --- | --- | --- |
| S01 | 原回归、L3/L4 离线 | 回环服务/规则/离线通过；旧 URL 预期经授权调整后，默认桌面 59 项全部通过 |
| S02 | L2/L3/L4 | 有效 CA、wss、rooms-1.1 身份与真实完整对局通过；CLI 真实 TLS 启动并正常退出 |
| S03 | L1/CLI | 单证书、单 key、缺文件、错配、非证书、实际加密私钥均拒绝，无明文降级；CLI 拒绝时未打印 Listening |
| S04 | L1 | 非回环缺 TLS/许可拒绝，serve 调用未发生 |
| S05 | L1 | 非回环 + 许可 + TLS 纯参数检查通过；未实际非回环监听 |
| S06 | L1 | 远端明文、错协议/路径、凭据、query/fragment、编码变体、别名、控制字符拒绝；未创建 socket |
| S07 | L1 | DNS、IPv4/IPv6、默认 443、指定端口接受；只对自有回环目标实际连接 |
| S08 | L2/L3/L4 | 未知 CA、错 SAN、过期证书真实失败；各坏证书服务 `session.open=0`，无降级 |
| S09 | L2 | TLS 端口明文、错误 HTTP 路径、浏览器 Origin 拒绝；随后有效客户端完整对局成功 |
| S10 | L1 | 成包固定配置优先于环境；main 实际调用配置模块，renderer 无地址输入/文件读取接口 |
| S11 | L1 | null、坏 JSON、重复键、4096 字节边界、未知字段、读失败与坏 UTF-8 检查；错误不激活房间 |
| S12 | L1 | 成包缺文件仅接受严格回环诊断；源码只读开发环境变量 |
| S13 | L3/L4 | 各自两玩家一观众连续两场，共享真实核心 ledger、不同 match ID、观众无私密选牌与提交权限 |
| S14 | L2/L3/L4 | 10→5 秒保留当前 deadline、下拍采用 5 秒；同 UUID/序号请求重放另由 L2 验证只增加一次 policy_revision |
| S15 | L3/L4 | 实际关闭已提交玩家 socket，观察 reconnecting 后同身份恢复；Def 只产生一次 +2 充能；服务重启拒绝旧身份 |
| S16 | L3/L4 | 房主提交后离开，当拍结束后 HOST_LEFT，无伪造赢家；退出提示截图留档 |
| S17 | L3/L4 | 服务持续停止后，真实源码离线 worker 仍启动；L4 档案字节不变 |
| S18 | L2/L3/L4 | 全部自有服务 closed，连接/tasks 为 0；端口关闭；子进程退出；临时证书与档案目录删除 |

本包固定源码 L4 实际完成 **2 场**，不与前一次未固定源码的探索联测相加。
原 N35 占位仍是独立驱动 NOT_RUN；新 L4 结果独立记载，不把 159 改成 160。
截图来自 Playwright 驱动的普通 Electron main/preload/renderer，文件位于 `screenshots/`；已查看牌桌和证书失败提示图。
窗口退出对局提示由测试脚本自动应答，未改系统安全设置。没有真实玩家档案、密码或 token 进入证据。

## 初次失败、限制和待处理

1. **默认桌面套件真实失败**：`tests-online/test-network.cjs:18–20` 旧测试要求 `wss://example.com/rooms-v1` 抛错。
   新任务要求这一格式接受，故旧断言失败。初次输出保留在 `first-desktop-conflict.txt`；固定源码复测仍在 `regression/desktop.txt`。
   用户随后明确允许更新该文件：把合法 wss 移入接受集合，拒绝集合改用远端明文 ws，其他负例保留，测试名同步修正。未删整个测试、未添加 skip/expectedFailure。修订后完整桌面套件 59 PASS，证据在 `authorized/desktop.txt`。
2. 前期一次工具命令在错误 cwd 尝试写入新测试脚本，得到 `No such file or directory`，未产生文件；随后在正确根目录写入。不是产品运行失败。
3. 首次 TLS 探索联测通过，随后新增明确的重放和 reconnecting 观察后，在固定源码重新跑一次通过。总计两次真实窗口联测，没有无限重试或刷数量。
4. 未执行 Windows/Linux 窗口、公网/非回环监听、跨电脑、物理弱网、真实域名/正式 CA、新打包或新包配置窗口验收。
   成包配置优先级只在 L1 纯函数/真实临时文件层测试；本包 L4 是源码运行，不能称成包已验收。
5. 未重跑旧 900 秒 endurance 与 100 序列。规划已保留最终 d0 的独立证据，本次不改规则/房间事务；这里只引用，不计为本次运行。
6. 已做聚焦自审，Kimi 未调用；用户已授权推送和建 PR。PR 单列 ChatGPT Pro 架构确认问题，尚不声称已获得其审查或批准。未部署或发布。

## 授权修订、验证边界与架构确认

仅按用户授权修改旧端点测试的名称和两个输入集合，提交 `dd6099a1d493c8da60ce6c5d2aac04a1f558e7f4`。
随后 `npm --prefix game/desktop test` 为 59 PASS，`python scripts/check.py` exit 0（保留原 #1 expected failure）。
未再次重跑 TLS 窗口；Git 比较证明除此测试文件外，产品和安全联测工具均与已验证 `08a98748a0461274abe4411a3dcd88defd7de683` 相同。
历史 `regression/desktop.txt` 的 58 PASS / 1 FAIL 原样保留，新结果位于 `authorized/`，不覆盖旧失败。

PR 目标 `integration/r03-live`。该分支与本任务的共同祖先为 `8a6f8b29f517ab4c5a16466f0894e86995f8a852`；
因此 PR diff 还会包含指定输入 d0 相对旧起点已有的集成修复。T06 新增范围应以 d0→任务分支比较，不能把继承修复计作 T06 新实现。

PR 正文见 `PR.md`，其中专门请求 ChatGPT Pro 确认：A04 是否应取代旧的全部 wss 拒绝预期，
以及用户允许的单文件测试调整与现有证书负例证据是否足够。问题待负责人答复；未冒充其架构批准。
