# 测试矩阵

| 范围 | 结果 | 证据/限制 |
|---|---|---|
| Q01/rate | FAIL | 固定输入，最小复现使用同case_id；ValueError |
| Q02/malformed | PASS | 真实本机检查 |
| Q03/clock_reads | FAIL | 固定输入，最小复现使用同case_id；AssertionError |
| Q04/selecting | FAIL | 固定输入，最小复现使用同case_id；AssertionError |
| Q04/revealing | FAIL | 固定输入，最小复现使用同case_id；AssertionError |
| Q04/grace | FAIL | 固定输入，最小复现使用同case_id；AssertionError |
| Q11/eliminated_grace | PASS | 真实本机检查 |
| Q12/lost_ack | PASS | 真实本机检查 |
| Q16/restart | PASS | 真实本机检查 |
| Q19/exact_writer | PASS | internal controlled writer; exact queued count/bytes, in-flight frame excluded |
| Q05/N38/10000_to_5000 | PASS | real sockets; N46 also real client with scripted delivery |
| Q05/N38/5000_to_30000 | PASS | real sockets; N46 also real client with scripted delivery |
| Q05/N39/permissions | PASS | real sockets; N46 also real client with scripted delivery |
| Q05/N39/stale | PASS | real sockets; N46 also real client with scripted delivery |
| Q05/N39/replay | PASS | real sockets; N46 also real client with scripted delivery |
| Q05/N39/same | PASS | real sockets; N46 also real client with scripted delivery |
| Q05/N39/deadline | PASS | real sockets; N46 also real client with scripted delivery |
| Q10/N40/players_2 | PASS | real sockets; N46 also real client with scripted delivery |
| Q10/N40/players_3 | PASS | real sockets; N46 also real client with scripted delivery |
| Q10/N40/host_charge_not_immune | PASS | real sockets; N46 also real client with scripted delivery |
| Q10/N41/submitted_disconnect | PASS | real sockets; N46 also real client with scripted delivery |
| Q10/N41/resume_does_not_clear | PASS | real sockets; N46 also real client with scripted delivery |
| Q10/N41/forced_online | PASS | real sockets; N46 also real client with scripted delivery |
| Q10/N41/forced_offline | PASS | real sockets; N46 also real client with scripted delivery |
| Q11/N28/lobby | PASS | real sockets; N46 also real client with scripted delivery |
| Q11/N45/online | PASS | real sockets; N46 also real client with scripted delivery |
| Q11/N45/offline_resume | PASS | real sockets; N46 also real client with scripted delivery |
| Q13/N46/stale_event_ack_new_room | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N04/cap_6 | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N04/eliminated_keep_seat | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N05/room_ready | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N05/room_start | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N05/room_submit | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N05/forged | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N06/h | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N06/p | PASS | real sockets; N46 also real client with scripted delivery |
| Q14/N06/disconnected | PASS | real sockets; N46 also real client with scripted delivery |
| Q15/N10/secret_Bi | PASS | real sockets; N46 also real client with scripted delivery |
| Q15/N10/secret_Def | PASS | real sockets; N46 also real client with scripted delivery |
| Q19/N31/rooms | PASS | real sockets; N46 also real client with scripted delivery |
| Q19/N31/slow | PASS | real sockets; N46 also real client with scripted delivery |
| Q20/N03/last_seat | PASS | real sockets; N46 also real client with scripted delivery |
| Q20/N28/replacement | PASS | real sockets; N46 also real client with scripted delivery |
| Q17 | PASS，原生视觉PARTIAL | gui.json；三个真实窗口，原生dialog回调响应脚本化 |
| Q18/100seeds | 100PASS | seeds-100.json，固定seed0–99；最大动作数 92 |
| Q18/900seconds | FAIL | endurance-900.json；976场；同seq公开字段漂移 |
| 原160 | 156PASS/3FAIL/1NOT_RUN | baseline-160.json；最新完整执行另见baseline-160-latest.json |
| 原11交叉场景 | 11PASS | baseline-cross.json；真实server→desktop解码 |
| 五类变异 | 3KILLED/2BASELINE_FAIL | mutations.json；两类缺通过正控，不计KILLED |
| Windows | NOT_RUN | 本机macOS，无Windows验收证据 |
| 原N35 | NOT_RUN | 独立160驱动没有运行此例，新增GUI单列 |
