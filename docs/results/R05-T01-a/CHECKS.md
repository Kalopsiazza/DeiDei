# 真实检查与证据

2026-10-06，macOS arm64，Asia/Shanghai；Node24.12.0/npm11.6.2。根检查Python3.13.7；原模型/冻结构建用独立Python3.11.16精确hash环境。指定main基线为 `01f6bc0cfa4c371c81d042a8cdac614909453f4c`。产品最终SHA与完整工件在下方记录；不把dirty工作内容伪写为已提交。

短证据路径均位于本任务忽略的 `.local-outputs/R05-T01-a/`。合成资料、完整原始日志和大型工件不提交入git。源码、普通main、socket/模型、下载、安装和信任分别记录。

| 层 | 命令 / 实际结果 | 证据 |
| --- | --- | --- |
| source/unit 基线 | `python3 scripts/check.py`、`npm --prefix game/desktop ci` / `test`、server unittest均exit0；desktop94项 | baseline-python.log / baseline-npm-ci.log / baseline-desktop.log / baseline-server.log |
| source/unit 最终 | `python3 scripts/check.py` exit0：语法97文件、root35/core192/runtime48、黄金192条/469次resolve、legacy25（原expectedFailure1）；旧AI八项字节保全 | 早期final-python.log为95文件；最终三包的evidence/source-checks.txt均从7854ebe运行同一入口，97文件 |
| source/unit 最终server | `PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m unittest discover -s game/server/tests -v` exit0，80项 | final-server.log；真实socket、规则/准备版本、期限、重开、保密 |
| source/unit 最终desktop | `npm --prefix game/desktop test` exit0，typecheck/build＋126项，fail/cancel/skip/todo均0 | final-desktop-5.log；最终三包evidence/desktop-tests-and-build.txt亦126项exit0 |
| real_model 源码 | `game/ai/.venv/bin/python -I game/ai/runtime_probe.py --output <本轮json>` exit0：三真实模型会话各3次forward、200IPC请求0timeout、crash/取消/runtime死亡/父EOF清理；本轮负载p95 1.724ms/max16.802ms | runtime-ai-probe-shutdownfix.json / .log；早期独立基准见model-probe/benchmark.json |
| real_worker / model UI | `DEIDEI_INTEGRATION_OUTPUT=<新目录> node game/integration/smoke-major-update.cjs` exit0，8项：草稿/取消、火力2DD禁云、经典重置、原模型1拍、受控AI SIGKILL合法回退1拍、冷预热取消、实际Electron main SIGKILL子树回收 | major-smoke-third.log / major-ui-3/checks.json |
| real_worker_room | `node game/integration/smoke-rooms-major.cjs` exit0，6组/6次双方公开结算：改规则清准备、旧ready/start拒绝、真实断线恢复/回大厅、包1→3DD、100%幸运原价、guest无本机包可读、两套卡面 | rooms-major.log / rooms-major/checks.json；两个main及server正常退出 |
| native file picker / rules | `node game/integration/smoke-major-update.cjs --native-import` exit0，2项；真实系统选择器两次导入，普通main冷重启保留，真worker 1→3DD与Bi→Pragon原价6单位结算 | native-import-2.log / native-import-2/checks.json |
| settings/hardware | `node game/integration/smoke-settings-major.cjs` exit0，27项＋正常退出；同次草稿/保存/放弃/立即偏好、真实16GiB/8并行、balanced有效rAF482/p95 17.6ms | privacy-stats/settings-smoke-3.log / settings-major-3/checks.json；high未测，不外推 |
| native fullscreen UI | `DEIDEI_SMOKE_OUTPUT=<新目录> node game/integration/smoke-fullscreen-major.cjs` exit0，16项；实际enter/leave、已保存/实际/pending分开，完成后清pending提示 | fullscreen-major-3.log / fullscreen-major-3/checks.json；本轮静止截图覆盖早期动画截图 |
| telemetry_http_db | `PYTHONPATH=game/telemetry game/telemetry/.venv/bin/python -m unittest discover -s game/telemetry/tests -v` exit0，7组；真HTTP/SQLite/admin/CSV/重启、revision/授权/删除、DB锁/队列/429/TTL、安装人口去重 | privacy-stats/python-tests-6.log |
| privacy/hardware 定向 | `node --test game/desktop/test-privacy.cjs game/desktop/hardware/test.cjs` exit0，13组；默认零请求、epoch/ACK/停传/删除竞态、有限outbox与短测失效 | privacy-stats/node-tests-8.log；亦纳入最终desktop |
| telemetry 普通main | `node game/integration/smoke-telemetry-major.cjs` exit0，30项；真safeStorage、随机solo/设置/推荐/短测、自然batch与admin/CSV；停传、删除ACK后台人口0、冷启同意关闭且无历史补传 | telemetry-gui-4/checks.json / privacy-stats/telemetry-gui-4.log |
| update_transport | `node game/packaging/check-update.cjs <新目录>` exit0，17项；实际锁定updater字节下载、坏hash/缓存重取/渠道/迟到/取消、来源/逐跳header | update-transport-7/transport.json / distribution-probe/update-transport-7.log；payload不是可安装app |
| ordinary startup | `node game/desktop/updates/smoke-startup.cjs <新目录>` exit0；损坏prefs/history各保留原字节、更新disabled/no updater/no timer，普通游戏窗口打开 | distribution-probe/update-startup-1/startup.json |
| package_contents / frozen UI | 三份build均exit0；完整冻结UI exit0：只读中文空格/不同cwd/受限PATH，真实core/AI/model终局2模型拍、零回退；缺AI拒绝；正常退出/子树回收 | distribution-probe/final-7854ebe-f18bda29/ledger.json、frozen-ui/frozen-ui.json；工件见下表 |
| full artifact transport | `node game/packaging/check-native-update.cjs --from <N> --next <N1> --out <新目录> --transport-only --isolated-fixture` 第2轮exit0；真实完整0.5.1 ZIP/缓存/hash复核、普通退出重开仍0.5.0、档案/规则/隐私保留，无staging header | distribution-probe/final-7854ebe-f18bda29/full-artifact-transport-2/native-update.json，3152 bytes，SHA256 d3256b1c14b58b95d2c2e8abd4684d60bc94e54648642042cfd7053ff15564a1 |
| native_install | NOT_RUN | 当前无有效native更新签名；ad-hoc、下载ready和API调用不能替代原生替换 |
| production_trust | NOT_RUN | 无正式身份/公证/生产feed；production入口拒绝缺项，候选签名完整性另验 |
| human_cross_device | NOT_RUN | Windows native、跨电脑/显示器/DPI、真人体验、首次系统信任、公网collector TLS和旧目的地迁移未验 |

早期major-ui-3明确记录c4ce0c4＋dirty；native-import-2为3582b11＋dirty；rooms-major未记HEAD/dirty，写UNKNOWN；fullscreen-major-3仅有main/UI文件摘要。最终补验截图与三包明确7854ebe/产品clean，不混用早期版本。31fba74仅修外部runner，基础core/runtime/server和实际应用字节未变，输入比较另附。

统计GUI仅通过固定lifecycle夹具暂停首次空闲batch，准备真实操作后由普通菜单放行；未改时钟/限频/网络实现或注入报告。统计只代表自愿上传安装的选择/使用，不代表所有玩家或满意度。

## 失败、修复与未运行

- 原模型初配NumPy1.26.4加载失败 `numpy._core.numeric`；仅换精确兼容环境至2.3.5后原权重实际加载成功。未改checkpoint/旧八项：model-probe/raw-load.log / preserve.json。
- 初期server分支、旧ready/fixture输入、规则大厅遮挡与radio样式曾失败；保留原行为/保密断言后最终80项和双main/短窗通过。server-2-initial.log、desktop-rooms-12-first/second/third.log、rooms-major-first/second/均保留。
- 冻结core收到shutdown ACK但stdin仍开时曾卡在BufferedReader finalization；有界raw stdin lease修复后v1/v2六指令退出0、stderr空。runtime回归、runtime-ai-probe-shutdownfix.*及成包检查分别核验。
- main回收/读档任务结束后未自动继续安装准备的两个回归曾失败；补任务计数/回收集合/pump后通过。privacy-stats/final-review-main-regression-1/2/3.log。
- optional更新文件损坏曾影响启动；修复后真实两种损坏均可开普通main且更新关闭。成包fixture配置路径/共享缓存已修，独立8项及真实传输17项通过。缺固定AI路径此前可能在开窗前抛错；延迟规则bridge创建后main错误回归通过，成包负例另验。
- picker首轮120秒超时（自动化选错app/焦点）；第二轮真实选择/冷重启通过。collector前三轮、全屏首轮为异步等待/selector夹具失败，修正后通过并保留失败输出。失焦/改变尺寸的性能样本实际拒绝，不计有效性能数据。
- 首轮完整build实际exit1：builder26.17.0拒绝win根publisherName，已按正式schema移入signtoolOptions；该轮期间另有main修正，旧SHA输出不交付。之后按新提交重建，并增加开始/stage前/末端输入一致守卫。

不删有效断言，不新增skip/expectedFailure；legacy原expectedFailure1保留。黄金入口C074/room_state_preserved、C081/session_request_replay仍为SESSION_NOT_RUN，runtime/server另验，不改成该入口PASS。rooms目录旧failure PNG不计入最终成功截图。

## 最终同产品输入与截图

补验是冻结7854ebe普通main→真实worker。`final-input-screens-2/checks.json`记录7项实际通过：ArrowDown原生radio、Space复选框、Tab/Escape/焦点恢复、左右规则栏真实wheel/拖动滚动条、两次系统picker/冷启保留/1→3DD及幸运原价；整体exit1仅因末端“新版卡牌”错误selector。按源码“绘画牌面”补跑 `final-card-screens-1` exit0，两卡面真实结算/保存及正常退出通过。首轮 `final-input-screens-1` exit1为未等待Home平滑滚动完成；保留两轮失败，没有改产品来通过截图。短窗设置真实1000×650，固定保存/关闭按钮可达。

少量原始PNG已随PR保留；逐文件SHA256、准确内容尺寸/DPR/画面档/卡面/来源/产品SHA见 [索引](screenshots/index.json)。未改像素。

| 图片 | 来源与画面（产品7854ebe） |
| --- | --- |
| [短窗规则](screenshots/final-rules-short.png) | 普通main，1000×650/DPR2，illustrated/reduced；左右原生滚动及固定应用按钮 |
| [短窗设置](screenshots/final-settings-short.png) | 同产品普通main，1000×650/DPR2，illustrated/reduced；画面分类/固定关闭保存 |
| [幸运揭晓](screenshots/native-lucky-reveal.png) | 普通main＋原生导入/真实worker，1366×768/DPR2，illustrated/reduced；实际Bi→Pragon、原价6单位 |
| [原版牌桌](screenshots/final-table-classic.png) / [绘画牌桌](screenshots/final-table-illustrated.png) | 同次普通main/真实结算，1000×650/DPR2、reduced；共享牌桌完整卡面/身份/倒计时 |
| [成包原模型拍](screenshots/frozen-model-real-turn.png) | 完整独立N包普通main→冻结core/AI，1366×768/DPR2，illustrated；motion未采集，记NOT_CAPTURED |

早期settings-major-3/graphics-short-sample.png实际为恢复后的1366×768/DPR2短测图，不是短窗图；原生1000×650操作另有JSON证据。早期截图留本地，不冒充最终SHA。原生1366×768→1000×650→请求1000×1000（实际1000×994）→恢复及DPR2已记录；跨DPI/真人仍未运行。

## 最终完整工件

三份build的真实exit0及精确命令见 `distribution-probe/final-7854ebe-f18bda29/ledger.json`。候选代码SHA为7854ebe完整值。ordinary官方publish dry-run exit0，fixture-only N/N1清单检查各exit0、eligible=false；无上传/发布。默认production入口实际exit1 `PRODUCTION_SIGNING_IDENTITY_REQUIRED`，记录为生产构建失败/缺身份拒绝，而非签名通过。

| 用途 | 忽略的build目录（game/packaging/build/） | 完整manifest |
| --- | --- | --- |
| 普通0.5.0 | darwin-arm64-l6hjznjj | [manifest](release-manifest-macos-arm64.json)：DMG304600968 bytes，ZIP298845801 bytes，blockmap/feed；ad-hoc未公证 |
| 独立N=0.5.0 | darwin-arm64-m7qvggi2 | [manifest](release-manifest-fixture-N.json)；完整DMG/ZIP/feed，无发布资格 |
| 同名N+1=0.5.1 | darwin-arm64-kgi0jt88 | [manifest](release-manifest-fixture-N1.json)；完整DMG/ZIP/feed，无发布资格 |

每份架构、生产依赖/资源闭包、冻结core/AI、外app与30个嵌套Mach-O完整性、ZIP中文空格解压后签名/core/AI均exit0；实际资源与所有UI/docs数据随包。开发AI环境移除/无源码cwd/受限PATH的运行另由最终冻结UI证明；没有物理卸载系统Python或断开系统网络。

[构建输入](build-info-macos-arm64.json)含431项原始仓库摘要；[交付前比较](build-input-equivalence.json)如实记录三包各430项一致，仅外部验收runner在31fba74变更，132个实际stage文件全部一致，图鉴JSON一致。该runner不在应用或冻结worker内，修正后重跑受影响的真实传输；不重编未变的运行字节。

完整传输首轮exit1 `ReferenceError: require is not defined`，尚未请求feed，native未运行；两处evaluate改为注入的safeStorage后第2轮exit0。两次普通main退出0/forced=false，自有main/worker/helper均消失，feed端口释放，精确ownership标识下本轮合成默认档案清理；旧R02档案不读取。`full-artifact-transport.log`和第2轮记录均保留。

npm runtime audit exit0；包含builder开发工具的audit实际exit1（low/moderate），显式high/critical策略检查通过，不宣称全依赖无漏洞。未关闭自动检查。

## 保全与交付

原36条worktree登记36/36一致：27现存/9原缺失，branch/HEAD/status、staged/unstaged diff SHA256及233个非ignored untracked摘要无差异；只新增本任务。initial-worktrees.json / preserved-worktrees-final.json。整个legacy/rl相对指定main无差异。

工作树 `<主仓库>/.worktrees/r05-major-update` 保留未归档；恢复档未改。31fba74仅保存外部runner修正；最后文档提交只改交付记录、manifest与必要截图。三包实际产品输入比较通过后推送一个草稿PR，远端head/base/draft与自动CI在本次对话回读，不手改状态或重复触发。Kimi未调用。

打包中间失败另保留：6ac普通完整build exit0，但发布dry-run因builder-debug误收exit1；fixture N在尚未成完整installer时中断exit143。它的真实成包app诊断第三轮exit0（模型4拍/零回退、缺AI负例、两个普通main退出0/自有workers消失）；前两轮为揭晓断言时机与复制只读副本symlink的harness失败。该诊断full-artifact/native明记NOT_RUN，不替代最终候选。
