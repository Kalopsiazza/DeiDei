# R03-T05-a 测试矩阵

| 检查 | 实际状态 | 边界 |
|---|---|---|
| 工具负例8项 | PASS，exit0 | 缺在线/资源、错误SHA、损坏清单、文件泄漏、错误PE架构、空间路径、错误产物路径、链接越界/权限漂移、非法候选 |
| 根检查40项 | PASS，exit0；1历史expectedFailure | 不是全产品验收 |
| macOS本机原生构建 | PASS，exit0 | DIAGNOSTIC_BASELINE；source 8a6f8b2，packaging 2e2007a |
| 依赖审计 | PASS | 两份npm audit无high/critical；固定Python公告空，未升级依赖 |
| 最终ZIP内外校验 | PASS | stage、资源hash、许可、文件/链接/可执行位、arm64、build-info一致 |
| 冻结worker协议 | PASS | 无系统Python；原离线运行入口 |
| 冻结server真实hello | PASS | 最终ZIP再解压、真实loopback；无GUI；0场、0次GUI开退 |
| 本机成包Electron GUI | NOT_RUN | 不接触默认私人档案；交一次性CI账户执行 |
| 原生CI macOS | PASS（诊断基线） | 5场、10次开退及实际包窗口；run 34875308825 |
| 原生CI Windows | FAIL | 改时限使本拍deadline漂移-7ms；0场/0次完整开退，后续未测 |
| 修订候选 | NO_CANDIDATE | 三个规定查看点；基线缺陷保留 |
| 真人/干净机/物理断网/公网 | NOT_RUN | 不以原生CI替代 |

实际命令：`python3 scripts/check.py`；`python3 -m unittest discover -s game/packaging_r03 -p test_tools.py -v`；专用Python执行`game/packaging_r03/build.py --source <固定产品检出> --output <新目录>`；`R03_PYTHON=<专用Python> node game/packaging_r03/check-package.cjs <输出目录> --headless`。完整构建子命令和退出码见commands.json。

Q21/Q23/Q24 macOS真实成包窗口通过；Q22已覆盖离线worker、身份恢复失败后的单人开场及损坏副本，未另在持续停止服务条件下重跑单人GUI。含1366×768/1920×1080视口。Windows包结构/冻结启动通过，GUI时限检查失败后其余未测，不以macOS结果代替Windows。N33/N36/N48等产品修订与全回归属于T04/T03-c，本包没有篡改原预期。
