# 首次失败与修复记录

| 阶段 | 实际结果 | 处理 |
| --- | --- | --- |
| 固定输入 8a6f8b29 独立160例 | 156 PASS / N33、N36、N48 FAIL / N35 NOT_RUN | 原样保留 baseline-independent.json，未改独立预期 |
| 新 Q01–Q04 修复前 | 3 FAIL / 1 ERROR | UUID 关联及固定锚点回归确实能发现旧实现缺陷，见 new-regressions-before-fix.txt |
| 新回归第一次修复后 | 一个测试在服务还没观察到 disconnect 时推进 ManualClock，回执尚未生成 | 先用房主 sync 确认服务处理断线，再推进时钟；不改移除断言，见 regression-clock-observation-failure.txt |
| 固定中间版本 0e50a6d 独立160例 | 158 PASS / N33 FAIL / N35 NOT_RUN | 第五次违规的末尾 ACK 被 handler finally 取消 writer 吞掉；增加最多1秒等待队列发送完毕，保留五次违规/关闭码/队列预算 |
| d0c9640 定向 N33 | PASS；新增第五份 ACK 及 1008 关闭顺序自测 PASS | 终态响应通过原队列，不走第二套直接 send；不减少发送条数 |
| 首次 GUI | 已完成三场及多项窗口检查，房主进程 SIGKILL 后脚本再次读取已销毁 Playwright 对象而失败 | 测试脚本在 launch 时保存自有子进程句柄；生产 main/preload 未改；保留 first-gui-failure.txt |
| 首次桌面环境命令 | node_modules 链接目标位置写错，npm 无本地 tsc | 修正到既有依赖目录后25+28通过，锁和依赖版本未变；initial-environment-failure.txt |
| 修复前真实钟运行 | 源版本被最后 ACK 修复取代，提前停止自有旧运行 | superseded-soak.json 只记部分计数，不能作900秒验收；最终代码重新完整运行 |

同类问题没有超过三次盲目重试；每次复跑都有上述具体原因或改动。未新增 skip / expectedFailure，未删除旧样本或降低时间精确相同要求。
