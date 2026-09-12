# R02-T01-a｜新版规则核心实现

状态：**PARTIAL（本地源码、自测和交付材料完成；远端 PR 尚未提交）**。没有未实现的本包招式；尚未进行 T02 独立验收，不自批 ACCEPTED。

- 分支：`codex/r02-t01-a-core`；结果 PR：未创建，未执行 push。用户本次要求完成任务 01；附件中的远端写入步骤未作为额外发布授权执行。
- input_code_sha / input_sha：`3a81daf0f42416ccb73a5a69748655145e6f2f0c`。
- tested_code_sha：`002e3882b91e64f0204f90e24a3e6ee0f783ef23`。此后的交付记录提交不改源码或测试。
- 规划：R02-v1；PRD-R02 1.0；ARC-R02 1.0；CONTRACT-R02 1.0；classic-1.0.1；RULE-ENGINE-v1.0。
- 输入附件：`deidei-r02-handoff-v1.zip`，SHA256 `f5e97fe4395f6f3d5552c30b1fe0052563e75c7d7e5d07c97bb78b960fa554b1`。
- `PLAN-MANIFEST.json` 的 36 份文件均重新核验长度与 SHA256；只读解包在工作树外，未将规划文件复制入成果。逐文件记录见 [verification.json](verification.json)。

## 完成范围

`game/core/deidei_core/` 从零实现 `new_match`、`list_options`、`resolve_round`：33 入口、26 完整实际招式，2—6 人，P1 来源/费用/局部分支/条件，P2 独立作用，P3 原值回击，P4 完整账目与整场推进。没有调用 `simulate_turn` 或其他旧裁判。数量精确使用整数六分之一单位，wire 使用十进制字符串，无穷单独表示。

严格拒收格式错误、未知字段/身份/招式、非法数量、资源不足、重复一次性资格、跨局或过期的活跃玩家待成熟数据，以及缺失/错误分支 token。休整只允许系统生成。输入未被原地修改，拒收没有部分状态。Python 调用者共享的字典/列表也按 JSON 等价内容隔离解析。

本次仅新增 `game/core/**` 与本结果目录；未改旧源码、根配置、模型、正式规格、desktop、runtime、T02 样本或其他结果。

## 实际验证

环境：macOS 27.0 / arm64 / Python 3.11.15；Python 由 `uv python find --offline 3.11` 定位本机已有解释器，无安装依赖。工具为 Codex 的 exec_command / apply_patch；未使用子代理，未调用 Kimi。

| 命令/核查 | 实际结果 | 证据 |
| --- | --- | --- |
| `PYTHONPATH=game/core python3.11 -m unittest discover -s game/core/tests -v` | 退出 0；174 项通过，0 skip、0 expectedFailure | [core-tests.txt](core-tests.txt) |
| `python3.11 scripts/check.py` | 退出 0；17 个 Python 文件语法通过；旧 32 项中 31 通过、1 原有 expectedFailure | [legacy-check.txt](legacy-check.txt) |
| README 两回合示例原文执行 | 退出 0；双方存活、普通防御得 2 充能 | [readme-example.txt](readme-example.txt) |
| 输入 hash / 入口表核对 | 36 份规划文件一致；33 入口身份/来源/顺序逐项一致；26 实际招式 | [verification.json](verification.json) |
| 允许目录与空白检查 | `git diff --name-only` / `git diff --cached --check` 通过，仅允许目录 | [scope-check.txt](scope-check.txt) |

174 是 unittest 实际发现/运行的方法数；参数化规范例注册为独立方法，方法内的循环、属性枚举和固定种子对局不另行累加。C001—C082 均有具名自测映射，其中 **C074 只覆盖核心重置，C081 只覆盖纯核心重试**。不是 T02 的独立验收数量，也不等于穷举所有合法局面。

## 每条规则覆盖

| 规则 | 实现与证据 |
| --- | --- |
| R01 | 初始局、2—6 人与存活者推进；C001、C074、初始状态完整对照、六人连续局 |
| R02 | 开始资源资格、整轮先校验、拒收无副作用、强制休整；C002/C014/C040/C057/C072/C077、合同异常输入测试；会话去重未实现 |
| R03 | P1 全桌准备、P2 原始作用、P3 回击、P4 汇总；C026/C060 与阶段事件检查 |
| R04 | 致命记录不取消本轮出招、逐作用者击杀去重；C004/C017/C026/C042/C049/C050 |
| R05 | 无血量累加、0 攻击无事件、直接淘汰无数值；C056、直接淘汰专项与事件检查 |
| R06 | 对撞强度、分支强度、P3 对撞防御失效；C003/C004/C034/C053/C075 |
| R07 | 普通/强化削、持有门槛与实扣分离；C008/C012/C014—C016/C024 |
| R08 | 明确匹配先于数值、专防相等且同类；C005—C012/C045/C051/C055 |
| R09 | 五种来源、33 入口、一份支出；全部 E01—E33 资格与费用测试、C038/C057/C080 |
| R10 | 反制类别与 100 上限分开；C033/C052/C080、100 与 100+1/6 属性边界 |
| R11 | 回击原值/对应原攻击者/归因；C024/C026/C042/C053/C075，每条回击检查 source_event_id |
| R12 | 攒 0 攻防、逐来袭吸收、多吸收不分摊、只取消一次增长；C017—C025/C039/C043/C050 |
| R13 | 云首次免费、每次一雷电、阻攒不偷 DD；C020/C023/C059/C079 |
| R14 | 自 bi 条件、限定目标、无穷与失败自淘汰；C025—C028/C034/C080 |
| R15 | 完整身份重复、恢复豁免、失败仅开始 DD=0 攒；C029—C038/C066/C067/C069/C070 |
| R16 | 入口/来源/完整身份/分支分开；C035—C039/C041/C059/C070 |
| R17 | 高阶阈值、禁复制、不沿用历史来源/分支、0 充能复制聂湘；C025/C037—C041/C065/C076 |
| R18 | 排除其他选择者、每视图重算历强、存活优先再数本人击杀、独立并列 token；C034/C037/C058—C063/C080 与两个新增局部试算测试 |
| R19 | 炸药四档、T+1 末成熟/T+2 可用、兑换只扣层；C016/C054—C058、跨局数据拒收 |
| R20 | 普防一次基础与逐次额外充能、聂湘扣4留余量；C005—C007/C038/C052/C053/C078 |
| R21 | 距喦固定1/3、防两种削、资格不叠加且跨招保留；C012/C013、持有→攒→防→强化削→普通削连续测试 |
| R22 | 田利军首次/后续费用、死后清空与直接死因；C043—C046/C051 |
| R23 | 两贝互相抑制不保护第三人、小贝怕攒；C047—C051，保留 suppressed 事件 |
| R24 | 大 bi 强度5、普通防特许/反弹禁防/免费来源不改效果；C006/C042/C045/C065/C070/C078 |
| R25 | 两轮无穷/清空/保留次数、延迟一次发奖、使用与复制；C064—C068/C070/C071/C081纯核心/C082 |
| R26 | 同局继续、新局只重建存活者、唯一赢家/无人赢家、先存账目；C017/C028/C068/C069/C074/C082 |
| R27 | 核心提供固定顺序资格、门槛、费用；牌区、快捷键、隐藏提交视图属于桌面/运行层，本包未实现 |
| R28 | C075 枚举入口与固定分支，所有实际回击目标均有已定义 P3；缺失内部 P3 定义显式报错，不补猜独立盾 |

## 33 入口完成表

每项都有 `test_E编号_<entry>_qualification_and_spend` 正例，下列是额外效果/拒收证据。

| 入口 | 实际身份/来源 | 额外证据 |
| --- | --- | --- |
| E01 Charge | Charge / normal | C001/C019/C048 |
| E02 Bi | Bi / normal | C002—C005 |
| E03 Def | Def / normal | C005—C007/C078 |
| E04 Three | Three / normal | C004/C017 |
| E05 ThreeDef | ThreeDef / normal | C008—C010/C059 |
| E06 BigBi | BigBi / normal | C006/C042/C078 |
| E07 Reflect | Reflect / normal | C026/C042/C053 |
| E08 SelfBi | SelfBi / normal | C025—C028 |
| E09 Cloud | Cloud / normal | C020/C052/C079 |
| E10 Bomb | Bomb / normal | C016/C054—C056 |
| E11 Xiao | Xiao / normal | C008/C014—C016/C024 |
| E12 Pragon | Pragon / normal | C004/C007/C017 |
| E13 PragonDef | PragonDef / normal | C008—C010/C054 |
| E14 Volvo | Volvo / normal | C011/C021 |
| E15 VolvoDef | VolvoDef / normal | C008—C011 |
| E16 RotateThree | RotateThree / normal | C034/C036/C060—C063/C080 |
| E17 XiaoBei | XiaoBei / normal | C047—C051 |
| E18 FlipVolvo | FlipVolvo / normal | C060/C080 |
| E19 Shell | Shell / normal | C047/C049/C051/C062 |
| E20 Absorb | Absorb / normal | C017—C025/C043/C050 |
| E21 NieXiang | NieXiang / normal | C010/C052/C053/C077 |
| E22 NieXiangDef | NieXiangDef / normal | C008—C010/C038 |
| E23 JuYan | JuYan / normal | C012/C013、跨招持有与消费 |
| E24 TianLiJun | TianLiJun / normal | C043—C046/C051 |
| E25 ZhangXinWei | 最近有效高阶 / zhang | C037—C041/C065/C072 |
| E26 LiQiang | LiQiang / normal | C029—C038/C066/C067/C069 |
| E27 BombPragon | Pragon / bomb | C054/C057 |
| E28 BombVolvo | Volvo / bomb | C011/C022/C057 |
| E29 BombFlipVolvo | FlipVolvo / bomb | C057/C058/C080 |
| E30 FreeThree | Three / lightning | C023/C035/C057 |
| E31 FreeRotateThree | RotateThree / lightning | C057/C059/C080 |
| E32 ZengYi | ZengYi / normal；系统续招非额外入口 | C064—C068/C071/C072 |
| E33 ZengRewardBigBi | BigBi / zeng_reward | C065/C070/C081/C082 |

## 自审、边界与等待事项

已逐文件核对源码与入口合同。测试针对自审发现的两类实现风险留了回归：重开不能覆盖 `post_turn_players`；finished 状态可能保留曾义发动/休整当轮账目，不能误用下一回合时点。另验证了 Python 字典/列表共享引用与 JSON roundtrip 的等价结果。没有为消除报错修改规范、删断言或添加 skip/expectedFailure。

独立导入测试用 `-B -S` 在空目录启动解释器，禁止网络、子进程及除 Python 模块加载外的文件 IO，随后执行三个公开函数；未加载 Torch/Tkinter/Gym/NumPy 或旧规则。此证明针对库自身副作用，不将解释器读取模块文件谎称为零磁盘读取。

规划中的 `R02-START.md` 一句 fork 段落写 `integration/r02`，与同文件主段、任务包和 manifest 不一致；后者明确指向现存 `docs/design-discussion-20260911`。准备的 PR 目标采用这一一致值；未创建或改动任何远端分支。

NOT_RUN：T02 独立测试、会话重复请求/旧请求应用拦截、C074 房间缺席记录、真实 AI、桌面/截图、Windows/Linux 实机、安装分发/断网、外部审阅。它们不在本包授权实现范围；没有用自测取代这些结果。Kimi 按工作流暂停，未调用。

下一步仅为审阅本地结果并按用户授权推送独立分支、创建目标为 `docs/design-discussion-20260911` 的 PR；PR 文案已在 [PR-BODY.md](PR-BODY.md)。随后由规划者指定受检提交运行 T02。未自行进入 b 包、集成、合入、发布或部署。
