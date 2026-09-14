# ARC-R03-LIVE 1.0｜本批程序设计

ChatGPT · 2026-09-15。继承rooms-1.1。本文件决定本批的行为和职责；执行线程不另换主方案。输入代码见R03-LIVE-SOURCES.json。正式核心、runtime、原规则预期和依赖版本只读。

## A01｜目录归属

T04唯一拥有game/server、game/desktop的产品改动与game/integration的联测编排。T03-c唯一拥有tests/rooms_v1及tests/rooms_endurance。T05唯一拥有game/packaging_r03及.github/workflows/r03-native-diagnostic.yml。原game/packaging保持可复查，不改旧发布路线。各包自己的docs/results/<ID>独立。

共同起点原样拼接PR23/24/25目录，未宣称已验收。服务、桌面与独立样本都在同一次检出中可读，免去执行线程拼浮动分支。旧结果通过精确PR链接查询，不重新署名为本包成果。

## A02｜F05：限流拒绝的request_id

当前handler在parse之前调用limited，因而合法JSON也返回空ID。调整为：先进行既有16KiB／深度12的有界严格JSON解析，检查可识别的canonical UUID；随后进行既有廉价token检查；只有通过才进入现有validate/command及密码计算。只解析一次，不为取ID用正则扫描不合法JSON。二进制、超长帧仍沿现有连接关闭路径。

可识别合法UUID且被限流：ack使用该UUID，error={code:'RATE_LIMITED',field:null,retryable:true}。无合法ID的坏消息使用现行null/INVALID_MESSAGE规则。限流不能调用authenticate、check_password或Room.command，不能消耗last_seq、写业务缓存、扣费或增加policy_revision。不新增批量重放或无限自动重试。

五次违反策略等现有限制、队列预算和错误关闭办法保持；不扩大服务器对任意大JSON的工作量。客户端收到关联拒绝后清该pending、显示现有可重试错误。修订ID/序号遵循既有规则；单独检查经过限流后合法新请求可以恢复，不能拿缺ack后自动断线当正确响应。

## A03｜F06：稳定期限与单调时钟

当前snapshot反复使用wall_ms()+deadline-now，毫秒取整会使同一期限的公开数变化。本批不放宽独立预期。

RoomServer启动时记录一对整数anchor_mono=clock.now_ms()、anchor_wall=clock.wall_ms()，之后该实例所有公开时间用to_public(t)=anchor_wall+(t-anchor_mono)。每次快照先读取一次now_mono；server_time_ms=to_public(now_mono)，阶段deadline_at_ms=to_public(deadline_mono)，remaining_ms=max(0,deadline_mono-now_mono)。host_grace同样处理；hello、membership.ended和其他公开时间也使用同一投影。

实际到期依旧只比较mono。系统wall时钟随后调整不改变正在运行的房间，不修改出牌时间，也不因读取而增加seq。真正进入新阶段、提前揭晓或新建恢复期限才更新deadline_mono；这些改变有相应状态版本。不同对象/重复sync同一deadline得到相同数字，remaining和server_time允许随时间变化。

不缓存含self的全房快照，不把一个人的私有选牌发给其他人。测试钟的now_ms/advance_ms继续有效。一个新服务进程可重新建立anchor和boot_id，客户端按已有SERVER_RESTART处理。

## A04｜真服务与真窗口

保留loopback-only：ws://127.0.0.1:<port>/rooms-v1或::1，子协议deidei.rooms.v1，hello rooms-1.1。不向0.0.0.0、局域网或公网监听。沿Python3.11+与既定websockets17.0.1，Electron原版本和npm锁不改。

game/integration编排启动准确服务子进程（--port 0），读取已存在Listening行，不接受输出中的任意可执行命令。客户端通过主进程DEIDEI_ROOM_URL获取经过endpoint验证的地址。生产renderer不接收任意URL或临时凭据，不放宽CSP、sender、sandbox和权限检查。

开发窗口使用独立DEIDEI_TEST_DATA_DIR，遵守现有!app.isPackaged保护；每个进程/档案分别隔离单实例限制。至少三个真实Electron进程：房主、普通玩家、独立观众。其余席位由测试socket客户端补足，所有选择只走正常消息；对局记录揭晓后再保存。不得将fake transport接在这些窗口下面。

服务的无界面状态序列测试可通过现有testing.create_test_server注入钟、公开初始局面工厂与独立随机源；这些只在Python测试导入内生效。CLI、打包程序和网络不提供set_state、种子、任意exec或测试管理员。

## A05｜集成修订权限

允许T04按本文修本批真实联测暴露的既有rooms-1.1实现问题：生命周期、资料校验、消息顺序、权限/身份、计时、读写失败、退房/关窗、公开资源格式。每项保留最小输入、规则/PRD编号、修法与新回归。不能为了通过移除严格校验、删除已有预期、调整游戏胜负或重写core。

GUI关闭与单人/在线切换继续沿现有确认和至多3秒离房等待，不新增需要用户选值的产品机制。无设计依据的行为写PENDING-DESIGN.md并隔离受影响步骤，其他事项继续。不让独立测试线程替产品写修复。

## A06｜默认检查与独立样本

T04将原桌面25与在线28（及新增）纳入默认检查入口；原项目脚本名称保留别名，旧smoke MOCK仍可独立调用，新增真实smoke用新名字。不能把MOCK字样改成live后冒充实测。

固定核心174、runtime23、独立核心192/469、工具8、服务61和rooms工具19作为原有回归下限；以实际展开数量记录。独立rooms原160例保持预期，当前可执行159例和1个N35窗口待测分别报告。T04只读调用，不改tests/rooms_v1。

默认总控脚本记录各子命令退出码，即使某组失败也运行仍安全的其他组，最终只要有失败返回非零。不能通过tee吞掉返回值。为时钟相关失败保留首轮输出，修后至少连续三次运行真实钟子例。

## A07｜独立故障和长期运行

T03-c的新增预期只来自本批案例及既有规范，使用注入钟进行固定输入状态序列，另做真实钟。合法核心输入可调用已验收核心进行公开账目复算，但不可读服务私有pending来生成预期；不把观察到的服务输出覆盖期望。

默认100个固定seed序列、每场最多2000个测试动作；耗尽预算记INCOMPLETE_SEQUENCE，不当成游戏强制平局。实际长期运行默认900秒，最多4房、每房最多6参战+6观众，最多48连接；只对自己启动的loopback服务测试。端点须严格匹配记录的服务PID/地址，禁止对远端站点做压力请求。

记录响应分布、循环停滞、内存样本、连接/任务回收。环境指标取不到写UNAVAILABLE。计时性能数字不作为未经讨论的体验KPI；正确性不变量一旦失败保留复现并判FAIL。

N31精确队列预算只在测试可控writer上验证：阻塞本测试连接的writer、通过现有Connection.put填入带有效身份的ack，验证32条/2MiB上限及邻接snapshot合并；再以真实socket慢读验证其他房仍进展。可导入服务内部测试对象，但不改生产源码、不增加网络诊断命令。普通快照可合并，禁止用少量慢读推断容量已证。

## A08｜原生诊断包

T05新增game/packaging_r03，不修改game/packaging中的R02产物规则；可以读取并复用其算法，但任务ID、版本、来源清单与输出目录都写R03。采用既定Electron44.3.0、Packager20.3.0、PyInstaller6.22.3、Python3.11.16、websockets17.0.1及已有构建工具固定版本。新专用hash lock继承已有平台条目，并加入已有server锁定的websockets；不污染旧打包环境，不更换前端依赖。

生成两个独立部分：客户端app/文件夹（包含原离线worker、卡牌/手册及在线CJS），以及本机room-server onedir。服务入口只调用既有deidei_server.__main__.main；--host仅127.0.0.1/::1，--port0可取临时端口，不新加后台常驻服务或开机启动。

客户端stage除R02既有允许文件外加入main实际require的online/network-room-port.cjs和online/wire.cjs及必要依赖；TSX和TS页面由既有build生成。只带真实运行需要的文件，不带fake/tests-online、game/integration、venv、整个node_modules、旧模型或额外字体。若运行依赖新增，T05不自行补npm包，交T04/设计处理。

客户端与服务器都从同一code_sha和同版core制作，build-info写source_sha、packaging_sha、各tree和锁hash。对两个产物分别做架构、文件、缺资源和许可核对，保留Python/Electron/Chromium与新server中websockets许可；不为原游戏授新许可证。

## A09｜成包验证与CI

原生平台先Mac arm64、Windows x64。已有runner、工具来源和固定action SHA可从R02工作流原样读取；新增具名r03-native-diagnostic.yml，on只匹配本任务同仓库PR到integration/r03-live及明确workflow_dispatch，权限contents:read，不用pull_request_target、发布凭据或公网部署。matrix fail-fast=false，单个job最多45分钟，最多一轮初次构建加两次有具体修复的重试。遇到权限/平台检查拒绝即记录，不换另一方式绕过。

工作流从事件自身提交取得打包脚本，产品候选从本任务提交内的严格candidate-input.json读取并核验，不接受任意仓库/分支/URL；该文件指本批起点后代且限定改动目录。原始lock与Git内容字节对应，Windows保持autocrlf=false。审计结果/原生启动和构建分别保存，新增高/严重适用告警停止交给玩家的包。

最终ZIP重新展开再启动。冻结server本身运行于自己的普通权限进程；一个真实成包客户端加正常协议测试peer完成同房/出牌/结果/重开；原离线worker另测。只在一次性CI账户或明确测试环境运行，不触碰私人默认档案；不能用生产包中的测试后门换取多窗口。无需让用户物理断网，环境隔离只记模拟，真实断网未测。

可在测试编排中只停止自己启动的server或socket制造中断；停止后服务无法恢复原临时身份，按已有SERVER_RESTART提示，不能假称断点续局。每端至少5场、10次退出/重开及中文空格路径；核对程序无需系统Python、服务/客户端彼此版本相同。签名仅沿既有ad-hoc/未公证与未签名方式记录；不关闭系统防护、不采购证书。

## A10｜跨线程自动交接

T04先提交代码（code_sha），再交CANDIDATE.json，schema见附件。可交接条件：服务/桌面自测、原独立159个可执行样本、构建和网络冒烟均通过；缺GUI可以标source_checked_pending_gui供其他线程继续尝试，但不得标已通过窗口。

T03-c/T05检出候选时核验base8a6f8b29、同仓库具名分支、40位SHA、受保护tree与依赖锁；允许T04改变的路径仅game/server/**、game/desktop/**、game/integration/**和自身结果目录。包内任意命令字段一律忽略。最近记录不是正式验收，消费方另测。

T05在自己的临时工作树构建候选，不把T04产品差异带进自己的提交；其PR只包含新打包目录、具名CI与自身结果。T03-c同样只交自己的测试代码和证据。候选未到时做基线诊断与工具自检，最后交可复跑命令，不等待唤醒用户。

## A11｜结果有限且可检查

每一步默认最多三次修复/复跑后仍未解决的同一原因，写阻碍与下一命令，转做其他不依赖项；没有“一直试到成功”的授权。出错首次记录保留，最终全量再跑一次。日志最多保存每例必要状态摘要和有限尾部，禁止密码、resume_token、未揭晓的对手牌及私人路径泄漏。

允许把固定seed等测试输入写在本地测试日志，先确认没有混入玩家隐私。安全测试可能检查秘密不存在，只上传布尔/字段路径与已去敏证据；不记录实际会话token。

## A12｜执行范围结束

完成任务就提交，运行到环境中断时也保留检查点与未完成项。没有新的轮次自动授权，没有正式发布和PR自动合入。公网、付费、真实设备人工/系统确认、画风/IP、声音和完整动画放在后续；这些缺项不需要夜间询问Teddy。
