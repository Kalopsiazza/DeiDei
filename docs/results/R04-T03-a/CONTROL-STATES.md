# 实际控件状态与运行证据

本表按实际 JSX、父级禁用条件和样式覆写划分消费者。原六批实际 App 补测、图鉴附加批次 AE5 与初始 loading 批次 LD2 均 PASS；联机 O13 的命名DOM消费者与十一类请求锁补测 PASS，原生popup接受由同产品指纹的 N7 独立补齐；历史各次FAIL保持；表中的“复用”明确说明代表控件、同一源码条件或同一 JSX，不把相同文案、共享 Modal 名称或一次路线通过当成所有消费者通过。此表不代替动态适配、原生窗口操作或严格前台性能验收。

## 证据与输入

本表相对链接是已归档并回读的精选副本，原件与副本SHA256见 evidence/MANIFEST.json；历史失败原件与执行输入保持。原始运行目录均在 `/Users/zengchongtai/develop/DeiDei/.local-outputs/r04-t03-a/`。QA driver不同版本和dirty输入保留，不写成统一collector已运行。

| 代号 | 归档链接／原始运行 | 实际结果及输入 |
| --- | --- | --- |
| F | [controls-front.json](evidence/controls-front.json)；`controls-front-unlocked-v2/checks.json` | PASS，88条 controls／2条 business。HEAD `ac012f979b7351ae2100b51731842b5b765020b3`＋QA dirty＋welcome 焦点单行修改；运行 welcome.css 为 W1。 |
| S | [controls-settings.json](evidence/controls-settings.json)；`controls-settings-unlocked-v2/checks.json` | PASS，141／3。HEAD 同 F＋QA dirty；运行 welcome.css 为 W0，其余 renderer/style 同 F。 |
| R | [controls-recover.json](evidence/controls-recover.json)；`controls-recover-unlocked-v1/checks.json` | PASS，55／2。HEAD `dc38024a91818c3e2a2ca537675549409cfca620`＋QA dirty；运行 welcome.css W1。只损坏隔离临时 profile，备份原文件 hash 实际核验。 |
| L | [controls-local.json](evidence/controls-local.json)；`controls-local-unlocked-v2/checks.json` | PASS，167／4。HEAD 同 F＋QA dirty＋welcome 焦点单行；运行 W1。只读目标读真实子元素 `.avatar`／`strong` 样式，baseline 和实际 Tab 后各等220ms。 |
| A | [controls-archive.json](evidence/controls-archive.json)；`controls-archive-unlocked-v2/checks.json` | PASS，141／1。HEAD 同 R＋QA dirty；运行 W1。搜索 focus-within 的真实 owner 边框／阴影一并采样。 |
| T | [controls-tutorial.json](evidence/controls-tutorial.json)；`controls-tutorial-unlocked-v1/checks.json` | PASS，50／4。HEAD 同 R＋QA dirty；运行 W1。实际 worker 完成 guided、challenge失败／重试／胜出及进入普通单人。 |
| AE5 | [archive-extra checks 副本](evidence/controls-archive-extra-final.json)；`controls-archive-extra-final-v5/checks.json` | PASS，88条 controls／1条 business。HEAD `98955894b432f1f12d4bdf36f0a4697cdf95aeb7`＋仅两个QA driver dirty；运行 renderer/style/W1 与产品 P5一致。11个四态职责、原生 details 展开、相关导航、多拍回合、无结果恢复、icon group实际Tab/Home/End。 |
| LD2 | [loading checks 副本](evidence/controls-loading-final.json)；`controls-loading-final-v2/checks.json` | PASS，7条 controls／1条 business。HEAD及QA-only dirty同AE5，运行同P5。只延迟原profile.read8000ms；loading brand真实四态、点击导航、原handler返回ok／calls1，未虚造brand busy。 |
| MC | [modal-contract.json](evidence/modal-contract.json)；`modal-contract-unlocked-v1/checks.json` | PASS，两 case；HEAD `6eb652d088ffdf1f9e047bb14b9d48acf5037885`＋QA/stage.css dirty。实际 SharedUI export，测试 parent 只改变 props。 |
| SU | [settings-unlocked.json](evidence/settings-unlocked.json)；`settings-unlocked-after-v1/dynamic.json` | PASS；HEAD 同 MC＋QA/stage.css dirty。设置昵称／头像／checkbox 三个真实四态代表，实际 Tab／Space、resize、native focused=true。style 是历史 `54c0ae99b27edc8f7a2532ee50c9600ef95a06c77e11688b0ebf697f48757210`。 |
| OU | [online-unlocked.json](evidence/online-unlocked.json)；`online-unlocked-bottom-auto-v1/checks.json` | PASS，17项业务检查；HEAD `9b1d500b4fbd6166d6faa195b2d34e1e8d06a601`＋QA/battle-identity.css dirty。实际本机服务，同 owned host 依次6／3／4／5／2人；自然 create／submit／Apply pending，实际后拍及结果返厅。 |
| O5 | [controls-online-v5-failure.json](evidence/controls-online-v5-failure.json)；`controls-online-unlocked-v5/checks.json` | **整体FAIL**：180秒native popup continuation marker超时。35条状态记录已到lobby select；retry／实际SERVER_RESTART离线、create/join字段集继承禁用、role容量满与释放、真实role pending均有证据。输入HEAD同R＋QA dirty；runtime renderer/style同六批。不要把后半未执行或marker当原生接受通过。 |
| N7 | [native-cua 副本](evidence/native-select-accepted.json)＋[初始30秒](evidence/native-select-popup-30.png)／[Up高亮20秒](evidence/native-select-popup-highlight-20.png)／[Return接受20秒](evidence/final-native-select-accepted.png)；[continuation副本](evidence/controls-online-v7-failure.json) | **仅原生popup接受证据完成**：实际CUA截图/AX与Up→Return，popup关闭、父dialog仍开，driver随后读option=`20000`。HEAD同AE5、dirty为空，运行同P5。v7整体仍FAIL（最后result卸载后generic confirm查询旧battle按钮超时）；marker只是恢复驱动，不是接受证明；20秒是实际选项，不是本次政策已应用的声明。 |
| O10 | [online v10 failure 副本](evidence/controls-online-v10-failure.json)；`controls-online-final-v10/checks.json` | **整体FAIL**：`返回主菜单 real pointer active`；3条状态记录，前2条verified，第三仅完成default/hover/active原始样本，0条business；后半未执行。HEAD `2c5b0b896a31331d12627b471647a70d9223c8c0`，dirty为空，运行renderer/style/W1同P5。旧O5与v7/v8/v9失败不改写。 |
| OH | [v8失败副本](evidence/controls-online-v8-failure.json)／[v9失败副本](evidence/controls-online-v9-failure.json)／[v11失败副本](evidence/controls-online-v11-failure.json)／[v12失败副本](evidence/controls-online-v12-failure.json) | **整体均FAIL**：v8 58状态/15business，误要求最后提交disabled与submitting同帧；v9 64/17，即刻native focus断言；v11 48/9，pause关闭按钮hover；v12 58/13，ACK后跨时点isDisabled断言。v8/v9 HEAD同AE5＋QA dirty，v11/v12 HEAD同O10＋各原件列出的QA dirty。首错与partial不因O13通过而改写；v7 FAIL在N7、v10 FAIL在O10另列。 |
| O13 | [online v13 checks 副本](evidence/controls-online-final.json)；`controls-online-final-v13/checks.json` | **PASS**，3项检查／66条controlStates全部verified／796条natural（host501＋guest295），不合计成七态笛卡尔积。HEAD `63496395b59af71998a47a1e183e509c8472865b`，dirty为空，运行renderer/style/W1同P5。11类请求逐项有真正pending或leaving且disabled样本；两端进入result、host3与guest2可用结果动作四态、guest WAITING固定disabled、host返厅、两端实际离房。raw `applicableOnlineDOMConsumersComplete=true`、`controlStatesComplete=false`保留；后者是原生popup单独证据的设计边界，不改raw为true。 |
| C | [completion-product.json](evidence/completion-product.json)；`completion-product/checks.json` | PASS，14项；产品 `1b2b7a182e53e7f61b563638f58622893c5fa4b1`，dirty为空。实际 App 预览／设置迟延成功与失败、trusted Escape→Enter、父页面／焦点／退出。 |
| W | [welcome-product.json](evidence/welcome-product.json)；`welcome-product/welcome-native.json` | PASS，37项；产品同 C、dirty为空。首次／P01／returning 路径、P01建档不写真实已存 profile、同 PID watcher reload，运行 welcome.css W0。 |
| D | 现有 dynamic 归档按原文件保留 | 只引用具体控件代表或实际结束预览行为；旧整次 FAIL／首错保持原状。最终动态重跑由独立动态证据更新，不在这里改写。 |

F/S/R/L/A/T、AE5、LD2、N7、O13 的 renderer runtime SHA-256 均为 `02623dff22676f84615e686a19e19a5bfd1e55fcb457cc853e2fc6ceb0581a90`，style 均为 `f116daceded31ae25d74546026e62d63c5157d4f47c3f94ffc6907cd442f9911`。W0=`530cd5bebdb0a86dcb07eeb756b654c9d5b3604c1f50ccf1e7980aa505b2b921`；W1=`5bc9062eb8b3b51f20f151b0210e206fc40d188625671dbefc7cdbfbae0b2dce`。当前源码 SharedUI hash 与 MC／六批一致：`5b067b7a989e454a904be9419ea2e1e66d71d298b54f7a2aebec6ffb6afc2d4d`。原六批与 AE5／LD2 均 normal exit=0／无强杀／owned children消失／隔离 profile删除，所有记录到的 Tab／Escape／Enter 均 trusted。原六批四态代表在真实Tab后逐项断言 native focused=true、documentFocus=true，保存其余默认／hover／active时的documentFocus。AE5／LD2 每个四态组入口显式激活 owned app，再断言 native/document focus；Tab后的组终点仍保留二者断言，最终业务快照前再激活并断言。它们证明命名采样点，不是整个业务等待期间的连续原生焦点；原失败保持，不宣称已定位OS失焦原因。O13每组四态入口使用真实owned native activation，有界等至focused再输入；保存四态document focus。其normal host/guest/service exit=0、无强杀、两隔离profile删除；本行不扩大为连续native focus或严格性能。当前产品来源仍为P5 `dc38024a91818c3e2a2ca537675549409cfca620`，P5之后AE5／LD2／N7／O13所用的后续HEAD仅包含QA/文档增量，已按Git文件列表核对。

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
| initial loading `.topbar .brand`（独立class） | LD2 `loading/brand` | LD2 | LD2 active=true | LD2真实Tab | NA：导航不保持selected | source sceneChangePending条件；初始loading样本enabled，未制造不可达锁 | NA独立busy：同步导航；LD2只延迟原profile.read8000ms，原reply ok／calls1，brand点击不重复读取 |
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
| archive list group | A列表/按键行为 | 滚动组非按钮，A真实滚动；不要求按钮hover视觉 | 无click动作；真实Arrow/Home/End已做，按压不另计业务state | A stack group实际Tab、Home/End/ArrowDown保留焦点；AE5 icon group不同class，真实Tab／可见outline，End选ZengRewardBigBi、Home回Charge | NA：焦点不是选项，选项见牌/图标 | NA：无disabled | NA：同步浏览 |
| archive depth tab（精确属性代表） | A | A | A | A | A aria-selected/pressed true | NA：无disabled | NA：同步切深度 |
| archive scene picker | A | A | A | A | A true | NA：无disabled | NA：同步换示例 |
| archive demo beats | A | A | A | A | A true | NA：无disabled | NA：同步选择演示阶段 |
| archive demo rounds `.archive-rounds` | AE5 `archive-extra/round` | AE5 | AE5 | AE5 | AE5实际多拍bomb-timeline第二回合pressed=true、beat归0 | NA：无disabled | NA：同步换回合，不当播放busy |
| archive play | A | A | A | A | A playing=true；真实开始/暂停 | NA：无disabled | NA请求busy：playing是演示状态 |
| archive terms summary | A | A | A | A | 原生details open，A actual expand | NA：无disabled | NA：原生展开 |
| archive header reader（start/questions/rules同button JSX） | AE5 questions `header-reader`；start/rules复用同JSX/class且各入口已有实际点击 | AE5代表复用 | AE5代表复用 | AE5代表复用 | AE5 questions实际打开后aria-pressed=true | NA：无disabled | NA：同步开阅读层 |
| archive onboarding steps | A | A | A | A | A末step true | NA：无disabled | NA：同步换步骤 |
| archive onboarding next | AE5 `next-enabled`；A末step禁用 | AE5 enabled | AE5 enabled | AE5 enabled | NA：推进动作；AE5实际下一步pressed=true另记录 | A末step disabled；AE5初始step enabled | NA：同步换步骤 |
| archive think summary／native原条款 summary | A各消费者命名样本 | A各 | A各 | A各 | 原生details open，A各真实展开 | NA：无disabled | NA：原生展开 |
| archive chapter button | A | A | A | A | A true | NA：无disabled | NA：同步切章节 |
| archive FAQ summary（不同class覆写） | AE5 `question-summary` | AE5 | AE5 | AE5 | AE5真实details open；不伪造pressed | NA：无disabled | NA：原生展开 |
| archive guide-card link（FAQ/start/rules共同archive-guide-actions） | AE5 FAQ代表 `guide-card-link`，共同class/handler复用 | AE5代表复用 | AE5代表复用 | AE5代表复用 | NA：链接动作 | NA：普通卡链接无disabled；下一步单列 | NA：同步相关导航；AE5实际Xiao卡详情、阅读层卸载 |
| archive relations／related-back | AE5两职责各命名样本 | AE5各 | AE5各 | AE5各 | NA：相关导航动作 | NA：无disabled | NA：同步选卡/回退；AE5 Charge→Cloud→Charge |
| archive more-relations summary | AE5 `more-relations-summary` | AE5 | AE5 | AE5 | AE5真实details open；不伪造pressed | NA：无disabled | NA：原生展开；其内relation与外部同class/handler复用 |
| archive rule-link | AE5 `rule-link` | AE5 | AE5 | AE5 | NA：导航动作；AE5对应R01 details实际open | NA：无disabled | NA：同步开规则 |
| archive egg toggle | AE5 `egg` | AE5 | AE5 | AE5 | AE5 aria-expanded true→false，不伪造aria-pressed | NA：无disabled | NA：同步便签开关 |
| archive no-match reset | AE5 `no-match-reset` | AE5 | AE5 | AE5 | NA：重置动作 | NA：无disabled | NA：同步清search/category；实际恢复33张卡 |
| archive back | A | A | A | A | NA：导航 | A leaving disabled | A实际380ms离场锁 |
| archive tutorial-entry | A | A | A | A | NA：启动 | A leaving，T真实startTutorial busy disabled | T真实IPC迟延成功／calls1 |
| Tutorial guided/challenge next primary（不同文字同一JSX） | T `guided-next`／`retry`；其它文案实际推进 | T代表复用同primary | T代表复用 | T代表复用 | NA：推进动作 | T guided冻结suspended、tutorialNext busy disabled；所有文案同busy/suspended表达式 | T真实tutorialNext迟延；guided→challenge，challenge失败→retry→获胜→complete均实际worker；不同text不需要独立虚构busy |
| Tutorial hint | T | T | T | T | T true | T submit busy disabled | T真实submit受控失败后保持challenge/selecting／提示与确认恢复 |
| Tutorial complete solo | T | T | T | T | NA：启动 | T startSolo busy disabled | T真实startSolo迟延成功 |
| Tutorial complete back | T | T | T | T | NA：返回 | T同startSolo父busy disabled | T父锁；自身leave同步清view，不造教程退出pending |

LD2 使用现有原App wrapper只延迟初始profile.read；brand四态后实际导航欢迎页，原handler在约8000ms返回ok且calls1，继续进入昵称阶段。它没有把读取期间无独立busy prop的brand标成busy。

AE5 已完成此前最小新增职责批次，使用真实content的FAQ目标Xiao、相关Cloud、R01和多拍bomb-timeline；另有无匹配恢复33张卡及icon group原生Tab/Home/End。它只补上述命名职责与明确共享consumer，不按每张卡/每条文案重复矩阵。旧archive-v1 search owner、local-v1 ARTICLE及archive-extra/loading各次focus失败保持原始首错，不把采样失败重写成产品bug。

## 联机职责与边界

OU证明原本多人业务与后拍政策/飞行路径。O13已实际通过命名联机DOM消费者；N7独立证明同P5产品的原生popup Up→Return接受20秒。两者联合使用不改写O13的raw `controlStatesComplete=false`、不将continuation marker当接受，也不将本次lobby Apply冒充当前拍deadline/飞行验收。历史O5及v7–v12全部FAIL保留。

O13的十一类请求锁已从raw重新核对：retry、create、join、role-spectator、role-player、ready、start、time-apply-lobby、submit、result-return、leave，逐类均有命名action/selector/text、disabled和真正pending/DOM pending/leaving。原online.openLobby、online.start及两次online.leave各1800ms的命名延迟分别记录，calls=1，原handler和真实服务协议仍执行；其余正常pending不伪造ACK或DOM。结果返厅的720ms leaving期间三个host动作实际disabled；实际leave确认后Modal立即卸载，pending锁记录在房间出口，不能反称可见Modal正文仍在等待。

| 实际消费者／source | default | hover | active | focus-visible | selected | disabled | busy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Online entry create／join（menu primary/secondary覆写） | O13各代表；O5历史 | O13各 | O13各true | O13各 | NA：导航 | O13实际connecting !connected禁用 | O13 retry父pending锁；入口本身同步换表单 |
| Online retry reconnect | O13实际SERVER_RESTART入口 | O13 | O13true | O13 | NA：动作 | O13 Retry busy disabled | O13真实重新连接online.openLobby迟延1800ms、calls1；实际connecting两入口同步锁 |
| Online entry/form back `.settings-back` | O13返回菜单／create back | O13 | O13true | O13 | NA：导航 | O13 create/join父pending；offline退出enabled | 父请求锁O13；表单返回同步，leave另列 |
| Online turn/cap range（各有不同覆写） | O13各 | O13各 | O13各true | O13各 | NA：数值不是selected | O13实际!connected及create pending逐字段disabled | O13父字段集锁，实际reconnect后容量1仍保持 |
| Online room code／password input（不同class） | O13 create password、join code/password各样本 | O13各 | O13各true | O13各 | NA：文字 | O13 create/join逐字段disabled | O13真实父pending锁，字段无独立spinner |
| Online early checkbox／role radio | O13各 | O13各 | O13各true | O13各，radio读真实sibling视觉 | O13 early/player/spectator实际checked | O13 create/join父fieldset锁 | O13真实父pending，不能说输入无disabled |
| Online create submit | O13；OU各N业务 | O13 | O13true | O13 | NA：提交 | O13fieldset pending／!connected；OUfalse→true→false | O13自然create pending／确认中… |
| Online join submit／fallback spectator | O13 join；fallback复用同join handler及既有settings-action代表，真实错误fallback分支未专项 | O13 join；fallback仅明确共享代表 | 同左 | 同左 | NA：提交 | O13 join blocked逐字段；fallback同fieldset源条件 | O13 join pending；不称fallback错误分支独立执行 |
| Online lobby ready／role change | O13 ready四态；两个role职责各四态 | O13各 | O13各true | O13各 | NA：无pressed；取消准备只是同button文案 | O13六参战席/观众容量满disabled→释放enabled；ready与role真实请求锁 | O13两个role自然pending、两端ready自然pending；authoritative各自ready=true才开局 |
| Online lobby start | O13 enabled四态；not-ready disabled另样本；OU各N | O13 enabled | O13 enabled true | O13 enabled | NA：启动 | O13 not-ready、真实start期间disabled | O13 online.start1800ms原handler，start/取消准备/出口同步锁，calls1 |
| Online copy code | O13四态及实际复制；OUnotice业务 | O13 | O13true | O13 | NA：动作 | NA：JSX无disabled | NA：clipboard Promise只notice，无busy锁/文字 |
| Online timing-open／Apply | O13两职责各四态；OU政策业务 | O13各 | O13各true | O13各 | NA：动作 | O13 Apply与Shared close真实pending禁用；open父blocked条件有自然样本 | O13 lobby Apply自然pending并关dialog；OU当前拍/后拍政策另证，不互相冒充 |
| Online native timing select | O13原生control默认；N7真实popup初始30 | O13hover=true | O13 pointer打开popup、raw active=false保留；N7 OS popup/Up→Return另证，不标DOM active PASS或NA | O13实际Tab/outline；N7原生Up→Return接受20、popup关父dialog仍开 | O13真实selectOption20选项；N7 Return后driver option20000；marker本身不算接受 | NA：无disabled prop、不在disabled fieldset | NA：同步limitMs；Apply busy不禁select；N7不单独宣称20政策生效 |
| Online HUD pause／situation | O13各实际四态 | O13各 | O13各true | O13各 | NA：开dialog | NA：JSX无disabled | NA：同步开dialog |
| Online HUD freeze | O13固定disabled样本 | NA：online原生disabled目标 | NA：online固定disabled | NA：disabled不Tab | 源aria-pressed存在但在线一直false，无true声明 | O13 online mode固定disabled | NA：线上onFreeze无操作，不发网络pause |
| Online pause close／resume／room-settings／leave（battle-dialog） | O13各职责四态 | O13各 | O13各true | O13各 | NA：动作 | room-settings源!canAdjust；O13 host enabled，其角色禁用分支未单采，普通disabled视觉/语义可复用相同pause-actions button；其余JSX无disabled，close的closing合同另记 | NA独立请求：同步开关菜单，确认leave另列 |
| Online situation battle-dialog close | O13 `situation close` | O13 | O13true | O13 | NA：关闭 | 无独立closeDisabled；closing期间Shared合同MC/C复用 | NA：同步开关，closing合同不当请求busy |
| Online leave-confirm primary／continue／close | O13 lobby host各四态；guest实际确认复用同SharedUI/handler | O13 host代表复用 | 同左 | 同左 | NA：动作 | 源primary exitBlocked、close busy且connected；普通leave确认立即卸载，O13 pending禁用在房间出口；continue无disabled；不虚造可见dialog等待状态 | O13两端原api.leave1800ms、各calls1，真实菜单返回；相同Shared busy合同MC复用，正文无独立spinner |
| Online cinematic skip | OU实际立即入场，O13现有enterArena实际路径 | 复用L同cinematic-skip class/hover规则，online.css无该button专属覆写 | 复用L同class/原生button与同步handler | 复用L同cinematic-skip及foundation.css共享button:focus-visible规则，online.css无该button专属覆写；未称O13独立skip四态 | NA：阶段动作 | NA：JSX无disabled | NA：同步setEnteredMatch，阶段卸载 |
| Online result host review／primary／exit | O13三动作各四态；OU各N返厅 | O13各 | O13各true | O13各 | NA：结果动作 | O13真实resultLeaving期间三者disabled；primary还有blocked/pending_close源条件 | O13 host returnLobby实际请求，720ms离场锁；两端均入lobby，不用local startSolo代替 |
| Online result guest review／exit | O13两动作各四态 | O13各 | O13各true | O13各 | NA：结果动作 | 共享MatchResult leaving，O13 host结果锁代表；guest exitBlocked源条件由真实leave出口锁佐证 | guest review/开leave dialog同步；实际leave请求O13另证 |
| Online guest result WAITING primary | O13真实default+disabled，text等待房主开启下一局/WAITING | NA：固定原生disabled | NA：固定disabled | NA：disabled不Tab | NA：不是selected | O13 disabled=true；源非host或pending_close/blocked，当前guest非host | NA：guest不能发returnLobby；角色等待不捏造本人busy |
| Online Battle card default／selected／unavailable | O13 Charge默认和已选各四态；unavailable独立 | O13 enabled各 | O13 enabled各true | O13 enabled各 | O13实际Charge pressed=true，33卡同map JSX复用 | O13资源不足实际reason、自然submit锁；参与者角色由真实editable源条件 | O13 host submit action有natural pending/disabled；最后guest直进公开新拍/结果，不强求必有submitting中间DOM帧 |
| Online Battle confirm | O13 enabled四态；未选disabled独立 | O13 enabled | O13 enabled true | O13 enabled | NA：提交动作 | O13 no-selected、actual submit busy/已提交 | O13自然submit；Charge公开last_turn原回合/双方entry=Charge/source=human逐项核验，不能以超时推进代替真实点击接受 |

O13只声明两端实际进入result，没有对最后SelfBi outcome做独立一致性比较；两次Charge推进则已按两端公开last_turn完整相等、原turn_id、每端动作Charge与source=human严格验证。共享只读token/history/result-player继续用L/T同BattleStage消费与样式代表，不因网络路由额外捏造selected、disabled或busy。表中明确复用的enabled视觉或角色条件不等于每段文字/每个人数都有独立四态；没有采到的具体分支仍按源码与代表边界说明。

## 复用边界与源码引用

1. **短loading入口与图鉴已补完**：LD2／AE5填上各命名职责；既有六批保持独立输入，不累计记录数为七态全部通过。
2. **联机命名职责补测已通过**：O13 PASS与N7真实原生接受按相同P5指纹联合使用；raw flags和历史FAIL各自保留。没有新增一轮文案矩阵；最终动态路线/人数布局、原生拖窗全屏跨屏及严格前台性能继续由各自实际证据验收，O13不代替这些检查。
3. **同源码复用**：教程不同next文字、欢迎returning标题/P01确认/结束预览已具相同JSX/class与真实业务证据，无需重复低风险文案四态。settings音效与音乐同map；Identity四头像同button JSX；ordinary Modal正文只有新增class或禁用条件不同才增样本。受控profile/settings/quit/fixture/solo失败使用真实IPC Reply `{ok:false,error:'SAVE_FAILED'}`，没有复制Modal实现或合成DOM属性。

源码位置： [renderer.tsx](../../../game/desktop/renderer.tsx#L98)（错误／欢迎／菜单／prepare／设置／Modal，98–117）；[WelcomeEntrance.tsx](../../../game/desktop/WelcomeEntrance.tsx#L31)（stage inert、tools/title disabled、31–43）；[SharedUI.tsx](../../../game/desktop/SharedUI.tsx#L5)（Identity与Modal，5–27）；[BattleStage.tsx](../../../game/desktop/BattleStage.tsx#L65)（HUD／history/token/card/confirm、65–85；Situation与MatchResult、89–103）；[ManualArchive.tsx](../../../game/desktop/ManualArchive.tsx#L51)（Example rounds/playing，51–71；真实导航，114–125；搜索／图鉴／阅读层，129–174）；[TutorialCoach.tsx](../../../game/desktop/TutorialCoach.tsx#L30)（hint/next/complete条件，30–32）；[OnlineRoom.tsx](../../../game/desktop/online/OnlineRoom.tsx#L88)（不同联机消费者、blocked fieldset、原生select、结果，88–158）；[useOnlineSession.ts](../../../game/desktop/online/useOnlineSession.ts#L16)（blocked/exitBlocked来源）。

本表不累计controls记录数为完整七态全部通过。控件代表／合法busy合同、动态路线／原生拖窗全屏跨屏、严格聚焦性能各自按实际证据判断；联机命名DOM职责O13与原生popup N7已分别补完；独立最终动态/原生/性能验收仍按各自原件的实际状态，当前本表不单独宣告M2/M3完成。
