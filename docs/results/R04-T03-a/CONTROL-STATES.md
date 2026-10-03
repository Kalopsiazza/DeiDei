# 实际控件七态适用性与现有证据

本表保留P1采样覆盖；最新P2自动动态10路线189记录PASS，14项completion再次PASS。新增联机整条路线两次仍FAIL，未补齐下表七态消费者，不把新样本数量直接相加。当前候选产品P2为 `edbb85a664bde73bc74160f00bb38e15d5634908`，增加在线全屏背景滤镜局部处理。最新路线结果见 [REPORT](REPORT.md)，本表适用性不等于七态全部通过。

此表按当前 JSX 与已保存运行记录整理。产品输入为 `1b2b7a182e53e7f61b563638f58622893c5fa4b1`；当前三个 smoke driver 有未提交修改。表中的“已测”仅指对应记录确有状态、样式或行为证据，不代表全部页面七态完成，也不代表 M2／M3 已验收。Mac 当前锁屏；本次只读，不追加 GUI 样本。

证据代号：

- **C**：[completion-product/checks.json](evidence/completion-product.json)，整体 PASS，14条记录，产品 SHA `1b2b7a182e53e7f61b563638f58622893c5fa4b1`，dirty为空。真实主进程，只有 IPC 的700ms成功／失败迟延为测试控制。包括四预览、四组 trusted Escape→Enter、关闭时 calls=0、迟延动作 calls=1、父页面／焦点／正常退出。
- **D**：[dynamic-product-v2/dynamic.json](evidence/dynamic-product-v2-failure.json)，整体 FAIL：最后1000×560短空间步骤已显式滚到footer关闭并确认可见／命中，却再去点击屏外header返回；两者共用closeSettings，属于驱动导航错误，改点已验证footer后的重跑待完成。10条路线、188项控件记录；产品 SHA `1b2b7a182e53e7f61b563638f58622893c5fa4b1`，dirty仅三个QA driver，renderer/style与C匹配。图鉴Bi／stack1248／detail0在resize保持，模式切换／精确属性／长规则关闭、教程提示层与本地P09结果路线、三类减少动态／透明度实际推进均已到达；solo/archive额外1600×650、1000×1000、1920×1200、2560×1080按记录标实际工作区内或oversized。真实四态8个代表，未增加全部消费者的七态覆盖。旧D9与dynamic-product失败保留。
- **O**：[online-v7/checks.json](evidence/online-dynamic-failure.json)，普通 main＋实际本机服务，整体 FAIL：等待 Charge public reveal 超时。已完成六人前厅／部署／接入／大厅／选择与时限 Apply、六人观战，以及自然 create／submit／timing pending 采样。输入为 af5 加 dirty；renderer同D，style `f001ad16e26878cbafe6beb8ff823cb9a7263aded1748fc42a75f4af4150dc3e` 与 C 相同。不能延伸为后续人数、结果或旧两人停顿均通过。

“适用·未测”表示存在实际状态或应复核的消费者，但当前这些记录没有对应采样。“行为已做”表示实际操作成立，未完整采该状态外观。selected 对应业务 `aria-pressed`／`aria-selected`／checked／option值，不把文本选区或普通键盘焦点混成 selected。busy 可以体现为文字、父级 pending 或操作锁，不要求每个控件都有 `aria-busy`。

| 实际控件／职责 | default | hover | active | focus-visible | selected | disabled | busy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 欢迎：声音开关 | D有默认几何／命中 | 适用·未测 | 适用·未测 | 适用·未测 | **D测：aria-pressed false→true，关闭／开启声音真实操作** | NA：自身无disabled；离开opening即卸载 | NA：同步切muted，不承担异步请求 |
| 欢迎：跳过／重播 | D有入口与实际点击 | 适用·未测 | 适用·未测 | 适用·未测 | NA：一次性阶段动作，不保持选择 | NA：JSX无disabled；非对应stage时卸载／不可用是阶段关系 | NA：同步setStage／pause，不显示请求忙碌 |
| 欢迎：标题进入牌厅／返回身份入口 | **D测代表 `.welcome-title .welcome-action`** | **D真实hover样式** | **D mouse.down，active=true** | **D Tab可达，focusVisible=true、2px outline** | NA：进入动作不保持pressed | 适用：`disabled=saving||busy`；本记录未进入该禁用分支，进入动画另由inert锁定 | 适用：继承父级busy操作锁；独立标题busy外观未测 |
| 欢迎：确认名字／重建／重新读取 | D确认名字入口和建档；C没有替代全部恢复入口 | 适用·未测 | 适用·未测 | 适用·未测 | NA：提交／读取动作 | 适用：`disabled=saving`；对应输入fieldset也锁；未专门采此组禁用 | 适用：确认按钮“保存中…”；当前记录未定向采欢迎saving，不套用C的settings |
| 欢迎：ready新手实战／进入菜单／开发预览／结束预览 | D进入菜单已做；其他消费者需各自核 | 适用·未测 | 适用·未测 | 适用·未测 | NA：导航／请求动作 | 适用：ready按钮busy，tools按钮传入disabled；未完整采 | 适用：新手按钮“正在入场…”，tools继承busy；未完整采 |
| Shared Identity：昵称输入（欢迎／设置） | D欢迎有实际输入、几何；**D设置四态采样** | **D设置采样；欢迎覆写未测** | **D设置active=true；欢迎未测** | **D设置Tab采样；欢迎输入也记录focusVisible=true** | NA：没有业务selected；文字选区不计 | **适用·未测：欢迎Identity disabled=saving；设置外层fieldset disabled=saving** | 输入不提交请求、无独立busy视觉；父saving使disabled，禁用期间输入保留需单列复核 |
| Shared Identity：四个头像按钮（欢迎／设置） | **D设置代表太阳按钮**；欢迎各按钮实际点击 | **D设置已采；欢迎覆写未测** | **D设置active=true；欢迎未测** | **D设置Tab可达，3px outline** | 适用：aria-pressed；D点太阳／月亮／星星，**没有选中true后的完整样式采样** | 适用·未测：同上fieldset继承禁用，不是NA | 同步选择无独立busy；父saving锁定，未测该锁期间头像行为 |
| 菜单：单人／好友／手册／设置／退出／开发预览 | **D单人代表四态；其余有部分入口** | **D单人代表已采**；不同minor/footer覆写待核 | **D单人active=true**；其他覆写待核 | **D单人Tab真实focusVisible及阴影变化**；菜单预览也曾focusVisible=true | NA：导航动作，不保持pressed | 适用：sceneChangePending；退出／预览另加busy；**不能由enabled样本当成禁用已测** | 适用：导航请求锁，退出quitBusy；当前只C覆盖预览动作busy，不覆盖所有菜单消费者 |
| 设置：声音／窗口／昵称头像／关于页签 | D真实切昵称／窗口，内容保留 | 适用·未测 | 适用·未测 | 适用·未测 | 适用：aria-pressed；切换行为D已做，selected样式未完整采 | **NA：页签本身没有disabled，也不在saving字段集内** | NA：同步换页签；saving只锁内容／保存动作，不能称页签busy |
| 设置：音乐／音效range、全屏checkbox | D窗口checkbox check／uncheck真实执行；声音保存另由既有欢迎调查使用，但本C/D/O不补全 | 适用·未测 | 适用·未测 | 适用·未测 | checkbox checked适用、D操作已做；range无业务selected，只有数值 | **适用·未测：外层fieldset disabled=saving** | 无独立busy视觉；继承saving禁用，不能误写input永远无disabled |
| 设置：返回／关闭／保存并关闭 | **D保存代表四态；返回／关闭入口D已做** | **D保存已采**；返回／关闭覆写待核 | **D保存active=true** | **D保存Tab可达，2px outline** | NA：动作不保持选择 | **D测保存clean时disabled=true、dirty时false；C测保存关闭action保存期间disabled**；返回／关闭saving锁未逐个采 | **C真实settings.apply迟延成功／失败，calls=1、输入保持、失败可再操作**；D正常保存不等于busy视觉全套 |
| 单人准备：开始／返回 | D有几何、两停点操作和实际worker启动 | 适用·未测 | 适用·未测 | D开始实际Shift+Tab→Tab回到按钮；记录focusVisible=true；反馈全套待核 | NA：一次性导航／启动 | 适用：开始busy；返回sceneChangePending||busy；未定向采启动busy禁用 | 适用：开始“正在开场／LOADING”；没有当前日志的迟延启动样式采样 |
| 单人准备：固定不限时∞按钮 | 当前仅源码固定状态，本记录未采 | NA：固定disabled的说明控件，无可执行hover目标 | NA：固定disabled，不执行动作 | NA：原生disabled不进入Tab路径 | 适用：固定aria-pressed=true；不是可切换时限能力 | 适用：JSX固定disabled；本记录未专门采外观 | NA：没有接入时限请求 |
| 单人／多人入场：立即进入／立即入场 | D/O真实跳过行为已做 | 适用·未测 | 适用·未测 | 适用·未测 | NA：一次性跳过 | NA：JSX无disabled；阶段结束即卸载 | NA：同步切已进入状态，不发新开局请求 |
| BattleStage：可用／已选牌 `.card-pick` | D真实worker默认与selected牌；O六人33牌几何 | **D已选Charge代表采样**；未选牌／线上覆写待核 | **D Charge active=true** | **D Charge Tab可达、focusVisible=true、3px outline** | **D、O实际选Charge，aria-pressed=true；D resize仍保留match与选牌** | **D/O实际资源不足牌disabled；busy、ready、exiting、suspended、revealed、已提交也会使!editable，未全部逐态采** | **O自然submit中仍selecting时按钮disabled→submitting已提交**；单人全部busy外观待核；忙碌影响editable，不是牌自身spinner |
| BattleStage：确认／重试提交 | D/O真实确认行为；D/O无选牌时disabled | 适用·未测 | 适用·未测 | 适用·未测 | NA：提交动作；已提交文本不是selected | **D/O无选牌disabled；O提交后disabled**；error重试分支本记录未采 | **O自然IPC：confirm disabled=false→true，同selecting→已提交/submitting**；无aria-busy，不能声称spinner验证 |
| BattleStage：暂停／局势 | D/O实际可达、弹窗开关 | 适用·未测 | 适用·未测 | 适用·未测 | NA：打开dialog，不保持pressed | **NA：这两个button JSX没有disabled**；dialog打开期间背景inert是另一条关系 | NA：同步开Dialog，不发异步请求 |
| BattleStage：冻结／恢复 | D单人freeze/resume真实操作；O线上固定禁用 | 适用·未测 | 适用·未测 | 适用·未测 | **D记录“恢复”aria-pressed=true** | **O测mode online时disabled=true；源码人数>2也禁用** | NA：本地同步切frozen，不暂停服务时钟；多人无冻结请求 |
| Shared Modal：关闭／ESC | D短弹窗／长规则／局势与O时限／局势／观众菜单实际可达；C关闭行为 | 适用·未完整采关闭按钮hover | 适用·未完整采 | C在真实动作焦点上Esc→Enter并恢复触发项；**关闭按钮自身focus-visible样式未全采** | NA：关闭动作，不保持选择 | **C预览迟延期间close disabled；源码closeDisabled||closing**。C验证closing期间后续动作不执行 | **C成功／失败迟延保存/预览，busy时拒绝关；最新回调分支有源码处理，busy在240ms内改变的持久回归仍未补** |
| Modal正文：继续编辑／保存关闭／预览场景／恢复／离开／退出 | **D“继续编辑”四态；C预览与保存关闭行为；O观众继续实际操作**；其他消费者不能全复用 | **D继续编辑已采**；primary/danger/battle-dialog覆写未全采 | **D继续编辑active=true**；其他覆写待核 | **D继续编辑Tab与3px outline**；C原生键盘动作焦点，非全套样式 | 预览场景aria-pressed适用·未采selected外观；其余动作NA（不保持选择） | **C预览/保存action busy disabled；恢复saving、离开pending、退出busy均适用·未完整测**；“继续编辑”等关闭动作经requestClose另受closing/inert控制 | **C preview/settings迟延成功+失败实际calls=1**；恢复/quit/离开忙碌消费者未因此自动通过 |
| Online前厅：创建／加入／重连／返回 | O front-small实际可达和点击 | 适用·未测 | 适用·未测 | 适用·未测 | NA：进入表单／连接动作 | 适用：创建加入!connected||busy；retry busy；返回exitBlocked；O已连接enabled样本，不代表断连禁用全测 | 适用：session busy/连接；retry/reconnectbusy未采，不能复用create-submit的pending |
| Online部署／接入：房号、密码、时限range、容量range | O真实输入/密码保留、End把时限改30000，create-small/join-small几何 | 适用·未测 | 适用·未测 | **O时限range focusVisible=true；其他输入未作同类样式采样** | range／文本NA（值不是selected）；输入内容保留O已查 | **适用：OnlineRoom fieldset disabled=blocked，blocked=busy||pending||!connected；O采提交button禁用，但没有逐个采字段disabled** | 字段无独立busy文字；同fieldset继承真实pending锁，逐字段业务拒绝未测 |
| Online：early checkbox／参战观战radio | O实际check/uncheck、参战↔观战，观众加入结果已查 | 适用·未测 | 适用·未测 | 适用·未测 | checked适用；O真实切换与最终spectator身份成立，**checked样式七态未完整采** | **适用：继承外层fieldset blocked（嵌套role字段集也继承）**；未逐字段采禁用 | 无独立busy文字；继承表单pending禁用，不应记NA disabled |
| Online：创建并进入／加入表单submit | O实际创建和观众加入 | 适用·未测 | 适用·未测 | 适用·未测 | NA：发送请求，不保持选择 | **O create-6自然disabled=true→false；由fieldset继承而非button自身disabled**；join忙碌未同样采 | **O create-6实际data-pending=true、确认中…、disabled=true，再pending=false恢复；不把它扩大为所有联机按钮busy外观** |
| Online大厅：准备／角色转换／开始／复制房号／退出／调整时限 | O lobby-small、准备/复制/开局和时限实际入口 | 适用·未测 | 适用·未测 | 适用·未测 | 准备为标签“准备/取消准备”的动作，无aria-pressed，独立selected视觉NA；其余动作NA | **O未全员就绪时开始disabled=true**；准备blocked、角色容量/blocked、退出exitBlocked、调整blocked适用；复制按钮无disabled，NA | 准备/角色/start/退出/Apply可忙碌·未逐个采；复制为clipboard Promise，源码只notice，无busy锁或文字，NA独立busy |
| Online时限：原生select | **O timing-open enabled、selectOption('20000')及选项值行为** | 适用·未测（OS popup另验） | 适用·未测（OS popup另验） | 适用·未测；未做原生键盘popup接受流程 | **O选值和policy 30000→20000、revision+1已验证；selectOption不等于OS原生菜单体验验收** | **NA：该select没有disabled，也不在disabled fieldset内；Modal closing的inert不可冒充select:disabled** | NA：select同步改limitMs，不发请求；Apply busy时select是否继续可操作未定向采 |
| Online时限：Apply | **O真实打开/Apply/之后仍selecting；当拍deadline/accepted/turn不变** | 适用·未测 | 适用·未测 | 适用·未测 | NA：请求动作 | **O自然Apply disabled=false→true；JSX disabled=blocked** | **O timing-apply自然React/IPC状态，保持已提交内容**；后续揭晓超时，不能记后拍时限完整生效或整次PASS |
| MatchResult：回顾／再来一场／准备下一局／退出 | **C本地preview结果/回顾/返回真实执行；D本地P09结果四停点／回顾／返回**；O本次未到联机结果 | 适用·未测 | 适用·未测 | 适用·未测 | NA：结果动作不保持选择；winner/out为展示状态 | 适用：leaving、primaryDisabled、exitDisabled；本记录未定向采离场和guest等待禁用 | 适用：开始新场或online resultLeaving锁；无独立aria-busy，当前记录未验证该busy家族 |
| 图鉴：搜索／清空、卡牌图标切换 | D archive入口target几何；**切换按钮真实四态** | **D archive mode真实hover**；搜索待核 | **D archive mode active=true**；搜索待核 | **D archive mode真实Tab、focusVisible=true、2px outline**；搜索待核 | 搜索NA；view-toggle无aria-pressed，显示模式是data-mode/文案，**D在1000×650／1366×768／1920×1080真实切图标与卡牌** | NA：这些JSX没有disabled/禁用字段集；返回按钮例外见下 | NA：本地同步搜索/模式切换，无异步请求 |
| 图鉴：分类／卡牌与图标／档案tab／场景／示例回合和播放／章节 | **D选Bi，纯resize后选项与两侧scrollTop保持**；D精确属性真实点击与长规则打开／滚动／关闭；其他场景／章节未定向采 | 适用·未测 | 适用·未测 | 适用·未测 | 适用：aria-pressed/aria-selected；D保留Bi；播放pressed=playing及其余选择外观未测 | 普通选择控件NA（无disabled）；入门“下一步”末步disabled适用·未测 | 同步本地选择/计时播放无请求busy，NA；playing是selected/演示状态，不把它混成busy |
| 图鉴：返回／新手实战 | D进入新手实战与教程后退出已做；返回／新手动作独立四态与busy未完整采 | 适用·未测 | 适用·未测 | 适用·未测 | NA：导航动作 | 适用：返回leaving；新手busy||leaving | 适用：离场/启动请求锁；未测。**不能把共享settings-back代表搬成图鉴全部态** |
| 教程：提示／明白继续／重试／普通单人／返回 | D真实教学worker／提示层／第一拍／继续与退出，四停点geometry可达；非完整新玩家教程效果 | 适用·未测 | 适用·未测 | 适用·未测 | 提示aria-pressed=hint适用；下一步等动作NA | 适用：busy||suspended；需实际guided/challenge/revealed/complete状态 | 适用：推进和startSolo请求锁；当前记录未测，不以共享牌桌代替教程层 |
| 牌桌历史／资源token、结果玩家：tabIndex=0只读说明 | 源码有可聚焦展示；本次未定向采 | 适用：历史展开／资源hover；未测 | NA：无click/action handler，按压不是业务操作 | 适用：源码有focus样式／可聚焦；未测 | NA：展示数据不是选项 | NA：无disabled能力 | NA：不发请求／无忙碌动作 |

## 引用与界限

实际源码位置：

- [renderer.tsx](../../../game/desktop/renderer.tsx#L101)：欢迎传参/Identity saving，menu、prepare、settings字段集与页签、结果、Modal各消费者（101—117）。
- [WelcomeEntrance.tsx](../../../game/desktop/WelcomeEntrance.tsx#L31)：声音/跳过、重播、tools、标题disabled与stage inert（31—43）。
- [SharedUI.tsx](../../../game/desktop/SharedUI.tsx#L5)：Identity字段集/头像aria-pressed；Modal latest/closing/inert/closeDisabled（5—27）。
- [BattleStage.tsx](../../../game/desktop/BattleStage.tsx#L50)：editable、HUD、卡牌/确认按钮及result leaving禁用（50—103）。
- [OnlineRoom.tsx](../../../game/desktop/online/OnlineRoom.tsx#L98)：前厅、表单fieldset、checkbox/radio/input、submit、room动作、两处select/Apply、result/spectator（98—158）。[useOnlineSession.ts](../../../game/desktop/online/useOnlineSession.ts#L16) 定义blocked／exitBlocked。
- [ManualArchive.tsx](../../../game/desktop/ManualArchive.tsx#L129)：搜索/模式/卡牌/tabs/场景/章节，返回/教程及入门末步的不同禁用条件（129—173）。[TutorialCoach.tsx](../../../game/desktop/TutorialCoach.tsx#L28) 定义教程提示/下一步/完成入口。

D 的真实四态代表只有 welcome action、menu option、settings avatar、settings input、dialog action、settings save、selected card。它使用真实hover、mouse.down、Tab并保存样式，未合成属性；共享组件在不同消费者有覆写，仍需按表补测。C的700ms控制为真正IPC业务迟延，不是CSS属性合成。O的自然pending保存原始MutationObserver记录，不为取得样本延迟ACK。

C只有当前14条定向记录通过；D/O整次仍FAIL且保留首错、非零退出、正常owned cleanup。这里不重复把已测数相加成“七态全部完成”，不把后续未执行的图鉴、教程、偏好、本地动态结果、联机结果／更多人数记成通过。输入/原生select后续的禁用与busy测试按真实父级条件进入；不靠添加伪disabled或降低原断言补齐。
