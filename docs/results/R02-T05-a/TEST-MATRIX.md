# R02-T05-a 测试矩阵

最终代码 `45dbf9c4e13e693b01736a79cb97652f760f8bad`；两个最终 ZIP 的完整 hash、OS/arch、命令和逐行状态见 [TEST-MATRIX.json](TEST-MATRIX.json) 与 [MANIFEST.json](MANIFEST.json)。源码、native_ci、packaged_automation 和 human 分列，不用总测试数代替人工。

**新增人工结论：macOS PASS（用户文字确认）；Windows NOT_RUN。** 常规人工流程含断网步骤，详见 [HUMAN-ACCEPTANCE.md](HUMAN-ACCEPTANCE.md)。原始 CI 记录与新的人工作证分开保留。

| ID | 检查 | macOS arm64 | Windows x64 | 证据与限制 |
| --- | --- | --- | --- | --- |
| P01 | 起点与范围 | PASS | PASS | 固定产品输入与独立 worktree，禁止路径没有增量。   |
| P02 | 工具与风险 | PASS | PASS | 完整前后审计及上游公告适用性见 DEPENDENCIES；当前 npm 高/严重项为零，非全二进制安全扫描。   |
| P03 | 原生构建 | PASS | PASS | 原生干净工具环境；每次创建本包新输出，不清理其他工作。   |
| P04 | 源码回归 | PASS | PASS | 原 174/21/192/8/22/39+1 保留，新增 runtime 2 与 desktop 3；两个 Session 占位仍 NOT_RUN。   |
| P05 | 冻结后台 | PASS | PASS | 六种既有 JSONL 指令，OS-only PATH/无效开发变量/不同 cwd；stdout 无协议外输出。   |
| P06 | 随包资料 | PASS | PASS | catalog/entry-map 与固定 Git blob 及包内资源逐字节核对；手册 33 招；无旧模型。   |
| P07 | 真实成包启动 | PASS | PASS | 来自最终 ZIP，isPackaged=true，主进程实际 PID 的 worker 在 resources 内。   |
| P08 | 开发环境隔离 | PASS | PASS | 仅临时 CI 源树不可达；非法 Python 变量、隔离 PATH、中文空格路径、不同 cwd 仍可玩；不是干净机。   |
| P09 | 缺文件错误 | PASS | PASS | 损坏测试副本分别缺 worker/catalog，显示 PACKAGE_INCOMPLETE，无开发后台回退；原 ZIP 哈希未变。   |
| P10 | 路径及权限 | PASS | NOT_RUN | Mac 非特权 uid 501 只读 app/正常 userData 通过；两端中文路径通过。Windows CI 权限不能证明普通用户只读安装验收。 Windows 普通用户权限未测。  |
| P11 | 退出及控制台 | PASS | PASS | 10 次 open/start/leave/exit，观察到的自有 worker 均回收。Windows 不弹控制台的真人观察另列 NOT_RUN。   |
| P12 | 单人流程 | PASS | PASS | 5 场真实随机对局与再开；分数 DD、曾义自动休整、实际中止 worker 后错误与重开均观察到。   |
| P13 | 断网冷启动 | PASS（本人整体确认） | NOT_RUN | 用户对含物理断网的常规流程确认通过；未提供逐项日志，可选新档案离线另列未确认。 |
| P14 | 无开发工具电脑 | NOT_RUN | NOT_RUN | 没有无 Python/Node/Git 的干净机器或独立真人系统账户；CI PATH 隔离不能替代。   |
| P15 | 窗口及档案 | PASS | PASS | 真实 Electron renderer 的 1366×768 与 1920×1080 视口；33 牌、三排、中文可读；昵称设置跨重启保留。非物理屏幕/真人输入证明。   |
| P16 | 签名及系统信任 | FAIL | NOT_RUN | Mac ad-hoc 完整性退出 0，但 Gatekeeper 退出 3 拒绝；没有公证或关闭防护。Windows 未签名，实际发布者/Defender 提示未人工复测。  Windows 发布者提示未测。 |
| P17 | 下载校验 | PASS | PASS | 实际下载外层 artifact digest、内部 ZIP、大小和文件清单核对；稳定链接/到期时间记录。普通操作见包内说明。   |
| P18 | 范围及真实声明 | PASS | PASS | 无新增生产测试后门、任意 exec、种子或 set_state；无字体/私有档案/旧模型/无关依赖；不改规则，不声明联网或正式发行。   |

两端基线回归：核心 174、runtime 原 21、新增 2、独立 192（469 次 resolve）、工具 8、桌面原 22、新增 3、根测试 39 通过 + 1 原有 expected failure。C074/room_state_preserved 与 C081/session_request_replay 保持 NOT_RUN，没有改写独立预期。

Mac P07/P11/P12 人工补充项、P13 常规离线与 P15 实际界面按用户整体文字反馈记 PASS，未补造操作次数、屏幕参数或截图。Mac P16 的 CI Gatekeeper 拒绝仍保留，人工验收不代表公证或系统信任通过。可选新档案离线首启、P14 干净电脑未单独确认；Windows 真人项目仍 NOT_RUN。细项与来源见 JSON。
