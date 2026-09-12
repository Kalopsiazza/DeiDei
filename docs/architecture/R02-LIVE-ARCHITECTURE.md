# ARC-R02-LIVE 1.0｜本地会话与真实对局

ChatGPT · 2026-09-13。先读PRD-R02-LIVE，再按本文件执行。沿用classic-1.0.1及CONTRACT-R02 1.0的核心与DesktopView格式；正式源文档仍以本轮附件中original-r02-input.zip为准。

## A01 分工与目录

`game/core`和`tests/rules_v1_001`在本包只读，不移动、不改预期。新增Python3.11标准库包`game/runtime/deidei_runtime`，负责会话、临时对手、可见数据与JSONL服务。Electron主进程通过一个受控子进程通信，renderer只收DesktopView；不把完整会话或AI未揭晓选择放到renderer。

建议文件：session.py、solo.py、opponent.py、view.py、worker.py、tests/。文件数可调整，职责不变。桌面新增worker-port与bridge，保留FixturePort开发预览。调用链：renderer→受限preload→主进程WorkerPort→本机worker→MatchSession→已验收纯核心。

开发启动使用明确的Python可执行文件参数/环境变量，普通README给出venv步骤；路径由主进程固定，不接受renderer传路径，不使用shell=true。Python包只使用标准库。开发依赖沿用桌面受测锁；不执行audit fix，不加入新运行依赖或Forge分发。本包只有本地源码运行，不伪称免环境安装版。

## A02 MatchSession 的调用约定

提供`MatchSession(initial_state, context=None, max_cached=128)`；初始状态通过核心公开调用验证并复制。`snapshot()`返回深拷贝。`context_snapshot()`返回独立的会话元数据：mode_at_start与absence_counts（默认初始人数决定duel/multiplayer，各人计数0）；本包不实现网络超时，但玩法重开不清这份元数据。

`apply_round(request_id, expected, submissions, choice_tokens)`：expected精确为{match_id,game_id,turn_index}，turn_index仍为规范数字字符串。成功返回与核心相同的Resolution，并将next_state写入会话一次；拒收返回{ok:false,error:{code,player_id,field}}。增加会话错误REQUEST_CONFLICT/STALE_TURN/SESSION_CLOSED/INVALID_REQUEST，原核心错误原样传出。

先检查request_id为非空不超过128字符；规范序列化expected、submissions、tokens作为payload指纹。

- 缓存中同ID同载荷：返回原Resolution的副本，不再应用next_state，不再生成奖励或随机数。
- 缓存中同ID不同载荷：REQUEST_CONFLICT，无状态变化。
- 不在缓存且expected不等于当前match/game/turn：STALE_TURN，无状态变化。
- 有效的新请求：调用核心一次，成功才应用next_state并记录成功请求。无效出招不占用成功请求ID，允许本轮改选合法牌。
- 最近128份成功结果采用FIFO缓存。缓存被移除后的旧轮请求仍因expected过期被拒，不从旧输入回放。缓存上限是技术选择，不是玩法限制。
- `close()`令本实例永久关闭，清缓存；之后请求SESSION_CLOSED。开始另一场创建新实例、新match_id，不能复用旧ID来影响新场。

状态应用串行执行。本地worker一次读取一条指令，不并行修改同一会话；主进程的多个请求也不会令同一轮应用两次。纯核心重复计算与会话重复应用分别测试。

## A03 临时对手

显示名称“临时随机对手”，实现标识random-legal-v1。只从核心返回的合法入口等概率选一个；无权访问玩家当轮的选择。开始每回合、接受玩家输入之前就生成AI候选，并为本轮固定保存。无效提交、重复请求、getView和切换设置都不令AI重选。

默认随机源用系统随机；测试可注入固定Random实例。分支token从独立随机源产生，各选择者0/1等概率；token在本次有效回合固定，重试不重抽。不承诺这个对手有策略水平；不偷偷读取旧模型，也不训练。

AI处于曾义recovery时省略其submission；本人recovery也由核心自动生成，不能给它填一张普通牌。双方均自动动作时按同样的一次提交推进，不无限循环跳过揭晓。

## A04 单人流程与展示

每场两个身份：本机档案local_id（UUID含短横线合法）与固定bot_local，match_id使用本次新的UUID。单人不限时。

进入新回合先读取snapshot与list_options，生成AI选择并隐藏。玩家合法提交后调用Session一次。返回submitting视图短暂展示已提交；约200ms后进入revealed，显示这轮ledger账目、招式与结果；再保留约800ms，转下一轮selecting或整场result。时长集中为可注入配置，属于本轮开发选择，不写入游戏规则。

revealed读取这次账目，不把已经重开的零资源假装成吸收没有发生。下一局selecting再使用next_state初始资源。只要有结果就按transition推进，不由动画或文案猜赢家。

本人强制休整时立即使用系统动作进入同样提交/揭晓过程，不等待用户按灰牌。advance由注入monotonic clock驱动，getView只推进到当前允许的下一个可见阶段，不能因轮询重复执行apply_round。

DesktopView的source为live；演示预览为fixture。图上脚本提示、单人按钮、对手名称和结果说明根据source决定。FixturePort仍只在开发入口显式选择，不能在worker失败时自动替换成fixture。

## A05 WorkerPort 与请求

沿用{v:1,id,op,payload}逐行JSON，响应{v:1,id,ok,data或error}。stdout仅输出协议，stderr输出不含私人数据的诊断。op只允许health/start_solo/submit/get_view/leave/shutdown，payload按逐项白名单校验。

- health：空payload，返回运行版本，不开始对局。
- start_solo：{profile_id,nickname,avatar_id}，主进程从真实本机档案提供；丢弃原场之前由UI确认，创建新session。
- submit：{view_id,entry_id}，由控制器解析当前选择view与expected。成功动作的request_id固定为该选择view_id；同view不同entry在已经接受后返回REQUEST_CONFLICT。
- get_view/leave/shutdown：空payload。leave关闭当前场，保留档案；shutdown正常回收worker。

WorkerPort仍实现startSolo/submit/getView/leave四个既有方法。getView和重复submit返回当前可见视图；Session内部可复用原Resolution，但不把旧DesktopView重新推回renderer覆盖当前状态。

限制单帧1MiB、主进程最多16个待答请求、10秒请求超时。借鉴R01-T02-b固定135b938fcfe0486895adfeea37fab73ee5f881dd的每进程独立请求记录，读取后只复制bridge需要的代码，记录来源；帧大小按本文件调整。旧进程晚到消息不能伤及新请求，等待close后完成回收。只结束自己启动的子进程。

worker异常退出或不可恢复通信失败时，显示“本场中断，可重新开始”，不静默重开或宣称恢复。档案不受影响。没有持久对局恢复要求。leave时收到晚到结果要丢弃；传输重试不产生第二次玩法应用。

## A06 可见数据与UI修订

options的资格、required、spend来自真实核心；name/ui_group/detail_rule_ids来自既有33入口映射。cost_text与requirement_text由view适配处根据真实数据生成，不用静态fixture资格。先检查当前来源再处理特殊文字，如强化削持有1/3实付0、复制聂湘不需充能。

participants仅含公开资源和状态；本轮未揭晓的AI选择、token、候选评分不得下发。所有人的DD、雷电、充能、成熟炸药与奖励至少能在其席位和详情读取；非零主要量直接可见。完整历史/首次使用等公开说明可放展开摘要，不用大段进度挤牌名。

DD显示用BigInt作六分之一整数除法和余数约分："6"→1、"2"→1/3、"3"→1/2、"7"→1又1/6、"9"→1又1/2、"36"→6。禁止Number转换丢精度；超长数字可视觉省略但详情保留准确值。

读取视图采用单个在途请求，完成后再安排下一次；收到错误要明确展示并提供重新读取或退出，不持续吞错。观战、休整、submitting、revealed都能更新。source/场ID/本地请求世代用于忽略过期返回，退出或开新场后不能被旧结果带回牌桌。不要靠“本人已提交”作为所有更新的前提。

保持三类18/9/6、三排、全部33牌可见。修订后再测1366×768、1920×1080；没有物理大屏就继续标开发视口。输入框/弹窗不触发出招，已提交不可重复选发。

## A07 测试与结果分类

原174核心自测、192独立核心样本及8工具自测保持通过，源码与预期只读。本包另写至少以下会话/worker测试：

S01 同ID同载荷重复不再应用状态；S02 同ID改载荷拒绝；S03 缓存移除后旧轮仍拒绝；S04 重试C065的r5奖励、r6消费后再重试旧r5；S05 C074新局不清mode_at_start和absence_counts；S06 关闭及新场不接受旧expected；S07 AI在提交前选好且重试不重选；S08 曾义自动休整与双自动动作；S09 原进程晚到exit/stdout与重试；S10 getView失败、leave后的旧返回与新场隔离。

S04分别核对返回Resolution和当前snapshot，不能只数返回JSON里是否带奖励。C081原独立session驱动当前没有适配，本包用有出处的新会话测试先验证；不修改原驱动来把NOT_RUN改成通过。之后独立测试线程接入新Session再复核。

桌面至少真实操作一场“攒→攻防→结果→再来”，保留实际双方招式与ledger来源；固定测试对手可供自动化，不暴露在普通产品入口。另做多个固定seed连续游玩，测试停止次数只是测试预算，不设玩家自动判平局。没有图形环境可交PARTIAL，不生成假实机图。

不得运行Forge package/make、上传安装包、换依赖或清掉23项告警记录。分发路线由下一份明确设计处理，本包仅本机源码集成。
