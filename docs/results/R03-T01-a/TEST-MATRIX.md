# R03-T01-a 自测覆盖

以下为任务 01 自测，不代表任务 03 独立验收。实际命令、退出码和完整受测 SHA 见 MANIFEST.json。
测试代码在 `game/server/tests/test_rooms.py` 和 `test_boundaries.py`；测试函数名包含下列编号。

| 编号 | 自测证据/预期 | 状态 |
| --- | --- | --- |
| N01 | 服务身份、房号、seat0、未准备、公共视图不含凭证 | PASS / socket |
| N02 | 正确密码加入；错误/不存在同错误；密码不 trim | PASS / socket |
| N03 | 并发争第六席恰一人成功 | PASS / socket |
| N04 | 六席与六观众分开；第七观众失败；淘汰留原座 | PASS / socket |
| N05 | 观众 ready/submit、伪造身份字段失败 | PASS / socket |
| N06 | 未准备、非房主、断线成员不能开局 | PASS / socket |
| N07 | 换角色清准备；观众离开不清准备；房主不能换观众 | PASS / socket |
| N08 | 开局后拒绝 player 加入，观众可加入且无 options | PASS / socket |
| N09 | create 回包重放、resume 后重放、冲突、129 次后淘汰缓存拒绝旧序号 | PASS / socket |
| N10 | 他人秘密选择 Bi/Def 的完整观众 view 差分；sync/resume/失败回复；本人 accepted 私有 | PASS / socket |
| N11 | early 开/关、299/300ms 最短时长、重复 sync 不再结算 | PASS / socket + 注入时钟 |
| N12 | deadline-1 接受；deadline 先截止，来源为代理 | PASS / socket + 注入时钟 |
| N13 | 非法牌、缺字段、重复键、NaN、二进制及 16385 字节拒收 | PASS / socket + parser |
| N14 | submit 原样重放、异载荷冲突、费用一次 | PASS / socket |
| N15 | 新 ID 的第二张牌拒绝 | PASS / socket |
| N16 | 新序号包装旧 turn 拒绝；古老序号全局拒绝 | PASS / socket |
| N17 | 双人合法 chooser 只取开始状态；多人 Charge | PASS / socket |
| N18 | 从四人淘汰至两人仍为 multiplayer、仍默认 Charge | PASS / socket |
| N19 | 手动清零，非法/重连不清，第三次先行动再移除 | PASS / socket |
| N20 | recovery 在线保留原缺席，离线加一次；不允许提交/替换 Charge | PASS / socket |
| N21 | 自 bi/反弹/吸收、Pragon/防御等完整多人核心结算 | PASS / socket |
| N22 | 已提交后离开保留动作；弃权与攻击 kills 分离 | PASS / socket |
| N23 | 核心已重开 + 弃权存活者仍仅 game_index+1；缺席和 mode 保留 | PASS / socket |
| N24 | 自然赢家弃权、两位赢家同时弃权、仅剩房主；不调用单人 new_match | PASS / socket |
| N25 | 揭晓中离开不重写结果；自然淘汰者即刻离开；已公布赢家离开仍保留赢家 | PASS / socket |
| N26 | 房主 leave/第三次缺席关闭，不宣判新赢家 | PASS / socket |
| N27 | selecting/revealing 暂停恢复余量；宽限 0/30/60 秒；暂停时允许离开 | PASS / socket |
| N28 | 大厅断线 30 秒释放；参战者 30 秒仍保留，第三拍才移除；旧 close 不踢新连接 | PASS / socket |
| N29 | 正确重连、伪造 token 拒绝、已移除者不能恢复房间资格 | PASS / socket |
| N30 | 三场不同 match_id，return_lobby 清准备、保留观众 | PASS / socket |
| N31 | 并行两房不串状态；离开后新房不收到旧房快照；有界慢 writer 不阻塞同房 | PASS / socket + 慢 writer 注入 |
| N32 | 他房 room_id、观众越权、set_state/exec/seed/附加玩家字段全部拒绝 | PASS / socket |
| N33 | 20/s 限流、错误响应无 stack；Origin/路径/子协议拒收；密码失败限流；容量与生命周期 | PASS / socket + 有界队列/容量注入 |
| N34 | C065 奖励获得/使用/旧请求重放不再发放；新局仍保留 mode/缺席 | PASS / socket |
| N35 | Electron 网络失败返回离线、旧视图不覆盖新视图 | NOT_RUN / T01 无 desktop 修改权 |
| N36 | 六真实 socket 客户端 + 两观众连续三场；另用真实时钟等 5 秒截止 | PASS / loopback；不代表六真人 |

补充：完整 policy 参数边界、默认副本、未知字段/布尔冒数字/深度、1MiB 快照上限、
32 条/2MiB 出站队列、私有核心字段投影、密码不进入缓存、独立 RNG 流、核心失败关闭房间。

慢消费者以实际连接的 writer 阻塞注入验证队列和旁路玩家；未做物理弱网/OS 缓冲压测。
64 房上限采用同一注册表的容量注入，未跑 64 房或 1024 连接的吞吐压力测试。
独立核心驱动仍报告 C074/C081 的 session 适配 NOT_RUN；此处自测不改写独立驱动结果。
