# TEST-MATRIX

固定测试源码 `fe6163ae52ed8e353b3a3ae51174a2a4f018b33d`；服务 `c4b27b1b358a4823e65d92e0b035be3e18438c60`；桌面 `1dbe1e4f8de28410dc42946efddffc011966cc3a`。

160 个样本：156 PASS，3 FAIL，1 NOT_RUN。通过数只计真实已执行样本，不把静态校验计为服务通过。

| 子例 | 结果 | 执行范围 |
| --- | --- | --- |
| N01/create | PASS | ManualClock + 真实 loopback WebSocket |
| N02/correct | PASS | ManualClock + 真实 loopback WebSocket |
| N02/wrong | PASS | ManualClock + 真实 loopback WebSocket |
| N02/missing | PASS | ManualClock + 真实 loopback WebSocket |
| N03/last_seat | PASS | ManualClock + 真实 loopback WebSocket |
| N04/cap_0 | PASS | ManualClock + 真实 loopback WebSocket |
| N04/cap_6 | PASS | ManualClock + 真实 loopback WebSocket |
| N04/cap_12 | PASS | ManualClock + 真实 loopback WebSocket |
| N04/eliminated_keep_seat | PASS | ManualClock + 真实 loopback WebSocket |
| N05/room_ready | PASS | ManualClock + 真实 loopback WebSocket |
| N05/room_start | PASS | ManualClock + 真实 loopback WebSocket |
| N05/room_submit | PASS | ManualClock + 真实 loopback WebSocket |
| N05/forged | PASS | ManualClock + 真实 loopback WebSocket |
| N06/h | PASS | ManualClock + 真实 loopback WebSocket |
| N06/p | PASS | ManualClock + 真实 loopback WebSocket |
| N06/disconnected | PASS | ManualClock + 真实 loopback WebSocket |
| N07/player_join | PASS | ManualClock + 真实 loopback WebSocket |
| N07/player_leave | PASS | ManualClock + 真实 loopback WebSocket |
| N07/role | PASS | ManualClock + 真实 loopback WebSocket |
| N07/spectator_join_leave | PASS | ManualClock + 真实 loopback WebSocket |
| N07/host_role | PASS | ManualClock + 真实 loopback WebSocket |
| N08/mid_match | PASS | ManualClock + 真实 loopback WebSocket |
| N09/same | PASS | ManualClock + 真实 loopback WebSocket |
| N09/conflict | PASS | ManualClock + 真实 loopback WebSocket |
| N09/resume_retry | PASS | ManualClock + 真实 loopback WebSocket |
| N09/evicted | PASS | ManualClock + 真实 loopback WebSocket |
| N10/secret_Bi | PASS | ManualClock + 真实 loopback WebSocket |
| N10/secret_Def | PASS | ManualClock + 真实 loopback WebSocket |
| N11/5000_True | PASS | ManualClock + 真实 loopback WebSocket |
| N11/5000_False | PASS | ManualClock + 真实 loopback WebSocket |
| N11/12000_True | PASS | ManualClock + 真实 loopback WebSocket |
| N11/12000_False | PASS | ManualClock + 真实 loopback WebSocket |
| N11/30000_True | PASS | ManualClock + 真实 loopback WebSocket |
| N11/30000_False | PASS | ManualClock + 真实 loopback WebSocket |
| N12/before | PASS | ManualClock + 真实 loopback WebSocket |
| N12/at | PASS | ManualClock + 真实 loopback WebSocket |
| N13/illegal | PASS | ManualClock + 真实 loopback WebSocket |
| N13/missing | PASS | ManualClock + 真实 loopback WebSocket |
| N13/duplicate | PASS | ManualClock + 真实 loopback WebSocket |
| N13/nan | PASS | ManualClock + 真实 loopback WebSocket |
| N13/large | PASS | ManualClock + 真实 loopback WebSocket |
| N13/bool_number | PASS | ManualClock + 真实 loopback WebSocket |
| N13/extra | PASS | ManualClock + 真实 loopback WebSocket |
| N14/submit_replay | PASS | ManualClock + 真实 loopback WebSocket |
| N15/locked | PASS | ManualClock + 真实 loopback WebSocket |
| N16/fresh_old_turn | PASS | ManualClock + 真实 loopback WebSocket |
| N16/evicted | PASS | ManualClock + 真实 loopback WebSocket |
| N17/players_2 | PASS | ManualClock + 真实 loopback WebSocket |
| N17/players_3 | PASS | ManualClock + 真实 loopback WebSocket |
| N18/six_to_two | PASS | ManualClock + 真实 loopback WebSocket |
| N19/manual | PASS | ManualClock + 真实 loopback WebSocket |
| N19/illegal | PASS | ManualClock + 真实 loopback WebSocket |
| N19/resume | PASS | ManualClock + 真实 loopback WebSocket |
| N19/none | PASS | ManualClock + 真实 loopback WebSocket |
| N20/online | PASS | ManualClock + 真实 loopback WebSocket |
| N20/offline | PASS | ManualClock + 真实 loopback WebSocket |
| N21/C026_dead_reflector_returns | PASS | ManualClock + 真实 loopback WebSocket |
| N21/C050_cancelled_charge_still_kills | PASS | ManualClock + 真实 loopback WebSocket |
| N21/C043_dead_tian_clears | PASS | ManualClock + 真实 loopback WebSocket |
| N22/submitted_leave | PASS | ManualClock + 真实 loopback WebSocket |
| N22/three_absences | PASS | ManualClock + 真实 loopback WebSocket |
| N23/single_restart | PASS | ManualClock + 真实 loopback WebSocket |
| N24/winner_leaves | PASS | ManualClock + 真实 loopback WebSocket |
| N24/two_leave | PASS | ManualClock + 真实 loopback WebSocket |
| N25/continue | PASS | ManualClock + 真实 loopback WebSocket |
| N25/terminal | PASS | ManualClock + 真实 loopback WebSocket |
| N26/leave | PASS | ManualClock + 真实 loopback WebSocket |
| N26/absent | PASS | ManualClock + 真实 loopback WebSocket |
| N27/0_expire | PASS | ManualClock + 真实 loopback WebSocket |
| N27/30000_expire | PASS | ManualClock + 真实 loopback WebSocket |
| N27/30000_resume | PASS | ManualClock + 真实 loopback WebSocket |
| N27/60000_expire | PASS | ManualClock + 真实 loopback WebSocket |
| N27/60000_resume | PASS | ManualClock + 真实 loopback WebSocket |
| N27/reveal_resume | PASS | ManualClock + 真实 loopback WebSocket |
| N28/lobby | PASS | ManualClock + 真实 loopback WebSocket |
| N28/playing | PASS | ManualClock + 真实 loopback WebSocket |
| N28/replacement | PASS | ManualClock + 真实 loopback WebSocket |
| N29/correct | PASS | ManualClock + 真实 loopback WebSocket |
| N29/forged | PASS | ManualClock + 真实 loopback WebSocket |
| N29/removed | PASS | ManualClock + 真实 loopback WebSocket |
| N30/next_match | PASS | ManualClock + 真实 loopback WebSocket |
| N31/rooms | PASS | ManualClock + 真实 loopback WebSocket；精确32条/2MiB阈值 NOT_PROVEN |
| N31/slow | PASS | ManualClock + 真实 loopback WebSocket；精确32条/2MiB阈值 NOT_PROVEN |
| N32/set_state | PASS | ManualClock + 真实 loopback WebSocket |
| N32/debug | PASS | ManualClock + 真实 loopback WebSocket |
| N32/seed | PASS | ManualClock + 真实 loopback WebSocket |
| N32/forged_room | PASS | ManualClock + 真实 loopback WebSocket |
| N33/errors | PASS | ManualClock + 真实 loopback WebSocket |
| N33/burst_limit | FAIL | ManualClock + 真实 loopback WebSocket |
| N33/room_capacity | PASS | ManualClock + 真实 loopback WebSocket |
| N34/C065_reward_replay | PASS | ManualClock + 真实 loopback WebSocket |
| N34/C074_core_full_reset | PASS | ManualClock + 真实 loopback WebSocket |
| N34/room_mode_absence_reset | PASS | ManualClock + 真实 loopback WebSocket |
| N35/electron_manual | NOT_RUN | 实际 Electron，留集成包 |
| N36/six_players_three_matches | PASS | ManualClock + 真实 loopback WebSocket |
| N36/real_clock | FAIL | 真实时钟 socket；同序号 deadline 断言失败，尚未到超时动作检查 |
| N37/default | PASS | ManualClock + 真实 loopback WebSocket |
| N37/legacy_12 | PASS | ManualClock + 真实 loopback WebSocket |
| N38/10000_to_5000 | PASS | ManualClock + 真实 loopback WebSocket |
| N38/5000_to_30000 | PASS | ManualClock + 真实 loopback WebSocket |
| N39/permissions | PASS | ManualClock + 真实 loopback WebSocket |
| N39/stale | PASS | ManualClock + 真实 loopback WebSocket |
| N39/replay | PASS | ManualClock + 真实 loopback WebSocket |
| N39/same | PASS | ManualClock + 真实 loopback WebSocket |
| N39/deadline | PASS | ManualClock + 真实 loopback WebSocket |
| N40/players_2 | PASS | ManualClock + 真实 loopback WebSocket |
| N40/players_3 | PASS | ManualClock + 真实 loopback WebSocket |
| N40/host_charge_not_immune | PASS | ManualClock + 真实 loopback WebSocket |
| N41/submitted_disconnect | PASS | ManualClock + 真实 loopback WebSocket |
| N41/resume_does_not_clear | PASS | ManualClock + 真实 loopback WebSocket |
| N41/forced_online | PASS | ManualClock + 真实 loopback WebSocket |
| N41/forced_offline | PASS | ManualClock + 真实 loopback WebSocket |
| N42/lobby_expire | PASS | ManualClock + 真实 loopback WebSocket |
| N42/lobby_resume | PASS | ManualClock + 真实 loopback WebSocket |
| N42/result_expire | PASS | ManualClock + 真实 loopback WebSocket |
| N42/result_resume | PASS | ManualClock + 真实 loopback WebSocket |
| N42/eliminated_expire | PASS | ManualClock + 真实 loopback WebSocket |
| N42/eliminated_resume | PASS | ManualClock + 真实 loopback WebSocket |
| N43/after_turn_lobby | PASS | ManualClock + 真实 loopback WebSocket |
| N43/after_turn_selecting | PASS | ManualClock + 真实 loopback WebSocket |
| N43/after_turn_revealing | PASS | ManualClock + 真实 loopback WebSocket |
| N43/after_turn_result | PASS | ManualClock + 真实 loopback WebSocket |
| N43/immediate_lobby | PASS | ManualClock + 真实 loopback WebSocket |
| N43/immediate_selecting | PASS | ManualClock + 真实 loopback WebSocket |
| N43/immediate_revealing | PASS | ManualClock + 真实 loopback WebSocket |
| N43/immediate_result | PASS | ManualClock + 真实 loopback WebSocket |
| N43/after_turn_unsubmitted | PASS | ManualClock + 真实 loopback WebSocket |
| N44/leave_0 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N44/leave_1 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N44/leave_2 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N44/timeout_0 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N44/timeout_1 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N44/timeout_2 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N45/online | PASS | ManualClock + 真实 loopback WebSocket |
| N45/offline_resume | PASS | ManualClock + 真实 loopback WebSocket |
| N46/stale_event_ack_new_room | PASS | ManualClock + 真实 loopback WebSocket + 实际 NetworkRoomPort/脚本传输 |
| N47/host_role_player | PASS | ManualClock + 真实 loopback WebSocket |
| N47/host_role_spectator | PASS | ManualClock + 真实 loopback WebSocket |
| N47/null_id | PASS | ManualClock + 真实 loopback WebSocket |
| N48/three_matches | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N48/real_clock | FAIL | 真实时钟 socket；同序号 deadline 断言失败，尚未到超时动作检查 |
| N49/nickname_spaces | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_format | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_newline | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_chinese | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_emoji | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_max20 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_over21 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_surrogate | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_emoji20 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/nickname_padded | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/password_empty | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/password_spaces | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/password_max32 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |
| N49/password_over33 | PASS | ManualClock + 真实 loopback WebSocket |
| N49/password_format | PASS | ManualClock + 真实 loopback WebSocket |
| N49/password_control | PASS | ManualClock + 真实 loopback WebSocket |
| N49/password_type | PASS | ManualClock + 真实 loopback WebSocket |
| N49/password_surrogate | PASS | ManualClock + 真实 loopback WebSocket |
| N49/password_emoji32 | PASS | ManualClock + 真实 loopback WebSocket + 实际 readMessage |

## 补充固定 a/b 交叉检查

| 实际 socket 场景 | a 对 1.1 预期 | b 对 1.1 预期 |
| --- | --- | --- |
| lobby | PASS | PASS |
| ordinary_reveal | PASS | PASS |
| ordinary_win | PASS | PASS |
| voluntary_forfeit | FAIL | PASS |
| timeout_forfeit | FAIL | PASS |
| nobody_survives | PASS | PASS |
| forfeit_nobody | FAIL | PASS |
| nickname_spaces | FAIL | PASS |
| nickname_format | FAIL | PASS |
| nickname_chinese | PASS | PASS |
| nickname_emoji | PASS | PASS |

这是新补充驱动对未改产品的交叉检查，不是未改 a 独立驱动通过数。未改 a 独立驱动：0 PASS、95 FAIL（工厂入参阶段）、N35 NOT_RUN，见 a-original-*。

## 相关回归

| 检查 | 实际结果 |
| --- | --- |
| 样本结构 | 160 / 49 类有效，服务通过数不由此增加 |
| rooms 工具自测 | 19 tests，全部通过 |
| 根检查 | 59 tests，保留1个历史 expectedFailure；无新增 skip |
| 原核心 | 174 tests，通过 |
| 独立核心 | 192 fixtures / 469 resolve calls，通过；原2个session占位保留 NOT_RUN |
| runtime | 23 tests，通过 |
| 原桌面 | npm test，25 tests，通过，含构建/类型检查 |
| 原独立工具 | 8 tests，通过 |
| 新 Node 桥脚本 | 两个 node --check，通过 |

命令、cwd、环境、退出码、起止时间及测试 SHA 见 CHECKS.json 和各 *-run.json。日志为原始 stdout/stderr。
