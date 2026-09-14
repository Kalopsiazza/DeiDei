## 这次想解决什么

为 R03 制作独立原生诊断构建：原 R02 stage 缺在线模块与在线解码器所需 catalog，不能直接作为在线包。新工具从固定只读产品 SHA 构建含离线 worker 的客户端与独立冻结 room-server。

## 改了什么，哪些没有涉及

仅 game/packaging_r03、新具名 r03-native-diagnostic.yml 与本结果目录。增加精确 stage/require 校验、双平台固定 hash lock、候选回执验证、source_sha/packaging_sha、许可/架构/最终 ZIP 清单验证、真实成包 socket/窗口编排。产品、core/runtime、旧打包与旧CI不改。

## 怎样验证

- 8 项工具负例通过；根 40 项通过，保留 1 个历史 expectedFailure。
- 本机 macOS arm64 基线包构建、签名/架构/内外清单验证通过；最终ZIP重新展开后冻结worker正常执行，冻结server在OS-only PATH、无系统Python的条件下真实接受rooms-1.1连接。
- 依赖审计无高/严重项，Python公开公告为空。
- 当前候选输入 DIAGNOSTIC_BASELINE。基线已知 N33/N36/N48 产品问题保留；本结果不是联机验收版本。
- 原生CI已结束：macOS真实包5场/10次开退、目标视口与故障旅程通过；Windows包构建/校验通过，实际窗口改时限时本拍deadline漂移-7ms而失败。保留断言，Windows后续0场/0次完整开退，未冒充通过。

## 对现有内容的影响

现有依赖/产品/规则不变，独立环境只增加既有websockets17.0.1。复用原打包的下载来源和许可原文，不给游戏添加许可证。不关闭防护、不部署公网、不发布Release、不合入或关闭旧PR。

## 已知问题

三个规定查看点均未收到T04候选。Windows失败对应基线已知F06，须T04修复后再测。缺候选时交BASELINE_ONLY和固定复跑命令。真实成包窗口仅在一次性CI账户执行；本机默认私人档案不用于测试。未调用Kimi，保持暂停。

## 提交者确认

- [x] 变更路径受限，原目录只读。
- [x] 失败/未测与实际通过分开。
- [x] 不提交二进制、凭证、私人档案或字体。

CI：https://github.com/Kalopsiazza/DeiDei/actions/runs/34875308825 。两端内部artifact明确标DIAGNOSTIC_BASELINE，详细SHA/到期与截图见docs/results/R03-T05-a。
