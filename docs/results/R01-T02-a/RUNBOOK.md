# R01-T02-a｜复测步骤

本包是独立验证程序，非游戏、非正式安装版。源码提交 `6187c2366f3be282db0d6bad73dd025c27224a87`，输入 `plan/r01-v1` = `aeabaf681197eb110da919e310ad1f4833433bba`。源码 ZIP 包含完整冻结仓库及实验；从 ZIP 解压目录开始。不要只复制实验目录而漏掉原规则。

## macOS 测试者（不需要 Python / Node）

1. 获取 manifest 中 macOS ARM64 ZIP，核对 `shasum -a 256 <ZIP>`。解压到有中文及空格的目录，例如 `桌面/得得 测试/`。
2. 关闭已运行的实验窗口，关闭所有开发服务。双击 `DeiDei R01 Tech.app`。当前无 Developer ID 签名／公证；若系统阻止，记录原文并停止，不关闭 Gatekeeper，不删除 quarantine。
3. 检查六个席位、三张测试卡图。点击 Health，应显示 `ready`。档案只写系统用户应用数据下 `deidei-r01-tech/r01-t02-a-test/profile.json`；macOS 通常在 `~/Library/Application Support/` 下。无个人资料要求，只用测试昵称。
4. 写入测试昵称，退出重开、读取，应保持 localId 与昵称；四案例依次预期 Continue、PlayerWin、Continue、PlayerWin。结果属于旧代码事实。
5. Easy seed=42 重复请求应返回相同招式并显示 `Easy heuristic`。空昵称写入应失败；读取原档案仍应成功。停止 worker 后点 Health 应可重新启动。
6. **真正离线检查**：先完整退出程序，再断开 Wi-Fi、以太网等网络，保持开发服务关闭，然后第一次从分发路径重开。重做素材／档案／四案例／Easy，记录系统网络状态、时间、截图及错误。结束恢复原网络。这一步本次未执行，不能用 renderer 禁网或限制 PATH 替代。
7. 连续十次开窗 → Health → Easy → 关闭窗口；用活动监视器观察本实验 worker 退出，不误杀其他 Python。记录每次 PID／退出及异常。人工结果独立于自动化结果。

## 构建者：macOS ARM64

构建机需要 Node 24.12.0、npm 11.6.2、Python 3.11.15（可用 uv 获取）。从完整源码根目录执行：

```sh
cd experiments/r01-t02-a
uv venv --python 3.11.15 .venv
uv pip install --python .venv/bin/python -r requirements-build-macos-arm64.txt
npm ci
.venv/bin/python build-worker.py
.venv/bin/python test-worker.py
.venv/bin/python test-worker.py dist/worker/worker
npm test
npm run package
node smoke.cjs 'out/DeiDei R01 Tech-darwin-arm64/DeiDei R01 Tech.app/Contents/MacOS/DeiDei R01 Tech' build/local-evidence
cd ../..
python3 scripts/check.py
```

`build-worker.py` 在构建目录拷贝原 `deidei_env.py`，记录 SHA-256，PyInstaller onedir 输出到 dist/worker；不生成可编辑的第二套规则。Forge 打包应用与 worker，程序不调用系统 Python／Node。`smoke.cjs` 启动真实窗口但属于自动化，有调试连接，不能替代普通双击、断网、真人验收。内存是进程采样，不是持续峰值。

macOS CPU 模型检查（只在隔离开发环境，不放进轻量运行包）：

```sh
cd experiments/r01-t02-a
uv venv --python 3.11.15 .model-venv
uv pip install --python .model-venv/bin/python -r requirements-model-macos-arm64.txt
.model-venv/bin/python model-probe.py
```

脚本加载仓库既有 latest.zip，调用实际模型的 CPU predict，异常立即失败；不加载 opponent_pool.pkl、不把随机回退算通过。脚本的 RSS 采集使用 macOS resource 口径，未适配 Windows。测试只覆盖四个固定公开状态，不证明专家完整策略或强度。

## Windows 构建者及测试者（本次 NOT_RUN）

没有可访问 Windows 实机，本次无 Windows 二进制。先把源码 ZIP 交给 Windows 构建者；**不要把源码 ZIP 当成免环境运行包**。下列依赖清单是在 Mac 上解析 Windows 平台依赖得到的，未证明 Windows 安装／构建成功。

在 Windows 原生桌面、记录 OS/CPU 后，用 Node 24.12.0、npm 11.6.2、uv 与 Python 3.11.15，从完整源码根目录 PowerShell 执行：

```powershell
cd experiments/r01-t02-a
uv venv --python 3.11.15 .venv
uv pip install --python .venv/Scripts/python.exe --require-hashes -r requirements-build-windows.txt
npm ci
.\.venv\Scripts\python.exe build-worker.py
.\.venv\Scripts\python.exe test-worker.py
.\.venv\Scripts\python.exe test-worker.py dist\worker\worker.exe
npm test
npm run package
```

检查实际 `out/DeiDei R01 Tech-win32-<arch>/`，把**整个文件夹**压成 ZIP，不能只发 exe。记录文件字节数与 `Get-FileHash -Algorithm SHA256`。构建失败保存退出码与日志，不自行更换架构或跳过安全校验。

将 ZIP 交到无 Python／Node 的 Windows 测试机，解压到 `桌面\得得 测试\` 后按前述 1—7 操作。用任务管理器核对 worker.exe 退出。Windows 的自动脚本可运行，但其 workerReaped 为 null，必须另做进程回收人工检查。填写 REPORT 同款矩阵：build、普通双击 launch、物理 offline、中文空格路径、10 次退出、人工观察、签名安全提示。四类证据不能互相替代。

## 异常测试和恢复

`npm test` 检查不存在的 worker、无响应超时、错误协议、异常退出、停止重启、损坏档案保留、字段白名单和 macOS 目录无写权限；仅测试临时目录。生产档案与原模型均不写入。不要手动破坏真实玩家文件。窗口错误可以通过空昵称／非法种子复现；启动超时和无写权限的窗口呈现尚需人工复测。

删除实验源码目录即可移除构建环境；本机测试档案独立存在，保留或由测试者自行清理。本次没有写正式游戏存档。

## 复测 Easy IPC 耗时

在实验目录、已构建 worker 后运行。仅测包内 worker，包含 JSONL 往返，不含 UI；将输出另存 JSON。窗口冷启动采用 smoke.cjs 的 launchMs，含自动化连接开销，不清空系统缓存。

```sh
node - <<'JS'
const {WorkerBridge}=require('./bridge.cjs');
(async()=>{
  const path=require('node:path');
  const b=new WorkerBridge(path.resolve('dist/worker',process.platform==='win32'?'worker.exe':'worker'));
  let t=performance.now(); await b.request('health'); const firstHealthMs=performance.now()-t;
  const samples=[];
  for(let seed=0;seed<100;seed++){t=performance.now();await b.request('choose_easy',{seed});samples.push(performance.now()-t);}
  await b.stop();console.log(JSON.stringify({firstHealthMs,easyIpcMs:samples},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
JS
```

上例 heredoc 用于 macOS shell；Windows 可将中间 JavaScript 保存为实验目录下的临时 `.cjs` 再运行。
