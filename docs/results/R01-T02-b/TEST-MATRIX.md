# R01-T02-b 测试矩阵

PASS仅指列明的环境与证据。Windows延迟不阻挡第二轮的授权见CHATGPT-HANDOFF；不是通过标记。

| 项目 | 本机 Mac ARM64 | Mac CI | Windows x64 CI | 同学 Windows 实机 |
|---|---|---|---|---|
| 固定a缺陷复现 | REPRODUCED，旧blob核对 | 非本项 | 非本项 | NOT_RUN |
| generation/晚到exit/stdout/失败启动/管道/连续stop/并发单次完成 | PASS，6个Node测试含多个负例 | PASS | PASS | NOT_RUN |
| 200ms/真实10000ms超时、实际子进程回收、随后重试 | PASS | PASS | PASS | NOT_RUN |
| 源码+PyInstaller worker协议/4案例/Easy | PASS | PASS | PASS | NOT_RUN |
| 原型基础检查 | PASS，32项含1既有expectedFailure | PASS，同样1既有expectedFailure | PASS，同样1既有expectedFailure | NOT_RUN |
| Forge原生构建+带Python包 | PASS | PASS，macOS15 ARM64 | PASS，Windows2022 x64 | NOT_RUN |
| 包远程可取得及SHA | 本地ZIP另有SHA | PASS，已下载核对 | PASS，已下载核对 | 尚未转交到实机 |
| 普通窗口操作（无调试启动） | PASS，CUA启动/Health/停止/重试；不是真人双击 | NOT_RUN | NOT_RUN | NOT_RUN |
| 本人普通双击 | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |
| 无开发服务、本地素材/档案/案例/Easy | PASS，分发ZIP启动 | 非桌面检查 | 非桌面检查 | NOT_RUN |
| 中文空格路径，ZIP解压后的应用 | PASS，build/得得 验证 b | NOT_RUN | NOT_RUN | NOT_RUN |
| 10次窗口启停、worker PID消失 | PASS，自动化10/10 | NOT_RUN | NOT_RUN | NOT_RUN |
| 真正物理断网后重启 | NOT_RUN，需测试者主动切换网络 | NOT_RUN | NOT_RUN | NOT_RUN，授权延期 |
| 无系统Python/Node的干净环境 | NOT_RUN，限制PATH不能替代 | NOT_RUN | NOT_RUN | NOT_RUN，授权延期 |
| 系统安全提示、签名安装体验 | NOT_RUN，无Developer ID签名/公证配置 | NOT_RUN | NOT_RUN | NOT_RUN，授权延期 |
| Teddy/同学人工观察 | NOT_RUN | 非人工 | 非人工 | NOT_RUN，授权延期 |
| 新规则1.0的80案例/新模型适配 | NOT_RUN，不在本包范围 | NOT_RUN | NOT_RUN | 不得用旧实验充当新规则测试 |

原始证据：old-generation-reproduction.json、regression.txt、worker-source.json、worker-packaged.json、original-check.txt、desktop-smoke.json、macos-observations.json、ci-run.json、ci-build-log.txt。界面截图是实际Mac窗口，CI没有桌面截图。
