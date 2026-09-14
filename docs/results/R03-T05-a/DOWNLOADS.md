# R03-T05-a 内部诊断包下载

仅供诊断。产品为有已知缺陷的基线8a6f8b29f517ab4c5a16466f0894e86995f8a852，工具fabcb1d8438f05988d8eb64ac58ca0862ee92fb0。macOS这组实际成包旅程通过；Windows时限检查失败。未取得T04修订候选，不标为正式联机版。

[原生CI](https://github.com/Kalopsiazza/DeiDei/actions/runs/34875308825)。需Actions下载权限。两份外层artifact已实际下载，外层SHA、内层ZIP、build-info和每个清单条目均核验；权限和架构由对应native runner验证，macOS下载副本又做了一遍原生核验。

| 平台 | 内部artifact | 过期时间（UTC） | 状态 |
|---|---|---|---|
| windows | [下载 #10361275991](https://github.com/Kalopsiazza/DeiDei/actions/runs/34875308825/artifacts/10361275991) | 2026-10-14T17:33:48Z | FAIL |
| macos | [下载 #10360039450](https://github.com/Kalopsiazza/DeiDei/actions/runs/34875308825/artifacts/10360039450) | 2026-10-14T17:34:12Z | DIAGNOSTIC_BASELINE_AUTOMATION_PASS |

## windows

- 外层SHA256：`cb129fb1864bee28c49c77f4dd6bfe8c9a038fd67fa364e1a2f87a13f0bdc40e`；178427589 bytes。
- 内层：`DeiDei-R03-T05-a-DIAGNOSTIC_BASELINE-win32-x64-8a6f8b2.zip`。
- 内层SHA256：`a3552533f5c299ae69adcb868d477c42eb0e7770ee87283d258906a1dcff6b16`；178843667 bytes。
- 逐项验证250个清单条目。

## macos

- 外层SHA256：`ec34b265a17b1a0e8b9a8b323977df9878313b18d516e52994c13aac75fa6b28`；149268378 bytes。
- 内层：`DeiDei-R03-T05-a-DIAGNOSTIC_BASELINE-darwin-arm64-8a6f8b2.zip`。
- 内层SHA256：`364d1777f6527819e0521f13d0a4e259d5b23a0511cd7a554d80863825c23b47`；149937221 bytes。
- 逐项验证341个清单条目。

## 使用

下载并解压外层artifact，再展开里面的DeiDei ZIP。macOS用Archive Utility或ditto，保留符号链接、可执行位和中文文件名；Windows用系统解压。保留room-server和THIRD-PARTY，按内含使用说明先启动loopback服务，再通过DEIDEI_ROOM_URL启动客户端。具体命令见game/packaging_r03/PLAYER-README.txt，无需系统Python。

Mac用`shasum -a 256 <zip>`、Windows用`Get-FileHash <zip> -Algorithm SHA256`核对两层hash。macOS为ad-hoc/未公证，Windows未签名；不关闭系统防护。本机另存初次mac构建（packaging 2e2007a），以mac-local-delivery.json单独对应，不能混用CIhash。

已下载原件位于当前用户Downloads/DeiDei-R03-T05-a-native目录；二进制不入Git。下载校验第一次直接用Python ZipFile查找mac中文文件名未匹配，改用构建时相同的ditto原生解压后完整通过；产物未修改。

## 候选到达后的下一命令

`python3 game/packaging_r03/candidate.py --refresh --output game/packaging_r03/candidate-input.json`

仅在得到CANDIDATE后提交该固定输入，从source_sha新建干净只读检出，再运行`game/packaging_r03/.venv/bin/python game/packaging_r03/build.py --source <该检出> --output <新目录>`；Windows改Scripts/python.exe。真实GUI由一次性CI账户执行，不在私人默认档案下伪造GITHUB_ACTIONS绕过保护。
