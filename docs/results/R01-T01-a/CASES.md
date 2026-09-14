# CASES｜当前双人观察与多人OPEN

输入及tested_code_sha：`aeabaf681197eb110da919e310ad1f4833433bba`。全部为合成状态。CODE结果可复查，不代表Teddy批准。数字DD均为内部单位（6=1DD），未写字段取PlayerState默认值。P为第一个参数、C为第二个参数；PlayerWin=P胜、CpuWin=C胜、Draw=本局平局、Continue=继续（非法动作也可能返回Continue）。完整资源/状态、合法性与输入副作用见 observations.json。

## 基础与特殊局面（CODE实跑）

| 案例ID | P招式及初态 | C招式及初态 | 合法P/C | 结果 | 返回DD P/C |
| --- | --- | --- | --- | --- | --- |
| both-charge | Charge `{}` | Charge `{}` | [True, True] | Continue | [6, 6] |
| bi-bi | Bi `{"dd":6}` | Bi `{"dd":6}` | [True, True] | Continue | [0, 0] |
| bi-pragon | Bi `{"dd":6}` | Pragon `{"dd":12}` | [True, True] | CpuWin | [0, 0] |
| illegal-bi | Bi `{"dd":5,"bombPending":[1,0,0]}` | Charge `{}` | [False, True] | Continue | [5, 0] |
| bi-vs-Def | Bi `{"dd":6}` | Def `{}` | [True, True] | Continue | [0, 0] |
| bi-vs-ThreeDef | Bi `{"dd":6}` | ThreeDef `{}` | [True, True] | PlayerWin | [0, 0] |
| bi-vs-PragonDef | Bi `{"dd":6}` | PragonDef `{}` | [True, True] | PlayerWin | [0, 0] |
| bi-vs-VolvoDef | Bi `{"dd":6}` | VolvoDef `{}` | [True, True] | PlayerWin | [0, 0] |
| bi-vs-NieXiangDef | Bi `{"dd":6}` | NieXiangDef `{}` | [True, True] | PlayerWin | [0, 0] |
| bi-vs-JuYan | Bi `{"dd":6}` | JuYan `{}` | [True, True] | PlayerWin | [0, 0] |
| reflect-bi | Reflect `{"dd":6}` | Bi `{"dd":6}` | [True, True] | PlayerWin | [0, 0] |
| suicide-reflect | Suicide `{}` | Reflect `{"dd":6}` | [True, True] | PlayerWin | [0, 0] |
| suicide-charge | Suicide `{}` | Charge `{}` | [True, True] | CpuWin | [0, 6] |
| suicide-suicide | Suicide `{}` | Suicide `{}` | [True, True] | Draw | [0, 0] |
| rotate-reflect | RotateThree `{"dd":36}` | Reflect `{"dd":6}` | [True, True] | PlayerWin | [0, 0] |
| rotate-flip | RotateThree `{"dd":36}` | FlipVolvo `{"dd":48}` | [True, True] | CpuWin | [0, 0] |
| flip-rotate | FlipVolvo `{"dd":48}` | RotateThree `{"dd":36}` | [True, True] | PlayerWin | [0, 0] |
| enhanced-xiao-dd-0 | Xiao `{"juyanBuff":true}` | Def `{}` | [False, True] | Continue | [0, 0] |
| enhanced-xiao-dd-1 | Xiao `{"dd":1,"juyanBuff":true}` | Def `{}` | [False, True] | Continue | [1, 0] |
| enhanced-xiao-dd-2 | Xiao `{"dd":2,"juyanBuff":true}` | Def `{}` | [True, True] | PlayerWin | [2, 0] |
| enhanced-xiao-juyan | Xiao `{"dd":2,"juyanBuff":true}` | JuYan `{}` | [True, True] | Continue | [2, 0] |
| enhanced-xiao-absorb | Xiao `{"dd":2,"juyanBuff":true}` | Absorb `{"dd":6}` | [True, True] | Continue | [2, 2] |
| buff-survives-charge | Charge `{"juyanBuff":true}` | Charge `{}` | [True, True] | Continue | [6, 6] |
| absorb-free-three | Absorb `{"dd":6}` | FreeThree `{"lightning":3}` | [True, True] | Continue | [0, 0] |
| absorb-bomb-pragon | Absorb `{"dd":6}` | BombPragon `{"bombLayers":1}` | [True, True] | Continue | [0, 0] |
| zhang-own-record | ZhangXinWei `{"hasHighAttackRecord":true,"lastHighAttack":"Pragon","lastMove":"Charge"}` | Def `{}` | [True, True] | PlayerWin | [0, 0] |
| zhang-opponent-only-record | ZhangXinWei `{}` | Def `{"hasHighAttackRecord":true,"lastHighAttack":"Pragon"}` | [False, True] | Continue | [0, 0] |
| zhang-spent | ZhangXinWei `{"zhangUsed":true,"hasHighAttackRecord":true,"lastHighAttack":"Pragon"}` | Charge `{}` | [False, True] | Continue | [0, 0] |
| absorb-zhang | Absorb `{"dd":6}` | ZhangXinWei `{"hasHighAttackRecord":true,"lastHighAttack":"Pragon"}` | [True, True] | Continue | [12, 0] |
| liqiang-bi-repeat | LiQiang `{}` | Bi `{"dd":6,"lastMove":"Bi"}` | [True, True] | PlayerWin | [0, 0] |
| liqiang-zhang-repeat | LiQiang `{}` | Pragon `{"dd":12,"zhangUsed":true,"hasHighAttackRecord":true,"lastHighAttack":"Pragon","lastMove":"ZhangXinWei"}` | [True, True] | PlayerWin | [0, 0] |
| liqiang-free-previous | LiQiang `{}` | Three `{"dd":18,"lastHighAttack":"Three","lastMove":"FreeThree"}` | [True, True] | CpuWin | [6, 0] |
| liqiang-free-current | LiQiang `{}` | FreeThree `{"lightning":3,"lastMove":"Three"}` | [True, True] | PlayerWin | [0, 0] |
| liqiang-both-after-charge | LiQiang `{"lastMove":"Charge"}` | LiQiang `{"lastMove":"Charge"}` | [True, True] | PlayerWin | [0, 6] |
| liqiang-both-after-nomove | LiQiang `{}` | LiQiang `{}` | [True, True] | Continue | [6, 6] |

CODE定位：普通攻击deidei_env.py:419–429；反弹/自杀363–380；吸收385–406；合法性181–201与非法整回合返回499–507；强化削239–241、336–346、569–570；张新伟182–183、226–227、571–578；历强251–287。每招对攒的31条案例另见 MOVE-INVENTORY.md 与原始JSON的catalog-*。

关键观察：

- CODE：资源不足时对方攒也不推进，pending也不推进；不能将Continue解读为接受了该招。
- CODE：历强同时出现时先算P再算C，并读取已经改写的P.effective。对称的“双上回合攒、双历强”局面只判P赢，属于参数位置效应，未修复。
- CODE：旧免费三雷的lastMove为FreeThree，当前三雷effective为Three，所以不相等；反过来相等。旧炸药变体也不经过_last_move_effective映射。当前只特判旧张新伟，不是全面的实际招式历史。
- CODE：距喦buff经一次攒仍存在；DD=0/1时即使Action预计算ddCost=0，削仍非法；DD=2时扣0。强化削对吸收Continue且吸收方由6变2，故吸收收益2、净亏4。
- CODE：量子分支为[Three,Suicide]或[Volvo,Suicide]，选择器用胜负效用找纯均衡，取列表首个；无均衡时按效用和最大值取首个。没有用户手动选择，也不是多人分支规则（433–481）。

## 炸药时序与防御（CODE实跑）

- `bomb-T`：P(dd=6)炸药对C攒；P返回dd=0、bombUses=1、pending=[1,0,0]、bombLayers=0。
- `bomb-T-plus-1`：承接上条返回状态，双方攒；P返回dd=6、pending=[0,0,0]、bombLayers=1，因此T+2开始可兑换。并未等待两个额外回合。
- 来源：deidei_env.py:483–488、536–541、579–580；DOC docs/game-rules.md:31–33；既有tests/test_core.py:111–118。

| 本次之前bombUses | 普通削 | Bi | Pragon | 三雷 | 沃尔沃 |
| --- | --- | --- | --- | --- | --- |
| 0 | CpuWin | CpuWin | CpuWin | CpuWin | CpuWin |
| 1 | Continue | Continue | CpuWin | CpuWin | CpuWin |
| 2 | Continue | Continue | Continue | CpuWin | CpuWin |
| 3 | Continue | Continue | Continue | Continue | CpuWin |
| 4 | Continue | Continue | Continue | Continue | CpuWin |

P每次独立状态dd=6、bombUses如表，P出Bomb；C出列名攻击且刚好足DD。Continue表示炸药挡住；CpuWin表示C击败P。CODE阈值=(min(此前次数+1,4)-1)*6，最高18内部单位（3DD），并非4DD；沃尔沃分支不接受Bomb防御。来源deidei_env.py:302–356。不是把次数上限当作炸药使用次数上限。

已知副作用（CODE）：`repeated_bomb` 在同一个p(dd=6)、c默认输入上调用炸药对攒两次，首次返回0层，第二次返回1层；原p的pending已由[0,0,0]变成[1,0,0]。两次不是从相同值状态出发，因为函数改写了第一次的输入。根因是499–502浅复制共享列表，536–541/483–487写列表。原正式测试test_known_regressions.py:10–16仍以expectedFailure记录，不能将本包复现断言通过说成修复。

## 多人：只列口述能证明的部分

TEDDY来源是输入快照中转述记录 docs/history/game-design-discussion-v0.5.md:56–60：一般招式作用其他所有玩家；甲Bi、乙攒时，即使另有人出其他招，乙也因Bi出局。这里只确认乙，不推断甲或其他玩家。当前方向docs/game-design-discussion.md:12–14保留2–6真人与全场出招。历史稿:99还记录“自Bi遇反弹，反弹者出局”；这是该组合的记录，未声明任意多人全局结算。

| 局面（动作资源足够） | TEDDY记录能证明的部分 | OPEN，禁止用双人函数补齐 |
| --- | --- | --- |
| A Bi、B反弹、C攒 | C因Bi出局 | A/B生死，反弹传播范围；Q10 |
| A Bi、B Pragon、C攒 | C因Bi出局 | A/B是否互相影响、同回合攻击者被杀后攻击还是否有效；Q11 |
| A旋转三雷、B反弹、C攒 | 默认全场，无已确认结果 | 分支是否统一、三人生死；Q12 |
| A自Bi、B反弹、C Bi、D攒 | D因C的Bi出局；有历史自Bi/反弹组合记录 | 不凭组合记录断言B最终结果或A/C结果；多人优先级未知 |
| 所有人本轮都满足某种淘汰条件 | 无已批准完整条件 | 是否全局平局、是否有胜者、同轮与依次结算；Q11 |

本包未调用任何多人结算，也未将双人Outcome串用成多人算法。未运行GUI、模型推理、联网游戏或Windows；这些不是只读规则证据的通过条件。
