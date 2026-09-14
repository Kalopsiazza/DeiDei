# R03-T01-b 提交验收

基于 PR #22 固定输入 `0f114284492417ec61634895c485d73417ff1b49`，只在独立 b 分支增量修订服务。
受测 SHA、运行时间和退出码以 MANIFEST.json 为准。附件清单 26 项均校验，plan_sha 未提供，保持 null；
origin/integration/r03 的 SHA 仅为规划交付上下文，不代替附件版本。

## 结果与变更

- rooms-1.1 默认 10 秒，房主（含淘汰后）以版本检查修改下一选择阶段时限；同值、重试及迟到命令不重置当拍。
- 活跃房主缺席前三次代攒，第四次截止前关闭；不调用第四次核心，不暂停其他玩家。休整保持规则；重连不清缺席。
- 非参战离线房主独立宽限；淘汰留座。主动离开提供 after_turn/immediate；after_turn 保留当拍已接受动作并只结算一次。
- 自动移除定向发 membership.ended；同会话重连重送、进入新房清除，写出前检查连接世代和房间。
- 弃权终局 to_game_id 修为字符串；资料/密码验证 Unicode 边界；房主身份和不可识别请求的错误形状按 1.1 对齐。

实现主要在 room.py / server.py / protocol.py，CLI 与测试入口同步；README 更新启动行为。
N01–N36 映射保留，N26/N27 根据版本条款显式替换旧第三次关房／暂停预期；新增 N37–N49。

## 验证

最终固定受测代码 `02c6c06f5a26149de31c17954f03657289ac23cc`：服务 **61/61 PASS**，核心 **174/174 PASS**，独立核心 **192/192 PASS、469 次 resolve**，运行层 **23/23 PASS**，独立工具 **8/8 PASS**；根检查 **40 项（39 PASS、1 原有 expectedFailure）**。pip check 与 CLI help 退出 0。桌面 **25/25 PASS**，typecheck/build 退出 0；后者是只读输入的临时副本，非 rooms-1.1 桌面联调。

最终运行结果见 MANIFEST.json 与 evidence。服务为真实 loopback socket + 真实经典核心，多数计时用注入时钟；
N36 另含真实时钟截止。N36/N48 各运行六人、两观众、连续三场，后者含动态时限及房主代理。
桌面 25 项、typecheck/build 在固定输入的临时归档副本运行，复用已安装依赖；源码工作区不产生桌面输出。
全部实际命令与退出码记录在 MANIFEST.json 和 desktop-validation.json，重跑入口为 validate.py。

首次完整服务回归 60/61，通过其他基线；N39 受随机代理进入强制休整影响。新测试夹具显式用 Charge，
保持 FORCED_RECOVERY 与全部断言，服务源码未为此修改。首次失败与 SHA 保留在 first-run-manifest.json、
evidence/first-run-server.txt；最终证据另记。更早的 N43 草拟测试曾错误要求抹掉已公布 result，已改为验证保留已公布结果，
并继续断言主动退出不公布新的 outcome；select/reveal 核心调用次数断言保留。

## 边界与待验收

参数状态 PROVISIONAL：尚未收到本轮剩余问题回复，after_turn / early_reveal=true 仅为默认提案。
10 秒、局中修改、淘汰留座及四次策略已有用户指示；下一拍生效等细节来自附件规划，未冒充用户原话。
完整原话及选择分别见 DECISIONS.md、decisions.json；没有 policy-effective.json。

本任务服务自测不等于 T03 独立房间验收。未发现固定 T02-b 远端分支，rooms-1.1 桌面解码与 GUI 联机 NOT_RUN；
没有为通过旧客户端而删除新字段。独立核心驱动原有 C074/C081 session 项仍 NOT_RUN。
Windows、跨电脑、物理弱网、真人、多机容量压力测试均 NOT_RUN。

经典规则、模型、core/runtime/desktop、a 结果、原分支及依赖锁未修改。没有部署、合并、关闭旧 PR 或发布。
未调用 Kimi。PR 含未合入的 a 祖先；本任务增量只统计 input_sha 到 b，不能把 a 归功于本次重写。
