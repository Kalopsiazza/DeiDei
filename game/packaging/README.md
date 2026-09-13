# R02-T05-a 原生测试包

固定 Python 3.11.16、uv 0.11.13、Node 24.12.0、npm 11.6.2。桌面原依赖仅将 Forge 换为 Packager 20.3.0，Python 工具按本目录两端 hash lock 安装。原规则、会话、随机策略和资料字节保持不变。

在独立功能工作树根目录执行；所有产品及 CI 文件必须先提交，构建记录实际 HEAD。仅支持原生 macOS arm64 / Windows x64。示例为 macOS：

```sh
uv python install --no-bin --python-downloads-json-url game/packaging/python-downloads.json 3.11.16
uv venv --python 3.11.16 game/packaging/.venv
uv pip sync --python game/packaging/.venv/bin/python --require-hashes game/packaging/requirements-darwin-arm64.lock
npm --prefix game/desktop ci
game/packaging/.venv/bin/python game/packaging/build.py
```

Windows 使用 `.venv/Scripts/python.exe` 和 `requirements-win32-x64.lock`。venv 应为空环境创建，不复用个人环境。激活该专用 venv 后也可在 `game/desktop` 运行 `npm run package`。

uv 0.11.13 的内置下载表不含 3.11.16，因此使用该版本已支持的下载表参数。`python-downloads.json` 取自 Astral uv 官方提交 `c0df400a4cf4aad88f7f34bb2ac3ebb5a8f3839e` 的平台记录；归档为官方 python-build-standalone 20260901，两端 SHA256 与 GitHub release asset digest 核对。没有更换工具或忽略 TLS/下载校验。

脚本执行风险检查、源码回归、onedir worker 冻结、独立六指令烟测、白名单 stage、Packager、架构和签名检查、完整 ZIP、重新展开与逐文件核验。每次输出到本目录忽略的 `build/<平台>-<随机后缀>/`，保留失败证据；`build/latest.json` 只指向最近成功构建。若需清理，仅删除明确选择的本任务 build 子目录，不删除其他工作树或缓存。

`check-package.cjs` 只在临时 GitHub CI 系统账户运行，启动最终 ZIP 的真实应用；它不会放宽成包忽略 `DEIDEI_TEST_DATA_DIR` 的保护。在个人电脑上应人工打开测试包，或使用独立测试 OS 账户。自动化只对临时 CI 源码副本做暂时隔离，结束时恢复。

签名后不再修改应用内容。Mac ad-hoc 完整性与 Gatekeeper 信任分开报告；Windows 未签名。旁置许可证与玩家说明在 ZIP 内，最终包 hash、各验证层级及 build-info 摘要位于 ZIP 外的 delivery-manifest。Actions candidate 仅在构建及成包自动化成功后上传；失败只保留证据。

未覆盖的真人电脑、物理断网和系统安全提示见使用说明及 `docs/results/R02-T05-a/`。不发布 Release，不提供关闭系统防护的命令。
