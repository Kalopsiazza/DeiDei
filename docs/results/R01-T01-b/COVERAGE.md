# R01-T01-b｜逐项覆盖与独立推导

全部 60 条映射、33 个入口、80 组案例均逐项审阅。PASS 只表示文档比对／手工推导未发现该项冲突，不是程序测试通过；GAP/ISSUE 是已确认文本遗漏或覆盖缺口，CLARIFY 是输入不足待澄清。性质案例仍是 DESIGNED_NOT_RUN。

固定正式稿：[3a81daf][base]；原证据：[d3a1e58][source]。原话引用包含原文及紧邻的问句解释；“是的／同意”等短答只能依该存档上下文审阅，不宣称重获完整原聊天或第40轮截图。

`K(X)` 为本轮、重开之前的不同有效击杀目标集合。表中只写非空 K，其余为空。原案例遗漏时这里明确补出推导，不以改写规则解决。未逐项重复的合法成本、次数、历史均按入口表与 R09/R16/R17 记一次；净收益在重开前，随后新局全部归零。

## 60 条 G 映射

逐项先比对原 G，再回到答复并核对新 R。58 项落点完整，G22/G59 有 F05 所指正文遗漏；没有发现另一个与后期答复相悖的映射规则。

| G／原文定位 | 新 R 落点 | 原答复行 | 状态 | 独立判断 |
| --- | --- | --- | --- | --- |
| [G01][G01]（L99） | [R03][R03] | [L126][a126]、[L429][a429] | PASS | 先全场属性、再原始作用与回击，P4统一写回；没有按席位逐人跑全轮。 |
| [G02][G02]（L100） | [R04][R04]、[R26][R26] | [L46][a46]、[L457][a457]、[L659][a659] | PASS | 致命记录不会撤销本轮行动；新局在账目之后。 |
| [G03][G03]（L101） | [R09][R09]、[R16][R16] | [L75][a75]、[L263][a263]、[L334][a334] | PASS | 当前来源负责费用与明示收益例外，完整身份负责历史；没有历史来源链。 |
| [G04][G04]（L102） | [R07][R07] | [L75][a75]、[L317][a317] | PASS | 仅普通削适用当前正防御兜底；强化削不适用。 |
| [G05][G05]（L103） | [R09][R09] | [L11][a11]、[L631][a631] | PASS | 强化门槛1/3但扣0，兑换与复制另付一次来源费用，概念没有混同。 |
| [G06][G06]（L104） | [R08][R08] | [L326][a326]、[L461][a461]、[L613][a613] | PASS | 专属防同时看等号数值与类别；不能变成小于等于，也保留普通削特例。 |
| [G07][G07]（L105） | [R14][R14] | [L46][a46]、[L342][a342] | PASS | 成功自bi防御无穷，历强10000仍被挡；不改成9999。 |
| [G08][G08]（L106） | [R06][R06]、[R15][R15]、[R26][R26] | [L46][a46]、[L363][a363]、[L659][a659] | PASS | 对撞仅该对抵消，多历强保留第三人攻击；回合继续与整场结束分开。 |
| [G09][G09]（L107） | [R19][R19] | [L97][a97]、[L11][a11] | PASS | 首次阈值后改1/3；后续1/2/3封顶，T+1末成熟且T+2才使用。 |
| [G10][G10]（L108） | [R05][R05] | [L111][a111] | PASS | 来袭逐条防御，强度不求和破盾，也不消耗防御容量。 |
| [G11][G11]（L109） | [R12][R12] | [L111][a111]、[L117][a117] | PASS | 三雷面对两吸收，各得3各付1，不分摊。 |
| [G12][G12]（L110） | [R14][R14] | [L138][a138]、[L143][a143] | PASS | 至少一合规对象才成功，失败必自身淘汰；双纯自bi全员淘汰。 |
| [G13][G13]（L111） | [R18][R18] | [L154][a154]、[L162][a162] | PASS | 一轮一个分支对全场共用；不按目标选效果。 |
| [G14][G14]（L112） | [R18][R18] | [L158][a158]、[L190][a190]、[L207][a207] | PASS | 先存活再本人击杀，都死仍比较击杀；不拿别人死亡数评分。 |
| [G15][G15]（L113） | [R18][R18] | [L175][a175]、[L183][a183] | PASS | 同等评分随机；等概率由规划者单列设计选择，不冒充逐字原话。 |
| [G16][G16]（L114） | [R04][R04] | [L207][a207]、[L210][a210] | PASS | 多人有效杀同一目标各记1，单一作用者按目标去重；F01是案例默认冲突，正文映射正确。 |
| [G17][G17]（L115） | [R18][R18] | [L247][a247]、[L251][a251] | PASS | 采用第15轮局部视图替代第13轮联合方案；其他选择者全排除，恢复全场不重选。 |
| [G18][G18]（L116） | [R17][R17] | [L11][a11]、[L263][a263]、[L588][a588] | PASS | 本人最近仍有效高阶，不要求上回合，未用且有记录才可0DD复制。 |
| [G19][G19]（L117） | [R15][R15]、[R16][R16] | [L263][a263]、[L549][a549]、[L561][a561] | PASS | 完整身份忽略来源/分支；休整豁免独立，不传给免费大bi；F02属用例输入缺口。 |
| [G20][G20]（L118） | [R15][R15] | [L342][a342]、[L346][a346] | PASS | 成功看合规重复事实，攻击10000仅对重复者，防9999；目标挡住不取消成功。 |
| [G21][G21]（L119） | [R15][R15] | [L310][a310]、[L573][a573]、[L631][a631] | PASS | 失败只读开始DD，0按攒、正数无攻防；合法成功失败均占用一次。 |
| [G22][G22]（L120） | [R08][R08] | [L310][a310]、[L317][a317] | GAP-F05 | 数值+比较/匹配原则保留，但正式防御表未给攒的防御0，无法称逐招字段全部显式齐全。 |
| [G23][G23]（L121） | [R14][R14] | [L138][a138]、[L342][a342] | PASS | 10000限反制目标；失败是直接自身淘汰，不走可格挡伤害。 |
| [G24][G24]（L122） | [R10][R10] | [L359][a359]、[L364][a364] | PASS | 上限含100，超过则该次防御及反制失效，不取消别次效果；云由第27轮补入。 |
| [G25][G25]（L123） | [R11][R11] | [L379][a379]、[L391][a391] | PASS | 只回原攻击者的原数值，击杀归反弹者，不能反全场或取最大值。 |
| [G26][G26]（L124） | [R12][R12] | [L380][a380]、[L391][a391] | PASS | 合规攻击逐次求和，施放费一次，炸药/强化削零攻击收益仍保留。 |
| [G27][G27]（L125） | [R12][R12] | [L391][a391]、[L398][a398] | PASS | 每个攒者给每个吸收者1；只取消一次增长，旧余额不被多人重复扣。 |
| [G28][G28]（L126） | [R03][R03]、[R06][R06] | [L408][a408]、[L425][a425]、[L429][a429] | PASS | 四阶段确认，P2对撞盾与跨阶段保护分开；局部试算也算回击。 |
| [G29][G29]（L127） | [R13][R13] | [L441][a441]、[L445][a445] | PASS | 云沿用吸收匹配、不拿DD；每次1雷电，阻攒不扣旧余额。 |
| [G30][G30]（L128） | [R21][R21] | [L441][a441]、[L728][a728]、[L732][a732] | PASS | 采用第40轮1/3与不叠加，覆盖第27轮临时1；不把旧稿当现行。 |
| [G31][G31]（L129） | [R05][R05]、[R22][R22] | [L441][a441]、[L448][a448] | PASS | 三反制对田直接淘汰，没有10000伪伤害，无回击/吸收收益。 |
| [G32][G32]（L130） | [R20][R20] | [L457][a457]、[L461][a461]、[L633][a633] | PASS | 普通聂湘扣4余量留，强度7/2；可反弹、不可吸收/云防，复制另走0费。 |
| [G33][G33]（L131） | [R20][R20] | [L462][a462]、[L532][a532]、[L536][a536] | PASS | 基础每次1，成功挡bi/普通削/大bi每条再1；多目标不重复基础。 |
| [G34][G34]（L132） | [R22][R22] | [L457][a457]、[L463][a463] | PASS | 田最终清空攒的旧余额与增长，不取消别人的吸收收益；本轮死亡不改变它。 |
| [G35][G35]（L133） | [R10][R10]、[R23][R23] | [L474][a474]、[L478][a478] | PASS | 两贝对三反制禁防，不能因为小于100就放行。 |
| [G36][G36]（L134） | [R23][R23] | [L474][a474]、[L479][a479] | PASS | 三种两贝配对仅消掉彼此攻击，对第三人仍生效。 |
| [G37][G37]（L135） | [R05][R05]、[R23][R23] | [L474][a474]、[L480][a480]、[L484][a484] | PASS | 攒直接淘汰小贝，小贝对该攒者不攻击；后者是已标明的必要推论。 |
| [G38][G38]（L136） | [R12][R12] | [L496][a496]、[L500][a500] | PASS | 沃尔沃/炸药沃尔沃均能防；普通得4、炸药攻击得0，不沿用旧代码排除。 |
| [G39][G39]（L137） | [R18][R18] | [L496][a496]、[L502][a502] | PASS | 翻转沃尔沃分支强度4、吸收量看当前来源；完整身份与入口支出不变。 |
| [G40][G40]（L138） | [R06][R06] | [L512][a512]、[L520][a520] | PASS | 1/3、1、2、3、4、5与各自P2对撞数一致；费用6/8不当强度。 |
| [G41][G41]（L139） | [R07][R07]、[R11][R11]、[R12][R12]、[R13][R13] | [L521][a521] | PASS | 普通削/bi可反可吸；强化削可反但吸收0；大bi吸收5而不反。 |
| [G42][G42]（L140） | [R24][R24] | [L512][a512]、[L516][a516]、[L522][a522] | PASS | 普通防挡大bi是单独许可；反弹挡不住是5伤害，不是代码杀。 |
| [G43][G43]（L141） | [R25][R25] | [L532][a532]、[L549][a549]、[L553][a553]、[L569][a569] | PASS | 每局一次0DD，T与T+1攻0防无穷，系统续招；没有两次主动消费。 |
| [G44][G44]（L142） | [R25][R25] | [L532][a532]、[L559][a559] | PASS | 有利积攒清空含炸药进度/强化，限制性次数留下；不重置整人状态。 |
| [G45][G45]（L143） | [R25][R25] | [L532][a532]、[L558][a558] | PASS | T+4末唯一奖励、T+5开始可用、可保留不折现；状态机映射相符。 |
| [G46][G46]（L144） | [R22][R22]、[R24][R24] | [L549][a549]、[L557][a557] | PASS | 田防9含大bi5但不含两贝例外；无穷/9999可挡大bi是数值推论。 |
| [G47][G47]（L145） | [R15][R15]、[R25][R25] | [L549][a549]、[L561][a561] | PASS | 休整从重复集合剔除，其他重复照算；不能变成先触发再格挡，F02另列。 |
| [G48][G48]（L146） | [R17][R17] | [L588][a588]、[L600][a600] | PASS | 高阶只按实际攻击至少2，记录完整身份；曾义0不高阶、奖励大bi5可复制。 |
| [G49][G49]（L147） | [R17][R17]、[R25][R25] | [L588][a588]、[L602][a602] | PASS | 曾义清空有效记录，不从旧日志恢复；大bi实际出招后才建记录。 |
| [G50][G50]（L148） | [R17][R17] | [L592][a592]、[L605][a605]、[L606][a606] | PASS | 完整自bi/历强/反弹禁复制；复合招自bi分支仍按完整复合身份，推论已标明。 |
| [G51][G51]（L149） | [R17][R17]、[R26][R26] | [L596][a596]、[L607][a607]、[L682][a682] | PASS | 禁用/低阶不覆盖旧高阶；当轮账目保留不意味着跨新局还能复制。 |
| [G52][G52]（L150） | [R06][R06]、[R08][R08] | [L613][a613]、[L617][a617] | PASS | 普通防1、专属3/4、两贝7/10、聂湘7/2与特别匹配顺序一致。 |
| [G53][G53]（L151） | [R07][R07]、[R19][R19] | [L613][a613]、[L619][a619] | PASS | 强化削穿普通防与所有放炸药档，未误伤炸药来源攻击的对撞能力。 |
| [G54][G54]（L152） | [R09][R09] | [L627][a627]、[L631][a631] | PASS | 逐一比对完整33入口费用、成熟层/雷电门槛、一次限制与无额外次数上限。 |
| [G55][G55]（L153） | [R17][R17]、[R20][R20] | [L627][a627]、[L633][a633] | PASS | 复制聂湘0充能0DD，只用张新伟一次；普通聂湘仍扣4。 |
| [G56][G56]（L154） | [R02][R02]、[R27][R27] | [L641][a641]、[L657][a657]、[L658][a658] | PASS | 合法/灰牌、1—0与资格复核相符；组内顺序/超过10键留页面决定。 |
| [G57][G57]（L155） | [R01][R01]、[R26][R26] | [L641][a641]、[L645][a645]、[L649][a649]、[L653][a653] | PASS | 无人淘汰继续；有淘汰至少2人重开；1赢家；0无人获胜，措辞采用后补充。 |
| [G58][G58]（L156） | [R26][R26] | [L645][a645]、[L660][a660]、[L661][a661] | PASS | 新局资源/历史/次数/曾义/炸药全重置；已淘汰者不复活，房间数据不混入。 |
| [G59][G59]（L157） | [R05][R05]、[R08][R08] | [L671][a671]、[L675][a675]、[L679][a679] | GAP-F05 | 七种原始攻击0已出现于入口/正文；明确确认的攒防御0在所映射条款及正文缺字。 |
| [G60][G60]（L158） | [R21][R21] | [L717][a717]、[L722][a722]、[L728][a728] | PASS | 一份强化资格、不能挡bi来自摘录；防御1/3来自Teddy随后答复，来源区分正确。 |

## 33 个入口

所有 E 在正文费用表及玩家短文各出现一次，并与原目录的可用条件、费用、数值及当前来源核对。原身份名只作取证别名，不要求新引擎沿用旧枚举；新完整实际身份共26种。G54/第37轮费用表 [L631][a631] 适用于全部入口，特殊入口再按其所列原逐招字段和上表原话核对。PASS 不代表引用的 C 没有 F01 等表达问题。

| E／正式入口 | 原目录位置 | 数值、门槛、费用、来源核对 | 对应案例 | 状态 |
| --- | --- | --- | --- | --- |
| [E01][E01] | [Charge L830][sE01] | 0DD；攻0；防0缺显式正文；normal | [C001][C001]、[C019][C019]、[C048][C048] | GAP-F05 |
| [E02][E02] | [Bi L355][sE02] | 门槛/扣1DD；攻1/P2防1；normal | [C002][C002]、[C003][C003] | PASS |
| [E03][E03] | [Def L536][sE03] | 0DD；攻0/防≤1；大bi许可及基础/逐击充能；normal | [C005][C005]、[C006][C006]、[C078][C078] | PASS |
| [E04][E04] | [Three L373][sE04] | 门槛/扣3DD；攻3/P2防3；normal | [C004][C004]、[C017][C017] | PASS |
| [E05][E05] | [ThreeDef L557][sE05] | 0DD；攻0/防=3+三雷类；普通削兜底；normal | [C008][C008]、[C009][C009]、[C010][C010] | PASS |
| [E06][E06] | [BigBi L391][sE06] | 门槛/扣5DD；攻5/P2防5；不可反/普通防可挡；normal | [C006][C006]、[C042][C042] | PASS |
| [E07][E07] | [Reflect L673][sE07] | 门槛/扣1DD；无原始攻击/防≤100且类别匹配；逐条原值回击；normal | [C026][C026]、[C042][C042]、[C053][C053] | PASS |
| [E08][E08] | [Suicide L738][sE08] | 0DD；成功向反制者10000/持续防∞，失败自淘汰防0；normal | [C025][C025]、[C027][C027]、[C028][C028] | PASS |
| [E09][E09] | [Cloud L695][sE09] | 首次0后门槛/扣1DD；攻0/防≤100+匹配；每次1雷电；normal | [C020][C020]、[C079][C079] | PASS |
| [E10][E10] | [Bomb L850][sE10] | 门槛/扣1DD；攻0/防1/3→1→2→3；成熟T+1末；normal | [C016][C016]、[C054][C054]、[C055][C055] | PASS |
| [E11][E11] | [Xiao L411][sE11] | 门槛1/3DD；普通扣1/3，强化须buff且扣0；攻/P2防1/3；normal | [C008][C008]、[C014][C014]、[C015][C015]、[C024][C024] | PASS |
| [E12][E12] | [Pragon L430][sE12] | 门槛/扣2DD；攻2/P2防2；normal | [C004][C004]、[C010][C010]、[C026][C026] | PASS |
| [E13][E13] | [PragonDef L575][sE13] | 0DD；攻0/防=2+Pragon；普通削兜底；normal | [C008][C008]、[C009][C009]、[C010][C010] | PASS |
| [E14][E14] | [Volvo L448][sE14] | 门槛/扣4DD；攻4/P2防4；可吸收4；normal | [C011][C011]、[C021][C021] | PASS |
| [E15][E15] | [VolvoDef L593][sE15] | 0DD；攻0/防=4+Volvo含炸药与分支；normal | [C010][C010]、[C011][C011] | PASS |
| [E16][E16] | [RotateThree L785][sE16] | 门槛/扣6DD；完整旋转，分支Three3或自bi；不随分支降费；normal | [C034][C034]、[C060][C060]、[C061][C061]、[C062][C062] | PASS |
| [E17][E17] | [XiaoBei L470][sE17] | 门槛/扣7DD；攻7/P2防7；两贝逐对抵消、攒克制；normal | [C047][C047]、[C048][C048]、[C050][C050] | PASS |
| [E18][E18] | [FlipVolvo L806][sE18] | 门槛/扣8DD；完整翻转，分支Volvo4或自bi；normal | [C060][C060]、[C080][C080] | PASS |
| [E19][E19] | [Shell L492][sE19] | 门槛/扣10DD；攻10/P2防10；不怕攒；normal | [C047][C047]、[C049][C049]、[C062][C062] | PASS |
| [E20][E20] | [Absorb L715][sE20] | 门槛/扣1DD一次；攻0/防≤100+类别；各攻击+各攒者求和；normal | [C017][C017]、[C019][C019]、[C058][C058]、[C060][C060] | PASS |
| [E21][E21] | [NieXiang L513][sE21] | 需≥4充能扣4、0DD；攻/P2防7/2；反弹可防、吸收/云不可防；normal | [C010][C010]、[C052][C052]、[C053][C053]、[C077][C077] | PASS |
| [E22][E22] | [NieXiangDef L611][sE22] | 0DD；攻0/防=7/2+聂湘；普通削兜底；normal | [C008][C008]、[C010][C010]、[C038][C038] | PASS |
| [E23][E23] | [JuYan L629][sE23] | 0DD；攻0/防≤1/3；一份资格保留至合法削、不叠加；normal | [C012][C012]、[C013][C013]、[C014][C014] | PASS |
| [E24][E24] | [TianLiJun L649][sE24] | 首次0后门槛/扣1/2DD；攻0/防≤9；两贝禁防、三反制直淘；normal | [C043][C043]、[C045][C045]、[C046][C046]、[C051][C051] | PASS |
| [E25][E25] | [dynamic copy L872][sE25] | 本局未用+本人有效高阶；0DD/原招资源0；完整原招重算；zhang | [C037][C037]、[C038][C038]、[C039][C039]、[C040][C040] | PASS |
| [E26][E26] | [LiQiang L759][sE26] | 本局未用、0DD；成功10000/防9999，失败攻防0且DD=0按攒；normal | [C029][C029]、[C030][C030]、[C031][C031]、[C032][C032]、[C066][C066] | PASS |
| [E27][E27] | [Pragon L888][sE27] | 需/扣1成熟层、0DD；Pragon2；bomb吸收攻击收益0 | [C054][C054]、[C057][C057] | PASS |
| [E28][E28] | [Volvo L904][sE28] | 需/扣2成熟层、0DD；Volvo4；bomb吸收攻击收益0 | [C011][C011]、[C022][C022]、[C057][C057] | PASS |
| [E29][E29] | [FlipVolvo L920][sE29] | 需/扣4成熟层、0DD；完整翻转重选分支；bomb | [C057][C057]、[C058][C058]、[C080][C080] | PASS |
| [E30][E30] | [Three L936][sE30] | 需/扣3雷电、0DD；Three3；lightning可被吸收3 | [C023][C023]、[C035][C035]、[C057][C057] | PASS |
| [E31][E31] | [RotateThree L952][sE31] | 需/扣6雷电、0DD；完整旋转重选分支；lightning | [C057][C057]、[C059][C059]、[C080][C080] | PASS |
| [E32][E32] | [ZengYi L987][sE32] | 本局unused、0DD；两轮攻0/防∞清空；T+4末唯一奖励；normal | [C064][C064]、[C065][C065]、[C066][C066]、[C072][C072] | PASS |
| [E33][E33] | [BigBi L968][sE33] | ready未用奖励扣1份、0DD；BigBi5；zeng_reward不继承休整豁免 | [C065][C065]、[C070][C070] | PASS |

## 80 组案例

每组均重新按开始状态→作用→回击→账目→整场推进阅读推导，未使用旧引擎结果。C008/009/010/012/016/024/033/051/052/055/057/062/063/068/072/080 的子例分别处理；未把参数化条目数当测试运行数。

| C／输入与规范出处 | 状态 | 独立预期推导与判断 |
| --- | --- | --- |
| [C001][C001] | PASS | 两人无攻击，各10→11；所有击杀空，同局继续。 |
| [C002][C002] | PASS | A开始0<bi门槛1，整轮拒收，B不能先攒；输入逐项保持。 |
| [C003][C003] | PASS | 1对1双方各自防住，各扣1为9，击杀空且不退款。 |
| [C004][C004] | PASS | 3穿2/1，2仍穿1；K(A)={B,C},K(B)={C}；仅A存活，余额7/8/9。 |
| [C005][C005] | PASS | 1被普通防挡；基础1+成功格挡1=2充能，B扣1，无死亡。 |
| [C006][C006] | PASS | 大bi5按明确许可被普通防挡；充能2且B扣5，历史仍BigBi。 |
| [C007][C007] | ISSUE-F01 | 2穿普通防1；A得基础1，B扣2并K(B)={A}获胜；默认空集合与此冲突。 |
| [C008][C008] | PASS | 四个子例普通削均受正防御兜底；B扣1/3，双方活且无击杀。 |
| [C009][C009] | ISSUE-F01 | 四个等号防御均不匹配bi1；每例K(B)={A}、B获胜；未写集合不能默认空。 |
| [C010][C010] | PASS | 配对3/2/4/7/2数值及类别均匹配；最后B充能4→0，其余付3/2/4DD；均存活。 |
| [C011][C011] | PASS | 两个Volvo4都被Volvo防挡且相互抵消；B扣4DD，C扣2层，A不付费。 |
| [C012][C012] | ISSUE-F01 | 距喦1/3挡两种削，三例均授予一份buff；bi子例K(B)={A}；普通削扣1/3、强化扣0。 |
| [C013][C013] | PASS | 授予布尔一份不累加；A保持一份，B攒+1，均存活。 |
| [C014][C014] | PASS | 强化资格不消除持有1/3门槛；DD0拒收，资格及所有输入保留。 |
| [C015][C015] | ISSUE-F01 | 强化削禁防优先，K(A)={B}；A保留1/3余额并耗buff，B仍基础1充能。 |
| [C016][C016] | ISSUE-F01 | 五档都先禁防；每例K(A)={B}，A扣0耗buff，B扣1并登记待成熟一层；不因死亡取消。 |
| [C017][C017] | PASS | A三雷杀B Pragon；C对3和2各吸收，3+2−1=4净增，账目DD14；A/C随后归零新局。 |
| [C018][C018] | PASS | A三雷被B/C各防，每人独立3−1=2，余额12；A扣3且无淘汰。 |
| [C019][C019] | PASS | 两攒各增长被取消一次、余额10；每吸收1+1−1=1净增到11，无淘汰。 |
| [C020][C020] | PASS | 云挡三雷且首次0DD得1雷电；D杀B/C，二攒增长取消；A/D新局归零。 |
| [C021][C021] | PASS | Volvo4可吸，B4−1=3净增到13，A扣4，无淘汰。 |
| [C022][C022] | PASS | 炸药Volvo4可防但攻击DD收益0；A扣2层、B净−1到9，无淘汰。 |
| [C023][C023] | PASS | 雷电来源不改Three3收益，A雷电3→0、DD仍0；B净+2到12，无淘汰。 |
| [C024][C024] | ISSUE-F01 | 吸收挡强化仅付1；反弹登记原值1/3，P3削对撞失效，K(B)={A}；两例A扣0耗资格。 |
| [C025][C025] | PASS | 自bi因B成功获∞仅杀B；B仍吸C三雷3付1；A高阶Three账目保留、随后A/C新局清除。 |
| [C026][C026] | PASS | A成功自bi杀B；B虽死仍回C原值2，K(B)={C}；C不能以P2对撞挡P3，仅A赢。 |
| [C027][C027] | PASS | 无反制目标，自bi直接自淘汰；B攒+1获胜却没有击杀，A也不记自杀目标。 |
| [C028][C028] | PASS | 两个自bi各无目标，均自淘汰；K均空，winner=null且不重开。 |
| [C029][C029] | PASS | 无重复且A开始DD0，历强按攒+1；B也+1，A资格已用，历史LiQiang而非Charge。 |
| [C030][C030] | ISSUE-F01 | A开始DD1，失败不攒且防0；普通削1/3穿透，K(B)={A}，B扣1/3获胜。 |
| [C031][C031] | PASS | 只有B完整身份Bi重复；A10000杀B，C Pragon2也杀B；A防9999不攻击C，A/C新局。 |
| [C032][C032] | PASS | A/B各因C重复成功10000杀C，彼此上招空不互为目标；新局恢复一次资格。 |
| [C033][C033] | ISSUE-F01 | 反弹/吸收重复均触发10000且超100，K(A)={B}；无回击/攻击收益，反制费仍1。 |
| [C034][C034] | PASS | Three候选被历强10000和反弹回3杀；自bi候选∞防历强且杀C，选自bi；B成功未杀A，A/B重开。 |
| [C035][C035] | ISSUE-F01 | 雷电Three仍是Three重复，K(B)={A}；A扣3雷电，B历强成功获胜。 |
| [C036][C036] | PASS | RotateThree不是上一Three；B失败DD1无防；三雷候选存活杀B，自bi无目标死亡，选择三雷扣6。 |
| [C037][C037] | ISSUE-F01 | 复制完整RotateThree并以zhang0费用重选；自bi防B历强且K(A)={C}；A/B新局，账目用张资格一次。 |
| [C038][C038] | PASS | zhang只看有效NieXiang记录，DD/充能0合法；7/2被聂湘防匹配，张资格耗一次。 |
| [C039][C039] | PASS | 旧记录曾来自bomb不能传成本/零收益；当前zhang Pragon2，B吸2付1净+1，A0DD。 |
| [C040][C040] | PASS | 两个子例分别缺高阶/已用，均资格失败拒收；不能退化为攒，输入不变。 |
| [C041][C041] | PASS | bi互挡各扣1；A last=Bi但低于2不覆盖可复制Three，均存活。 |
| [C042][C042] | PASS | 大bi杀反弹A及PragonC；A仍登记回C原值2并杀C；K(B)={A,C},K(A)={C}，仅B赢。 |
| [C043][C043] | PASS | B直接淘汰田A；田仍最终清C为0；B从攒得1付1净0，B/C随后新局。 |
| [C044][C044] | PASS | B直接杀田A，C成功自bi杀B；10000超限不回；田无攻击，C唯一存活。 |
| [C045][C045] | PASS | 田首次免费防9挡大bi5；B扣5，双方无击杀，同局继续。 |
| [C046][C046] | PASS | 田第二次扣1/2到0、次数2；攒本应2+1但最终清为0，无死亡。 |
| [C047][C047] | PASS | 两贝只取消相互攻击，均击杀吸收C；C不能防/无攻击所得但付1；A/B新局。 |
| [C048][C048] | ISSUE-F01 | 攒直接K(B)={A}且小贝对B攻击排除；A扣7、B+1并获胜；不能默认为无击杀。 |
| [C049][C049] | PASS | 两贝彼此抵消；B攒直接杀小贝A，扇贝C杀B；B仍+1，C获胜，A不攻击B。 |
| [C050][C050] | PASS | B攒增长取消仍直接杀小贝A；A仍杀吸收C；C从B得1付1净0，B获胜且余额10。 |
| [C051][C051] | ISSUE-F01 | 两贝对田禁防先于7≤9/10>9，K(A)={B}；小贝/扇贝分别扣7/10，田首次免费。 |
| [C052][C052] | ISSUE-F01 | 聂湘7/2对两反制禁防，K(A)={B}；A充能6→2、DD0；吸收费1无所得/首次云仍+1雷电。 |
| [C053][C053] | ISSUE-F01 | 聂湘花4充能，反弹花1登记7/2；P3对撞失效，K(B)={A}，B获胜。 |
| [C054][C054] | PASS | T A扣1DD待成熟1、B+1；T+1双方攒，A DD1且末成熟1；T+2扣层出Pragon被专防挡，全程无重置。 |
| [C055][C055] | PASS | 前放0/1/2/3与第8次分别防1/3、1、2、3、3匹配本次攻击；放置各扣1，攻击者付对应费。 |
| [C056][C056] | PASS | 第二次炸药防1逐次挡两bi1，不相加成2；B/C对撞；每人一份支出，无淘汰。 |
| [C057][C057] | CLARIFY-F03 | 五个子例成熟层0<1、1<2、3<4、雷电2<3、5<6均拒收；待成熟仅本轮末不能预支，展开需局/回合约定。 |
| [C058][C058] | PASS | Volvo分支存活杀C/D共2优于自bi杀B共1；K(A)={C,D}；bomb扣4层，B0+1+1−1=1净增，随后A/B新局。 |
| [C059][C059] | PASS | 只见三雷防，Three候选存活0杀、自bi失败；选Three付6雷电且DD0，完整身份RotateThree。 |
| [C060][C060] | PASS | 局部各忽略另一选择者，普通分支2杀胜过自bi1杀；全场B4杀A3/D/E，A仍杀D/E；吸收3+4+1+1−1=8；B/C新局。 |
| [C061][C061] | PASS | 每个局部只有自己：Three活、自bi失败死；均锁Three，全场3对3抵消，各扣6。 |
| [C062][C062] | ISSUE-F01 | 面对扇贝，两候选都死且A无杀，同分随机；扇贝10在两例均杀A，K(B)={A}，自bi例另有自身失败死因。 |
| [C063][C063] | PASS | Three候选活杀C，自bi活杀B，均(活,1)；前者吸收B净3+1−1=3，后者B仍从攒得1付1净0；幸存二人新局。 |
| [C064][C064] | CLARIFY-F03 | T/T+1 A攻0防∞清有利积攒、使用记录留，B各+1；休整后waiting。待成熟时间未明确，终态清0可判、清前事件无法唯一判。 |
| [C065][C065] | PASS | 从零r1/r2清空，r3—r5 A攒到3、r5末ready；r6免费BigBi后spent且建记录，r7zhang0费用；B充能2→4，无淘汰。 |
| [C066][C066] | ISSUE-F02 | 按默认A上招空，B本就失败被C杀，K(C)={B}；补A上招ZengYi才能检出误触发；正确A/C重开清旧等待。 |
| [C067][C067] | ISSUE-F02 | C重复Bi使B成功且K(B)={C}；A上招空使“排除休整”未受检验，需补ZengYi并检查合规目标仅C。 |
| [C068][C068] | ISSUE-F01;CLARIFY-F03 | 普通防许可/休整∞均挡BigBi，K(B)={C}；A/B新局所有玩法清空；waiting到期未给，重置前发奖账目不唯一。 |
| [C069][C069] | PASS | 新局历史空且DD0，所有历强无目标按攒到1、资格耗用；没有死亡，继续同局。 |
| [C070][C070] | ISSUE-F01 | 奖励来源BigBi重复触发历强，K(B)={A}；A消耗唯一奖励、不花5DD，也无休整豁免。 |
| [C071][C071] | ISSUE-F01;CLARIFY-F03 | waiting无保护，攒防0被bi杀，K(B)={A}；A仍本轮攒+1；是否当轮发奖取决未给到期值。 |
| [C072][C072] | PASS | 张新伟/历强已用或曾义spent均拒收；有DD/高阶不恢复次数，不能产生任何更新。 |
| [C073][C073] | ISSUE-F04 | 相同身份token下应输入不变/排序归一结果一致；四组无到期奖励，故只能部分覆盖性质，不能验证发奖重试。 |
| [C074][C074] | ISSUE-F01 | 两个Three分别杀Bi/普通防，K(A)=K(B)={C,D}；A/B新局玩法全清，房间仍多人且缺席计数留。 |
| [C075][C075] | PASS | 可回击仅削含强化、Bi/Pragon/Three/Volvo/NieXiang与其已定义来源/普通分支；无独立盾；其余无攻击或被类别/100上限排除。是枚举论证，未跑引擎。 |
| [C076][C076] | PASS | Pragon2与完整RotateThree成功分支可记录；Bi1不足，完整自bi/历强/反弹禁用，旧高阶不覆盖；不可把回击值当本体攻击。 |
| [C077][C077] | PASS | 普通NieXiang充能3<4，DD10不能替代；整轮拒收，复制入口C038另算。 |
| [C078][C078] | PASS | 普通防挡两大bi，基础1+1+1=3；B/C强度5相等抵消，各花5，无淘汰。 |
| [C079][C079] | PASS | r1云0DD/雷电1且B不攒；r2各攒1；r3云付1得雷电2、B仍1。r2立即续云DD0应拒收。 |
| [C080][C080] | ISSUE-F01 | 面对吸收普通分支活0杀、自bi活1杀，均锁自bi，K(A)={B}；支出6DD/8DD/4层/6雷电且无10000吸收收益。 |

## 专项覆盖和边界

| 专项 | 覆盖证据／判断 |
| --- | --- |
| 原值回击与死亡保留 | C024/C026/C042/C053；反弹来源只带原来袭值、目标和归因，未发现规范冲突。 |
| 攻击与攒同时吸收 | C058/C060/C063 独立逐项加总，分别净+1、+8、三雷分支+3；计入已死攒者且先记账后新局。 |
| 分支局部视图 | G17、R18、A06及C034/C037/C060/C061/C063；固定招式条件应局部重算。C060不单独证明历强局部重算，A12仍需后续真测试。 |
| 复制与历史 | C025/C035—C041/C065/C070/C076；完整实际身份、来源、分支不混合，禁用/低阶不覆盖，曾义及新局清记录。 |
| 输入不变与重试 | R02/A04—A06/A12/C002/C014/C040/C057/C072/C073；只有规范与夹具覆盖审阅，未执行引擎输入隔离；奖励重试见F04。 |
| 炸药、曾义、新局 | C054/C064—C071/C074/C079；时点主规则一致，合成时序字段见F03；休整豁免见F02。 |
| 胜负与击杀 | 唯一存活者才winner，0存活为空；击杀是作用者目标集合而非赢家推算，案例默认冲突见F01。 |
| 所有可回击形态 | 普通/强化Xiao、Bi、Pragon（normal/bomb/zhang）、Three（normal/lightning/zhang）、Volvo（normal/bomb/zhang）、NieXiang（normal/zhang）；RotateThree（normal/lightning/zhang）的Three分支、FlipVolvo（normal/bomb/zhang）的Volvo分支。只有P2对撞盾；其余实际招式无可反弹攻击或被类别/上限排除。 |
| 原证据限制 | 固定原话是a包作者保存的记录；同学截图仅摘录。原日志、93个旧观察和32项旧测试不作新版真值；本任务未参与原编写，仍属于同类AI辅助复核。 |

发现编号的详情和建议兼容性见 [FINDINGS.md](FINDINGS.md)。没有写新引擎、正式测试或新玩法。

[base]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c
[source]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md
[G01]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L99
[G02]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L100
[G03]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L101
[G04]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L102
[G05]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L103
[G06]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L104
[G07]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L105
[G08]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L106
[G09]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L107
[G10]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L108
[G11]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L109
[G12]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L110
[G13]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L111
[G14]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L112
[G15]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L113
[G16]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L114
[G17]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L115
[G18]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L116
[G19]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L117
[G20]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L118
[G21]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L119
[G22]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L120
[G23]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L121
[G24]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L122
[G25]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L123
[G26]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L124
[G27]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L125
[G28]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L126
[G29]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L127
[G30]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L128
[G31]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L129
[G32]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L130
[G33]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L131
[G34]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L132
[G35]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L133
[G36]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L134
[G37]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L135
[G38]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L136
[G39]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L137
[G40]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L138
[G41]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L139
[G42]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L140
[G43]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L141
[G44]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L142
[G45]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L143
[G46]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L144
[G47]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L145
[G48]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L146
[G49]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L147
[G50]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L148
[G51]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L149
[G52]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L150
[G53]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L151
[G54]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L152
[G55]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L153
[G56]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L154
[G57]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L155
[G58]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L156
[G59]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L157
[G60]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L158
[R01]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R01
[R02]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R02
[R03]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R03
[R04]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R04
[R05]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R05
[R06]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R06
[R07]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R07
[R08]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R08
[R09]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R09
[R10]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R10
[R11]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R11
[R12]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R12
[R13]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R13
[R14]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R14
[R15]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R15
[R16]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R16
[R17]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R17
[R18]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R18
[R19]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R19
[R20]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R20
[R21]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R21
[R22]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R22
[R23]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R23
[R24]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R24
[R25]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R25
[R26]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R26
[R27]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#R27
[a11]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L11
[a46]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L46
[a75]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L75
[a97]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L97
[a111]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L111
[a117]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L117
[a126]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L126
[a138]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L138
[a143]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L143
[a154]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L154
[a158]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L158
[a162]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L162
[a175]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L175
[a183]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L183
[a190]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L190
[a207]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L207
[a210]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L210
[a247]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L247
[a251]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L251
[a263]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L263
[a310]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L310
[a317]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L317
[a326]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L326
[a334]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L334
[a342]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L342
[a346]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L346
[a359]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L359
[a363]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L363
[a364]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L364
[a379]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L379
[a380]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L380
[a391]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L391
[a398]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L398
[a408]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L408
[a425]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L425
[a429]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L429
[a441]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L441
[a445]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L445
[a448]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L448
[a457]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L457
[a461]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L461
[a462]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L462
[a463]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L463
[a474]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L474
[a478]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L478
[a479]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L479
[a480]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L480
[a484]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L484
[a496]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L496
[a500]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L500
[a502]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L502
[a512]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L512
[a516]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L516
[a520]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L520
[a521]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L521
[a522]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L522
[a532]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L532
[a536]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L536
[a549]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L549
[a553]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L553
[a557]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L557
[a558]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L558
[a559]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L559
[a561]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L561
[a569]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L569
[a573]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L573
[a588]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L588
[a592]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L592
[a596]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L596
[a600]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L600
[a602]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L602
[a605]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L605
[a606]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L606
[a607]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L607
[a613]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L613
[a617]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L617
[a619]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L619
[a627]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L627
[a631]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L631
[a633]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L633
[a641]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L641
[a645]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L645
[a649]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L649
[a653]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L653
[a657]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L657
[a658]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L658
[a659]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L659
[a660]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L660
[a661]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L661
[a671]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L671
[a675]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L675
[a679]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L679
[a682]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L682
[a717]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L717
[a722]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L722
[a728]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L728
[a732]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md#L732
[E01]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L107
[sE01]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L830
[E02]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L108
[sE02]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L355
[E03]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L109
[sE03]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L536
[E04]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L110
[sE04]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L373
[E05]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L111
[sE05]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L557
[E06]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L112
[sE06]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L391
[E07]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L113
[sE07]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L673
[E08]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L114
[sE08]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L738
[E09]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L115
[sE09]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L695
[E10]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L116
[sE10]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L850
[E11]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L117
[sE11]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L411
[E12]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L118
[sE12]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L430
[E13]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L119
[sE13]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L575
[E14]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L120
[sE14]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L448
[E15]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L121
[sE15]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L593
[E16]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L122
[sE16]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L785
[E17]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L123
[sE17]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L470
[E18]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L124
[sE18]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L806
[E19]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L125
[sE19]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L492
[E20]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L126
[sE20]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L715
[E21]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L127
[sE21]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L513
[E22]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L128
[sE22]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L611
[E23]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L129
[sE23]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L629
[E24]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L130
[sE24]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L649
[E25]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L131
[sE25]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L872
[E26]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L132
[sE26]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L759
[E27]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L133
[sE27]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L888
[E28]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L134
[sE28]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L904
[E29]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L135
[sE29]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L920
[E30]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L136
[sE30]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L936
[E31]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L137
[sE31]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L952
[E32]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L138
[sE32]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L987
[E33]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/RULEBOOK.md#L139
[sE33]: https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md#L968
[C001]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C001
[C002]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C002
[C003]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C003
[C004]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C004
[C005]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C005
[C006]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C006
[C007]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C007
[C008]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C008
[C009]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C009
[C010]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C010
[C011]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C011
[C012]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C012
[C013]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C013
[C014]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C014
[C015]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C015
[C016]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C016
[C017]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C017
[C018]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C018
[C019]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C019
[C020]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C020
[C021]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C021
[C022]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C022
[C023]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C023
[C024]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C024
[C025]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C025
[C026]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C026
[C027]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C027
[C028]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C028
[C029]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C029
[C030]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C030
[C031]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C031
[C032]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C032
[C033]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C033
[C034]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C034
[C035]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C035
[C036]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C036
[C037]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C037
[C038]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C038
[C039]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C039
[C040]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C040
[C041]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C041
[C042]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C042
[C043]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C043
[C044]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C044
[C045]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C045
[C046]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C046
[C047]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C047
[C048]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C048
[C049]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C049
[C050]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C050
[C051]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C051
[C052]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C052
[C053]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C053
[C054]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C054
[C055]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C055
[C056]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C056
[C057]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C057
[C058]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C058
[C059]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C059
[C060]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C060
[C061]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C061
[C062]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C062
[C063]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C063
[C064]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C064
[C065]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C065
[C066]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C066
[C067]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C067
[C068]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C068
[C069]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C069
[C070]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C070
[C071]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C071
[C072]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C072
[C073]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C073
[C074]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C074
[C075]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C075
[C076]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C076
[C077]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C077
[C078]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C078
[C079]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C079
[C080]: https://github.com/Kalopsiazza/DeiDei/blob/3a81daf0f42416ccb73a5a69748655145e6f2f0c/docs/rules/v1/CASES.md#C080
