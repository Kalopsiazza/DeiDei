# R05 原生分发与更新

当前入口为 `build.py` → electron-builder 26.17.0，生产运行依赖 electron-updater 6.8.10 / semver 7.8.5；Electron 44.3.0 的官方下载校验直接使用 @electron/get 5.1.0。全部精确版本和传递依赖位于 desktop npm lock。旧 Packager 已退出入口。固定 Python 3.11.16、uv 0.11.13、Node 24.12.0、npm 11.6.2。

保留 `DeiDei R02`、`cn.kalopsia.deidei.r02`、`DeiDeiR02` 与原默认 userData。旧 ZIP 没有 updater，首次需要手动安装新安装版。支持原生 macOS arm64 与 Windows x64，首版 asar=false。产出 DMG/ZIP/YAML 或完整离线 NSIS EXE/YAML，所有构建固定 publish=never。

在任务工作树根目录准备两个独立环境，不复用其他工作树的 venv：

```sh
uv python install --no-bin --python-downloads-json-url game/packaging/python-downloads.json 3.11.16
uv venv --python 3.11.16 game/packaging/.venv
uv pip sync --python game/packaging/.venv/bin/python --require-hashes game/packaging/requirements-darwin-arm64.lock
python3 game/packaging/prepare-ai-env.py
npm --prefix game/desktop ci
```

`prepare-ai-env.py` 将 AI 与冻结工具的两份 hash lock 合入 `game/packaging/ai-build/.venv`，不会修改 `game/ai/.venv`。Windows 使用对应 win32-x64 lock 和 Scripts/python.exe。Python 官方下载来源/摘要仍由 python-downloads.json 固定，uv 0.11.13 需要显式该下载表。

所有 game、CI 及图鉴编译输入 `docs/results/R04-T01-b/manual-content/content.json` 必须先保存为提交。构建验证指定 main 基线为祖先，记录实际 HEAD、输入逐文件摘要、平台/架构与 lock 摘要。默认是 production；没有 Developer ID/公证或 Windows 签名与 publisher 时明确失败。未配置 provider 的源码与 local-test 候选显示更新不支持。

```sh
# 可分享的本地候选；不能据此称已获系统信任。
game/packaging/.venv/bin/python game/packaging/build.py --mode local-test
# 维护者确认公开 GitHub Releases owner/repo 后，以独立 JSON 配置替换模板。
game/packaging/.venv/bin/python game/packaging/build.py --mode production --update-config /private/path/update-config.json
# 只输出确切上传清单、tag 与渠道；此脚本没有发布能力。
node game/packaging/publish-dry-run.cjs game/packaging/build/<actual-output>
```

stage 只纳入明确运行 CJS 目录及 UI_ASSETS 的完整两套牌面，检查所有 literal local require 闭包。stage 安装生产依赖，builder 不进入应用。固定冻结资源为 worker/ 与 ai-worker/；AI 只读 `_internal/model-manifest.json` 和 `_internal/model/latest.zip`。模型字节/hash 与保全 checkpoint 相符才加载。完整性脚本比较第一方文件、生产 node_modules 的锁定内容、两 worker 数据、模型、配置和许可证。builder 仅移除 Node package.json 的非运行元数据，该受限转换单独核验。任何生成候选都先跑真实冻结 core 指令及 AI CPU forward。

Mac 将全部冻结 Mach-O 路径显式交给 builder 嵌套签名，再签外 app；没有 worker 签名忽略规则。production 还验证 stapled ticket 与 Gatekeeper；Windows 对 installer 核验 Authenticode 与实际 publisher。签后不改应用。Mac ZIP 再展开到中文空格路径，比较所有文件、模式、符号链接，并重跑两个冻结 worker。许可证在 Resources/THIRD-PARTY，保留原署名。

每次输出至忽略的 `build/<platform>-<random>/`，失败日志保留；latest.json 只指向最后成功候选。release-manifest 分开记录源码、资源、冻结 worker、原生安装、生产信任及真人跨设备状态。`check-package.cjs` 的 GUI 自动化仅在临时 CI OS 账户运行，不能碰私人默认 profile，也不会放宽成包对 DEIDEI_TEST_DATA_DIR 的隔离。

发布清单只纳入当前版本/平台/架构的安装包、对应 blockmap 与已知 stable/beta feed；builder-debug.yml 留在构建目录，不进入清单或候选上传。`python3 game/packaging/check-input-guard.py` 和 `python3 game/packaging/check-artifact-whitelist.py` 可重跑源快照及实际文件白名单的小范围自检。

## 更新传输与原生安装

```sh
node --test game/desktop/updates/test.cjs
node game/desktop/updates/smoke-startup.cjs .local-outputs/R05-T01-a/update-startup-<new-run>
node game/packaging/check-update.cjs .local-outputs/R05-T01-a/update-transport-<new-run>
```

check-update 是独立无窗口 Electron，固定 synthetic appName/profile/cache、脚本自开的 loopback feed，并使用实际锁定 updater。检查真实下载、独立 SHA512/size 复核、损坏缓存重取、取消、迟到回复、beta/stable不降级、错误平台、禁止 stagingPercentage、不可信重定向、逐跳移除 staging header。此夹具的 payload 是传输字节，不是可安装 app；其结果不代表原生安装、生产签名或普通产品 GUI 验收。

原生 harness 另要求两个完整 fixture 工件、有效且相同的 designated requirement，以及严格独立 appId/名字/安装目录和合成默认 userData；macOS 可显式用 `--isolated-fixture` 在当前 OS 账户执行，CI 或独立测试 OS 账户也是可选隔离方式。每次使用新的 fixture 产品名/输出目录；它使用真实 app 默认 synthetic userData，不能只换 appId或注入生产 profile override。没有有效身份时原生替换记录 NOT_RUN；仍可用 `--transport-only` 跑完整工件的普通产品下载与普通退出/重开。

```sh
# N/N+1 使用相同独立名字与身份；固定 port 由 harness 持有。
game/packaging/.venv/bin/python game/packaging/build.py --mode fixture --fixture-url http://127.0.0.1:18742/ --fixture-name 'DeiDei Update Fixture R05-test-id' --fixture-version 0.5.0 --fixture-signing-identity '<effective test identity>'
# 对同一名字/身份构建更高版本 0.5.1，记录各自输出目录后运行。
DEIDEI_ISOLATED_TEST_ACCOUNT=1 node game/packaging/check-native-update.cjs --from <N-output> --next <N+1-output> --out .local-outputs/R05-T01-a/native-install-<new-id>
```

harness 检查普通 UI 下载后正常退出/重开仍是 N，再经“现在重启安装”与主菜单 nonce 流程取得 native 交接；只有目标文件版本变化、native 新进程、再启动的 app.getVersion/build-info 与原 synthetic profile/规则/隐私选择一致才记安装 PASS。safeStorage 可用时用独立合成能力验证跨替换解密。`--expect-native-failure` 与同一隔离目录的 `--resume` 支持坏签名 N+1失败→重开有效 N+2重试，避免同版本异 hash。

Windows installer 安装/替换 GUI、旧统计目的地删除与完整 collector 迁移仍有独立配置与设备前置条件；不能把上述版本替换检查当作这些层已经通过。不合并、不发布 Release、不改仓库可见性、不关闭系统防护。

没有证书时，对相同独立 fixture 名字构建 0.5.0 和 0.5.1，省略 `--fixture-signing-identity`，再执行：

```sh
node game/packaging/check-native-update.cjs --from <N-output> --next <N+1-output> --out .local-outputs/R05-T01-a/full-artifact-transport-<new-id> --transport-only --isolated-fixture
```

macOS 的 `--isolated-fixture` 明确表示在当前 OS 账户使用全新独立 appId/名字/安装目录与默认合成 userData，并不表示创建了新的 OS 账户；首次运行拒绝已存在的同名默认 userData、重用输出与任意开发 profile override；`--resume --isolated-fixture` 只接受先前写明身份/安装/默认档案路径的自有恢复目录。有效签名的 native 路线也接受同一严格隔离 gate。该模式验证两个完整工件、真实普通 main 下载、SHA512/size、普通退出/重开仍是 N、再检查缓存以及合成 profile/规则/隐私选择，不调用安装。原生替换仍为 NOT_RUN。

有有效测试证书后，构建可信 N、N+1 和更高的 N+2，以独立副本制造坏签名：

```sh
python3 game/packaging/prepare-bad-signature.py --from <signed-N+1-output> --out <new-bad-fixture-directory>
DEIDEI_ISOLATED_TEST_ACCOUNT=1 node game/packaging/check-native-update.cjs --from <signed-N-output> --next <bad-fixture-directory> --out .local-outputs/R05-T01-a/bad-then-valid-<new-id> --expect-native-failure
DEIDEI_ISOLATED_TEST_ACCOUNT=1 node game/packaging/check-native-update.cjs --from <signed-N-output> --next <signed-N+2-output> --out .local-outputs/R05-T01-a/bad-then-valid-<same-id> --resume
```

Mac 坏签名在 native 交接被拒；Windows updater 在下载时完成发布者核验，因此该负例记录下载发布者拒绝，native 为 NOT_RUN。有效 N+2 使用新的版本号以保留同版本异 hash 的拒绝规则。坏副本禁止上传。

`.github/workflows/r05-package.yml` 仅允许 workflow_dispatch，默认 production，显式选 local-test 才生成候选；固定 macOS arm64 / Windows x64、Actions SHA 与 uv/Node/Python 版本，不在 push 或 PR 自动跑重型打包，权限 contents:read。当前入口没有虚构的签名 secrets；production 未准备身份会失败。外部配置需求见 [EXTERNAL-REQUIREMENTS.md](EXTERNAL-REQUIREMENTS.md)。

在当前 macOS 账户验收真实冻结包 ML/UI，使用上述全新独立 fixture 名字生成完整工件后运行：

```sh
node game/packaging/check-frozen-ui.cjs --from <fixture-N-output> --out .local-outputs/R05-T01-a/frozen-ui-<new-id>
```

该外部 runner 验证独立 appId/名字与全新默认合成 userData，在中文空格只读安装副本、不同 cwd、无开发 Python/Node 的 PATH 下，用普通 main 真实选择旧模型、预热并完成对局；核对 model_turns/fallback_turns 和固定两 worker 子进程，另验缺 AI 路径拒绝。它会显示/操作一个窗口。结束后只删除本次标记的新合成 userData，以便随后完整 updater 夹具重新使用这份 N；不读取或清理正式 R02 数据。fixture npm name 由独立名字摘要生成，使 updater cache 也独立，manifest 记录 package_name。已成包 fixture 使用 builder 生成的 app-update.yml；只有独立非成包字节传输夹具使用 dev-app-update.yml。

中断构建的 app 诊断必须显式加 `--diagnostic --application <该构建的 packaged/mac-arm64/DeiDeiR02.app>`，从实际 app metadata 读取身份，报告标为 partial interrupted build，完整工件与原生安装均为 NOT_RUN；默认路线仍要求完整 release-manifest。
