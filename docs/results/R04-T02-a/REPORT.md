# R04-T02-a 分发输入与最终原生成包

A 实现提交 `1523ae5f8119af604008c72db5927d8fce2b39c3`，产品基线 `88185af2c9372b2f1d88707218cafee590b94018`。最终 **E 集成源码** `0a37a89d3ad5e0d1b7817831d3d94f5811e90346` 已完成 macOS arm64 原生成包，driver 实际退出 0。该 SHA 包含 B/C/D/E，不能以 A 分支替代成包输入。A 分支回补工具／文案的本地提交为 `07381319a876c2a725ca4eeb72b28ce9430f0b68`。成包 GUI、真人与物理环境验收仍未执行。

继续开发路径 `.worktrees/r04-t02-a`／`codex/r04-t02-a-delivery`；保留、未归档。最终产品工作区 `.worktrees/r04-t02-e`；本次只按根任务授权修改工具补丁和交付文案，生成物位于其忽略的 build 目录。

## 实现与初轮源码检查

- `stage.cjs` 从现有 `UI_ASSETS` 派生 UI 清单，显式列出主进程模块，检查文件及本地 literal require；A 初版 55 文件，最终 E 纳入 `online/service-config.cjs` 后为 56。包含联机模块、catalog、欢迎样式／视频／牌背和两张擂台图。旧中庭源文件按 PRD 保留，正式允许列表与分发退出。
- 图鉴 `manual-content/content.json` 纳入未提交输入检查、已提交字节核对与 build-info 摘要；包使用编译 renderer。build-info 标明当前产品来源，旧计划摘要另标 legacy；旧证据保留。
- `check-package.cjs` 更新 R04 页面路径、语义定位，覆盖教程、图鉴、无联机配置及缺欢迎媒体。保留开发 Python 禁用、源码隔离、真实 worker、重启／回收与坏包检查。最终 E 卡名字号按 DESIGN 的 12–16px 范围并加完整 glyph 范围检查；没有为了旧单阈值扩大产品字号。个人账户 guard 未放宽。

下列为 A 实现 SHA 的历史检查，与最终包检查分开记录：

| 命令 | 退出 | 结果 |
| --- | --- | --- |
| `npm --prefix game/desktop test` | 0 | 类型／构建；62/62 |
| `node game/packaging/stage.cjs game/desktop` | 0 | 当时 55 文件及运行模块解析通过 |
| `node --check game/packaging/check-package.cjs`；`python3 -m py_compile game/packaging/build.py` | 各 0 | 语法通过 |
| `node .local-outputs/R04-T02-a/source-selector-probe.cjs` | 0 | 临时档案、普通 main；欢迎、建档、设置、无配置联机、图鉴、真实教程、单人 33 牌及提交，11 项；非成包验收 |
| `node game/packaging/check-package.cjs` | 1 | 当前个人账户被 disposable CI OS 账户 guard 拒绝；未执行成包自动化 |

初轮 stage 因 macOS `/var`／`/private/var` 等价处理失败，已用 `realpathSync` 规范化并复测。原失败与最终日志保留于 A 忽略的 `.local-outputs/R04-T02-a/`。

## 实际成包阻断与最小修复

首轮固定 E `268b508ee9c9ef58eca410ef503b6c11998df1dd` 运行原 `build.py` **退出 1，非中止**；在 npm audit high/critical guard 停止，尚未生成包。唯一受影响节点是 dev/build 链 `@electron/packager@20.3.0 → @electron/asar@4.3.0 → minimatch@10.2.6 → brace-expansion@5.0.9`；1 high、0 critical，运行依赖另查为 0。实际公告为 [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7)、[GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) 和 [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)。

经根任务批准，仅将已有 `^5.0.8` 范围内的锁定传递节点补丁升级至 5.0.12；lock 恰好修改一个节点的 version/resolved/integrity，其他节点及工具版本未变。独立审查核对官方注册表 tarball 完整性、相同 MIT/Node 要求/入口/API，无 P1/P2；CJS、ESM、minimatch 代表性 brace 匹配及真实 ASAR 打包提取 fixture 退出 0。

E 原 `node_modules` 指向 `r04-t01-b`：先在忽略目录用修改后的锁独立 `npm ci --ignore-scripts --no-audit --no-fund`，复制同版本已有 Electron 二进制（字节一致），再移入 E 自有真实 `node_modules`。外部软链接结构曾让 npm Arborist 报 extraneous，保留该诊断并修正环境位置，未改检查器。原依赖树仍为 brace 5.0.9，未写原目标。最终 E `npm ls --all`、完整和生产 audit 均退出 0、全部漏洞计数 0。

同一提交修正 `PLAYER-README.txt` 与 `package.json.description` 的 R02 占位说明，准确描述当前 R04 欢迎／新手／图鉴、本地临时随机合法策略、可选已配置可信 rooms-1.1 及未配置边界；应用／bundle／profile 兼容名称不变。六项 Python 工具与 Node/npm/uv/Electron 原锁保持不变，本次仅有上述传递补丁依赖变更，无新框架。

首轮输出：E `game/packaging/build/darwin-arm64-6gadq6ma/`；完整 stdout 副本 `.local-outputs/r04-t02/native-build-268b508-audit-failure.log`。补丁 diff、安装、前后 audit/tree、origin 与兼容日志也保留在 E `.local-outputs/r04-t02/`，不提交批量日志。

## 最终 E 固定 SHA 原生成包

使用 A 专用 Python 3.11.16，按原 darwin-arm64 hash lock 安装六项工具；Node 24.12.0、npm 11.6.2、uv 0.11.13、Electron 44.3.0。R03 环境未修改。命令从 E 工作区执行：

```sh
DEIDEI_EXPECTED_SHA=0a37a89d3ad5e0d1b7817831d3d94f5811e90346 /Users/zengchongtai/develop/DeiDei/.worktrees/r04-t02-a/game/packaging/.venv/bin/python game/packaging/build.py > .local-outputs/r04-t02/native-build.log 2>&1
```

完整记录见 [native-commands.json](native-commands.json)：31 命令各退出 0；driver 退出 0，输入干净且 code_sha 精确一致。实际检查包括：

| 检查 | 实际结果 |
| --- | --- |
| Python public advisories / npm audit / runtime audit / npm tree | 6 个 Python 工具公告空；两类 npm audit 全部计数 0；tree 无缺失／extraneous |
| core / runtime / independent / tools / root | 174 / 27 / 192 核心 fixtures / 8 / 59；root 有既有 expected failure 1；independent 的两项 session 用例仍 NOT_RUN |
| desktop | 类型、构建、79/79，无 skipped / cancelled |
| frozen 与解压后 worker | 各 6 行／6 命令 health→start_solo→submit→get_view→leave→shutdown，退出 0；临时非源码 cwd、无效开发 Python 环境、OS-only PATH；33 牌真实 runtime |
| stage 与来源 | 56 输入文件，应用 app 目录 58 文件（另含 package/build-info）；运行 require 解析通过；206 个输入文件摘要，包括已提交图鉴内容 |
| Electron / 架构 / 签名 | 官方 release archive 与 SHASUMS256 匹配；桌面与 worker 均 arm64；worker、应用和解压应用 deep strict 验签通过，ad-hoc、未公证 |
| archive / unpack | 中文及空格解压路径；355 常规文件 + 14 symlink = 369 交付清单项，字节／权限／链接目标一致；ZIP 共 1680 成员（另含目录及 macOS 元数据） |

`spctl` 实际退出 0，但输出 **`accepted / override=security disabled`**，反映本机已有安全状态；本次未改系统设置，不能据此声明系统信任验收通过。正常环境再次执行 `node game/packaging/check-package.cjs` 实际退出 1，被既有 disposable CI OS 账户 guard 拒绝；未 fake GITHUB_ACTIONS、未隐藏源码、未写私人 profile、未开成包 GUI。

ZIP 绝对路径：`/Users/zengchongtai/develop/DeiDei/.worktrees/r04-t02-e/game/packaging/build/darwin-arm64-45803_11/DeiDei-R04-T02-a-macOS-arm64-0a37a89.zip`。大小 **162011579 bytes**，SHA256 **`5403f5c48d675cb8ab7839be446507046758fad1230fdae148f75a09005167c9`**。机器可读摘要见 [delivery-manifest.json](delivery-manifest.json)。

同一输出目录保留 `delivery/`、`中文 空格 解压/`、`stage/build-info.json`（SHA256 `9bbf7053fb82cf3d390f097511d0859120138d7a95e62c947ade1e1cf5f31173`）、`delivery-manifest.json` 与 `evidence/commands.json`、`file-manifest.json`、完整 frozen/unpacked worker、签名、官方 checksum 证据。npm lock SHA256 `47d4ad6084037112463d8aabcc869dc76556c3bbe31e652bcd1e52178ac585e2`；编译图鉴内容 SHA256 `61d559c9a06fc285fff2d715233993b4228a63f7f339b0877686de8726de00ca`。完整 stdout 在 E `.local-outputs/r04-t02/native-build.log`。

未测：成包 GUI、Windows、干净机／无开发工具电脑、物理断网、跨设备真人与系统信任。源码 GUI 和上述冻结协议验收不能替代这些层级。无 push、公共 merge 或发布；Codex 独立审查已完成，Kimi 未调用。
