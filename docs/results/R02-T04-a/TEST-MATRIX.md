# R02-T04-a 验证矩阵

最终受测代码：`e340a2a20fa8d8274c995b3a17759abf3ade92b6`。命令与退出码以 validation.json 为准。

| ID / 范围 | 方法及断言 | 状态 |
| --- | --- | --- |
| S01 | 同请求重复只调用核心一次；返回值与 snapshot 深拷贝隔离 | PASS |
| S02 | 同 ID 不同载荷 REQUEST_CONFLICT；非法牌不占成功 ID | PASS |
| S03 | FIFO 淘汰后旧 expected 仍 STALE_TURN，snapshot 不变 | PASS |
| S04 | 只读 C065 自然链：r5 发奖重试；r6 消费后重试 r5，返回旧 Resolution、当前仍 spent/turn7/DD18 | PASS |
| S05 | 只读 C074 重开；mode_at_start、absence_counts 不变，淘汰席位不复活 | PASS |
| S06 | close 后 SESSION_CLOSED；新 match 拒绝旧 expected | PASS |
| S07 | AI 函数仅接受合法选项与 RNG；玩家输入前固定；非法提交、重试、读取不重选；未揭晓选择不下发 | PASS |
| S08 | 本人/双方曾义休整各只推进一次；同一时刻轮询不跳过揭晓；实际窗口休整后进入第 3 拍 | PASS |
| S09 | 按进程隔离 pending；旧 stdout/exit 不影响新请求；stop 等待 close；超时、坏帧、上限负例 | PASS |
| S10 | 单个在途读取；读取失败显式处理；退出后旧响应丢弃，新场隔离；提交前读取也由世代隔离 | PASS |
| 真实 worker | 本机 subprocess 实际 start/submit/replay/leave；空闲退出读取不重启 | PASS |
| 原核心与样本 | 174 自测、8 工具自测、192 独立样本 | PASS |
| 原 2 份独立 session | 后续独立线程适配；本包保留 NOT_RUN | NOT_RUN |
| 精确显示 | 六分之一约分、100 位及 5000 位 DD；真实费用、强化削门槛/实付、复制聂湘零充能 | PASS |
| 实际 Electron 自动化 | 两场实际 5 回合完整结算并重开，读取异常/重试、进程中断、档案与已保存音量不变 | PASS |
| 1366×768 / 1920×1080 | 实际 renderer 开发视口；33 牌、三排、无常规页面溢出、牌名至少 16px | PASS |
| 真实物理显示器 | 只读取宿主显示信息 1710×1112 @2；不称 1080p 物理验收 | OBSERVED |
| 源码本地资源 | main 的 app:// 白名单与请求拦截保留；runtime 不引入网络模块；不加载远程 URL | PASS_STATIC |
| 物理断网 | 未切换 Wi-Fi/网络或申请系统授权 | NOT_RUN |
| 用户本人手动对局 | 本包为实际窗口自动化及截图查看，不是用户手动验收 | NOT_RUN |
| Windows / Python 3.11 单独实机 | 当前只有 macOS/Python 3.13.7 执行证据 | NOT_RUN |
| 旧模型/专家 AI | 本包使用 random-legal-v1，不加载模型 | NOT_RUN |
| 安装包/签名/Forge/发布 | 本包只从源码运行 | NOT_RUN |
| 依赖审计 | 沿用原 23 项未处理问题，没有执行新的 npm audit | INHERITED_OPEN |

## 留给 Teddy 的离线复测步骤

1. 在联网且依赖已准备好时，按 game/desktop/README.md 启动源码；记下昵称、头像、音量。
2. 保存本页后，自行关闭 Wi-Fi / 断开网络。由本人处理网络与系统授权，本包不自动操作。
3. 进入单人，依次攒、使用可用攻防、查看两方资源与详情，玩至结果，再来一场。曾义发动后下一拍应自动休整。
4. 正常退出并重启程序，确认昵称、头像与设置仍保留；对局进度按设计不恢复。
5. 记录操作系统、Python/Node/Electron 版本、成功/失败步骤和真实截图；再自行恢复网络。

Windows 同学可按 README 的 PowerShell 源码步骤重复操作。缺 Python/Node 或系统授权时写清阻塞，不绕过防护，不把源码启动称为免环境安装。
