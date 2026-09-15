# ARC R03-NEXT 1.0｜测试修订与TLS准备设计

ChatGPT · 2026-09-15。[PRD](../prd/R03-NEXT-v1.md)先定义目标，本文件给执行者具体做法。所有新增有限选项都是规划者设计，未改Teddy已确认的玩法。

## A01｜测试F07的观察顺序

保留原真实socket限流路径。先由普通成员获取before，用合法UUID逐个发room.sync直到收到RATE_LIMITED，保存last_good命令序号。此时不关闭连接，由房主sync读取after_rate，比较room.seq、policy_revision、完整match和公开成员状态，均相同。

随后主动关闭成员，drain确保服务观察断线，房主sync读取after_disconnect；恢复原身份后读取after_resume。允许这两个合法事件改变room.seq与connected，匹配成员不变、match与policy不变。恢复响应last_command_seq仍等于last_good。原被限流UUID与command_seq重新发出应成功；after_replay相对after_resume没有新增房间变化。

不依赖恰好递增两次的实现细节；要求状态变化有原因、无倒退。同seq公开内容仍完全相等，不加毫秒容差。对“限流前后无副作用”使用断线前的观察窗口，不删除该断言。

## A02｜TLS服务启动

保留RoomServer构造函数及testing工厂旧调用。扩展start为兼容的关键词参数，例如start(host, port, *, tls_context=None, allow_remote=False)。认证、消息与房间程序不改。

CLI增加--tls-cert-file、--tls-key-file、--allow-remote。监听host仍为IP字面量，不用任意域名作bind地址。两条证书路径成对，先以ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)和load_cert_chain载入，再绑定端口；最低TLS1.2，保留标准安全密码设置。只传路径，不把私钥内容放进命令行或日志。密码保护私钥在本批不支持，明确报错，不弹交互密码框。

远端地址检查：非回环host要求allow_remote为True且tls_context存在；只给flag或只给明文都拒绝。默认和旧测试仍只回环。把TLS context传给websockets.serve，握手限时5秒；明文与TLS不混用同一端口。启动提示的scheme随实际服务为ws/wss，路径和子协议仍为/rooms-v1、deidei.rooms.v1，hello仍rooms-1.1。

保留origins=[None]、连接/消息/队列/密码并发预算、只使用真实socket对端IP的限流。不要加入信任X-Forwarded-For、HTTP代理、数据库或网页登录。未来选择反向代理时另做配置设计，本批采取服务直接TLS。

## A03｜服务地址配置

新增main进程专用online/service-config.cjs。采用纯函数loadServiceConfig({isPackaged,resourcesPath,env,readFile})返回{url,error,source}，不向renderer暴露证书、token或任意文件读取方法。文件读失败不能使主菜单和离线入口无法启动；错误只在联机入口显示。

- 源码：只取原有DEIDEI_ROOM_URL；空值为SERVICE_NOT_CONFIGURED。
- 成包：先读固定resources/service-config.json，UTF-8、最多4096字节、拒绝重复键、字段精确为schema_version与room_url。schema_version=1，room_url为null或合法wss字符串。
- 文件有合法URL就使用它，忽略环境覆盖；null表示维护者主动关闭联机，同样不走环境覆盖。
- 文件存在但内容或权限有误，返回SERVICE_CONFIG_INVALID，不使用环境回退。
- 文件根本不存在时，仅为兼容已有诊断流程允许DEIDEI_ROOM_URL为严格回环ws/wss；其他地址返回SERVICE_CONFIG_INVALID。没有环境则SERVICE_NOT_CONFIGURED。

只在主进程启动读取一次，不热更新，不写用户档案，不新增玩家可输入地址的页面。R03打包工具本包只读；此时正式包文件尚不生成，示例配置只能放文档，之后按确切部署地址另发成包包。

## A04｜URL和证书校验

在原wire.endpoint进行精确检查：长度≤2048，拒绝空白和控制字符；URL解析后协议只能ws:/wss:；用户名、密码、query、fragment均空；pathname精确为/rooms-v1，不容许编码后的变体或尾斜杠。ws维持127.0.0.1与[::1]且有合法端口；wss可用DNS域名或IP，端口空值采用443，有值为1—65535；拒绝0.0.0.0、::、组播等不能作为明确服务目标的字面量。输入/输出格式测试单独覆盖，不以能连上代替校验。

沿用main中原生WebSocket，不添加新客户端依赖或允许不安全TLS的参数。Node/Electron的真实证书验证开启；过期、未知CA、主机名不符都失败，绝不自动改成ws。为了避免用户看不懂，可在已有状态区显示“安全连接未建立，请检查服务器证书或网络”，不根据泛化error伪称已知道具体证书原因。

配置错误可通过NetworkRoomPort新增只读configurationError输入延迟到openLobby返回unavailable，或等价的main层处理；不创建已知无效URL的连接。保持pending、generation、临时身份、断线恢复和请求关联逻辑。

## A05｜测试CA与真实验证

仅在新临时目录生成根CA、服务证书与测试私钥，SAN至少含localhost与127.0.0.1。证书生成使用环境已具备的OpenSSL命令，明确检查版本和每次退出码；无工具则报告相关TLS自动化未执行，不安装系统CA或使用用户已有私钥。

Python客户端使用create_default_context(cafile=临时CA)，保持hostname检查。Node测试进程可在启动前用NODE_EXTRA_CA_CERTS指向临时CA；该变量在进程启动读取，设置在已运行进程内不算成功。Electron是否沿用该信任方式，以其原生WebSocket真实握手验证；不生效时停止窗口TLS项并保留证据，不注入绕过校验的代码。

提供有效、未知CA、错SAN、过期证书四组。过期证书可用本地OpenSSL CA配置的明确开始/结束日期产生，不改系统时间。测试私钥不入Git和artifact；测试结束清理自己的目录。安全记录只留场景、证书公开指纹、退出码、错误类别和结果。

## A06｜测试层次与窗口流程

层次L1：纯地址/配置/启动参数检查。L2：真实TLS socket、协议身份与完整对局。L3：真实NetworkRoomPort对TLS，保密/重连检查。L4：普通Electron main/preload UI；两玩家一观众、连续两场、10→5秒下一拍、host当拍后离开、服务停止后离线单人仍可玩。测试进程用独立临时档案，不触碰用户当前档案。

正确CA应完整完成身份和对局；错误证书在身份请求之前失败。测试服务器统计有无收到session.open，不打印frame/密码/token。旧非TLS回环160样本、核心和离线回归照常；新TLS另按S编号，不把旧N35改作已通过。

## A07｜发布前仍待决定

本批只实现远端能力的前置程序与本地验证，不监听外部地址、不连接陌生服务器、不改变防火墙、不申请证书或域名、不自动安装服务、不构建新的公网运行包。可写只读部署说明：环境变量、证书位置、普通权限、前台启动、停止和有限日志；不要擅自提供会自动修改系统的安装脚本。

需要的真实域名/主机/区域/费用/证书权限留待下一次受控部署包，用户到该Codex线程一次提供即可。本包执行不等待此问答。

## A08｜自动化与预算

T06可新增唯一工作流r03-secure-prepare.yml，限定同仓库具名codex/r03-t06-a-secure-preparation分支PR，contents:read、固定已用actions SHA、禁用持久凭据；仅127.0.0.1/::1和临时测试CA。Linux源码与Node检查为基本项；环境可用时加Mac真实窗口，Windows可保留未测。各job最长15分钟、并行至多2，每种环境至多两次有实质改动的运行，不循环尝试。

T03-d不改CI，使用准确候选与既有固定工具环境；本轮已有最终候选900秒原始证据，因此仅在改动确实影响持续测试时再完整跑一次，不重复做相同长跑来增加数量。两个包各自只修改自己的目录。

## 官方技术依据（2026-09-15核对）

- websockets 17.0.1 Encrypt connections：https://websockets.readthedocs.io/en/stable/howto/encryption.html 。serve可接收SSLContext；wss使用TLS；此处选择直接TLS，不强制新增代理。
- Python3.11 ssl：https://docs.python.org/3.11/library/ssl.html 。TLS_SERVER、load_cert_chain与启用证书/hostname验证的客户端context。
- Node24.12.0 CLI：https://nodejs.org/download/release/v24.12.0/docs/api/cli.html 。NODE_EXTRA_CA_CERTS在进程启动读取；不能将运行时改环境当作重新加载信任。

这些支持技术可行性，不代表本游戏的新代码已实现或安全认证通过。
