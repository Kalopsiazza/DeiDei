# R04-T02-a 分发输入

代码提交：`1523ae5f8119af604008c72db5927d8fce2b39c3`，产品基线 `88185af2c9372b2f1d88707218cafee590b94018`。状态：实现与定向检查通过，最终集成成包待执行。继续开发路径 `.worktrees/r04-t02-a`／`codex/r04-t02-a-delivery`；保留、未归档。

- `stage.cjs` 从现有 `UI_ASSETS` 派生 UI 清单，显式列出主进程模块，检查所有文件及本地 literal require；当前 55 文件。包含联机模块、catalog、欢迎样式／视频／牌背和两张擂台图。旧中庭源文件按 PRD 保留，正式允许列表与分发退出。
- 图鉴 `manual-content/content.json` 纳入未提交输入检查、已提交字节核对与 build-info 摘要；包使用编译 renderer。build-info 标明当前产品来源，旧计划摘要另标 legacy；旧证据保留。
- `check-package.cjs` 更新 R04 页面路径、语义定位并覆盖教程、图鉴、无联机配置及缺欢迎媒体。保留开发 Python 禁用、源码隔离、真实 worker、重启／回收与坏包检查。个人账户 guard 未放宽。

实际检查（代码提交以上）：

| 命令 | 退出 | 结果 |
| --- | --- | --- |
| `npm --prefix game/desktop test` | 0 | 类型／构建；62/62 |
| `node game/packaging/stage.cjs game/desktop` | 0 | 55 个文件、运行模块解析通过 |
| `node --check game/packaging/check-package.cjs` | 0 | 语法通过 |
| `python3 -m py_compile game/packaging/build.py` | 0 | 语法通过 |
| `node .local-outputs/R04-T02-a/source-selector-probe.cjs` | 0 | 临时档案、普通 main；欢迎视频推进、建档、设置、无配置联机、图鉴、真实教程、退出、真实单人 33 牌及提交；11 项，非成包验收 |
| `node game/packaging/check-package.cjs` | 1 | 当前为个人账户，预期由 disposable CI OS 账户 guard 拒绝；没有执行成包自动化 |

初轮 stage 测试因 macOS `/var`／`/private/var` 路径等价处理失败；已用 `realpathSync` 规范化并复测。原失败与最终日志保留在忽略的 `.local-outputs/R04-T02-a/`。

原生构建环境：复用已缓存的 Python 3.11.16，建立本任务 `game/packaging/.venv`，按原 darwin-arm64 hash lock 安装六项工具；Node 24.12.0、npm 11.6.2、uv 0.11.13 精确一致。R03 专用环境另含 websockets，未改动或升级。最终集成需把 E 新增 `online/service-config.cjs` 加入显式运行清单后，以固定干净 SHA 成包；该环境可由其绝对 Python 路径运行最终工作区的 `build.py`。

未测：最终集成原生包／成包 GUI、Windows、干净机、物理断网、跨设备与系统信任。源码 GUI 定位验证另记来源，不能替代成包验证。无 push、merge、发布、依赖变更或新框架；Codex 自审，Kimi 未调用。
