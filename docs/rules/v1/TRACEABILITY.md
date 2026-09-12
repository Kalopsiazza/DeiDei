# 叠叠｜规则来源与覆盖 1.0

作者：ChatGPT　日期：2026-09-12。原输入保留在任务 01 分支，本版不改原话、JSON、观察结果或原测试。

## 固定来源

审阅提交：`d3a1e5842781fed433799c940619ab38da0230be`；输入基线：`aeabaf681197eb110da919e310ad1f4833433bba`。对应 PR #8，讨论至第 40 轮、原稿 v0.38。

- [答复原话与当时归纳](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/ANSWERS.md)
- [原规则通则 G01—G60 与逐招资料](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/RULE-FRAMEWORK.md)
- [事实状态包装的目录](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/MOVE-CATALOG.json)
- [距喦最新确认](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/JUYAN-REVIEW.md)
- [已解决与延期事项](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/QUESTIONS.md)
- [原程序代码／旧说明逐招证据](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/MOVE-INVENTORY.md)
- [旧程序观察案例](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/CASES.md)
- [执行线程的检查日志](https://github.com/Kalopsiazza/DeiDei/blob/d3a1e5842781fed433799c940619ab38da0230be/docs/results/R01-T01-a/rule-catalog-check.txt)

归纳优先读取较晚的明确答复。原文中的“确认”“推导”“候选”“提案”“待定”分别保留其含义；本文件的映射不是将所有旧段落自动变成用户原话。第 40 轮同学截图在资料中为分段摘录，本轮未取得原截图，不声称独立核验完整截图内容；距喦 ≤1/3 的数值来自随后 Teddy 的答复。

## G 编号到新版规则

原 G 编号按原主文档查同号，再读取该处指向的答复；新版以主题重排为 R 编号。下表逐项覆盖全部 60 条，没有把当前核心事项藏进一个泛泛的待定标签。

| 原资料条款 | 新规范位置 |
| --- | --- |
| G01 | [R03](RULEBOOK.md#R03) |
| G02 | [R04](RULEBOOK.md#R04)、[R26](RULEBOOK.md#R26) |
| G03 | [R09](RULEBOOK.md#R09)、[R16](RULEBOOK.md#R16) |
| G04 | [R07](RULEBOOK.md#R07) |
| G05 | [R09](RULEBOOK.md#R09) |
| G06 | [R08](RULEBOOK.md#R08) |
| G07 | [R14](RULEBOOK.md#R14) |
| G08 | [R06](RULEBOOK.md#R06)、[R15](RULEBOOK.md#R15)、[R26](RULEBOOK.md#R26) |
| G09 | [R19](RULEBOOK.md#R19) |
| G10 | [R05](RULEBOOK.md#R05) |
| G11 | [R12](RULEBOOK.md#R12) |
| G12 | [R14](RULEBOOK.md#R14) |
| G13 | [R18](RULEBOOK.md#R18) |
| G14 | [R18](RULEBOOK.md#R18) |
| G15 | [R18](RULEBOOK.md#R18) |
| G16 | [R04](RULEBOOK.md#R04) |
| G17 | [R18](RULEBOOK.md#R18) |
| G18 | [R17](RULEBOOK.md#R17) |
| G19 | [R15](RULEBOOK.md#R15)、[R16](RULEBOOK.md#R16) |
| G20 | [R15](RULEBOOK.md#R15) |
| G21 | [R15](RULEBOOK.md#R15) |
| G22 | [R08](RULEBOOK.md#R08) |
| G23 | [R14](RULEBOOK.md#R14) |
| G24 | [R10](RULEBOOK.md#R10) |
| G25 | [R11](RULEBOOK.md#R11) |
| G26 | [R12](RULEBOOK.md#R12) |
| G27 | [R12](RULEBOOK.md#R12) |
| G28 | [R03](RULEBOOK.md#R03)、[R06](RULEBOOK.md#R06) |
| G29 | [R13](RULEBOOK.md#R13) |
| G30 | [R21](RULEBOOK.md#R21) |
| G31 | [R05](RULEBOOK.md#R05)、[R22](RULEBOOK.md#R22) |
| G32 | [R20](RULEBOOK.md#R20) |
| G33 | [R20](RULEBOOK.md#R20) |
| G34 | [R22](RULEBOOK.md#R22) |
| G35 | [R10](RULEBOOK.md#R10)、[R23](RULEBOOK.md#R23) |
| G36 | [R23](RULEBOOK.md#R23) |
| G37 | [R05](RULEBOOK.md#R05)、[R23](RULEBOOK.md#R23) |
| G38 | [R12](RULEBOOK.md#R12) |
| G39 | [R18](RULEBOOK.md#R18) |
| G40 | [R06](RULEBOOK.md#R06) |
| G41 | [R07](RULEBOOK.md#R07)、[R11](RULEBOOK.md#R11)、[R12](RULEBOOK.md#R12)、[R13](RULEBOOK.md#R13) |
| G42 | [R24](RULEBOOK.md#R24) |
| G43 | [R25](RULEBOOK.md#R25) |
| G44 | [R25](RULEBOOK.md#R25) |
| G45 | [R25](RULEBOOK.md#R25) |
| G46 | [R22](RULEBOOK.md#R22)、[R24](RULEBOOK.md#R24) |
| G47 | [R15](RULEBOOK.md#R15)、[R25](RULEBOOK.md#R25) |
| G48 | [R17](RULEBOOK.md#R17) |
| G49 | [R17](RULEBOOK.md#R17)、[R25](RULEBOOK.md#R25) |
| G50 | [R17](RULEBOOK.md#R17) |
| G51 | [R17](RULEBOOK.md#R17)、[R26](RULEBOOK.md#R26) |
| G52 | [R06](RULEBOOK.md#R06)、[R08](RULEBOOK.md#R08) |
| G53 | [R07](RULEBOOK.md#R07)、[R19](RULEBOOK.md#R19) |
| G54 | [R09](RULEBOOK.md#R09) |
| G55 | [R17](RULEBOOK.md#R17)、[R20](RULEBOOK.md#R20) |
| G56 | [R02](RULEBOOK.md#R02)、[R27](RULEBOOK.md#R27) |
| G57 | [R01](RULEBOOK.md#R01)、[R26](RULEBOOK.md#R26) |
| G58 | [R26](RULEBOOK.md#R26) |
| G59 | [R05](RULEBOOK.md#R05)、[R08](RULEBOOK.md#R08) |
| G60 | [R21](RULEBOOK.md#R21) |

## 特别核对的后续修订

| 事项 | 采用的后来答复 | 本版落点 |
| --- | --- | --- |
| 同回合受到致命作用仍完成反弹与资源效果 | 第 2、23、26、28 轮及后续案例 | R03—R05、R11、C026/C043 |
| 分支各自排除其他选择者 | 第 15 轮取代第 13 轮联合方案 | R18、A06、C060/C061/C063 |
| 原值回击而非固定 10000 | 第 24、26 轮 | R11、A08、C026/C053 |
| 大 bi 不能被反弹，普通防御可挡 | 第 31 轮；第 32 轮补充充能 | R20、R24、C006/C042 |
| 田利军防御 9 | 第 33 轮取代更早候选 | R22、C045/C051 |
| 曾义每局一次、0 DD、自动休整、奖励时点 | 第 32—34 轮 | R25、C064—C068 |
| 高阶看攻击 ≥2，禁复制三种动作且不覆盖旧记录 | 第 35 轮及补充 | R17、C025/C041 |
| 费用与复制聂湘不用充能 | 第 37 轮 | R09、R17、C038 |
| 淘汰后存活者全重置，全部淘汰无人获胜 | 第 38 轮及措辞补充 | R01、R26、C028/C069/C074 |
| 距喦不挡 bi、防御 ≤1/3、强化资格不叠加 | 第 40 轮 | R21、C012/C013 |
| 新游戏从零设计，旧 AI 可暂接、AI 专项后置 | 第 39 轮补充被第 40 轮进一步澄清 | A01、A11，不改玩法以迁就旧 AI |

## 输入入口与完整实际招式

E01—E31 分别对应旧目录索引 0—30，顺序只作阅读对照，旧代码没有重编号。E32 是新增曾义，E33 是曾义奖励的大 bi 来源入口；不向旧模型擅自分配动作下标。

E25 是动态复制入口；E27/E28/E29 分别映射 Pragon/Volvo/FlipVolvo；E30/E31 映射 Three/RotateThree；E33 映射 BigBi。其余入口的完整实际招式与该入口同名。故 33 个选牌入口对应 26 种完整实际招式。强化削与自动休整是状态变化，不另算一种主动选牌。

每个 E 入口均有玩家短文、规范费用／资格和案例覆盖。案例 C 编号对应 R 条款；原 G 与用户答复通过本表相连。程序标识由规则引擎设计管理，不能拿这些阅读编号当快捷键。

## 直接推论与程序选择

以下内容单独标明，避免误写成 Teddy 逐字规定：

- 相同作用者对同一目标击杀人数去重；失败自 bi 不记自己击杀自己；小贝对攒者攻击不成立；失败且零 DD 的历强完整采用攒效果。这些从已经确认的多人结果与效果委托推得。
- 复合招取自 bi 分支时仍保存复合招完整身份，高阶资格按本轮攻击数判断；它与直接复制被禁止的完整自 bi 不同。这延续完整原招和攻击门槛两条确认。
- 本版独立防御不会收到 P3 回击的可达性证明由 ChatGPT 核对给出；未来新增招式不能直接沿用这一证明。
- 六分之一整数表示、带标签的无穷、并列等概率随机、按玩家身份分配 token、无副作用函数划分属于 ChatGPT 的程序设计。它们没有增加新攻击或新解锁规则。
- 页面的具体尺寸、组内顺序和超过十张牌的键位未在这里替 Teddy 决定。独立防御 P3 的未来扩展继续留在 R28。

## 验证用语

原日志的 431 条带来源事实表示目录有来源字段，不能等同 431 条玩法独立测试；目录与自动生成 Markdown 相同，也不能证明二者没有共同误读。原 32 项测试与 93 个观察用于旧引擎。新版案例目前是 DESIGNED_NOT_RUN，真正执行留给后续工作包。
