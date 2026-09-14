# R03-T02-b 验证矩阵

受测 SHA：`19e75c0d3f3ca8423733538a57ef071ad808a713`。macOS arm64，Electron 44.3.0 / embedded Node 24.20.0；沿用锁定依赖。运行 `python3 docs/results/R03-T02-b/validate.py` 重现以下六项；日志、退出码与耗时由脚本记录。

| 检查 | 实际命令（根目录，另有说明除外） | 结果 / 来源 |
|---|---|---|
| 基础 | `python3 scripts/check.py` | 40 项，1 个保留历史 expectedFailure；exit 0 |
| 原桌面 | `npm --prefix game/desktop test` | 25/25，构建与类型检查；exit 0 |
| 在线 | `npm --prefix game/desktop run test:online` | 28/28，无 skip；exit 0 |
| 运行时能力 | 在 game/desktop：`./node_modules/.bin/electron tests-online/probe.cjs` | WebSocket=function；exit 0；不是联网验收 |
| 在线窗口 | `DEIDEI_ONLINE_SMOKE_OUTPUT=docs/results/R03-T02-b npm --prefix game/desktop run smoke:online` | 实际 Electron + MOCK socket；exit 0 |
| 单人窗口 | `DEIDEI_SMOKE_OUTPUT=docs/results/R03-T02-b/offline-regression node game/desktop/smoke-live.cjs` | 实际 worker/core；exit 0 |

validate.py 将两个输出环境变量设置为绝对路径；从任意目录运行 npm 脚本时应同样提供绝对输出路径。

| 新版覆盖 | 断言与证据 |
|---|---|
| W09 时限 | 精确六档、默认10；旧ack不覆盖新policy；保持当前截止时间/已交牌；POLICY_STALE 后新请求ID/递增序号；淘汰房主有权限、非房主无权限；pending_close 拒绝设置但允许现有玩家提交 |
| W10 房主恢复 | rounds 提示继续牌局；选择与grace倒计时并行递减；相同快照不重置；恢复清除提示；旧 paused 拒绝 |
| W11 成员移出 | 本人/房间/seq/事件ID检查，清旧房pending和确认牌，保留session；resume后移出清理重试；重复event、迟到ack/snapshot、旧event不影响新房与新create |
| W12 异常 | null request_id 仅接受指定INVALID_MESSAGE形状，不能完成pending；非法UUID/空ID成功ack拒绝；新增错误映射 |
| W13 文本 | 昵称1–20 Unicode码点、非纯空白、禁Cc/Cf/Cs；密码0–32且保留空格 |
| W14 真实结果 | 10 个实际 Room/core DTO 完整decode，规则/退赛各覆盖唯一胜者和无人获胜；last_turn未删；null/错误to_game_id及私密choice_token拒绝 |
| Electron新状态 | 10→5当前不变、下一拍5→30待生效；缺席仍33牌、双倒计时；淘汰房主能设置、结果页能设置；pending_close提示；无点击自动退页；保留身份、新房抵抗旧event/snapshot |
| 原窗口回归 | 六席位、准备/开始、33牌三排、1366×768与1920×1080无全页溢出；提交锁定、揭晓账目、结果下一场、观众角色、满房/错误密码、重连、原生关窗确认、IPC注入拒绝 |
| 原离线回归 | 实际单人开场、选择/揭晓、资源、恢复、结束/再次开场、worker中断与读失败；保留fixture开发入口 |

真实结果采集的输入源码 SHA256、dirty 状态及来源 HEAD 位于 `game/desktop/tests-online/room-results-v11.json`。该采集未启动 socket；会话/时钟容器为合成。Electron截图使用独立 MOCK，不能作为这些 Room DTO 已经完成窗口联调的证据。

未运行：真实服务socket与Electron联调、多设备真人、物理断网、Windows、打包发布；待后续固定服务候选 SHA 的集成工作。核心174、独立核心192/469、runtime23、打包工具8不在本次改动范围，不把旧成绩写成本次运行结果。
