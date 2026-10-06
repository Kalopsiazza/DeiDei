# R05-T01-a · Issue #42

完整正文保存于 [任务原文](../../tasks/R05/R05-T01-a.md)。从指定main `01f6bc0cfa4c371c81d042a8cdac614909453f4c` 开始，执行工作树 `/Users/zengchongtai/develop/DeiDei/.worktrees/r05-major-update`，分支 `codex/r05-major-update`。原工作树/未提交内容保留；本任务保留未归档，不合并或发布。

| 步骤 | 实际状态 | 保存与验收 |
| --- | --- | --- |
| 0 基线/可行性 | PASS | d61a508保存正文/基线；b6b134a保存原checkpoint真实CPU可行性与两平台hash lock。旧八项完整保全；Mac200真实请求，Windows仅精确wheel核验。 |
| 1 规则核心 | PASS | ebbedc5；同一P1–P4引擎、v1/v2经典等价、192项含256组合、独立黄金192条/469次resolve。 |
| 2 完整游玩链 | PASS（本机） | 51f7d55 / 3f7f2c3；rooms-1.2真实双普通main6组、规则权限/版本/断线/终局/包；实际系统picker导入/冷启保留/单人1→3DD和100%幸运原价。 |
| 3 原模型 | PASS（本机） | 0de6e0e / c4ce0c4；真实156/31投影/CPU模型、有限回退与父lease。普通main模型拍/受控crash回退拍分开，取消冷预热/main SIGKILL自有子树回收。冻结完整包另列。 |
| 4 设置/隐私/后台 | PASS（本机） | 3582b11 / 3f7f2c3；设置27项＋cleanup、真实全屏16项、真实collector普通main30项；后台7组、隐私/硬件13组。 |
| 5 更新/完整包 | BUILD_PENDING | b6f88da / 6ac3978；真实传输17项、成包fixture配置/缓存隔离、退出协作、完整闭包/两worker脚本。当前从6ac3978重新构建普通0.5.0及完整N/N+1；native安装/正式信任缺身份，NOT_RUN。 |
| 6 综合交付 | BUILD_PENDING | 最终desktop126项、server80项、根Python/保全通过；当前等待同SHA完整包与真实打包ML/完整下载结果，随后一个草稿PR。 |

阶段小提交按任务顺序保存。最新产品源码 `6ac3978caa618d9863e6724635483185876c27fc`；最终文档head仅在PR中记录，避免自引用。命令/退出码/失败和未运行详见 [CHECKS](CHECKS.md)，末端条件见 [EXTERNAL-SETUP](EXTERNAL-SETUP.md)。

## 玩家行为与玩法决定

- 经典、火力（一次攒2/5DD）、贷款（每game开局1DD，无偿还）、幸运（单次25%固定Bi→Pragon→Three→Volvo→BigBi链）共用现有引擎与八技能开关；教程仍经典全开。所有随机由runtime/server私有预留，core不读随机。RulesRequest/Snapshot、configured-1.0.0/base classic-1.0.1、规则schema1/core schema2保留明确边界。
- 单人/建房共用规则工作台和本机预设；跨模式草稿可恢复，取消不改已应用值，重置回经典全开。小型声明式包有内容hash/边界检查；加入方无需本机安装，活动场使用冻结快照。揭晓、历史、局势和终局保留原入口、实际招式、来源、升级与原价，仍使用两套现有卡面。
- 好友房由服务端判定。真实改规则清准备并递增revision；旧ready/start明确拒绝，同hash不清准备。旧客户端拒绝rooms-1.2，未揭晓入口/token/模型概率不公开，续拍/重开/重连保留规则。
- “旧版AI（试验）”加载保全原权重，无训练/重新下载/魔改模型。当前合法mask在原31槽上约束；缺少ZengYi特征明示。750ms热拍预算、可取消30秒预热；有限合法回退会准确标记来源/计数，不计为模型通过。
- 体验草稿跨设置分类保留，保存后全屏系统效果失败不推翻已保存档案；已保存/实际/pending分开。隐私和更新偏好即时独立保存。本机推荐与2+8秒短测无上传也可用，custom保留，未测high不外推。
- 统计默认仅本机、上传默认关闭。分scope同意、epoch/revision、同日累计、有限队列、停止门/删除能力、真实safeStorage与本机保留期均接入；aiohttp/SQLite/admin/CSV独立服务，不由桌面启动。统计是自愿上传安装的选择/使用口径。
- 更新服务单实例，公开固定GitHub provider无PAT，逐跳去staging安装header；默认不自动下载、不随普通退出自动安装。下载重新核对真实字节/hash/size；渠道拒绝降级/同版本异hash；一次安装计划与nonce、脏稿/活动房间/保存/AI回收/隐私写盘屏障协作。未配置时显示不支持；损坏optional更新状态保留原字节并关闭更新功能，游戏仍开窗。

## 真实失败与剩余边界

原模型初配NumPy不兼容、初期协议fixture/大厅布局、冻结stdin开管退出、main回收任务结束未自动继续安装准备、损坏optional更新状态，以及v26 publisherName schema曾失败；已作局部修复并保留原失败日志。自动化picker焦点/异步等待/selector失败另列，失焦短测按无效处理。缺固定AI路径延迟至实际请求返回PACKAGE_INCOMPLETE，禁止开发Python回退；从新提交实测负例。

首轮完整构建实际exit1且期间发生源修正，旧轮不交付。构建现抓初始输入SHA，并在stage前与manifest/latest写入前复核HEAD/clean/全部输入；实际改文件或HEAD的最小自检均拒绝。当前运行期间不再改产品或HEAD。

未验：native N→N+1真实替换/坏签名后N+2恢复、正式签名/公证/首次系统信任、Windows native、真人跨电脑/显示器/DPI、公网collector TLS/运营恢复/旧目的地删除和替换后删除能力。缺身份不阻止本机候选、真实模型和完整下载验收；不宣称这些层已通过。

原36条登记与233个未跟踪文件摘要逐项一致，旧legacy/rl整个目录相对基线无差异。任务输出在忽略的 `.local-outputs/R05-T01-a/` 与 `game/packaging/build/`；不移动、删除或归档原工作树。Kimi未调用。

正式发布dry-run发现builder-debug.yml误收进工件清单；只放行精确平台/版本的installer、ZIP、blockmap与四个已知feed，文件/hash/缺件自检通过。被中断fixture app仅用于诊断：只读中文空格/受限PATH真实模型整局4拍、零回退，缺AI明确拒绝，两次普通退出及自有子树回收通过；完整installer/native仍NOT_RUN。下一命令从本阶段小提交重新构建最终三份工件。
