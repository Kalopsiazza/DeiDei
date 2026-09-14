# R03-T05-a 原生诊断构建

产品只读，工具来自本任务提交。`candidate-input.json` 固定产品 SHA；没有 T04 合法回执时保留 `DIAGNOSTIC_BASELINE`。不修改旧 R02 打包路径、产品目录、npm 依赖或 CLI。不自动合入、部署或发布 Release。

## 环境与构建

只在 macOS arm64 或 Windows x64 原生执行。沿 R02 固定 Python 3.11.16、PyInstaller 6.22.3、Electron 44.3.0、Packager 20.3.0、Node 24.12.0、npm 11.6.2、uv 0.11.13。两个平台 hash lock 原样继承 R02 条目并拼入现有 websockets 17.0.1 锁；安装至本目录专用 `.venv`。

```sh
uv python install --no-bin --python-downloads-json-url game/packaging/python-downloads.json 3.11.16
uv venv --python 3.11.16 game/packaging_r03/.venv
uv pip sync --python game/packaging_r03/.venv/bin/python --require-hashes game/packaging_r03/requirements-darwin-arm64.lock
python3 -m unittest discover -s game/packaging_r03 -p test_tools.py -v
# 先提交本任务工具。--source 是准确产品SHA的干净只读检出；--output 必须为检出外的新目录。
game/packaging_r03/.venv/bin/python game/packaging_r03/build.py --source /path/to/fixed-product --output /path/to/new-diagnostic
R03_PYTHON="$PWD/game/packaging_r03/.venv/bin/python" node game/packaging_r03/check-package.cjs /path/to/new-diagnostic --headless
```

Windows 使用 `.venv/Scripts/python.exe` 和 `requirements-win32-x64.lock`。构建从 Git archive 创建专用临时源，npm ci/build 只写临时源，原 --source 不写。包内无系统 Python 依赖。构建时重查 PyPI 公告和 npm audit；审计不可用或未处理高/严重项中止构建交付，不执行 audit fix。

## 精确 stage 和来源

`verify.STAGE` 是客户端允许文件清单：旧运行 CJS、build/fixture.cjs、三个 UI 文件，另加 online/network-room-port.cjs、online/wire.cjs、catalog.json；附精简 package.json 与 build-info.json。`main` 的本地 require 链逐项核验。fixture bundle 是产品现存依赖，tests-online/fake 不入包。

worker 为 PyInstaller onedir，含同版 core/runtime、catalog、entry-map；独立 room-server onedir 的入口只调用既有 CLI，含 core/server/websockets。两者附相同 build-info（产品 source_sha、工具 packaging_sha、tree、lock 和 stage hash）。server 测试入口不打包，不添加网络诊断指令。

Electron/Chromium、Python、Python 内嵌运行库、React/React DOM/scheduler、PyInstaller 和 websockets 的许可置于 THIRD-PARTY；原游戏不新增许可证。Python 运行库许可清单与下载映射只读复用旧打包目录，构建验证已有 hash。

最终 ZIP 在中文空格目录重新展开，核验外层SHA、内层逐文件清单、符号链接/可执行位、架构、许可、两个 build-info 一致和资源 hash。`--headless` 只证明最终冻结服务启动和真实 hello；GUI 驱动只允许一次性 GitHub CI 账户，拒绝默认档案非空。不会伪造 GITHUB_ACTIONS 或改私人账户环境绕过保护。

## 候选与 CI

在本批三个固定查看点之一运行：

```sh
python3 game/packaging_r03/candidate.py --refresh --output game/packaging_r03/candidate-input.json
```

仅访问 origin 的具名 T04 分支。缺候选只打印 NO_CANDIDATE，不改变输入。候选须符合正式 schema、code_sha 先于回执提交、固定 base 后代、T04允许路径、core/runtime树、npm锁及依赖声明/server锁不变。回执不执行任意命令/URL。输入更新后需提交再构建。

具名 workflow 仅本任务同仓库 PR→integration/r03-live 或本分支 workflow_dispatch，contents:read，固定 action SHA，matrix fail-fast=false，45分钟上限。两个 runner 从事件提交读取工具，从提交内 candidate-input 读取精确产品，分别构建并对最终ZIP使用真实成包Electron、冻结服务和正常协议peer。每平台5场、10次启动退出、时限/普通移除/房主离开/服务重启、离线回归，截图区分真实包与工具模拟。失败保留证据；基线即使通过这段旅程也不掩盖已知N33/N36/N48失败。没有native GUI运行不记PACKAGED_AUTOMATION_PASS。

每平台最多初次构建加两次有实质修复的重试。内部 Actions artifact 保留30天，下载信息由本任务结果记录；不是正式 Release 或异地联机版。
