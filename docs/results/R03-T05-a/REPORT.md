# R03-T05-a 原生诊断包与成包联机验证

本包只改独立打包工具、具名CI与本结果目录。当前产品输入是有已知失败的基线，状态 BASELINE_ONLY；不是修订产品通过或可发给玩家的联机版。

## 来源

- 产品输入：8a6f8b29f517ab4c5a16466f0894e86995f8a852。
- 规划：plan/r03-live-v1，a1e01ee259c65d9241ad1c4daee7852faca366bf；长批次附件15项清单逐项size/SHA256通过。
- 分支：codex/r03-t05-a-native-diagnostic；PR #26，base integration/r03-live。
- macOS本机基线构建的工具SHA：2e2007a61c4448d4131e9bde09d919be3fb37e54。其后的CI/外部窗口驱动另有提交，不能将本机包工具SHA替换成最终文档SHA。
- CI首轮工具SHA：fabcb1d8438f05988d8eb64ac58ca0862ee92fb0，run 34875308825。每个包的真实两种SHA位于自己的build-info。

## 完成的工具

1. --source必须是提交内candidate-input指定的干净固定检出，构建只从git archive复制到新输出目录；不改源检出或其他线程。--output拒绝已有目录和源目录内部位置。
2. 严格candidate回执验证：具名同仓库T04分支、code先于receipt、固定base后代、允许路径、core/runtime树、npm锁及依赖字段、server锁。回执不接受命令字段或任意URL。本批三个规定查看点均未发现远端回执，未猜测未提交源码。
3. R03独立双平台hash lock沿用R02各平台固定条目，增加现有websockets17.0.1；独立Python环境。npm lock/版本和旧CI均未改。
4. stage保持旧运行链，加online/network-room-port.cjs、online/wire.cjs及catalog.json，逐个核验main/CJS的本地require。TSX已由固定build生成。真实产品依赖的fixture bundle保留；tests-online/fake不进入安装包。
5. 客户端携带冻结离线worker；room-server使用独立onedir，入口只调用现有CLI。两者固定同版core，build-info写source_sha、packaging_sha、tree/lock/stage/资源hash。
6. 最终ZIP重展、完整逐文件清单/符号链接/权限/架构/许可检查。Python/Electron/Chromium/React/PyInstaller/websockets及Python内嵌库许可保留，不新增游戏许可证。
7. 外部真实成包驱动：冻结服务、正常WebSocket peer、真实成包Electron；计划自动5场/10次开退、时限/移除/房主离开/服务重启与原离线；缺worker/catalog副本、缺服务路径明确失败。仅允许一次性CI账户，默认档案必须为空。未给成包产品增加测试后门。
8. 具名CI仅本任务同仓库PR或具名分支dispatch、contents:read、固定actions SHA、macOS arm64与Windows x64、45分钟、fail-fast=false。诊断包与候选的artifact门槛分开，公开日志不包含会话token/密码或未揭晓动作。

## 当前实际证据

本机macOS arm64：8个工具负例通过；根40项通过（保留1个历史expectedFailure）。原生构建及最终ZIP校验成功；冻结worker health/start/submit/get_view/leave/shutdown通过，最终独立server --help通过。最终ZIP再次解压后真实rooms-1.1 hello通过，使用无效Python变量及仅OS PATH，未借用系统Python。无界面probe是HEADLESS_DIAGNOSTIC_PASS，games=0/cycles=0，不冒充窗口通过。

npm audit（全部及runtime）无high/critical，Python固定环境各包PyPI公告为空。macOS代码签名验证通过，identity明确flags=adhoc；Gatekeeper本机命令退出0不代表公证或其他电脑信任通过。构建日志仅保留去路径的有限尾部和命令退出码；二进制不入Git。

原生CI run 34875308825 已结束：macOS job success，实际成包Electron+冻结server完成5场、10次开退，未来时限生效、普通玩家第三缺席移出、房主after_turn关闭、服务重启身份失效、离线单人、缺worker/catalog窗口和缺server路径均通过；两目标视口有33牌三排截图，见ci-macos。Q22未另外在服务持续停止状态下重跑单人GUI；已观测的是服务重启导致在线身份失效后的单人启动，不能把这两种环境条件混为一项。该成绩标DIAGNOSTIC_BASELINE_AUTOMATION_PASS，仍保留基线其他已知失败。

Windows job failure：包构建和最终ZIP核验、冻结服务真实hello通过；真实成包客户端已启动并进入房间，第一次改时限后当前拍deadline从1789407238434变为1789407238427（-7ms），精确相等断言失败。games=0/cycles=0，未把后续未运行项目算通过。这是本批待T04修订的F06稳定期限问题，T05不放宽断言、不修改产品、不为同一未修产品反复构建。两端均已上传具名DIAGNOSTIC_BASELINE内部artifact，Windows包明确附失败状态，不能当可验收联机版使用。

原生CI的首轮工具SHA fabcb1d 与本机初次工具2e2007a分别记录。每平台本批只有本机mac一次与CI各一次构建；没有失败重试、无无限等待。三个候选查看点均NO_CANDIDATE，最终交BASELINE_ONLY。精确artifact ID/内外hash/有效期及下载说明见DOWNLOADS.md。

## 边界与后续

基线已知N33/burst_limit、N36/real_clock、N48/real_clock未被T05修改；T05不接管产品修复。正式candidate仍需T04具名回执，消费后重新固定source_sha构建。任务04未交时不整夜等待，交BASELINE_ONLY和下一命令。真人/干净机、物理断网、公网/异地、收费证书和系统信任全部未验收。

按vibe-engineering-workflow完成高风险构建路径的负例与重点自审。未调用Kimi（保持暂停）。没有合入、关闭旧PR、部署或发布Release。

## 原始证据换行记录

全增量git diff --check退出2，仅来自原生Windows CI导出的CRLF文本（commands/audit/signature），文件列表见DIFF-CHECK.json。原始证据保留字节，不通过改写原文隐藏告警；单独检查打包源码与具名CI退出0。最终仅记录证据的提交带skip ci，避免对未改工具和已知失败基线再发起无意义原生构建；受测工具仍为fabcb1d，最终文档不冒充新二进制测试。
