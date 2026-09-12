# R01-T02-b｜进程修复与双平台运行验证

状态：**PARTIAL，已提交验收；Windows实机延期由Teddy明确接受，不阻挡第二轮进度。** 请ChatGPT单独派发完整Windows＋Codex同学验证任务，尽量用agents完成，最后提交独立PR。完整授权和编包要求见 [CHATGPT-HANDOFF.md](CHATGPT-HANDOFF.md)。不把延期写成Windows已通过；Mac未测项也不隐藏。

PR：[#10](https://github.com/Kalopsiazza/DeiDei/pull/10)，目标`docs/design-discussion-20260911`，分支`work/r01-t02-b-tech`。未合入，未开始R02，未改规划文档。

## 输入及代码

- 基线：`3a81daf0f42416ccb73a5a69748655145e6f2f0c`。
- 本地附件：`deidei-r01-b-handoff-local.zip`；PRD-R01-B/ARC-R01-B/T02-b均1.0，附件只读参考，没有上传其规划文件。
- a实验来源：`5421e905834eef3a84c74199998b14f72807fef9`。按要求复制到b独立目录，不修改a。
- 本机被测代码：`d6bcd3e848445e32dbc7908c664610fdde1dd1fb`。
- CI被测代码：`135b938fcfe0486895adfeea37fab73ee5f881dd`。相较本机被测代码仅改变获取Python的CI步骤，`experiments/r01-t02-b`无差异；没有冒用a包测试。

## 结果

| 标准 | 结论与依据 |
|---|---|
| B-TECH-01 | PASS：先复现旧blob的跨代误拒绝，再通过generation回归与实际子进程超时/退出测试。 |
| B-TECH-02 | PASS_BUILD_DELIVERY：Mac ARM64与Windows x64原生CI构建成功，均有可下载运行包，已下载核对内部ZIP SHA和必需可执行文件；不等于实机通过。 |
| B-TECH-03 | PARTIAL：Mac分发包10次自动启停/中文空格路径/资源及规则调用/回收通过；物理断网、无系统运行时、真人双击和签名体验未验证，Windows实机授权延期。 |
| B-TECH-04 | PASS_REVIEW_WITH_OPEN_RISK：列明全部根漏洞链及修复范围；未找到当前依赖约束内可直接采用的补丁，保留23项告警，不强制升级。 |

详细逐平台矩阵见[TEST-MATRIX.md](TEST-MATRIX.md)。Mac实际环境为macOS27.0、Apple M2 ARM64、16GB；CI构建OS见package-manifest/ci日志。两端CI不是两台玩家电脑。

## 修了什么

每次spawn独立保存child、pending、buffer、failed/exited/closed及收尾promise；监听器只处理该代。失败代保留在generations集合直到close，旧exit/stdout不能清理新代请求。stop重入共享收尾promise；请求先验证帧大小、停止状态和容量，再创建进程；错误、超时和退出单次完成请求，SIGTERM后必要时SIGKILL，只回收本实验子进程。

新`test-generation.cjs`覆盖晚到exit/stdout、协议错后即时重试、管道错误、spawn错误无exit只有close、连续stop、16并发请求单次完成、过大帧拒绝以及200ms和实际10秒超时回收/重试；原test-main与规则断言保留。

b包应用名和档案目录独立于a。新增普通只读权限CI与原生打包ZIP/hash收集脚本。原规则/模型、a实验、原CI、根依赖、PRD、架构及规则1.0资料都未改。没有实现新引擎、多人AI、房间或动画。

## 验证与失败记录

本机 `npm test` 6项通过（每项含列明子场景），源码/包内worker检查通过；`python3 scripts/check.py`32项通过口径含1个既有expectedFailure，没有改标记。TS/Forge打包通过；分发ZIP解压到`build/得得 验证 b`后10次窗口/档案/4案例/Easy/进程回收通过，另有CUA原生窗口停止后重启截图。

首次CI run34681246531失败：setup-python在两端取不到精确3.11.15。没有任意换Python，改用本机同版uv0.11.13获取同版Python3.11.15后，[run34681310902](https://github.com/Kalopsiazza/DeiDei/actions/runs/34681310902)两端成功。前后日志分别保留，最新CI不仅是静态YAML。

Node事件处理依据[官方child_process文档](https://nodejs.org/api/child_process.html)，实际证明来自本包回归。[artifact保存规则](https://docs.github.com/en/actions/tutorials/store-and-share-data)用于工作流14天配置；下表过期时间来自实际API回读。

## 可获取的包

下列是CI产物，内部package-manifest的code_sha均为`135b938fcfe0486895adfeea37fab73ee5f881dd`。GitHub artifact外层ZIP中包含应用ZIP与manifest；表内hash是**内部应用ZIP**的SHA，不是外层artifact digest。下载可能要求登录GitHub。

| 包与下载入口 | bytes | 内部ZIP SHA-256 | 到期UTC |
|---|---:|---|---|
| [DeiDei-R01-T02-b-macOS-arm64.zip](https://github.com/Kalopsiazza/DeiDei/actions/runs/34681310902/artifacts/10293203569) | 136,658,281 | `96d93b339f4a5fde3c3e145a8f4233a61839471f77c0a840179005624ae8608c` | 2026-09-26T07:40:38Z |
| [DeiDei-R01-T02-b-Windows-x64.zip](https://github.com/Kalopsiazza/DeiDei/actions/runs/34681310902/artifacts/10292994172) | 166,314,346 | `c573afd8b41d1bf73293c404f8679602e0889762945028024181e5f27960d850` | 2026-09-26T07:41:24Z |

本机另有Mac包：`experiments/r01-t02-b/build/delivery/DeiDei-R01-T02-b-macOS-arm64.zip`，136,885,971bytes，SHA`1e6d0381e40f7ff214896a48f11d45ef603f4f8e7b89ecaffc7f2d73795ad34a`；对应本机被测d6bcd3e。不同构建机器包hash可不同，不能混用。local包未上传替代CI包，清理本地目录会失去该副本。

没有正式Release，没有购买证书或禁用系统保护。Windows包现在可交给同学，不再仅提供源码。

## 依赖与保留风险

[DEPENDENCIES.md](DEPENDENCIES.md)列明Forge→tar6.2.1/tmp0.0.33/extract-zip2.0.1的链和延期理由。审计前后23项（critical1/high19/low3），运行依赖0。tar修复需跨至7.x、tmp需离开当前^0.0.33约束，extract-zip无修复版；没有清零就宣称安全。正式工具链由ChatGPT另作决定。

本包未重测旧专家模型，复制的模型探针不代表新运行证据；旧模型也未声明适配新规则。Mac物理离线、干净系统、真人观察尚缺；本次已询问Teddy是否方便配合，尚未收到结果，未自行断网。

## 请ChatGPT处理的后续

1. 验收进程修复、两端CI包和本机证据，分别处理剩余风险。
2. 记录Teddy明确接受Windows验证延期：**尚未取得Windows测试成功也允许进入下一步，Windows同学任务及其PR进度不得成为第二轮前置。** 其他前置由ChatGPT判断；不代表本线程自行签发R02。
3. 按[CHATGPT-HANDOFF](CHATGPT-HANDOFF.md)另发完整Windows任务：固定输入、agent分工、原生构建/负例/实机/离线/采样/可复查证据与独立PR，尽量自动执行，网络切换和安全提示由同学处理。不要只给几步点击清单。

已完成自审与实际验证；未调用Kimi（暂停使用）。
