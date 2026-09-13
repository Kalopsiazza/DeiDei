# R02-T05-a 提交验收报告

结论：**PARTIAL**。Windows x64 与 macOS arm64 已生成原生包，两端均为 SOURCE_PASS / BUILT / PACKAGED_AUTOMATION_PASS。真人电脑、物理断网、无开发工具电脑没有验收。Mac ad-hoc 完整性通过，Gatekeeper 实际拒绝；Windows 未签名。本包停在提交验收，待 ChatGPT/维护者决定下一步。

## 来源与提交边界

- 产品 input_sha：`3ce99f1cdd5f2f52c757ef61b696ecaade4877d0`，继承 PR #18 的任务04-b结果。
- 精确 tested_code_sha：`45dbf9c4e13e693b01736a79cb97652f760f8bad`。最终两端运行包和 CI 均来自此提交。
- 规划：附件 v1.0，plan_sha = null；PLAN-MANIFEST.json SHA256 = `84f621cc6a20739c6836a83bb5133659c8fbbcdebaef585a69033aa86fd498fc`。历史 context_plan_sha 不是本包规划提交。10 项清单逐项核对，规划只读、未复制到结果。
- 独立 worktree 分支 `codex/r02-t05-a-packaging`；原工作树仍为干净的 `codex/github-maintainer-results`，没有覆盖。
- [PR #19](https://github.com/Kalopsiazza/DeiDei/pull/19) → integration/r02。本包增量以 input_sha 比较；PR 的全量可能自然包含未合入的04-a/04-b祖先，原结果没有重写。tested_code_sha 后只提交本包证据，PR head 与成包代码 SHA 分别记录。

## 交付包

| 平台 | 内部 ZIP / 字节数 | SHA256 | 下载及到期时间（UTC） |
| --- | --- | --- | --- |
| darwin-arm64 | `DeiDei-R02-T05-a-macOS-arm64-45dbf9c.zip` / 139460469 | `00cf51f3571ac8d562d6d0409c6c2f6f28b308eedf77ccbfc925a969af873c64` | [Actions artifact](https://github.com/Kalopsiazza/DeiDei/actions/runs/34771885020/artifacts/10321614908)；2026-10-13T17:34:31Z |
| win32-x64 | `DeiDei-R02-T05-a-Windows-x64-45dbf9c.zip` / 168641592 | `6439fe9d2de06bc76641747bc9acbd51b1a933130f271031bbb8351e5aefd1f1` | [Actions artifact](https://github.com/Kalopsiazza/DeiDei/actions/runs/34771885020/artifacts/10322059034)；2026-10-13T17:34:43Z |

Artifact 是 GitHub Actions 测试产物，需有仓库访问权限，按实际到期时间保留；没有创建 Release。链接指向稳定 artifact 页面，不含带凭据短效 URL。下载后还需解开内部 ZIP：Mac 打开完整 .app，Windows 保持完整文件夹并打开 DeiDeiR02.exe，不能只复制 exe。包内 PLAYER-README 与 THIRD-PARTY 可离线读取；[离线步骤副本](OFFLINE-CHECKLIST.txt)。

外层 artifact 与内部 ZIP 是不同校验对象；两层 digest、大小和包内 build-info 分别核对，见 [download-verification.json](download-verification.json)。内部逐文件 SHA、链接和权限清单在各平台 evidence/file-manifest.json。最终 Mac 下载包还在本机用原生 ditto 再次展开，codesign 和真实内置 worker 六指令通过；见 download-macos-native-verification.json，未打开私人 GUI 档案。

## 实现与安全

Forge 7.11.2 改为 Packager 20.3.0，Electron 44.3.0 及其他直接前端版本保持不变。PyInstaller 6.22.3 onedir 随包携带固定 Python 3.11.16 与 core/runtime。成包路径只用 resources 内置后台和资源；源码启动仍沿用开发路径，缺文件给出 PACKAGE_INCOMPLETE。Windows spawn 仅增加 windowsHide。无 Session/solo/opponent/worker 业务或摘要规则改动。

新增 native CI 仅同仓库具名分支到 integration/r02 的 PR 运行，固定 action SHA，contents:read、无部署/发布密钥、checkout 不保存凭据。每端使用独立输出和 Python/Node 工具环境。Windows runner checkout 禁止 CRLF 自动转换；catalog、entry-map、npm/Python lock 都与指定 Git blob 原字节比对，避免“相同 SHA、不同工作区资源字节”。

旧 npm 审计 23 项（high 19、critical 1、low 3）；移除 Forge 链并重新解析指定 Packager 后全树与运行依赖审计均为 0。原告警逐项去向、完整树、PyPI/上游公告适用性及检查深度见 [DEPENDENCIES.md](DEPENDENCIES.md)。没有 audit fix --force、版本替换或隐藏未处理的高/严重项；公开元数据检查不代表整个二进制零漏洞。官方 Python notices、Electron/Chromium 与实际 bundled JS 许可随包保留，不给原项目另授许可证。

## 验证与真实窗口

[最终原生 CI](https://github.com/Kalopsiazza/DeiDei/actions/runs/34771885020) 两个 job 均成功；具体环境、lock hash、构建版本及全部命令/退出码见 [MANIFEST](MANIFEST.json)、[COMMANDS](COMMANDS.json)。核心174、runtime原21+新2、独立192/469调用、工具8、桌面原22+新3及根39+原expected-failure1全部保持。两个既有 Session 占位继续 NOT_RUN。

两端最终 ZIP 重新展开，真实 app.isPackaged=true；内置 worker 六种 JSONL 指令、开发环境不可达、中文空格路径、缺后台/资料副本、10次开关与后台回收、至少5场真实随机对局及再开均通过。实际观察分数 DD、曾义自动休整、worker中断错误与恢复；没有在生产包加入种子、任意exec或set_state。

截图来自各原生 runner 上最终应用的真实 Electron renderer，不是单元测试拼图，也不称为真人笔记本截图。1366×768 和 1920×1080 是开发视口，DPR1；33张牌三排可读，昵称和设置跨重启保存。各平台截图、对局摘要及运行上下文见 native-ci/<platform>/evidence/packaged-automation.json。

- [Mac 1366视口](native-ci/darwin-arm64/evidence/packaged-1366x768.png) / [分数DD](native-ci/darwin-arm64/evidence/packaged-fraction.png)
- [Windows 1366视口](native-ci/win32-x64/evidence/packaged-1366x768.png) / [分数DD](native-ci/win32-x64/evidence/packaged-fraction.png)

本机 macOS 27 arm64 的较早 `8d23cb1` 原生构建、冻结后台与解压后签名完整性亦通过，保留独立 local-macos 证据；它不是最终两端候选。为避免触碰私人默认档案，本机 GUI 未执行。实际 GUI 测试使用一次性 CI 系统账户，未改变产品档案目录或放开成包测试档案变量。

## 未完成的验收与限制

[P01—P18逐项矩阵](TEST-MATRIX.md) 保留所有未测/失败项。Mac CI 非特权 uid501 的只读程序目录写正常 userData 通过；Windows CI 权限不能证明普通用户只读安装，P10相应项未测。Windows原生CI是Server2022，不代表同学的Windows11笔记本。

Mac codesign verify 退出0；CI spctl assess 退出3、rejected，P16记FAIL。未公证、未用商业证书。当前本机 spctl 的 override=security disabled 是既有环境状态，不算信任通过；本任务没有改系统防护。Windows 发布者/Defender提示和真人控制台观察未测。遇到系统阻止应保留提示交回维护者，不关闭防护、不管理员运行。

物理断网由本人操作，本轮没有操作；旧档案断网冷启动/三场/再开、新档案离线首启、无开发工具干净机与物理屏幕均 NOT_RUN。已保存人工复测步骤，不等待 Windows 同学、不将模拟隔离冒充这些证据。未合入、未关旧PR、未分发给玩家、未发布或启动下一包。

## 审查材料

[范围增量](scope-check.json)、[中间失败与修复](FAILURES.md)、[依赖说明](DEPENDENCIES.md)、[提交回读](PR-SUBMISSION.json)。最终可执行源与CI只有获准路径，规则/独立预期/catalog内容/旧CI/模型/其他结果没有变更。源码变更与证据提交分离，证据清单排除自引用文件自身。Kimi 未调用，遵循此前暂停要求。

`git diff --check input_sha tested_code_sha` 退出2，提示仅来自保留原字节的官方许可证（CRLF/尾空行）；不改写上游原文消除提示。排除该原文目录后的应用/构建代码检查退出0，详见 whitespace-check.json。

证据暂存检查同样退出2，提示来自原样保存的Windows CRLF build-info与执行日志；为使build-info原字节hash对应ZIP而保留，详见 whitespace-check.json 的 evidence_staging。报告和应用代码本身无该空白问题。
