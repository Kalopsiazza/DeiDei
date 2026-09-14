# R03-T05-a 候选测试矩阵

产品d0c96408；工具325006a2；最终原生CI run 34909293225。

| 检查 | macOS arm64 | Windows x64 |
|---|---|---|
| 固定回执/受保护树/依赖锁 | PASS | PASS |
| 工具负例8项 | PASS | PASS |
| 构建、冻结worker/server、无系统Python | PASS | PASS |
| 最终ZIP再次展开、清单/版本/许可/架构 | PASS | PASS |
| 真成包5场对局与未来时限 | PASS；deadline严格相等 | PASS；deadline严格相等 |
| 普通玩家第三缺席、房主离开 | PASS | PASS |
| 重启server后的身份恢复失败 | PASS | PASS |
| 持续停止server后离线单人、10次开退 | PASS | PASS |
| 缺worker/catalog副本和缺server路径 | PASS | PASS |
| 1366×768、1920×1080三排33牌 | PASS；真实截图 | PASS；真实截图 |
| npm/Python执行时审计 | PASS | PASS |
| 原生签名观测 | ad-hoc；未公证；spctl rejected | NotSigned |
| 下载后独立校验 | PASS；原生复核 | PASS；清单字节复核，原生架构由CI核验 |
| 真人/干净机/物理断网/公网 | NOT_RUN | NOT_RUN |

候选首轮Windows在5场/10次之后退出127，原RUNNING报告不算通过；一次工具复制路径修复后复测通过。两轮证据分开保存。Q22是停止本地服务，不能解释为物理断网。

命令：python3 -m unittest discover -s game/packaging_r03 -p test_tools.py -v；node --check game/packaging_r03/check-package.cjs；原生CI执行固定Python的build.py --source product --output <新目录>，再node check-package.cjs <输出目录>。详细命令与退出码见candidate/ci-mac和candidate/ci-win/commands.json；基线历史见TEST-MATRIX-BASELINE.md。
