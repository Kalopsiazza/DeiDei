# E 真实房间与本机 TLS 结果

远端交付状态：**本机候选已交付，待源码验收**。以下为执行者检查记录，保留原检查输入／失败／未验事项；完整来源、集成提交和最终 head 的对应关系见 [VERSIONS.md](../R04-T02/VERSIONS.md)。本报告中的“未推送”指初轮记录时，后续由集成分支统一交付。

本机完成，跨设备未验。产品源头 `88185af2c9372b2f1d88707218cafee590b94018`；安全候选 `4df3287e793223f776208f72dbd07c8a32062e33` 的15个 game 文件相对已接受 d0c96408 完整审查后，逐行接入 `55411aa7f105057c7bee67d313592bb4462e16fa`，保留新版 UI/main/model。配置与安全约束见 TLS.md。无公网部署、证书绕过或新依赖；Kimi 未调用。

## 改了什么

真实工具沿用普通 main/preload、NetworkRoomPort、真实 Python CLI/server/socket 和受控故障代理。定位跟随当前欢迎、角色 radio、共享擂台、结果和退出；按真实 phase/deadline 等待默认5秒揭晓，零目标失败。入场并行及普通原生焦点恢复保证5秒选择预算；测试窗口的 backgroundThrottling=false 仅为自动化条件，不改产品默认值。

固定资源 service-config 严格校验来源/字节/键/地址；远端明文 ws 拒绝。TLS 1.2+ 和原生证书验证保持。坏 CA/SAN/过期在身份发送前失败；临时根仅由测试进程启动时加载，未改系统信任。

真实服务还复现了 C 的已失成员退出边界，8a65b88修复并定向复测。其后生产输入只有已经审查的 D CSS；后续旧 smoke 更新保留有效断言，明确区分本地 preview 与真实 online，不改游戏/网络语义。

## 怎样验证

本机 macOS arm64；源码 Electron 44.3.0；TLS Python 3.12.11。日志/截图保留在本 worktree 忽略目录，不提交临时证书、账户或凭据。

|实际检查|输入与结果|证据|
|---|---|---|
|`python scripts/check.py`|59项，历史预期失败1；exit0|`.local-outputs/r04-t02/root-check.log`|
|网络/service-config 定向 Node检查|19项，exit0|定向日志与原生构建再次运行|
|TLS 启动约束检查|4项，exit0|server TLS 定向检查|
|server unittest discover|71项，67.544s，exit0|`.local-outputs/r04-t02/server-unit.log`|
|真实 socket 序列|10种子，exit0，真实默认5秒揭晓|`.local-outputs/r04-t02/sequences.json`|
|`node game/integration/gui.cjs`|725ec1f，13组PASS，exit0，page_errors=[]|`.local-outputs/r04-t02/real-gui/gui.json` 与 PNG、`real-gui.log`|
|`PYTHONPATH=game/core:game/server:. python game/integration/secure/run.py --electron --output …`|74fbf36，28组PASS，exit0；Node L3和实际 Electron L4各11组|`.local-outputs/r04-t02/tls-electron/secure.json`、L3/L4.json、PNG、`tls-electron.log`|
|固定 Room/core公开样本采集|8e32721，service_dirty=false，12帧含3人 restart_survivors|`.local-outputs/r04-t02/room-results-final.json`；SHA256 `2d0d36522158fcb4bae9f08ef49440a3211052132df3ca715b13e292a6125198`|

Room/core 样本明确是合成时钟/会话容器，不是 socket；实际 socket 和 GUI 证据另列。最终 QA/报告提交不改变上述通过输入的 core/server、main/preload 或生产 UI；输入哈希和具体 SHA 分别保留，不将各轮混为同一 HEAD。

真实 GUI 覆盖6玩家/6观众容量、密码/只读、33牌/3行两尺寸、时限仅下一拍生效、原请求 ACK 丢失恢复、人类账目、房主自然淘汰、3场完整对局与新ID、成员第三拍/房主第四拍缺席、迟到旧消息、新房保护、选择/揭晓期房主离开、重启 SERVER_RESTART、停服后真实离线 worker/档案、原生关窗取消/确认及有界3秒离房。

TLS 坏 SAN/过期/未知 CA 的 session_open 各0；正例两场、观众权限/保密、原 Def 请求重连且只加2、房主离房前客方真实 human Charge 账目、重启及离线通过。8个自有服务清理后连接/任务0，端口关闭，临时证书删除；6个 L4应用 exit0，临时档案删除。

## 失败保留与限制

真实 GUI 六次旧尝试和 TLS 两次尝试保留在同级 `real-gui-attempt*` / `tls-electron-attempt*` 及各日志：包含未明确定位的近deadline点击超时、firstWindow顺序、已失成员退出、hover升起影响行数取样、关闭房间回到加入表单、结果截图早于650ms和已提交房主退出终态误判。定位/等待修正后重新完整运行；没有删原故障/隐私断言。

真实揭晓 RAF 有长帧：6人 p95/p99=66.8/116.2ms，2人=250.6/317.4ms。窗口拓扑不同，没有改前同条件网络基线；这些是功能通过中的性能异常，交 F 有界 profile，不能写性能通过。

最终交付输入为 `0a37a89d3ad5e0d1b7817831d3d94f5811e90346`。相比上述 GUI 通过输入，只另修一个打包工具的锁定传递依赖和玩家说明，生产 core/server/main/preload/UI 字节不变；原生成包和 desktop79 在此干净输入重验。之后结果文档提交不作为另一轮 GUI 测试输入。

F 的一次真实两人有界 probe 在此固定输入中另核对：揭晓时两端 state/last_turn/core ledger 同为 g1:t1，玩家显示第1回合／擂台结算／本拍已揭晓，观众明确观战，存活玩家不被写为已淘汰。此为性能诊断里的附加读取，清理时测试 wrapper 有强制回收，不能记为新增完整 smoke 通过；原13/28组的完整退出证据另保留。

未验：跨设备真人、受控公网服务、系统正式信任、Windows、干净机、物理跨DPI和长期资源泄漏。成包 GUI 的一次性 CI OS 账户边界由 A 记录。本轮未 push、合并、部署或发布。


## PR #34 · R34-03 检查判据（2026-10-03）

产品网络／TLS规则未改；最新源码产品3006f0a42bece4d702c5a7ba48af9d0d0fafbfc8另含C/D修正，原0a37a89安装包未重建。故障代理在内存比较真正被接受但丢ACK的原请求与重发request_id/command_seq/payload，只输出相同布尔值；GUI额外要求error=null，原公开human账目断言保留。

实际CLI＋relay＋两个NetworkRoomPort在clean4bdd定向1/1、exit0，四比较true、error=null、human Def仅结算一次；单改ID、seq、payload的三个反例各自拒绝。该检查及产品网络输入到3006未变；这是无Electron的真实socket定向，不替代历史13组GUI／28组TLS或跨设备。

secure与GUI收尾区分正常／强制退出、exit_code/signal和wait_error，失败后继续各资源清理且保留首错；GUI复用F的有界正常关闭，Q10显式SIGKILL只记EXPECTED_FAULT、normalExit=false。实际源码VM9/9通过，相关Node51项在clean3006通过。新ACK测试的清理错误也不会中断其他子进程回收或覆盖首错。

本轮没有重跑全13/28、900秒压力或再生成证书；原TLS和真实GUI输入／历史失败／未验事项保留。[新提交、命令、输入映射及精简证据](../R04-T02/R34-REPAIRS.md)。未部署、未绕过证书，未调用Kimi。
