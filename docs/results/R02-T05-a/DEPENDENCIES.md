# R02-T05-a 依赖与风险记录

检查时间：2026-09-14（Asia/Shanghai）。产品输入 3ce99f1cdd5f2f52c757ef61b696ecaade4877d0。此页是本次查询和适用性分析，不是应用安全保证。

## 固定版本与实际来源

Electron 44.3.0、React / React DOM 19.3.0、TypeScript 7.0.2、esbuild 0.28.2、playwright-core 1.63.0、@types/react / react-dom 19.3.0 原样保留。只将 Forge CLI 7.11.2 换成直接依赖 Packager 20.3.0；原转依赖 Packager 18.4.4 同时退出。未删除 lock 从头追最新版、未执行 audit fix 或加 overrides。

构建 Node 24.12.0、npm 11.6.2、uv 0.11.13、Python 3.11.16。Python 干净专用 venv：PyInstaller 6.22.3、hooks 2026.7、altgraph 0.17.5、packaging 26.3、setuptools 84.0.0；Mac macholib 1.16.4；Windows pefile 2024.8.26、pywin32-ctypes 0.2.3。安装使用实际生成的两端 hash lock，uv pip check 通过；每次原生构建再次核对完整清单。

uv 0.11.13 内置表没有 3.11.16，初次获取退出 2。没有换版本，而是使用该固定 uv 已支持的 `--python-downloads-json-url`；两个平台记录与官方 uv 提交 c0df400a4cf4aad88f7f34bb2ac3ebb5a8f3839e 的 download-metadata.json 逐字段核对。归档来自官方 python-build-standalone 20260901，SHA256 与 GitHub asset digest 核对：Mac 768f05cf200273bbdda9a5955a5a6892a4b22f2a0b1e4b0a9160f5c7fce86816；Windows 06cbe479e039f5b9cb5640c286d790074d63f549f92a32d599a3748293bd4510。[uv 官方参数说明](https://docs.astral.sh/uv/reference/cli/)、[官方 Python 归档](https://github.com/astral-sh/python-build-standalone/releases/tag/20260901)。

本机系统 Python urllib 的证书验证曾失败；没有关闭验证，改用正常 TLS 的 gh API 取得官方元数据。专用 Python 3.11.16 查询 PyPI HTTPS 正常。Electron 下载强制官方地址、校验官方 SHASUMS256，缓存同样复核；各端实际归档值见原生 evidence/electron-download.json。

## npm 告警的实际去向

基线新查 23 项：low 3、high 19、critical 1，npm audit 退出 1。首次复用 node_modules 软链接的 npm ls 退出 1（extraneous），它只是失败诊断；随后本工作树单独 npm ci，完整基线树退出 0。替换工具后的全树与运行依赖 audit 均退出 0、告警计数均 0；npm ls 退出 0。原始 JSON / explain 与逐项映射见 security/。

| 包 | 旧严重度 | 当前结果 |
| --- | --- | --- |
| @electron-forge/cli | high | 随 Forge 链移除 |
| @electron-forge/core | high | 随 Forge 链移除 |
| @electron-forge/core-utils | high | 随 Forge 链移除 |
| @electron-forge/maker-base | high | 随 Forge 链移除 |
| @electron-forge/plugin-base | high | 随 Forge 链移除 |
| @electron-forge/publisher-base | high | 随 Forge 链移除 |
| @electron-forge/shared-types | high | 随 Forge 链移除 |
| @electron-forge/template-base | high | 随 Forge 链移除 |
| @electron-forge/template-vite | high | 随 Forge 链移除 |
| @electron-forge/template-vite-typescript | high | 随 Forge 链移除 |
| @electron-forge/template-webpack | high | 随 Forge 链移除 |
| @electron-forge/template-webpack-typescript | high | 随 Forge 链移除 |
| @electron/node-gyp | high | 随 Forge 链移除 |
| @electron/packager | high | 20.3.0；原受影响的间接链退出，当前审计无该告警 |
| @electron/rebuild | high | 随 Forge 链移除 |
| @inquirer/editor | low | 随 Forge 链移除 |
| @inquirer/prompts | low | 随 Forge 链移除 |
| cacache | high | 随 Forge 链移除 |
| external-editor | low | 随 Forge 链移除 |
| extract-zip | high | 随 Forge 链移除 |
| make-fetch-happen | high | 随 Forge 链移除 |
| tar | critical | 随 Forge 链移除 |
| tmp | high | 随 Forge 链移除 |

旧 tar 6.2.1、tmp 0.0.33、extract-zip 2.0.1 全部退出。@electron/get 从 Forge 路线的 3.1.0 退出；保留 Electron 自用和 Packager 各自解析的 5.1.0。官方 @electron-internal/extract-zip 1.0.5 原已由 Electron 使用，新 Packager 也用该链，并非仅重命名消除告警；真实 npm explain 见 security/npm-explain-archives.json。22 条移除、1 条 Packager 更换及间接链修复均有完整 lock 可核对。

## 上游公告适用性

核对 [Electron 44.3.0 发布说明](https://releases.electronjs.org/release/v44.3.0)、[Packager 20.3.0 发布说明](https://github.com/electron/packager/releases/tag/v20.3.0)、[PyInstaller 6.22.3 变更记录](https://pyinstaller.org/en/stable/CHANGES.html) 及公开安全公告。保存 Electron 61 条、Packager 1 条、PyInstaller 4 条元数据，不复制整段公告正文。

Electron 44.3.0 的 npm advisory 版本范围逐项以已安装 semver 计算。两项单独解释：

- [GHSA-vv43-5jgx-7qv8](https://github.com/electron/electron/security/advisories/GHSA-vv43-5jgx-7qv8) 的一条范围没有上限，机械比较会命中。公告明确限定 macOS 的 Squirrel 自动更新；本项目无 autoUpdater / Squirrel 更新调用、无特权更新流程，因此本次用法不受影响。没有自行改写上游范围或把该行删除。
- [GHSA-2hfc-r8fq-92h7](https://github.com/electron/electron/security/advisories/GHSA-2hfc-r8fq-92h7) 的 package 为 Electron 仓库的 issue workflow，版本是 git 提交，不是应用运行时 semver。本项目不使用该工作流。

其余 Electron 版本范围未命中 44.3.0。Packager [GHSA-34h3-8mw4-qw57](https://github.com/electron/packager/security/advisories/GHSA-34h3-8mw4-qw57) 影响 18.3.0，20.3.0 不在范围内。PyInstaller 4 条公告的修复版本均早于 6.22.3；最近的 [GHSA-9fxf-4qw3-ghmr](https://github.com/pyinstaller/pyinstaller/security/advisories/GHSA-9fxf-4qw3-ghmr) 已在 6.22.1 修复，本包采用 onedir / 普通权限，不改成 onefile。

八个固定 Python 工具的 PyPI 精确版本 JSON 中 vulnerabilities 均为空，uv pip check 无冲突；这是公开元数据检查，未运行全二进制 CVE 扫描，不能写 Python 或整个应用“零漏洞”。风险条件通过只指未发现影响本次构建用法的未修高/严重项，每个原生任务还会重新检查 npm/PyPI；新增公告时停止受影响步骤。

## 许可证与签名

最终 ZIP 保留 Electron LICENSE、Chromium LICENSES.chromium.html、Python LICENSE、PyInstaller bootloader 许可及实际打入页面的 React/React DOM/scheduler 许可。Python 静态库及扩展的补充许可证从同版 20260901 原生 full 归档提取，保守保留其完整 notices 集合；没有增加对应可选运行库。两端归档 SHA256、来源和逐文件校验见 game/packaging/licenses/SOURCES.json。开发打包工具本身不随应用，旧模型、私有档案和字体不加入。没有为原项目授予新许可证。

PyInstaller 使用默认 ad-hoc：源码确认显式 identity 会启用 hardened runtime，初次本机因 Team ID 库校验失败，已经保留失败日志并移除此配置；未关闭系统库校验。Packager 使用 `identity: '-'`、`identityValidation: false`，不查商业身份、无公证；其 optionsForFile 关闭 hardened runtime 是本应用的 ad-hoc 签名配置，不是关闭系统 Gatekeeper。冻结 worker 的默认签名保留，签名后不再修改 app 内容。

codesign 完整性结果与 Gatekeeper 分列。当前本机 spctl 的 exit 0 含 `override=security disabled`，不能当系统信任通过；没有修改这项既有系统状态。Windows 未签名，CI 无控制台子进程证据不等于真人的 Defender / 发布者提示已检查。
