## 这次想解决什么

让现有单人实算程序随包携带 Python 后台与资料，提供 macOS arm64 / Windows x64 内部测试 ZIP。两端原生构建和成包自动化已通过，整体验收 **PARTIAL**：macOS 已获用户本人人工验收通过，Windows 真人验收仍未测；可选新档案离线/干净机未单独确认，原 CI Gatekeeper 拒绝记录保留。

## 改了什么，哪些没有涉及

固定 Packager20.3.0 替换未用 Forge，PyInstaller6.22.3 onedir 冻结现有 core/runtime；成包固定内置后台与资源路径、缺文件可读错误。增加具名只读 native CI、完整 ZIP/许可/文件哈希与回归。Windows checkout 保持 Git 原字节。

增量基线 `3ce99f1cdd5f2f52c757ef61b696ecaade4877d0`；PR 自然继承未合入的任务04祖先，本包没有重写原结果。核心规则、独立预期、Session/worker业务、布局、旧模型及原CI保持只读。

## 怎样验证

- 用户最新反馈：“都没问题， macOS验收通过”。据此记录 Mac 常规人工流程（含断网步骤）PASS，依据为整体文字确认，未新增逐项计数或截图。[人工验收记录](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t05-a-packaging/docs/results/R02-T05-a/HUMAN-ACCEPTANCE.md)。
- 精确 tested_code_sha：`45dbf9c4e13e693b01736a79cb97652f760f8bad`；其后只提交 docs/results/R02-T05-a 的证据，不能用后续 PR head 冒充包 SHA。
- [原生CI两端通过](https://github.com/Kalopsiazza/DeiDei/actions/runs/34771885020)；核心174、runtime23（原21+新2）、独立192/469调用、工具8、桌面25（原22+新3）、`python scripts/check.py` 39通过+1原expected failure。两个Session占位仍NOT_RUN。
- 最终ZIP实际app启动、内置worker六指令、开发环境隔离、缺文件、每端5场及再开、分数DD/自动休整/中断恢复、10次退出回收、两种真实renderer视口与档案保留均通过。
- [完整报告](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t05-a-packaging/docs/results/R02-T05-a/REPORT.md)、[矩阵](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t05-a-packaging/docs/results/R02-T05-a/TEST-MATRIX.md)、[来源与清单](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t05-a-packaging/docs/results/R02-T05-a/MANIFEST.json)、[依赖审计](https://github.com/Kalopsiazza/DeiDei/blob/codex/r02-t05-a-packaging/docs/results/R02-T05-a/DEPENDENCIES.md)。

| 平台 | 内部 ZIP / 字节数 | SHA256 | 下载及到期时间（UTC） |
| --- | --- | --- | --- |
| darwin-arm64 | `DeiDei-R02-T05-a-macOS-arm64-45dbf9c.zip` / 139460469 | `00cf51f3571ac8d562d6d0409c6c2f6f28b308eedf77ccbfc925a969af873c64` | [Actions artifact](https://github.com/Kalopsiazza/DeiDei/actions/runs/34771885020/artifacts/10321614908)；2026-10-13T17:34:31Z |
| win32-x64 | `DeiDei-R02-T05-a-Windows-x64-45dbf9c.zip` / 168641592 | `6439fe9d2de06bc76641747bc9acbd51b1a933130f271031bbb8351e5aefd1f1` | [Actions artifact](https://github.com/Kalopsiazza/DeiDei/actions/runs/34771885020/artifacts/10322059034)；2026-10-13T17:34:43Z |

## 对现有内容的影响

- 游戏规则/招式编号/状态编码：不变。
- 模型/依赖：无模型进入包；只做附件指定的Packager/PyInstaller工具路线，其他直接前端版本不变。旧npm23告警逐项处理后新审计0，不宣称完整二进制零漏洞。
- 文档与第三方来源：规划附件只读，结果另列；官方Python/Electron/Chromium及bundled JS许可随包。

## 已知问题

Mac ad-hoc完整性通过，但CI Gatekeeper实际拒绝（退出3），未公证；Windows未签名。Windows普通用户只读安装、真人控制台/系统安全提示、物理屏幕、物理断网与无开发工具电脑未测。既有截图仍是原生CI真实应用renderer视口；Mac 本人后续验收采用文字确认，不把 CI 图片改称人工截图。未发布Release、未分发、未合入，停在提交验收。

## 提交者确认

- [x] 检查了相对固定input_sha的允许路径增量，无无关内容。
- [x] 实际失败、命令退出码、旧Session占位与人工缺项均保留，没有删测试或改预期消除失败。
- [x] 未提交运行包大文件、venv、node_modules、密钥、私人档案或短效凭据链接。
