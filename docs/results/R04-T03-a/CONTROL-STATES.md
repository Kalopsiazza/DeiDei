# 实际控件状态与运行证据

本表按实际 JSX、父级禁用条件和样式覆写划分消费者。六批实际 App 补测均 PASS；表中的“复用”明确说明代表控件、同一源码条件或同一 JSX，不把相同文案、共享 Modal 名称或一次路线通过当成所有消费者通过。此表不代替动态适配、原生窗口操作或严格前台性能验收。

## 证据与输入

以下相对链接已归档并核对原件／副本SHA256；原始运行目录均在 `/Users/zengchongtai/develop/DeiDei/.local-outputs/r04-t03-a/`。QA driver不同版本和dirty输入保留，不写成统一collector已运行。

| 代号 | 归档链接／原始运行 | 实际结果及输入 |
| --- | --- | --- |
| F | [controls-front.json](evidence/controls-front.json)；`controls-front-unlocked-v2/checks.json` | PASS，88条 controls／2条 business。HEAD `ac012f979b7351ae2100b51731842b5b765020b3`＋QA dirty＋welcome 焦点单行修改；运行 welcome.css 为 W1。 |
| S | [controls-settings.json](evidence/controls-settings.json)；`controls-settings-unlocked-v2/checks.json` | PASS，141／3。HEAD 同 F＋QA dirty；运行 welcome.css 为 W0，其余 renderer/style 同 F。 |
| R | [controls-recover.json](evidence/controls-recover.json)；`controls-recover-unlocked-v1/checks.json` | PASS，55／2。HEAD `dc38024a91818c3e2a2ca537675549409cfca620`＋QA dirty；运行 welcome.css W1。只损坏隔离临时 profile，备份原文件 hash 实际核验。 |
| L | [controls-local.json](evidence/controls-local.json)；`controls-local-unlocked-v2/checks.json` | PASS，167／4。HEAD 同 F＋QA dirty＋welcome 焦点单行；运行 W1。只读目标读真实子元素 `.avatar`／`strong` 样式，baseline 和实际 Tab 后各等220ms。 |
| A | [controls-archive.json](evidence/controls-archive.json)；`controls-archive-unlocked-v2/checks.json` | PASS，141／1。HEAD 同 R＋QA dirty；运行 W1。搜索 focus-within 的真实 owner 边框／阴影一并采样。 |
| T | [controls-tutorial.json](evidence/controls-tutorial.json)；`controls-tutorial-unlocked-v1/checks.json` | PASS，50／4。HEAD 同 R＋QA dirty；运行 W1。实际 worker 完成 guided、challenge失败／重试／胜出及进入普通单人。 |
| MC | [modal-contract.json](evidence/modal-contract.json)；`modal-contract-unlocked-v1/checks.json` | PASS，两 case；HEAD `6eb652d088ffdf1f9e047bb14b9d48acf5037885`＋QA/stage.css dirty。实际 SharedUI export，测试 parent 只改变 props。 |
| SU | [settings-unlocked.json](evidence/settings-unlocked.json)；`settings-unlocked-after-v1/dynamic.json` | PASS；HEAD 同 MC＋QA/stage.css dirty。设置昵称／头像／checkbox 三个真实四态代表，实际 Tab／Space、resize、native focused=true。style 是历史 `54c0ae99b27edc8f7a2532ee50c9600ef95a06c77e11688b0ebf697f48757210`。 |
| OU | [online-unlocked.json](evidence/online-unlocked.json)；`online-unlocked-bottom-auto-v1/checks.json` | PASS，17项业务检查；HEAD `9b1d500b4fbd6166d6faa195b2d34e1e8d06a601`＋QA/battle-identity.css dirty。实际本机服务，同 owned host 依次6／3／4／5／2人；自然 create／submit／Apply pending，实际后拍及结果返厅。 |
| O5 | [controls-online-v5-failure.json](evidence/controls-online-v5-failure.json)；`controls-online-unlocked-v5/checks.json` | **整体FAIL**：180秒native popup continuation marker超时。35条状态记录已到lobby select；retry／实际SERVER_RESTART离线、create/join字段集继承禁用、role容量满与释放、真实role pending均有证据。输入HEAD同R＋QA dirty；runtime renderer/style同六批。不要把后半未执行或marker当原生接受通过。 |
| C | [completion-product.json](evidence/completion-product.json)；`completion-product/checks.json` | PASS，14项；产品 `1b2b7a182e53e7f61b563638f58622893c5fa4b1`，dirty为空。实际 App 预览／设置迟延成功与失败、trusted Escape→Enter、父页面／焦点／退出。 |
| W | [welcome-product.json](evidence/welcome-product.json)；`welcome-product/welcome-native.json` | PASS，37项；产品同 C、dirty为空。首次／P01／returning 路径、P01建档不写真实已存 profile、同 PID watcher reload，运行 welcome.css W0。 |
| D | 现有 dynamic 归档按原文件保留 | 只引用具体控件代表或实际结束预览行为；旧整次 FAIL／首错保持原状。最终动态重跑由独立动态证据更新，不在这里改写。 |

F/S/R/L/A/T 的 renderer runtime SHA-256 均为 `02623dff22676f84615e686a19e19a5bfd1e55fcb457cc853e2fc6ceb0581a90`，style 均为 `f116daceded31ae25d74546026e62d63c5157d4f47c3f94ffc6907cd442f9911`。W0=`530cd5bebdb0a86dcb07eeb756b654c9d5b3604c1f50ccf1e7980aa505b2b921`；W1=`5bc9062eb8b3b51f20f151b0210e206fc40d188625671dbefc7cdbfbae0b2dce`。当前源码 SharedUI hash 与 MC／六批一致：`5b067b7a989e454a904be9419ea2e1e66d71d298b54f7a2aebec6ffb6afc2d4d`。六批均 normal exit=0／无强杀／owned children消失／隔离 profile删除，所有记录到的 Tab／Escape／Enter 均 trusted；四态代表在真实Tab后逐项断言 native focused=true、documentFocus=true，保存其余默认／hover／active时的documentFocus。

四态指真实默认、鼠标 hover、按下、Tab focus-visible，并保存样式及命中几何。输入／range／checkbox 的 active **实际断言为 true**，没有因浏览器差异跳过后改成业务 NA。`复用 X`指该消费者与 X 有同一 JSX／class／条件，实际业务路径另有命名证据；没有独立采样的部分仍明确标明。`NA`均带源码原因。busy 对输入等字段表示父级操作锁，字段本身不显示 spinner。纯只读 token／历史／结果玩家无动作 handler，active NA，不混成业务 selected。示例 playing 和 details expanded 与请求 busy 分开。

## 欢迎、菜单与设置

| 实际消费者／记录名 | default | hover | active | focus-visible | selected | disabled | busy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 欢迎声音 `welcome/sound` | F | F | F | F | F true→false | NA：无disabled prop | NA：同步 muted |
| 欢迎跳过 `welcome/skip` | F | F | F | F | NA：阶段动作 | NA：无disabled，stage切换卸载 | NA：同步阶段切换 |
| 欢迎重播 `welcome/replay` | F | F | F | F | NA：阶段动作 | NA：无disabled | NA：同步重播 |
| 欢迎标题 `.welcome-title .welcome-action` | F `welcome/title`；W returning | F | F | F | NA：进入动作 | 条件为父saving/busy；visible-title禁用分支未到达，name/entering的inert另记 | visible-title无独立请求；W entering真实inert，不伪造标题busy |
| 欢迎 nickname（含P01相同Identity） | F/R | F/R | F/R | F/R，W1新增2px outline实际通过 | NA：文字选区不是选项 | F创建、R恢复期间fieldset锁 | F/R父saving锁，失败后值保持／可再输入 |
| 欢迎 avatar（太阳代表，共同button JSX） | F/R | F/R | F/R | F/R | F/R aria-pressed true | F/R真实fieldset锁 | F/R父saving锁；自身同步选择 |
| 欢迎正常确认／P01仅预览确认 `.welcome-action` | F正常；W P01实际确认且profile不变 | F；P01复用同class | F；P01复用 | F；P01复用 | NA：提交动作 | F正常saving；P01同步校验不进入saving | F profile.create受控1800ms失败；P01不是异步保存 |
| 欢迎损坏重建入口 `welcome/rebuild` | R | R | R | R | NA：开恢复dialog | 同saving，恢复dialog下背景按钮未逐个单采；共享welcome-action锁条件可复核 | 入口同步开dialog；实际恢复pending见R正文／背景Identity |
| 欢迎重新读取 `welcome/reload` | F/R | F/R | F/R | F/R | NA：读取动作 | F创建时disabled | 自身load无busy文字／锁；父saving时F拒绝输入。读取功能不冒充保存busy |
| ready主菜单 `.welcome-secondary` | F | F | F | F | NA：导航 | F教程启动期间disabled | F `welcome-tutorial/menu`父锁 |
| ready教程 `.welcome-action` | F | F | F | F | NA：启动 | F | F “正在入场…”／startTutorial单IPC失败恢复 |
| welcome-tools开发／结束预览同button JSX | F开发；D实际结束；W P01返回 | F开发代表复用 | F开发代表复用 | F开发代表复用 | NA：动作 | F开发实际父busy；结束预览同disabled传参 | F tools父锁；结束动作同步离开预览，不新增请求busy |
| initial loading `.topbar .brand`（独立class） | **待loading批次** | 待 | 待 | 待 | NA：导航不保持selected | source sceneChangePending条件；initial loading通常false，未制造不可达锁 | NA独立busy：同步导航；合法profile.read仅延迟初始读取，不是brand busy |
| menu primary `.menu-option-primary` | D单人代表 | D | D | D | NA：导航 | S `menu-preview/background-primary`真实prop，记录其处于native Modal背景 | S pending锁；普通导航同步，未把背景样本称前景操作 |
| menu secondary `.menu-option-secondary` | S `menu/secondary` | S | S | S | NA：导航 | 同primary sceneChangePending；S父pending有证据，secondary未单独snap | 同pending条件复用；在线状态另外验证 |
| menu minor（设置代表，手册／退出同class） | S `menu/minor` | S | S | S | NA：导航 | S背景设置；退出另加busy，S quit请求正文已测 | S父preview锁；退出打开dialog本身同步 |
| menu footer `.menu-preview` | S `menu/footer` | S | S | S | NA：动作 | S背景footer实际disabled | S preview请求锁 |
| 设置tab（窗口代表，其余同map JSX） | S `settings/tab` | S | S | S | S true，saving中实际切到其他tab | NA：不在saving fieldset、无disabled | NA：同步切页签；saving中仍可切 |
| 设置音乐range | S `settings/range` | S | S active=true | S | NA：数值不是选择项 | S saving字段集disabled | S父saving锁 |
| 设置音效range | 同音乐map JSX／CSS；S有字段实际值/锁 | 复用音乐代表 | 复用音乐代表 | 复用音乐代表 | NA：数值 | S `settings/音效音量`实际disabled | S同saving锁 |
| 设置fullscreen checkbox | S，SU | S，SU | S true，SU | S，SU实际Tab＋Space | S checked true；SU切换/还原 | S saving字段集disabled | S父saving锁 |
| 设置nickname | SU三态＋active；S真实输入 | SU | SU true | SU | NA：文字选区 | S `settings/nickname`disabled | S父saving，值保持、失败后enabled；SU不承担busy |
| 设置avatar（太阳代表） | SU | SU | SU true | SU | S `settings/avatar`true | S真实disabled | S父saving锁 |
| 设置header return | S | S | S | S | NA：导航 | S `settings/return` | S saving锁 |
| 设置footer close | S | S | S | S | NA：关闭 | S `settings/close` | S saving锁 |
| 设置footer save | S | S | S | S | NA：提交 | S clean disabled、dirty enabled、saving disabled | S aria-busy=true，实际settings.apply3000ms失败，Enter不重复IPC；随后真实保存成功 |

## Modal实际消费者、单人牌桌与终场

| 实际消费者／记录名 | default | hover | active | focus-visible | selected | disabled | busy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Shared短Modal close：设置／退出／恢复／预览 | S设置／退出、R恢复 | S/R；预览复用同class | S/R | S/R | NA：关闭 | S quit/preview、Rrecover disabled；C App closing行为；MC false→true取消close | C实际saving/preview期间拒绝关，MC latest契约见下 |
| 设置Modal continue | S `settings-modal/continue` | S | S | S | NA：关闭动作 | NA：无disabled；closing用inert；busy时requestClose guard | C保存期间守卫；正文“继续编辑”不是独立busy请求 |
| 设置Modal discard | S | S | S | S | NA：动作 | saving条件存在；C保存分支实际到达，独立discard busy snap未保存 | 父saving锁，不能改NA；无需另外制造busy业务 |
| 设置Modal primary save-close | S | S | S | S | NA：提交 | C保存期间disabled断言 | C实际迟延成功/失败、calls=1；S四态补当前class |
| 退出Modal continue／danger | S各命名记录 | S各 | S各 | S各 | NA：动作 | S close/continue/danger全锁 | S实际app.quit1800ms失败、文案正在退出、calls1、失败后关闭正常 |
| 恢复Modal continue／primary | R各 | R各 | R各 | R各 | NA：动作 | R正文及close全锁 | R profile.recover1800ms受控失败→实际成功；隔离损坏profile备份hash核验 |
| preview scene-grid action（initial代表同map） | S `preview/action`；C四真实预览路径 | S代表 | S代表 | S代表 | S initial true | S实际action/close disabled | S受控fixture.preview失败calls1，C成功/失败及父场景恢复 |
| pause battle-dialog close／primary／danger | L各命名记录 | L各 | L各 | L各 | NA：动作 | danger/close受sceneChangePending；正常pause未额外进入此禁用分支 | 本地resume／开leave dialog同步；不存在独立pause请求busy |
| short leave primary | L `battle-leave/primary` | L | L | L | NA：动作 | source sceneChangePending；本地leave同步清view→菜单，pending已无可見dialog | 本地无可見leave busy；不复制联机leave语义 |
| short leave continue | 同短Modal普通button／同dismissModal，C/S代表可复用 | 同左 | 同左 | 同左 | NA：关闭 | NA：无disabled；inert/close守卫另记 | 同步dismiss，无独立请求 |
| situation battle-dialog close（结果中） | L `result/dialog-close` | L | L | L | NA：关闭 | NA独立closeDisabled；closing仍使disabled | 同步开关，closing契约MC/C覆盖 |
| archive-dialog close | A `archive/start-close` | A | A | A | NA：关闭 | NA独立closeDisabled；closing仍使disabled | 同步开关，closing契约MC/C覆盖 |
| prepare start | L | L | L | L | NA：启动 | L | L真实startSolo1800ms成功、LOADING、calls1 |
| prepare back | L | L | L | L | NA：导航 | L start期间disabled | L父启动锁 |
| prepare ∞固定说明button | L默认selected-disabled样本 | NA：原生disabled目标 | NA：固定disabled | NA：不进入Tab序列 | L pressed=true | L disabled=true | NA：未接入时限动作 |
| local cinematic skip | L `intro/skip` | L | L | L | NA：阶段动作 | NA：无disabled | NA：同步切牌桌 |
| Battle unselected card-pick（Charge代表） | L | L | L | L | L点选→true；D已选代表四态可复用同class | L frozen／submit；D资源不足；OU提交/观战由真实editable决定 | L实际submit1800ms失败，已选保持；OU自然submit锁 |
| Battle confirm | L | L | L | L | NA：提交动作 | L submit锁；D无selected；OU自然已提交 | L单IPC失败并恢复；OU自然提交 |
| Battle retry（同button，error文案） | L `battle/retry` | L | L | L | NA：提交动作 | 同confirm editable条件，L/OU父锁复用 | 同confirm业务路径；fixture错误四态不冒充真实网络失败 |
| HUD pause | L | L | L | L | NA：开dialog | NA：无disabled | NA：同步开dialog |
| HUD situation | L | L | L | L | NA：开dialog | NA：无disabled | NA：同步开dialog |
| HUD freeze／resume（同button） | L | L | L | L | L pressed=true | OU线上固定disabled；source参与者>2也禁用 | NA：同步frozen，不发网络pause |
| error-strip reload | L | L | L | L | NA：动作 | NA：无disabled | NA独立busy：清readError触发真实读取；L恢复选择，非额外saving锁 |
| error-strip leave | L | L | L | L | NA：动作 | source sceneChangePending；本次只采enabled | 本地leave同步消失，无可見等待；不造背景busy |
| error-strip dismiss | L | L | L | L | NA：动作 | NA：无disabled | NA：同步清error |
| result review | L | L | L | L | NA：动作 | L resultLeaving实际disabled | L720ms离场父锁；开review本身同步 |
| result primary | L | L | L | L | NA：动作 | L restart busy、leaving | L真实startSolo失败calls1／原结果保留；联机primary职责见后表 |
| result exit | L | L | L | L | NA：动作 | L leaving实际disabled | L720ms离场父锁 |
| resource-token只读li | L默认 | L | NA：无action handler | L实际Tab与CSS反馈 | NA：资源展示 | NA：无disabled能力 | NA：无请求 |
| selection-history只读span | T默认 | T | NA：无action handler | T实际Tab与CSS反馈 | NA：历史展示 | NA：无disabled能力 | NA：无请求 |
| result-player只读article | L默认 | L | NA：无action handler | L实际子元素avatar/tooltip反馈 | NA：赢家/离场是结果展示 | NA：无disabled能力 | NA：无请求 |

MC 使用原 SharedUI 组件，普通motion关闭延迟240ms：busy props在真实 Escape 后83.6ms提交，同node超过240ms仍open、closing/inert撤销、callback=0；解busy后真实Tab再关，close1／旧callback1／触发项恢复。callback替换在82.3ms提交，同node最终新callback1／旧0／native close1。两case Escape→Enter 均trusted，间隔4.6／2.3ms，closing期间无action。busy取消后的瞬间焦点实际在BODY，记录不声称自动回到dialog；随后真实Tab恢复内部动作可用。该合同覆盖SharedUI相同实现，不代替每个业务正文的busy语义。

## 图鉴与教程

| 实际消费者／记录名 | default | hover | active | focus-visible | selected | disabled | busy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| archive search input | A | A | A true | A真实input＋focus-within owner边框/阴影比较 | NA：文本 | NA：无disabled | NA：同步过滤 |
| archive clear | A | A | A | A | NA：动作 | NA：无disabled | NA：同步清搜索 |
| archive view-toggle | A | A | A | A | 模式data-mode/文案实际切换；无业务pressed | NA：无disabled | NA：同步换模式 |
| archive category（攻击代表同map） | A | A | A | A | A true | NA：无disabled | NA：同步过滤 |
| archive stack-item（攻击首牌代表） | A | A | A | A | A true | NA：无disabled；虚拟视觉不可见不叫disabled | NA：同步选卡 |
| archive icon-tile（Charge代表） | A | A | A | A | A true | NA：无disabled | NA：同步选卡 |
| archive list group | A列表/按键行为 | 滚动组非按钮，A真实滚动；不要求按钮hover视觉 | 无click动作；真实Arrow/Home/End已做，按压不另计业务state | A stack group实际Tab、Home/End/ArrowDown保留焦点；icon group不同class，仅同keydown JSX，真实focus/keys待archive-extra | NA：焦点不是选项，选项见牌/图标 | NA：无disabled | NA：同步浏览 |
| archive depth tab（精确属性代表） | A | A | A | A | A aria-selected/pressed true | NA：无disabled | NA：同步切深度 |
| archive scene picker | A | A | A | A | A true | NA：无disabled | NA：同步换示例 |
| archive demo beats | A | A | A | A | A true | NA：无disabled | NA：同步选择演示阶段 |
| archive demo rounds `.archive-rounds` | **待archive-extra** | 待 | 待 | 待 | 适用pressed；待 | NA：无disabled | NA：同步换回合，不当播放busy |
| archive play | A | A | A | A | A playing=true；真实开始/暂停 | NA：无disabled | NA请求busy：playing是演示状态 |
| archive terms summary | A | A | A | A | 原生details open，A actual expand | NA：无disabled | NA：原生展开 |
| archive header reader（start/questions/rules同button JSX） | 各入口已实际点击；**四态待archive-extra questions代表** | 待 | 待 | 待 | aria-pressed=mode，待直接snapshot | NA：无disabled | NA：同步开阅读层 |
| archive onboarding steps | A | A | A | A | A末step true | NA：无disabled | NA：同步换步骤 |
| archive onboarding next | A末step禁用；**enabled四态待archive-extra** | 待enabled | 待enabled | 待enabled | NA：推进动作 | A末step disabled | NA：同步换步骤 |
| archive think summary／native原条款 summary | A各消费者命名样本 | A各 | A各 | A各 | 原生details open，A各真实展开 | NA：无disabled | NA：原生展开 |
| archive chapter button | A | A | A | A | A true | NA：无disabled | NA：同步切章节 |
| archive FAQ summary（不同class覆写） | **待archive-extra** | 待 | 待 | 待 | details展开待 | NA：无disabled | NA：原生展开 |
| archive guide-card link（FAQ/start/rules共同archive-guide-actions） | **待archive-extra FAQ代表** | 待 | 待 | 待 | NA：链接动作 | NA：普通卡链接无disabled；下一步单列 | NA：同步相关导航 |
| archive relations／related-back | **待archive-extra各职责** | 待 | 待 | 待 | NA：相关导航动作 | NA：无disabled | NA：同步选卡/回退 |
| archive more-relations summary | **待archive-extra** | 待 | 待 | 待 | details展开待 | NA：无disabled | NA：原生展开；其内relation与外部同class/handler |
| archive rule-link | **待archive-extra** | 待 | 待 | 待 | NA：导航动作；对应rule details实际open待 | NA：无disabled | NA：同步开规则 |
| archive egg toggle | **待archive-extra** | 待 | 待 | 待 | aria-expanded true/false待，不伪造aria-pressed | NA：无disabled | NA：同步便签开关 |
| archive no-match reset | **待archive-extra** | 待 | 待 | 待 | NA：重置动作 | NA：无disabled | NA：同步清search/category |
| archive back | A | A | A | A | NA：导航 | A leaving disabled | A实际380ms离场锁 |
| archive tutorial-entry | A | A | A | A | NA：启动 | A leaving，T真实startTutorial busy disabled | T真实IPC迟延成功／calls1 |
| Tutorial guided/challenge next primary（不同文字同一JSX） | T `guided-next`／`retry`；其它文案实际推进 | T代表复用同primary | T代表复用 | T代表复用 | NA：推进动作 | T guided冻结suspended、tutorialNext busy disabled；所有文案同busy/suspended表达式 | T真实tutorialNext迟延；guided→challenge，challenge失败→retry→获胜→complete均实际worker；不同text不需要独立虚构busy |
| Tutorial hint | T | T | T | T | T true | T submit busy disabled | T真实submit受控失败后保持challenge/selecting／提示与确认恢复 |
| Tutorial complete solo | T | T | T | T | NA：启动 | T startSolo busy disabled | T真实startSolo迟延成功 |
| Tutorial complete back | T | T | T | T | NA：返回 | T同startSolo父busy disabled | T父锁；自身leave同步清view，不造教程退出pending |

现有driver的 `--batch=loading` 与 `--batch=archive-extra` 均**尚未运行**；loading只延迟原profile.read8000ms、采实际brand四态和导航，原handler正常返回／calls1须通过。

archive-extra 是**尚未运行的最小新增批次**，由 `smoke-control-states.cjs --batch=archive-extra` 执行，只复用现有原App驱动的四态、wrapper和cleanup。它以原 content 的真实多拍场景、相关卡、rule ID进入状态，不追加假属性。通过后仅替换对应命名行；保留旧 archive-v1 search owner采样失败和local-v1 ARTICLE采样失败原始日志，不把这些失败改写成产品bug或删去首错。

## 联机职责与边界

联机 OU 的业务已经通过。O5整体FAIL但保留到lobby原生select之前的真实35项状态：下面O5单元格只升级确有记录的部分，未执行后半仍为待。no-hold v6已在实际nativefocus gate失败，checks0；须解锁后继续，不能把锁屏运行当严格前台性能或原生Return接受。

| 实际消费者／source | default | hover | active | focus-visible | selected | disabled | busy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Online entry create／join（menu primary/secondary覆写） | O5各实际代表 | O5各 | O5各true | O5各 | NA：导航 | O5实际connecting !connected禁用 | O5 retry父pending锁；入口本身同步换表单 |
| Online retry reconnect | O5实际SERVER_RESTART入口 | O5 | O5true | O5 | NA：动作 | O5 Retry busy disabled | O5真实重新连接（online.openLobby迟延1800ms）；父connecting状态，两入口同步锁 |
| Online entry/form back `.settings-back` | O5返回菜单／create back | O5 | O5true | O5 | NA：导航 | O5 create/join pending实际禁用；offline退出enabled | 表单返回同步，父请求锁O5；在线leave职责另列 |
| Online turn/cap range（分别有online-turn覆写） | O5各 | O5各 | O5各true | O5各 | NA：数值不是selected | O5实际!connected及create pending逐字段disabled | O5真实create字段集pending锁，数值在reconnect保留 |
| Online room code／password input（不同class） | O5 create password与join各字段 | O5各 | O5各true | O5各 | NA：文字 | O5 create/join真实逐字段disabled | O5真实父pending锁；字段本身无spinner |
| Online early checkbox／role radio（各职责） | O5各 | O5各 | O5各true | O5各，radio读真实sibling视觉 | O5early／player／spectator checked样本 | O5create/join父pending逐字段disabled | O5真实父pending锁；不是无disabled输入 |
| Online create submit | O5；OU各N业务 | O5 | O5true | O5 | NA：提交 | O5fieldset pending／!connected禁用；OUfalse→true→false | O5与OU自然pending／确认中…，不靠延迟ACK |
| Online join submit／fallback spectator | O5 join四态；fallback仅同settings-action样式/同join handler复用，分支未专项 | O5 join；fallback共享样式 | 同左 | 同左 | NA：提交 | O5 join blocked逐字段；fallback同fieldset | O5实际join pending；fallback同join spectator职责，不能称其错误分支已独立执行 |
| Online lobby ready／role change | O5 ready四态／两个role动作各四态 | O5各 | O5各true | O5各 | NA：没有pressed；取消准备文案不混selected | O5实际player六席/观众容量满disabled→释放enabled；真实role pending锁 | O5role-player/role-spectator自然pending；ready请求在marker之后，尚待后半 |
| Online lobby start | O5未全员ready的disabled样本；OU各N开局业务 | enabled四态待后半 | 待enabled | 待enabled | NA：启动 | O5not-ready实disabled；blocked条件待后半start | 实际start请求存在，marker之后待；不把本次disabled-only的hover/active自动业务NA |
| Online copy code | O5四态及实际复制；OUnotice业务 | O5 | O5true | O5 | NA：动作 | NA：无disabled | NA：clipboard Promise只notice，无busy锁/文字 |
| Online timing-open／Apply | O5 timing-open四态；Apply四态待后半；OU政策业务 | O5 open；Apply待 | O5 open true；Apply待 | O5 open；Apply待 | NA：请求动作 | OUApply false→true；O5open enabled，blocked锁有source/role父条件 | OUApply自然pending/后拍政策；O5marker之后Apply尚未执行 |
| Online native timing select | O5原生control默认 | O5hover=true | O5 pointer打开popup，raw active=false且标nativePopupRequiresCua；**不写active PASS或NA** | O5实际Tab／outline；原生Arrow＋Return接受仍未完成 | OUselectOption政策；CUA已见20秒高亮，未Return不叫接受 | NA：无disabled prop、不在disabled fieldset | NA：同步改limitMs；Apply busy不使select disabled |
| Online pause/menu resume／room settings／leave（battle-dialog） | OU实际菜单行为；L同CSS pause代表 | L代表可复用；线上room-settings按钮独立待 | 同左 | 同左 | NA：动作 | room-settings !canAdjust实条件待；其余无disabled | 同步开关菜单，无独立请求；确认leave另列 |
| Online leave-confirm primary／continue、close | OU room complete/退出行为；S/R短dialog同CSS | 共享短dialog代表可复用 | 同左 | 同左 | NA：动作 | primary exitBlocked、close busy&&connected源码条件；确认leave后Modal立即卸载，不虚造可见leave期间dialog锁；continue无disabled | 在线真正api.leave/close请求存在，pending未被本地同步leave覆盖 |
| Online cinematic skip | OU真实立即入场 | L同cinematic-skip样式，online-intro覆写需核 | 同左 | 同左 | NA：阶段动作 | NA：无disabled | NA：同步setEnteredMatch |
| Online result review／host primary／exit | OU各N真实结果返厅；L同MatchResult代表 | L共有样式可复用，online-result覆写需核 | 同左 | 同左 | NA：结果动作 | source leaving/blocked/exitBlocked；OU未定向逐项七态 | host returnLobby请求／结果transition锁存在；local startSolo不替代在线请求 |
| Online guest result WAITING primary | source真实!host||pending_close，OU guest相关路径不能替代样本 | NA：原生disabled目标 | NA：disabled | NA：disabled不Tab | NA：不是selected | **适用，待真实guest结果disabled snapshot** | 本人无returnLobby请求；等待host是角色锁，不捏造guest发起busy |

## 最小剩余执行范围与源码引用

1. **短loading入口与图鉴**：执行现有loading批次的原App品牌按钮四态／导航；执行 archive-extra；约10个职责代表填上上表“待archive-extra”，不重复已通过141项。额外源码覆盖不是按按钮数量做笛卡尔积。
2. **联机**：复用实际本机服务的一次host＋guest/viewer流程，在entry/create/join/lobby/selecting/result各停点复用四态sampler；同fieldset的一次真实pending逐字段采disabled，ready／role／start／leave的自然pending按真正请求进入。native select 用真正popup/Arrow＋Enter，勿用selectOption当OS验收。当前在线后半未执行的条件原样保留。
3. **同源码复用**：教程不同next文字、欢迎returning标题/P01确认/结束预览已具相同JSX/class与真实业务证据，无需重复低风险文案四态。settings音效与音乐同map；Identity四头像同button JSX；ordinary Modal正文只有新增class或禁用条件不同才增样本。受控profile/settings/quit/fixture/solo失败使用真实IPC Reply `{ok:false,error:'SAVE_FAILED'}`，没有复制Modal实现或合成DOM属性。

源码位置： [renderer.tsx](../../../game/desktop/renderer.tsx#L98)（错误／欢迎／菜单／prepare／设置／Modal，98–117）；[WelcomeEntrance.tsx](../../../game/desktop/WelcomeEntrance.tsx#L31)（stage inert、tools/title disabled、31–43）；[SharedUI.tsx](../../../game/desktop/SharedUI.tsx#L5)（Identity与Modal，5–27）；[BattleStage.tsx](../../../game/desktop/BattleStage.tsx#L65)（HUD／history/token/card/confirm、65–85；Situation与MatchResult、89–103）；[ManualArchive.tsx](../../../game/desktop/ManualArchive.tsx#L51)（Example rounds/playing，51–71；真实导航，114–125；搜索／图鉴／阅读层，129–174）；[TutorialCoach.tsx](../../../game/desktop/TutorialCoach.tsx#L30)（hint/next/complete条件，30–32）；[OnlineRoom.tsx](../../../game/desktop/online/OnlineRoom.tsx#L88)（不同联机消费者、blocked fieldset、原生select、结果，88–158）；[useOnlineSession.ts](../../../game/desktop/online/useOnlineSession.ts#L16)（blocked/exitBlocked来源）。

本表不累计controls记录数为完整七态全部通过。控件代表／合法busy合同、动态路线／原生拖窗全屏跨屏、严格聚焦性能各自按实际证据判断；锁屏阻碍与缺少具体设备条件分开，M2/M3保持未完成。
