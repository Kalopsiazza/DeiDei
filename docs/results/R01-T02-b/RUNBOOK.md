# R01-T02-b 运行与复测

本包只调用旧规则固定案例和 Easy，不代表新规则1.0引擎。Windows单独任务要求见 CHATGPT-HANDOFF.md，由 ChatGPT 正式签发；等待同学期间不阻挡第二轮。

## 获取包

本地包路径和SHA见manifest。远程构建与下载入口：[PR #10](https://github.com/Kalopsiazza/DeiDei/pull/10) 的 R01-T02-b packages 检查；选择成功 run 的对应平台 artifact，解压外层 artifact 后再解压应用ZIP。必须核对内部 package-manifest.json 的代码SHA、系统与ZIP SHA；artifact 计划保存14天，实际过期时间见本包manifest中回读值。失败／无artifact时不能把源码称为运行包。

macOS运行 `DeiDei R01 Tech B.app`；Windows将整个 `DeiDei R01 Tech B-win32-x64` 文件夹解压后运行其中exe，不能只取一个exe。运行包自带Python，不需玩家安装Python或Node；是否在无系统运行时机器通过仍须单独验证。未做正式签名／公证，系统阻止时记录原文并停止，不绕过安全保护。

## 本机复现

从完整仓库、指定代码提交开始（或该提交的源码归档，必须含根 deidei_env.py）。构建者需要Node24.12.0、npm11.6.2、uv0.11.13。

macOS ARM64：

```sh
cd experiments/r01-t02-b
uv venv --python 3.11.15 .venv
uv pip install --python .venv/bin/python -r requirements-build-macos-arm64.txt
npm ci
.venv/bin/python build-worker.py
.venv/bin/python test-worker.py
.venv/bin/python test-worker.py dist/worker/worker
npm test
npm run package
node smoke.cjs 'out/DeiDei R01 Tech B-darwin-arm64/DeiDei R01 Tech B.app/Contents/MacOS/DeiDei R01 Tech B' build/local-evidence
.venv/bin/python collect-package.py
cd ../..
python3 scripts/check.py
```

Windows PowerShell：

```powershell
cd experiments/r01-t02-b
uv venv --python 3.11.15 .venv
uv pip install --python .venv/Scripts/python.exe --require-hashes -r requirements-build-windows.txt
npm ci
.\.venv\Scripts\python.exe build-worker.py
.\.venv\Scripts\python.exe test-worker.py
.\.venv\Scripts\python.exe test-worker.py dist/worker/worker.exe
npm test
npm run package
.\.venv\Scripts\python.exe collect-package.py
cd ../..
py -3.11 scripts/check.py
```

精确旧代码缺陷复现来源：附件 `docs/reviews/evidence/R01-T02-a/probe-worker-generation.cjs`。对 `git show 5421e905834eef3a84c74199998b14f72807fef9:experiments/r01-t02-a/bridge.cjs` 保存的临时文件运行该探针，要求blob=3baf3bf1ca2eb5c846dbf39f53b59db1ee5da57f；本次输出在old-generation-reproduction.json。新回归 `test-generation.cjs` 不依赖附件，可单独运行 `node --test test-generation.cjs`，其中真实超时会等10秒。

## 分发包实机步骤

1. 退出所有本实验进程、关闭开发服务。解压到中文空格目录，如 `得得 验证 b`。普通双击启动，核对标题、R01-T02-b标记、6席位及3张素材。
2. Health应ready。四案例依次Continue、PlayerWin、Continue、PlayerWin。seed42重复Easy应相同并标明Easy heuristic。
3. 只用测试昵称写档案，退出重开读取，应保留localId、昵称；应用数据独立于a包（deidei-r01-tech-b/r01-t02-b-test）。非法昵称／seed应可见失败，停止worker后Health应恢复。
4. 连续10次启动/操作/退出。记录本程序及worker PID，核查关闭后消失。自动smoke可辅助，但Windows版不会自动确认workerReaped，该字段为null，必须另查。
5. **断网由测试者本人操作**：先退出，再亲自断开Wi-Fi/以太网，重开分发包并重做素材、档案、规则、AI。远程助手不自行切断连接。完成后恢复原网络，记录时间与网络状态截图。
6. 无系统Python/Node、正常用户权限、系统安全提示分别测试；限制PATH和CI不能代替干净实机。不改私人文件、不关闭防护，不加载不可信模型。

记录PASS/FAIL/NOT_RUN及失败证据，分别区分CI、自动窗口、真人观察。Mac物理断网/真人观察也未自动视为通过。完整同学工作范围见CHATGPT-HANDOFF，不仅上述点击步骤。
