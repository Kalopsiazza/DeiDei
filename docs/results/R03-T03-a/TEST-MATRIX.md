# R03-T03-a TEST-MATRIX

样本校验 VALID；服务通过 0；GUI/跨机/真人未运行。

| case_id | 初始身份 | 相对终点ms | 命令数 | 快照断言数 | clock | 服务状态 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| N01/create | h:player | 0 | 1 | 2 | manual | NOT_RUN |
| N02/correct | h:player | 0 | 2 | 2 | manual | NOT_RUN |
| N02/wrong | h:player | 0 | 3 | 3 | manual | NOT_RUN |
| N02/missing | h:player | 0 | 3 | 3 | manual | NOT_RUN |
| N03/last_seat | h:player, p:player, q:player, r:player, t:player | 0 | 7 | 2 | manual | NOT_RUN |
| N04/cap_0 | h:player, p:player, q:player, r:player, t:player, u:player | 0 | 7 | 2 | manual | NOT_RUN |
| N04/cap_6 | h:player, p:player, q:player, r:player, t:player, u:player, s0:spectator, s1:spectator, s2:spectator, s3:spectator, s4:spectator, s5:spectator | 0 | 13 | 2 | manual | NOT_RUN |
| N04/cap_12 | h:player, p:player, q:player, r:player, t:player, u:player, s0:spectator, s1:spectator, s2:spectator, s3:spectator, s4:spectator, s5:spectator, s6:spectator, s7:spectator, s8:spectator, s9:spectator, s10:spectator, s11:spectator | 0 | 19 | 2 | manual | NOT_RUN |
| N04/eliminated_keep_seat | h:player, p:player, q:player, s0:spectator, s1:spectator, s2:spectator, s3:spectator, s4:spectator, s5:spectator | 300 | 17 | 3 | manual | NOT_RUN |
| N05/room_ready | h:player, p:player, s:spectator | 0 | 4 | 2 | manual | NOT_RUN |
| N05/room_start | h:player, p:player, s:spectator | 0 | 4 | 2 | manual | NOT_RUN |
| N05/room_submit | h:player, p:player, s:spectator | 0 | 7 | 2 | manual | NOT_RUN |
| N05/forged | h:player, p:player, s:spectator | 0 | 4 | 2 | manual | NOT_RUN |
| N06/h | h:player, p:player | 0 | 8 | 3 | manual | NOT_RUN |
| N06/p | h:player, p:player | 0 | 8 | 3 | manual | NOT_RUN |
| N06/disconnected | h:player, p:player | 0 | 9 | 3 | manual | NOT_RUN |
| N07/player_join | h:player, p:player | 0 | 5 | 2 | manual | NOT_RUN |
| N07/player_leave | h:player, p:player | 0 | 5 | 2 | manual | NOT_RUN |
| N07/role | h:player, p:player | 0 | 5 | 2 | manual | NOT_RUN |
| N07/spectator_join_leave | h:player, p:player | 0 | 6 | 2 | manual | NOT_RUN |
| N07/host_role | h:player, p:player | 0 | 5 | 2 | manual | NOT_RUN |
| N08/mid_match | h:player, p:player | 0 | 7 | 2 | manual | NOT_RUN |
| N09/same | h:player | 0 | 1 | 2 | manual | NOT_RUN |
| N09/conflict | h:player | 0 | 1 | 2 | manual | NOT_RUN |
| N09/resume_retry | h:player | 0 | 1 | 2 | manual | NOT_RUN |
| N09/evicted | h:player | 7740 | 130 | 2 | manual | NOT_RUN |
| N10/secret_Bi | h:player, p:player, s:spectator | 0 | 11 | 6 | manual | NOT_RUN |
| N10/secret_Def | h:player, p:player, s:spectator | 0 | 11 | 6 | manual | NOT_RUN |
| N11/5000_True | h:player, p:player | 300 | 8 | 3 | manual | NOT_RUN |
| N11/5000_False | h:player, p:player | 5000 | 8 | 3 | manual | NOT_RUN |
| N11/12000_True | h:player, p:player | 300 | 8 | 3 | manual | NOT_RUN |
| N11/12000_False | h:player, p:player | 12000 | 8 | 3 | manual | NOT_RUN |
| N11/30000_True | h:player, p:player | 300 | 8 | 3 | manual | NOT_RUN |
| N11/30000_False | h:player, p:player | 30000 | 8 | 3 | manual | NOT_RUN |
| N12/before | h:player, p:player | 12001 | 8 | 2 | manual | NOT_RUN |
| N12/at | h:player, p:player | 12001 | 8 | 2 | manual | NOT_RUN |
| N13/illegal | h:player, p:player | 0 | 8 | 2 | manual | NOT_RUN |
| N13/missing | h:player, p:player | 0 | 8 | 2 | manual | NOT_RUN |
| N13/duplicate | h:player, p:player | 0 | 7 | 2 | manual | NOT_RUN |
| N13/nan | h:player, p:player | 0 | 7 | 2 | manual | NOT_RUN |
| N13/large | h:player, p:player | 0 | 7 | 2 | manual | NOT_RUN |
| N13/bool_number | h:player, p:player | 0 | 8 | 2 | manual | NOT_RUN |
| N13/extra | h:player, p:player | 0 | 8 | 2 | manual | NOT_RUN |
| N14/submit_replay | h:player, p:player | 300 | 7 | 2 | manual | NOT_RUN |
| N15/locked | h:player, p:player | 0 | 7 | 2 | manual | NOT_RUN |
| N16/fresh_old_turn | h:player, p:player | 1800 | 7 | 3 | manual | NOT_RUN |
| N16/evicted | h:player, p:player | 9540 | 136 | 3 | manual | NOT_RUN |
| N17/players_2 | h:player, p:player | 12000 | 5 | 3 | manual | NOT_RUN |
| N17/players_3 | h:player, p:player, q:player | 12000 | 7 | 4 | manual | NOT_RUN |
| N18/six_to_two | h:player, p:player, q:player, r:player, t:player, u:player | 13800 | 19 | 4 | manual | NOT_RUN |
| N19/manual | h:player, p:player, q:player | 27300 | 14 | 6 | manual | NOT_RUN |
| N19/illegal | h:player, p:player, q:player | 39000 | 14 | 6 | manual | NOT_RUN |
| N19/resume | h:player, p:player, q:player | 39000 | 13 | 6 | manual | NOT_RUN |
| N19/none | h:player, p:player, q:player | 39000 | 13 | 6 | manual | NOT_RUN |
| N20/online | h:player, p:player | 13800 | 7 | 3 | manual | NOT_RUN |
| N20/offline | h:player, p:player | 13800 | 7 | 3 | manual | NOT_RUN |
| N21/C026_dead_reflector_returns | A:player, B:player, C:player | 300 | 10 | 2 | manual | NOT_RUN |
| N21/C050_cancelled_charge_still_kills | A:player, B:player, C:player | 300 | 10 | 2 | manual | NOT_RUN |
| N21/C043_dead_tian_clears | A:player, B:player, C:player | 300 | 10 | 2 | manual | NOT_RUN |
| N22/submitted_leave | h:player, p:player, q:player | 300 | 11 | 2 | manual | NOT_RUN |
| N22/three_absences | h:player, p:player, q:player | 39000 | 13 | 4 | manual | NOT_RUN |
| N23/single_restart | h:player, p:player, q:player, r:player | 300 | 14 | 2 | manual | NOT_RUN |
| N24/winner_leaves | h:player, p:player | 1800 | 8 | 3 | manual | NOT_RUN |
| N24/two_leave | h:player, p:player, q:player | 1800 | 12 | 3 | manual | NOT_RUN |
| N25/continue | h:player, p:player | 13800 | 10 | 4 | manual | NOT_RUN |
| N25/terminal | h:player, p:player | 1800 | 9 | 3 | manual | NOT_RUN |
| N26/leave | h:player, p:player, q:player | 0 | 8 | 2 | manual | NOT_RUN |
| N26/absent | h:player, p:player, q:player | 39000 | 13 | 4 | manual | NOT_RUN |
| N27/0_expire | h:player, p:player | 1000 | 6 | 2 | manual | NOT_RUN |
| N27/30000_expire | h:player, p:player | 31000 | 6 | 3 | manual | NOT_RUN |
| N27/30000_resume | h:player, p:player | 31299 | 7 | 4 | manual | NOT_RUN |
| N27/60000_expire | h:player, p:player | 61000 | 6 | 3 | manual | NOT_RUN |
| N27/60000_resume | h:player, p:player | 61299 | 7 | 4 | manual | NOT_RUN |
| N27/reveal_resume | h:player, p:player | 31799 | 7 | 6 | manual | NOT_RUN |
| N28/lobby | h:player, p:player | 30000 | 2 | 3 | manual | NOT_RUN |
| N28/playing | h:player, p:player | 12000 | 6 | 2 | manual | NOT_RUN |
| N28/replacement | h:player, p:player | 0 | 3 | 2 | manual | NOT_RUN |
| N29/correct | h:player, p:player | 0 | 6 | 2 | manual | NOT_RUN |
| N29/forged | h:player, p:player | 0 | 6 | 2 | manual | NOT_RUN |
| N29/removed | h:player, p:player | 0 | 8 | 2 | manual | NOT_RUN |
| N30/next_match | h:player, p:player, s:spectator | 1800 | 12 | 5 | manual | NOT_RUN |
| N31/rooms | h:player, p:player, s:spectator, x:player, y:player | 60 | 11 | 5 | manual | NOT_RUN |
| N31/slow | h:player, p:player, s:spectator, x:player, y:player | 4800 | 90 | 5 | manual | NOT_RUN |
| N32/set_state | h:player, p:player | 0 | 6 | 2 | manual | NOT_RUN |
| N32/debug | h:player, p:player | 0 | 6 | 2 | manual | NOT_RUN |
| N32/seed | h:player, p:player | 0 | 6 | 2 | manual | NOT_RUN |
| N32/forged_room | h:player, p:player | 0 | 6 | 2 | manual | NOT_RUN |
| N33/errors | h:player, p:player | 0 | 8 | 2 | manual | NOT_RUN |
| N33/burst_limit | h:player, p:player | 1000 | 3 | 2 | manual | NOT_RUN |
| N33/room_capacity | h:player | 0 | 66 | 2 | manual | NOT_RUN |
| N34/C065_reward_replay | A:player, B:player | 11100 | 18 | 14 | manual | NOT_RUN |
| N34/C074_core_full_reset | A:player, B:player, C:player, D:player | 300 | 13 | 2 | manual | NOT_RUN |
| N34/room_mode_absence_reset | h:player, p:player, q:player | 25500 | 11 | 4 | manual | NOT_RUN |
| N35/electron_manual | h:player, p:player | 0 | 2 | 1 | manual | NOT_RUN（需实际GUI） |
| N36/six_players_three_matches | h:player, p:player, q:player, r:player, t:player, u:player, s:spectator, s2:spectator | 10800 | 67 | 33 | manual | NOT_RUN |
| N36/real_clock | h:player, p:player, q:player, r:player, t:player, u:player, s:spectator, s2:spectator | 5200 | 20 | 2 | real | NOT_RUN |
