# R03-T03-a CASE-MAP

96 个样本；36 类目录。以下是设计覆盖，真实服务全部 NOT_RUN。

| 家族 | 展开数 | 条款 | 子例 |
| --- | ---: | --- | --- |
| N01 | 1 | P02, P03, W01, W02, W05 | create |
| N02 | 3 | A03, P02, W02, W07 | correct, wrong, missing |
| N03 | 1 | A02, P02, W03 | last_seat |
| N04 | 4 | P02, P07, P13, W03, W05 | cap_0, cap_6, cap_12, eliminated_keep_seat |
| N05 | 4 | A06, P03, P09, W03 | room_ready, room_start, room_submit, forged |
| N06 | 3 | P03, W03 | h, p, disconnected |
| N07 | 5 | P03, W02, W03 | player_join, player_leave, role, spectator_join_leave, host_role |
| N08 | 1 | P02, P07, W03 | mid_match |
| N09 | 4 | A03, P04, W04 | same, conflict, resume_retry, evicted |
| N10 | 2 | A06, P04, P09, W04, W05 | secret_Bi, secret_Def |
| N11 | 6 | A04, P04, W04 | 5000_True, 5000_False, 12000_True, 12000_False, 30000_True, 30000_False |
| N12 | 2 | A02, P04, W04 | before, at |
| N13 | 7 | A06, P04, W01, W07 | illegal, missing, duplicate, nan, large, bool_number, extra |
| N14 | 1 | P04, W04 | submit_replay |
| N15 | 1 | P04, W03, W04 | locked |
| N16 | 2 | P04, W04 | fresh_old_turn, evicted |
| N17 | 2 | A02, A08, P05, W06 | players_2, players_3 |
| N18 | 1 | A05, P03, P05, P07 | six_to_two |
| N19 | 4 | P05, W03, W04 | manual, illegal, resume, none |
| N20 | 2 | P05, W03, W06 | online, offline |
| N21 | 3 | A05, A08, P05, P06, W06 | C026_dead_reflector_returns, C050_cancelled_charge_still_kills, C043_dead_tian_clears |
| N22 | 2 | A05, P05, P06, W06 | submitted_leave, three_absences |
| N23 | 1 | A05, P06, W06 | single_restart |
| N24 | 2 | A05, P06, W06 | winner_leaves, two_leave |
| N25 | 2 | P06, W04, W06 | continue, terminal |
| N26 | 2 | A05, P06, W07 | leave, absent |
| N27 | 6 | A04, P08, W05, W07 | 0_expire, 30000_expire, 30000_resume, 60000_expire, 60000_resume, reveal_resume |
| N28 | 3 | A03, A04, P08, W02 | lobby, playing, replacement |
| N29 | 3 | A03, P08, W02, W03 | correct, forged, removed |
| N30 | 1 | P07, W03, W04 | next_match |
| N31 | 2 | A02, A06, P09, W04 | rooms, slow |
| N32 | 4 | A06, A08, P14, W03 | set_state, debug, seed, forged_room |
| N33 | 3 | A06, P09, P13, W07 | errors, burst_limit, room_capacity |
| N34 | 3 | A02, A05, A08, P04, P05, P06, W04, W06 | C065_reward_replay, C074_core_full_reset, room_mode_absence_reset |
| N35 | 1 | A07, P10, P12, W08 | electron_manual |
| N36 | 2 | A08, P11, P15, W05, W06 | six_players_three_matches, real_clock |

N31队列阈值与N35实际UI限制见REPORT；分类出现不意味着其所有安全属性已实测。
