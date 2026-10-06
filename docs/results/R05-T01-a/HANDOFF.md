# R05-T01-a · Issue #42

完整正文保存于 [任务原文](../../tasks/R05/R05-T01-a.md)。指定 main 基线 `01f6bc0cfa4c371c81d042a8cdac614909453f4c`；分支 `codex/r05-major-update`，工作树 `/Users/zengchongtai/develop/DeiDei/.worktrees/r05-major-update`。原工作树、暂存和未提交内容保留，本任务保留未归档。只交一个对 main 的草稿 PR，不合并、发版或部署公网。

| 步骤 | 实际状态 | 阶段保存与证据 |
| --- | --- | --- |
| 0 基线/可行性 | PASS；Windows native 未运行 | d61a508 / b6b134a：完整正文、基线、旧八项保全；原 checkpoint 真 CPU 加载/200请求；两平台精确 hash lock。 |
| 1 规则核心 | PASS | ebbedc5：同一 P1–P4 引擎、v1/v2经典等价、八开关/256组合、192核心测试、黄金192条/469次resolve。 |
| 2 完整游玩链 | PASS（本机） | 51f7d55 / 3f7f2c3：rooms-1.2双普通main真实6组；原生导入/冷启保留、单人1→3DD及100%幸运原价。 |
| 3 原模型 | PASS（本机及冻结包） | 0de6e0e / c4ce0c4：原156/31投影、模型/有限回退分开、取消和父lease回收；最终冻结包真模型整局2拍、零回退。 |
| 4 设置/隐私/后台 | PASS（本机） | 3582b11 / 3f7f2c3：设置27项、原生全屏16项、普通main真实collector30项；真HTTP/SQLite/admin/CSV7组，隐私/硬件13组。 |
| 5 更新/完整包 | PASS：源码、内容、传输；native安装/生产信任 NOT_RUN | b6f88da / 6ac3978 / 7854ebe：三份完整DMG/ZIP/feed；固定core/AI/闭包/签名完整性；真实完整N→N+1下载、缓存复核、普通退出重开仍N。31fba74仅修外部验收runner。 |
| 6 综合交付 | 本地完成；草稿PR与自动CI以远端回读为准 | 最终desktop127、三包构建时desktop126、server80、Python97文件/root35/core192/runtime48/legacy25通过；最终同产品截图/真实输入补验，候选、manifest与本交付文档已保存。最终head登记于PR正文。 |

候选构建/最终截图的产品 SHA 为 `7854ebeae9814b796f5bfaa4925fd834ff957f73`。之后的 `31fba74` 修未进入应用的外部更新验收runner，`db66f09` 修 CI/打包测试环境与跨平台单测；三包各431项仓库输入中6项非运行输入变化，实际应用stage132文件及其余425项（含图鉴JSON、core/AI输入与锁文件）一致，见 [输入比较](build-input-equivalence.json)。不把仓库全快照写成完全相同。

## 玩家行为与玩法决定

- 经典、火力（一次攒2/5DD）、贷款（每game开局1DD，无偿还）、幸运（25%单次固定升级链）共用现有引擎和八技能开关；教程仍经典全开。随机由runtime/server私有预留，core不读随机。DD单位、编号与经典费用/胜负保留。
- 单人/建房共用规则工作台：跨模式草稿、取消/重置、命名预设与原生声明式包导入；加入者无需安装包，活动场使用冻结快照。揭晓、历史、局势和终局显示原入口、实际招式、升级/AI来源和原价，两套既有卡面均保留。
- 好友房仍由服务端判定。真实规则改变清准备并递增revision；同hash不清准备，旧ready/start和旧客户端明确拒绝。未揭晓入口/token/模型概率不公开，续拍/重开/重连沿用规则。
- “旧版AI（试验）”用保全原权重，没有训练/重新下载/修改模型。原31槽应用当前合法mask，明示缺少ZengYi特征；750ms热拍预算、可取消30秒预热。有限回退按真实来源计数，不充当模型通过；缺固定成包AI文件返回PACKAGE_INCOMPLETE，禁止开发Python回退。
- 设置草稿跨分类保留；写盘后全屏效果失败不推翻已保存档案，已保存/实际/pending分开。隐私和更新偏好即时独立保存。本机推荐/2+8秒短测无需上传，保留custom，未测high不外推。
- 统计默认仅本机、上传默认关闭。scope/epoch/revision、有限队列、即时停止门、删除能力、真实safeStorage与保留期接通；独立aiohttp/SQLite/admin/CSV服务不由桌面启动。人口分母是自愿上传安装，不代表全体玩家或满意度。
- 更新服务单实例、固定公开GitHub provider，无PAT；逐跳去staging安装header。默认不自动下载或随普通退出安装，真实hash/size/渠道/版本校验；一次nonce计划协调脏稿、房间、保存、AI回收与隐私写盘。未配置时不支持；损坏optional更新状态保留原字节、关闭更新而允许游戏开窗。

## 候选与真实边界

最终普通0.5.0候选在忽略目录 `game/packaging/build/darwin-arm64-l6hjznjj/packaged/`，DMG、ZIP、blockmap及latest-mac.yml均存在；[发行清单](release-manifest-macos-arm64.json) 记录实际大小/hash/schema/lock/签名级别。[完整构建输入](build-info-macos-arm64.json) 保存被测SHA。完整独立fixture N=0.5.0在 `darwin-arm64-m7qvggi2`，N+1=0.5.1在 `darwin-arm64-kgi0jt88`，二者不具备公开发布资格。

完整包的只读中文空格路径、不同cwd、OS-only PATH、开发AI环境移除，真实冻结core→AI→原模型整局及缺AI负例均通过。N→N+1完整ZIP真实下载/复核通过；普通退出重开仍0.5.0，档案/规则/隐私保留，未调用native安装。自有main/worker/feed结束，仅本轮合成默认档案已清理。

真实失败保留：初配NumPy不兼容、初期协议fixture/布局、冻结stdin退出、main回收任务后准备停滞、optional更新损坏、builder v26 publisherName位置，以及debug YAML误收发行清单。冻结UI早期诊断的断言时机/只读副本复制、picker焦点、异步等待和补拍标签/平滑滚动等待为harness失败，修正后分别重验；没有删有效断言或新增skip。最终完整传输首轮因evaluate中require失败、尚无feed请求，修外部runner后第2轮exit0；第一轮FAIL仍保留。草稿PR首轮自动CI实际114通过/12失败：9项缺独立collector环境、3项单测误依赖host平台；db66f09补严格hash环境并显式测试Mac/Windows目标及Linux拒绝，本地127项通过，失败日志保留。

未运行：有效签名下native N→N+1替换/坏签名后N+2恢复、正式签名/公证/首次系统信任、Windows native、真人跨电脑/显示器/DPI、远端WSS、公网collector TLS/运营恢复/旧目的地删除及替换后删除能力。production默认入口实际exit1拒绝缺身份；ad-hoc完整性通过不表示生产信任。黄金入口C074/C081仍SESSION_NOT_RUN，另有runtime/server真实检查。

原36条登记36/36一致，233个未跟踪文件摘要无差异；整个legacy/rl相对基线不变。输出和失败日志留在 `.local-outputs/R05-T01-a/` 与 `game/packaging/build/`，原恢复档未改。Kimi未调用。

命令、退出码、截图与失败索引见 [CHECKS](CHECKS.md)。下一步仅按 [EXTERNAL-SETUP](EXTERNAL-SETUP.md) 集中补身份、远端服务和设备条件；具备条件后执行其中production/fixture命令，仍不自动publish。
