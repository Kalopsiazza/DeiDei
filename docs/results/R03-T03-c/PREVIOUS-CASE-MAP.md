# 完整预期来源映射

保留 a 的 96 个 case_id；b 共 160 个子例，其中 64 个为新子例。样本是人工规范预期，不从受测服务输出生成。

来源 P=PRD、W=NET、A=ARC。P19—P24、W09—W13、A11—A17 来自 b 附件对应 `docs/prd/R03-ROOMS-v1.1.md`、`docs/contracts/r03/CONTRACT-v1.1.md`、`docs/architecture/R03-ROOMS-v1.1.md`；其他条款继承附件 `original-r03-a-input.zip`。N37—N49 另逐项对应 `ACCEPTANCE-v1.1.md` 同号。全部文件 hash 见 INPUT-PLAN-MANIFEST。

## 对既有预期的修正依据

- 全部请求改为规范 UUID；只向工厂传四项可配置 policy，六项公开 policy 仍严格核对。这修复 a 驱动入口问题，不改变玩法预期。
- 默认时限 12→10 秒，显式 12 秒仍保留；暂停与房主第三次散房由 P20—P22/W10/A12—A13 替换。N26/N27 的原 case_id 均保留。
- N05/N06/N47 使用 W12 明确的身份优先错误；N29 错误 token 为格式合法的合成 43 字符串，以区分认证失败与坏格式。
- N19/illegal 改用 Volvo：两次 Charge 后有 12 dd6，Pragon 的 12 门槛已满足；Volvo 要 24，才能实际检验无效提交不清缺席。依据只读核心 entries/C 条款，不按服务输出改答案。
- N33/errors 用数字 entry_id 检验精确 INVALID_MESSAGE，避免把规范未固定的未知字符串→具体错误映射当硬断言。N32 继续检查未知管理命令。
- N33/burst_limit 逐个接收回包后再发下一条，保持最多45次快速请求，隔离限流与32条队列边界；空ID RATE_LIMITED 仍判失败。
- N38 在开场1秒后才收齐动作，300ms最短展示已满足，最后一次提交即揭晓；不再多推进300ms而让下一拍预期少算时间。依据继承 A04。
- A13 规定房主离开后即失去成员订阅，只保留本拍参与记录，因此 pending_close 时不强制 host_id 仍在 members；其他开放房间仍必须有房主。
- W10 的 grace.remaining_ms 可随同序号 sync 倒数；deadline 与实际状态仍严格比较。真实时钟的截止差异未以容差抹平。
- N10 原两例增加临时观众的30秒宽限结束与resume回执：只改变主机未揭晓 Bi/Def，整个 membership.ended 除随机事件ID/时间/实例身份外须一致；旧房私密快照不得到达移除者。N28 大厅宽限另要求相应 receipt。

- N10 的 core roster/active_ids 原本按各次生成的 UUID 排序；映射为别名后也须按别名排序，否则相同身份集合出现随机误报。room_forfeits 同样按玩家身份比较完整移除项，保留重复数检查；席位列表和其他数组未放宽。

## 每个样本

| case_id | 保留/新增 | 人工预期 | 来源 |
| --- | --- | --- | --- |
| N01/create | a保留并适配 | 创建无密码房并检查房主与私有视图 | P02 P03 W01 W02 W05 |
| N02/correct | a保留并适配 | 密码正确入座；错误与不存在房号同码 | P02 W02 W07 A03 |
| N02/wrong | a保留并适配 | 密码正确入座；错误与不存在房号同码 | P02 W02 W07 A03 |
| N02/missing | a保留并适配 | 密码正确入座；错误与不存在房号同码 | P02 W02 W07 A03 |
| N03/last_seat | a保留并适配 | 两条独立连接竞争最后席位 | P02 W03 A02 |
| N04/cap_0 | a保留并适配 | 独立观众容量与六席分开 | P02 P13 W03 W05 |
| N04/cap_6 | a保留并适配 | 独立观众容量与六席分开 | P02 P13 W03 W05 |
| N04/cap_12 | a保留并适配 | 独立观众容量与六席分开 | P02 P13 W03 W05 |
| N04/eliminated_keep_seat | a保留并适配 | 淘汰者占原参战席而不消耗观众容量 | P02 P07 W03 W05 |
| N05/room_ready | a保留并适配 | 观众权限与未知身份字段 | P03 P09 W03 A06 |
| N05/room_start | a保留并适配 | 观众权限与未知身份字段 | P03 P09 W03 A06 |
| N05/room_submit | a保留并适配 | 观众权限与未知身份字段 | P03 P09 W03 A06 |
| N05/forged | a保留并适配 | 观众权限与未知身份字段 | P03 P09 W03 A06 |
| N06/h | a保留并适配 | 全连线全准备且仅房主可开局 | P03 W03 |
| N06/p | a保留并适配 | 全连线全准备且仅房主可开局 | P03 W03 |
| N06/disconnected | a保留并适配 | 全连线全准备且仅房主可开局 | P03 W03 |
| N07/player_join | a保留并适配 | 大厅成员变更是否清准备 | P03 W02 W03 |
| N07/player_leave | a保留并适配 | 大厅成员变更是否清准备 | P03 W02 W03 |
| N07/role | a保留并适配 | 大厅成员变更是否清准备 | P03 W02 W03 |
| N07/spectator_join_leave | a保留并适配 | 大厅成员变更是否清准备 | P03 W02 W03 |
| N07/host_role | a保留并适配 | 大厅成员变更是否清准备 | P03 W02 W03 |
| N08/mid_match | a保留并适配 | 开场后只允许观众加入 | P02 P07 W03 |
| N09/same | a保留并适配 | 创建幂等与缓存淘汰后的旧序号 | P04 W04 A03 |
| N09/conflict | a保留并适配 | 创建幂等与缓存淘汰后的旧序号 | P04 W04 A03 |
| N09/resume_retry | a保留并适配 | 创建幂等与缓存淘汰后的旧序号 | P04 W04 A03 |
| N09/evicted | a保留并适配 | 创建幂等与缓存淘汰后的旧序号 | P04 W04 A03 |
| N10/secret_Bi | a保留并适配 | 只改变他人秘密牌的完整JSON非干扰对照 | P04 P09 W04 W05 W11 A06 A14 |
| N10/secret_Def | a保留并适配 | 只改变他人秘密牌的完整JSON非干扰对照 | P04 P09 W04 W05 W11 A06 A14 |
| N11/5000_True | a保留并适配 | 提前揭晓与最短展示、截止均只结算一次 | P04 W04 A04 |
| N11/5000_False | a保留并适配 | 提前揭晓与最短展示、截止均只结算一次 | P04 W04 A04 |
| N11/12000_True | a保留并适配 | 提前揭晓与最短展示、截止均只结算一次 | P04 W04 A04 |
| N11/12000_False | a保留并适配 | 提前揭晓与最短展示、截止均只结算一次 | P04 W04 A04 |
| N11/30000_True | a保留并适配 | 提前揭晓与最短展示、截止均只结算一次 | P04 W04 A04 |
| N11/30000_False | a保留并适配 | 提前揭晓与最短展示、截止均只结算一次 | P04 W04 A04 |
| N12/before | a保留并适配 | 截止之前1ms接受、恰好截止拒绝 | P04 W04 A02 |
| N12/at | a保留并适配 | 截止之前1ms接受、恰好截止拒绝 | P04 W04 A02 |
| N13/illegal | a保留并适配 | 坏消息拒绝且不改公开状态或影响其他连接 | P04 W01 W07 A06 |
| N13/missing | a保留并适配 | 坏消息拒绝且不改公开状态或影响其他连接 | P04 W01 W07 A06 |
| N13/duplicate | a保留并适配 | 坏消息拒绝且不改公开状态或影响其他连接 | P04 W01 W07 A06 |
| N13/nan | a保留并适配 | 坏消息拒绝且不改公开状态或影响其他连接 | P04 W01 W07 A06 |
| N13/large | a保留并适配 | 坏消息拒绝且不改公开状态或影响其他连接 | P04 W01 W07 A06 |
| N13/bool_number | a保留并适配 | 坏消息拒绝且不改公开状态或影响其他连接 | P04 W01 W07 A06 |
| N13/extra | a保留并适配 | 坏消息拒绝且不改公开状态或影响其他连接 | P04 W01 W07 A06 |
| N14/submit_replay | a保留并适配 | 同一提交重试不重复支出、异载荷冲突 | P04 W04 |
| N15/locked | a保留并适配 | 新ID不能替换已经提交的入口 | P04 W03 W04 |
| N16/fresh_old_turn | a保留并适配 | 过期match/turn不能重新消费 | P04 W04 |
| N16/evicted | a保留并适配 | 过期match/turn不能重新消费 | P04 W04 |
| N17/players_2 | a保留并适配 | 双人注入合法代理、多人固定攒 | P05 W06 A02 A08 |
| N17/players_3 | a保留并适配 | 双人注入合法代理、多人固定攒 | P05 W06 A02 A08 |
| N18/six_to_two | a保留并适配 | 六人降到双人仍保持多人超时策略 | P03 P05 P07 A05 |
| N19/manual | a保留并适配 | 连续缺席只由有效手动提交清零 | P05 W03 W04 |
| N19/illegal | a保留并适配 | 连续缺席只由有效手动提交清零 | P05 W03 W04 |
| N19/resume | a保留并适配 | 连续缺席只由有效手动提交清零 | P05 W03 W04 |
| N19/none | a保留并适配 | 连续缺席只由有效手动提交清零 | P05 W03 W04 |
| N20/online | a保留并适配 | 强制休整在线不计不清、离线只计一次 | P05 W03 W06 |
| N20/offline | a保留并适配 | 强制休整在线不计不清、离线只计一次 | P05 W03 W06 |
| N21/C026_dead_reflector_returns | a保留并适配 | 完整核心预期：dead_reflector_returns | P05 P06 W06 A05 A08 |
| N21/C050_cancelled_charge_still_kills | a保留并适配 | 完整核心预期：cancelled_charge_still_kills | P05 P06 W06 A05 A08 |
| N21/C043_dead_tian_clears | a保留并适配 | 完整核心预期：dead_tian_clears | P05 P06 W06 A05 A08 |
| N22/submitted_leave | a保留并适配 | 离开仍保留当拍动作，forfeit不伪造击杀 | P05 P06 W06 A05 |
| N22/three_absences | a保留并适配 | 离开仍保留当拍动作，forfeit不伪造击杀 | P05 P06 W06 A05 |
| N23/single_restart | a保留并适配 | 规则重开和房间移除只增加一次局号 | P06 W06 A05 |
| N24/winner_leaves | a保留并适配 | 退出自然赢家与同时两位退出 | P06 W06 A05 |
| N24/two_leave | a保留并适配 | 退出自然赢家与同时两位退出 | P06 W06 A05 |
| N25/continue | a保留并适配 | 揭晓期间离房不修改已公开回合 | P06 W04 W06 |
| N25/terminal | a保留并适配 | 揭晓期间离房不修改已公开回合 | P06 W04 W06 |
| N26/leave | a保留并适配 | 1.1房主当拍离开或第四次缺席关闭 | P20 P22 W10 A12 A13 |
| N26/absent | a保留并适配 | 1.1房主当拍离开或第四次缺席关闭 | P20 P22 W10 A12 A13 |
| N27/0_expire | a保留并适配 | 1.1无参战回合时的房主管理宽限 | P21 W10 A12 |
| N27/30000_expire | a保留并适配 | 1.1无参战回合时的房主管理宽限 | P21 W10 A12 |
| N27/30000_resume | a保留并适配 | 1.1无参战回合时的房主管理宽限 | P21 W10 A12 |
| N27/60000_expire | a保留并适配 | 1.1无参战回合时的房主管理宽限 | P21 W10 A12 |
| N27/60000_resume | a保留并适配 | 1.1无参战回合时的房主管理宽限 | P21 W10 A12 |
| N27/reveal_resume | a保留并适配 | 1.1揭晓期断线不暂停且不重新结算 | P20 W10 A12 |
| N28/lobby | a保留并适配 | 普通成员断线宽限与连接世代 | P08 W02 W11 A03 A04 A14 |
| N28/playing | a保留并适配 | 普通成员断线宽限与连接世代 | P08 W02 A03 A04 |
| N28/replacement | a保留并适配 | 普通成员断线宽限与连接世代 | P08 W02 A03 A04 |
| N29/correct | a保留并适配 | 恢复凭证不依赖昵称且退出不复活 | P08 W02 W03 A03 |
| N29/forged | a保留并适配 | 恢复凭证不依赖昵称且退出不复活 | P08 W02 W03 A03 |
| N29/removed | a保留并适配 | 恢复凭证不依赖昵称且退出不复活 | P08 W02 W03 A03 |
| N30/next_match | a保留并适配 | 回大厅原角色不变、准备归零、新match隔离旧请求 | P07 W03 W04 |
| N31/rooms | a保留并适配 | 两房并行与旧房成员解除授权 | P09 W04 A02 A06 |
| N31/slow | a保留并适配 | 两房并行与旧房成员解除授权 | P09 W04 A02 A06 |
| N32/set_state | a保留并适配 | 拒绝任意状态注入及跨房成员访问 | P14 W03 A06 A08 |
| N32/debug | a保留并适配 | 拒绝任意状态注入及跨房成员访问 | P14 W03 A06 A08 |
| N32/seed | a保留并适配 | 拒绝任意状态注入及跨房成员访问 | P14 W03 A06 A08 |
| N32/forged_room | a保留并适配 | 拒绝任意状态注入及跨房成员访问 | P14 W03 A06 A08 |
| N33/errors | a保留并适配 | 错误无堆栈和秘密，普通连接继续服务 | P09 P13 W07 A06 |
| N33/burst_limit | a保留并适配 | 单连接突发45条，正常连接继续工作 | P13 W07 A06 |
| N33/room_capacity | a保留并适配 | 64房容量上界与第65个创建拒绝 | P13 W07 A06 |
| N34/C065_reward_replay | a保留并适配 | 自然奖励到账并消费后重放旧提交不再发奖 | P04 P05 W04 W06 A02 |
| N34/C074_core_full_reset | a保留并适配 | 完整核心预期：core_full_reset | P05 P06 W06 A05 A08 |
| N34/room_mode_absence_reset | a保留并适配 | 规则重开保留房间模式和缺席次数 | P05 P06 W06 A05 |
| N35/electron_manual | a保留并适配 | 网络失败返回菜单、晚到旧房快照与离线档案 | P10 P12 W08 A07 |
| N36/six_players_three_matches | a保留并适配 | 真实socket六连接两观众三场，另有真时钟截止 | P11 P15 W05 W06 A08 |
| N36/real_clock | a保留并适配 | 真实socket六连接两观众三场，另有真时钟截止 | P11 P15 W05 W06 A08 |
| N37/default | b新增 | 默认10秒与保留12秒配置 | P19 W09 W10 A11 |
| N37/legacy_12 | b新增 | 默认10秒与保留12秒配置 | P19 W09 W10 A11 |
| N38/10000_to_5000 | b新增 | 修改未来时限不改变本拍截止或选择 | P19 W09 W10 A11 |
| N38/5000_to_30000 | b新增 | 修改未来时限不改变本拍截止或选择 | P19 W09 W10 A11 |
| N39/permissions | b新增 | 时限权限、版本、重放、同值和截止优先 | P19 W04 W09 A11 |
| N39/stale | b新增 | 时限权限、版本、重放、同值和截止优先 | P19 W04 W09 A11 |
| N39/replay | b新增 | 时限权限、版本、重放、同值和截止优先 | P19 W04 W09 A11 |
| N39/same | b新增 | 时限权限、版本、重放、同值和截止优先 | P19 W04 W09 A11 |
| N39/deadline | b新增 | 时限权限、版本、重放、同值和截止优先 | P19 W04 W09 A11 |
| N40/players_2 | b新增 | 房主前三次代攒，第四次不调用核心 | P20 W10 A12 |
| N40/players_3 | b新增 | 房主前三次代攒，第四次不调用核心 | P20 W10 A12 |
| N40/host_charge_not_immune | b新增 | 房主代攒仍受攻击且自然淘汰不散房 | P20 W10 A12 |
| N41/submitted_disconnect | b新增 | 房主掉线与手动/强制动作的缺席计数 | P20 W10 A12 |
| N41/resume_does_not_clear | b新增 | 房主掉线与手动/强制动作的缺席计数 | P20 W10 A12 |
| N41/forced_online | b新增 | 房主掉线与手动/强制动作的缺席计数 | P20 W10 A12 |
| N41/forced_offline | b新增 | 房主掉线与手动/强制动作的缺席计数 | P20 W10 A12 |
| N42/lobby_expire | b新增 | 无房主可计数回合时截止只建立一次 | P21 W10 A12 |
| N42/lobby_resume | b新增 | 无房主可计数回合时截止只建立一次 | P21 W10 A12 |
| N42/result_expire | b新增 | 无房主可计数回合时截止只建立一次 | P21 W10 A12 |
| N42/result_resume | b新增 | 无房主可计数回合时截止只建立一次 | P21 W10 A12 |
| N42/eliminated_expire | b新增 | 无房主可计数回合时截止只建立一次 | P21 W10 A12 |
| N42/eliminated_resume | b新增 | 无房主可计数回合时截止只建立一次 | P21 W10 A12 |
| N43/after_turn_lobby | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/after_turn_selecting | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/after_turn_revealing | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/after_turn_result | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/immediate_lobby | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/immediate_selecting | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/immediate_revealing | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/immediate_result | b新增 | 房主主动离开阶段与两种批准范围内配置 | P22 W10 A13 A17 |
| N43/after_turn_unsubmitted | b新增 | 房主未交牌离开仍按一次Charge完成该拍 | P22 W10 A13 |
| N44/leave_0 | b新增 | 房间移除终局/重开保持核心账目和game_id | P06 P23 W12 A05 A15 |
| N44/leave_1 | b新增 | 房间移除终局/重开保持核心账目和game_id | P06 P23 W12 A05 A15 |
| N44/leave_2 | b新增 | 房间移除终局/重开保持核心账目和game_id | P06 P23 W12 A05 A15 |
| N44/timeout_0 | b新增 | 房间移除终局/重开保持核心账目和game_id | P06 P23 W12 A05 A15 |
| N44/timeout_1 | b新增 | 房间移除终局/重开保持核心账目和game_id | P06 P23 W12 A05 A15 |
| N44/timeout_2 | b新增 | 房间移除终局/重开保持核心账目和game_id | P06 P23 W12 A05 A15 |
| N45/online | b新增 | 自动移除定向通知与恢复重送，不复活原座 | P23 W11 A14 |
| N45/offline_resume | b新增 | 自动移除定向通知与恢复重送，不复活原座 | P23 W11 A14 |
| N46/stale_event_ack_new_room | b新增 | 真实客户端丢弃旧回执与旧ack，保留新房意图 | P23 W11 A14 |
| N47/host_role_player | b新增 | 房主任何role请求都精确拒绝HOST_ROLE_FIXED | P03 W12 |
| N47/host_role_spectator | b新增 | 房主任何role请求都精确拒绝HOST_ROLE_FIXED | P03 W12 |
| N47/null_id | b新增 | 无UUID坏JSON返回空ID且不影响合法连接 | W12 A15 |
| N48/three_matches | b新增 | 六玩家两观众动态时限与断线代理 | P19 P20 P23 W09 W10 W11 A16 |
| N48/real_clock | b新增 | 六玩家两观众动态时限与断线代理 | P19 P20 P23 W09 W10 W11 A16 |
| N49/nickname_spaces | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_format | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_newline | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_chinese | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_emoji | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_max20 | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_over21 | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_surrogate | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_emoji20 | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/nickname_padded | b新增 | 资料校验从session.open到桌面读取 | W13 A17 |
| N49/password_empty | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_spaces | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_max32 | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_over33 | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_format | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_control | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_type | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_surrogate | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |
| N49/password_emoji32 | b新增 | 密码长度/类别与不trim合法空格 | W13 A17 |

N21/N34 的完整核心预期来自未改的 tests/rules_v1_001/fixtures/C026、C050、C043、C065、C074；cases.json 的 core 步保留每份 input、expected 及全账目。
N31 仍 NOT_PROVEN 精确队列阈值；N35 仍 NOT_RUN 实际 Electron。
