# 检查与证据

日期2026-10-06，macOS arm64；开发Node24.12.0/npm11.6.2/Python3.13.7。原模型隔离CPU环境另列。原始日志保留在本任务 `.local-outputs/R05-T01-a/`，未提交大文件或私有档案。

| 产品SHA / 层 | 命令 | 退出码 / 实际结果 | 证据 |
| --- | --- | --- | --- |
| 01f6bc0cfa4c371c81d042a8cdac614909453f4c / source/unit baseline | `python3 scripts/check.py` | 0；各隔离组与旧AI保全通过，原expectedFailure保留 | baseline-python.log |
| 同基线 / desktop baseline | `npm --prefix game/desktop ci`，`npm --prefix game/desktop test` | 0；类型/构建、94项通过 | baseline-npm-ci.log / baseline-desktop.log |
| 同基线 / server baseline | `python3 -m venv game/server/.venv`；pip `--require-hashes -r game/server/requirements.lock`；`PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m unittest discover -s game/server/tests -v` | 0；真实回环与服务检查通过 | baseline-server-install.log / baseline-server.log |
| 步骤1工作内容 / original core | `PYTHONPATH=game/core python3 -m unittest discover -s game/core/tests -v` | 0；原174项通过 | core-original.log |
| 步骤1工作内容 / configured core | 同上 | 0；192项通过（18项新测试内含256组合及全部经典案例对照，组合不膨胀计数） | core-configured.log |
| 步骤1工作内容 / independent golden | `PYTHONPATH=game/core python3 tests/rules_v1_001/run_acceptance.py --core game/core` | 0；192个固定样本、469次resolve；原2个session项目本入口仍NOT_RUN | core-golden-acceptance.log |
| b6b134ae89822ef8383f9487786449d2556da107 / real_model probe | `game/ai/.venv/bin/python -I game/ai/probe.py --output .local-outputs/R05-T01-a/model-probe/benchmark.json` | 0；真实原权重31分布/200IPC，冷1427ms、p50 .153ms/p95 .194ms/max9.898ms、0timeout、RSS279265280bytes、child exit0回收 | model-probe/benchmark.json / benchmark.log |
| 同AI代码 / target lock | Mac精确hash-sync；Windows uv target dry-run、完整CPU wheel下载核验 | 0；15包闭包、Windowswheel110888878bytes/hash核验，Windows原生NOT_RUN | model-probe/precise-lock-sync.log / windows-lock-dry-run.log / windows-torch-verified.json |

## 后续阶段检查（被测工作内容尚未全部提交）

| 层 | 命令 / 结果 | 证据（本任务忽略输出目录） |
| --- | --- | --- |
| source/unit step2 | runtime35项、server80项、desktop online52项 PASS；原期限/保密断言保留 | runtime-2-final.log / server-2-final.log / desktop-rooms-12-fourth.log |
| source/unit AI | runtime47项 PASS；无 ML 基础组不导入 ML | runtime-ai-final.log（最终日志名以交付核对为准） |
| real_model | `game/ai/.venv/bin/python game/ai/runtime_probe.py` PASS，三真实会话各3次forward、故障/取消/EOF清理；200请求冷1324ms、p50 .220/p95 .313/max8.480ms、0timeout、RSS279658496bytes | runtime-ai-probe.json / runtime-ai-probe.log |
| real_worker / real_model UI | `node game/integration/smoke-major-update.cjs` exit0；8项实际普通main检查：规则草稿/取消、火力2DD/禁云、经典重置、原模型、crash合法回退、取消预热、实际Electron主进程SIGKILL子树清理 | major-smoke-first.log / major-ui/checks.json / major-ui/*.png |
| source/unit rules | `node --test game/desktop/test-rules.cjs` exit0；真正core编译器、文件导入持久化/冲突/删除冻结、共同黄金向量 | desktop-rules-tests.log |
| source/unit settings | `node --test game/desktop/tests-online/test-main-lifecycle.cjs` exit0，8项；写盘前失败保留原档，写盘后OS与本机统计失败仍返回已保存profile+warnings | settings-post-save-main-final.log |
| source/unit lifecycle | `node --test game/desktop/lifecycle/test.cjs` exit0；脏稿/活动会话/旧nonce/写盘屏障停止/一次交接 | 独立日志与最终desktop test |
| source/unit integrated subset | 89项 PASS；类型/构建 PASS（随后新增设置失败两项纳入最终基础检查） | desktop-integrated-first.log / desktop-integrated-build.log |
| settings/hardware actual UI | 普通main连续设置会话27项PASS、cleanup第28项；真实16GiB/8可用并行、DPR2、balanced有效rAF482间隔/p95 17.6ms，未测high不外推 | privacy-stats/settings-smoke-3.log / settings-major-3/checks.json |
| telemetry_http_db | 真aiohttp HTTP/SQLite/admin/CSV/重启/DB锁/TTL/配额/429/队列6组PASS；Node隐私与hardware13组PASS | privacy-stats/python-tests-5.log / node-tests-8.log |
| update_transport | 锁定稳定updater真实字节传输17项PASS；不是native安装 | update-transport-4/transport.json |

## 分层最终状态（实施中，不是完成声明）

source/unit、real_model（Mac源码）、telemetry_http_db后端、update_transport定向PASS；real_worker_room普通双Electron、collector普通main、package_contents正在执行。native_install、production_trust、human_cross_device仍NOT_RUN。

失败保留：候选NumPy1.26.4真实模型加载缺少`numpy._core.numeric`，改用精确NumPy2.3.5后真实加载成功（model-probe/raw-load.log）。server第一次新增协议测试有实现分支位置错误，修复后80项通过（server-2-initial.log / server-2-final.log）。桌面新增fixture与ready哈希旧输入导致初期失败，修复后52项通过（desktop-rooms-12-first/second/third.log）。双普通main首次大厅规则入口被席位遮挡，修正工具区布局后待复测（rooms-major-first/）。设置失焦短测实际拒绝SAMPLE_NOT_VISIBLE，不能记成有效性能数据。设置VM测试首次跨realm deepStrictEqual误报，改逐字段断言后8项通过（settings-post-save-main.log / settings-post-save-main-final.log）。没有改legacy八项、模型权重、有效断言或增加skip。
