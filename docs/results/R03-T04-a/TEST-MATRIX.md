# R03-T04-a 验证矩阵

所有 PASS 都对应真实运行；旧 N35 占位保持 NOT_RUN，Q 系列真实窗口另外记录，不修改独立预期。
“GUI”是普通 main.cjs / preload / NetworkRoomPort，真实 CLI WebSocket 服务；非 tests-online/smoke 的 MOCK。

| 案例 | 实际覆盖与边界 |
| --- | --- |
| Q01–Q02 | 新服务真实 socket 回归检查合法 UUID 限流关联、业务不调用、last_seq/cache/房间不变及恢复；坏 JSON/无 ID 保持 INVALID_MESSAGE；客户端错误清 pending 由既有 NetworkRoomPort 错误 ACK 回归覆盖 |
| Q03–Q04 | JumpingClock 大幅前后跳 wall，选择/揭晓/管理宽限及 membership 时间都保持固定单调投影；原独立真实钟 N36/N48 精确断言 |
| Q05 | GUI 10 秒当拍已交牌后改 5/30/同值，当前截止不变、版本只增两次、下一拍 30 秒；重放由独立 N38/N39 覆盖 |
| Q06 | 三个真实 Electron 分别房主/玩家/观众，socket 补满 6+6；各视图读完整严格 DTO，揭晓 ledger 一致 |
| Q07 | GUI 连续三场，Charge、Bi/Def、自 bi、完整结果、返回大厅与新 match_id；固定序列另验证资源、重复提交和重开 |
| Q08 | GUI 房主自然淘汰留席 0、player 身份、host 管理权，仍可改时间且无选牌 |
| Q09 | GUI selecting 离开在当拍后 HOST_LEFT，无新 outcome；revealing 离开保持同一已公布 ledger；核心至多一次另由原服务回归计数 |
| Q10 | 自有真实房主进程 SIGKILL，另一窗口观察三次 Charge 与第四次 HOST_ABSENT；“第四次不调用核心、已交后掉线”由服务/独立样本进一步断言 |
| Q11 | GUI 自动收到 third-absence 事件，无下一命令即显示原因；淘汰后断线宽限由服务与原独立 N42/N45 覆盖 |
| Q12 | 测试 relay 只在真实服务已接受 submit 并生成 ACK 后断开，真实窗口 resume 重送同一请求，保留同一牌与 human 来源；精确扣费/核心计数由原 N14/N29 回归 |
| Q13 | relay 延迟真实 snapshot/membership 回执，新房建立后释放，不清新房也不恢复旧房；晚到旧 ACK 由原 N46 客户端模块案例覆盖 |
| Q14 | 真实窗口错密码、玩家满、观众满、修正后加入；观众越权拒绝，淘汰不占观众；换角色等由原 N07/N32 覆盖 |
| Q15 | GUI spectator 没有他人 options/accepted/token，真实公开 ledger 一致；两种隐藏选择的完整公开差分由原独立 N10 覆盖 |
| Q16 | 停止并重启自有同地址 CLI 服务，真实窗口 SERVER_RESTART，未恢复旧身份；可回单人 |
| Q17 | 原生关闭处理的“取消/确认”返回值由自动脚本选择；真实 room.leave ACK 被 relay 留住时仍按 3 秒上限退出；非人工点击系统对话框 |
| Q18 | 100 个固定 seed 合成序列；独立 CLI 真实钟四房、48 连接持续运行，实际时长/结果/内存/响应见 soak.json；不等于 T03-c 独立长期验收 |
| Q19–Q20 | 继承服务慢 writer 预算、并发席位和连接世代回归；持续运行不是物理弱网或吞吐验收 |
| Q21/Q24 | NOT_RUN / T05 成包职责；本任务不交二进制或发布 |
| Q22 | GUI 服务重启后仍可启动真实离线 worker，档案字节保留；缺包文件检查为既有桌面测试，非最终 ZIP 验收 |
| Q23 | 已查看真实截图，1366×768 与 1920×1080 均 33 张牌、三排、无视口溢出；未调整画风 |

回归下限：核心174、runtime23、独立核心192/469、独立工具8、rooms工具19、服务66（原61+5）、桌面53（原25+在线28）、根59含1个原 expectedFailure（已包含19个rooms工具用例）。
原160例保持：159可执行 + N35未测。具体轮次结果以 MANIFEST/evidence 为准，编号不当作测试方法数。
