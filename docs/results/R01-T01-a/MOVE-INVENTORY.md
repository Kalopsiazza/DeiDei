# MOVE-INVENTORY｜31 招源码证据

输入 `plan/r01-v1` / `aeabaf681197eb110da919e310ad1f4833433bba`；PRD-R01 1.0、ARC-R01 1.0。以下 CODE 只说明该快照实现，不是原玩法定稿。DOC 为旧说明，OPEN 留待确认。

## 目录与编号

CODE：ALL_MOVES 正好31项，无重复，GUI名称31项全部对应。保留 ALL_MOVES 从0开始的索引与 Move 枚举值两套号码，不混用：NoMove 的枚举值1不在目录；Gym NOMOVE_IDX=31。来源 deidei_env.py:16–48、173–179；deidei_gym_env.py:11–30。Gym 的资源CAP是观测归一化截断，不是引擎资源上限（44–67）。

| ALL_MOVES索引 | 枚举值 | 代码名 | GUI显示名 | GUI来源行 |
| --- | --- | --- | --- | --- |
| 0 | 2 | Charge | 攒 | gui_deidei.py:22 |
| 1 | 3 | Bi | Bi | gui_deidei.py:23 |
| 2 | 4 | Def | 防御 | gui_deidei.py:24 |
| 3 | 5 | Three | 三雷 | gui_deidei.py:25 |
| 4 | 6 | ThreeDef | 三雷防 | gui_deidei.py:26 |
| 5 | 7 | BigBi | 大Bi | gui_deidei.py:27 |
| 6 | 8 | Reflect | 反弹 | gui_deidei.py:28 |
| 7 | 9 | Suicide | 自杀 | gui_deidei.py:29 |
| 8 | 10 | Cloud | 云 | gui_deidei.py:30 |
| 9 | 11 | Bomb | 炸药 | gui_deidei.py:31 |
| 10 | 12 | Xiao | 削 | gui_deidei.py:32 |
| 11 | 13 | Pragon | Pragon | gui_deidei.py:33 |
| 12 | 14 | PragonDef | Pragon防 | gui_deidei.py:34 |
| 13 | 15 | Volvo | 沃尔沃 | gui_deidei.py:35 |
| 14 | 16 | VolvoDef | 沃尔沃防 | gui_deidei.py:36 |
| 15 | 17 | RotateThree | 旋转三雷 | gui_deidei.py:37 |
| 16 | 18 | XiaoBei | 小贝 | gui_deidei.py:38 |
| 17 | 19 | FlipVolvo | 翻转沃尔沃 | gui_deidei.py:39 |
| 18 | 20 | Shell | 扇贝 | gui_deidei.py:40 |
| 19 | 21 | Absorb | 吸收 | gui_deidei.py:41 |
| 20 | 22 | NieXiang | 聂湘 | gui_deidei.py:42 |
| 21 | 23 | NieXiangDef | 聂湘防 | gui_deidei.py:43 |
| 22 | 24 | JuYan | 距喦 | gui_deidei.py:44 |
| 23 | 25 | TianLiJun | 田立军 | gui_deidei.py:45 |
| 24 | 26 | ZhangXinWei | 张新伟 | gui_deidei.py:46 |
| 25 | 27 | LiQiang | 历强 | gui_deidei.py:47 |
| 26 | 28 | BombPragon | 炸药·Pragon | gui_deidei.py:48 |
| 27 | 29 | BombVolvo | 炸药·沃尔沃 | gui_deidei.py:49 |
| 28 | 30 | BombFlipVolvo | 炸药·翻转沃尔沃 | gui_deidei.py:50 |
| 29 | 31 | FreeThree | 雷电·免费三雷 | gui_deidei.py:51 |
| 30 | 32 | FreeRotateThree | 雷电·免费旋转三雷 | gui_deidei.py:52 |

## 共通结算条件

- CODE：下文DD金额均是内部整数单位，6单位=1DD；炸药/雷电/聂湘充能另计。一般招式先检查dd≥cost；特殊招式提前返回条件。玩家正常初始状态资源为0；不把负资源等人为非法状态当玩法。
- CODE：只要有一方动作不合法，双方都返回Continue且不推进资源/历史/炸药，不是判输；build_action产生的费用本身不是已结算费用（499–507）。
- CODE：合法时先扣资源并更新声明动作的次数/状态，再判胜负，再给攒/吸收收益、写历史并推进炸药；胜负已定也会返回更新后的资源（510–584）。ddGainP/C仅指特殊吸收收益，不是总DD净变化。
- CODE：高阶集合见84–90，记录双方各自effective（571–576）；Bi/削不在其中。无专有状态的招仍受共通lastMove及炸药推进影响。
- CODE：普通攻击比有效分支威力，等强Continue，异强较强者胜；反制、历强、小贝等先判。量子算法见289–292、433–481，不能把power函数对原招的数值直接用于分支对撞。
- CODE：无按整局次数清零的额外猜测。Cloud/Bomb/Tian计数在引擎无次数封顶；Bomb的防御阈值封顶不等于只能放4次。

## 逐招

每招普通案例为 observations.json 中 `catalog-代码名`：P固定dd=60、lightning=6、bombLayers=4、nxCharge=4、hasHighAttackRecord=True、lastHighAttack=Pragon，其余默认；C默认状态出攒。这是为覆盖可执行动作设置的合成局面，并非开局资源或真实玩家档案。以下净DD是P返回值减60。所有结论对应CODE；“说明核对”对照DOC，不意味着未列出的文本都已穷尽核验。

### 00 · Charge · 攒

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0；通常+6，遇吸收/云无增益，遇田立军清空全部DD。
- CODE 次数/延迟/状态：无次数上限；每次声明更新lastMove。
- CODE 普通案例：`catalog-Charge` 对攒 → `Continue`；P净DD=+6单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:559–564、407–414；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:56起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：旧GUI漏提云阻止攒；被攻击判输仍可能得到+6返回状态，非存活证明。

### 01 · Bi · Bi

- CODE 可用条件：dd≥6。
- CODE 消耗/收益：扣6；威力6。
- CODE 次数/延迟/状态：无专有次数/延迟。
- CODE 普通案例：`catalog-Bi` 对攒 → `PlayerWin`；P净DD=-6单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:141、326–335、419–429；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:65起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI Bi项说距喦能挡，但代码挡不住；四专属防御也挡不住。

### 02 · Def · 防御

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0。
- CODE 次数/延迟/状态：每次nxCharge+1；对Bi/普通削再+1；仅挡Bi/普通削。
- CODE 普通案例：`catalog-Def` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:326–346、546–568；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:70起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：与GUI核心说明一致；成功格挡的额外充能按对方有效招名条件检查。

### 03 · Three · 三雷

- CODE 可用条件：dd≥18。
- CODE 消耗/收益：扣18；威力18。
- CODE 次数/延迟/状态：可记录为自身高阶攻击；三雷防/田立军/足次炸药可挡。
- CODE 普通案例：`catalog-Three` 对攒 → `PlayerWin`；P净DD=-18单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:143、302–311、571–578；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:75起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI能挡列表未列足次炸药；未将列表当成完整规则。

### 04 · ThreeDef · 三雷防

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0。
- CODE 次数/延迟/状态：挡普通削及三雷分支；不增加聂湘充能。
- CODE 普通案例：`catalog-ThreeDef` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:302–311、326–346；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:78起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI此项写能挡Bi，与代码及GUI Bi项冲突。

### 05 · BigBi · 大Bi

- CODE 可用条件：dd≥30。
- CODE 消耗/收益：扣30；威力30。
- CODE 次数/延迟/状态：可记录高阶；防御类仅田立军挡，反制另算。
- CODE 普通案例：`catalog-BigBi` 对攒 → `PlayerWin`；P净DD=-30单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:145、299–301、378–406；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:82起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：防御范围与说明一致；“终极”不是额外机制。

### 06 · Reflect · 反弹

- CODE 可用条件：dd≥6。
- CODE 消耗/收益：扣6；无DD收益。
- CODE 次数/延迟/状态：对可反弹攻击直接胜；自杀/量子自杀分支可克制；扇贝/小贝不可反。
- CODE 普通案例：`catalog-Reflect` 对攒 → `Continue`；P净DD=-6单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:112–116、367–380、433–481；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:86起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI提AI ban是策略提示，不是is_legal_move禁止。

### 07 · Suicide · 自杀

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0。
- CODE 次数/延迟/状态：对反弹/吸收/云胜，双方自杀Draw，其余对手通常胜；历强触发优先。
- CODE 普通案例：`catalog-Suicide` 对攒 → `CpuWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:363–377；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:91起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI名“自杀”；历史讨论“自Bi”是否同一招仍OPEN，仅反弹组合口述一致。

### 08 · Cloud · 云

- CODE 可用条件：首次cloudUses=0时dd≥0；之后dd≥6。
- CODE 消耗/收益：首次0，之后扣6；不获取吸入DD。
- CODE 次数/延迟/状态：每次cloudUses+1、lightning+1；阻止攒及可吸收攻击；无硬次数上限。
- CODE 普通案例：`catalog-Cloud` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:148、400–406、530–535、559–562；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:101起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：不是所有攻击都能挡；沃尔沃/聂湘等不在可吸收范围。

### 09 · Bomb · 炸药

- CODE 可用条件：dd≥6。
- CODE 消耗/收益：扣6；新炸药延迟+1层。
- CODE 次数/延迟/状态：bombUses+1；pending[1]+1后回合末移位；当回合不成熟，下一回合末成熟；防御阈值最多18单位。
- CODE 普通案例：`catalog-Bomb` 对攒 → `Continue`；P净DD=-6单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:149、302–356、483–488、536–541、579–580；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:106起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI“4层盾”不应读成4DD；上限是3DD，详见CASES；列表副作用仍存在。

### 10 · Xiao · 削

- CODE 可用条件：dd≥2，包括持有juyanBuff时。
- CODE 消耗/收益：普通扣2/威力2；强化实际扣0/威力仍2。
- CODE 次数/延迟/状态：持buff时强化，声明削才清buff；普通削可被多种防御挡，强化仅距喦挡（反制另算）。
- CODE 普通案例：`catalog-Xiao` 对攒 → `PlayerWin`；P净DD=-2单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:150、198–201、239–241、336–346、569–570；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:61起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：免费扣费不等于0DD可用；GUI吸收项说不能吸强化削，但代码能吸且收益2。

### 11 · Pragon · Pragon

- CODE 可用条件：dd≥12。
- CODE 消耗/收益：扣12；威力12。
- CODE 次数/延迟/状态：可记录高阶；Pragon防/田立军/足次炸药可挡。
- CODE 普通案例：`catalog-Pragon` 对攒 → `PlayerWin`；P净DD=-12单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:151、316–325、571–578；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:129起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：所列防御与GUI一致。

### 12 · PragonDef · Pragon防

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0。
- CODE 次数/延迟/状态：挡普通削/Pragon；不增加聂湘充能。
- CODE 普通案例：`catalog-PragonDef` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:316–346；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:132起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI本项写能挡Bi，代码不能。

### 13 · Volvo · 沃尔沃

- CODE 可用条件：dd≥24。
- CODE 消耗/收益：扣24；威力24。
- CODE 次数/延迟/状态：可记录高阶；沃尔沃防/田立军可挡；不能吸收。
- CODE 普通案例：`catalog-Volvo` 对攒 → `PlayerWin`；P净DD=-24单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:125–133、153、312–315；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:136起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：与GUI所列交互一致。

### 14 · VolvoDef · 沃尔沃防

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0。
- CODE 次数/延迟/状态：挡普通削/沃尔沃分支；不增加聂湘充能。
- CODE 普通案例：`catalog-VolvoDef` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:312–346；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:139起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI写能挡Bi，代码不能；量子分支另经选择器。

### 15 · RotateThree · 旋转三雷

- CODE 可用条件：dd≥36。
- CODE 消耗/收益：扣36；分支为三雷（威力18）/自杀；直接power函数36不等于结算分支威力。
- CODE 次数/延迟/状态：量子选择器按胜负效用找纯均衡，首个优先；记录为RotateThree。
- CODE 普通案例：`catalog-RotateThree` 对攒 → `PlayerWin`；P净DD=-36单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:155、289–292、433–481、571–578；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:142起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：“对你最有利”不足以完整描述双方量子时的选择器。

### 16 · XiaoBei · 小贝

- CODE 可用条件：dd≥42。
- CODE 消耗/收益：扣42；威力42。
- CODE 次数/延迟/状态：攒克小贝；与扇贝/小贝相遇Continue；不可挡/反弹/吸收。
- CODE 普通案例：`catalog-XiaoBei` 对攒 → `CpuWin`；P净DD=-42单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:156、298、407–414；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:146起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：与所列GUI主交互一致；“同级”是特殊抵消，power值并不等于扇贝。

### 17 · FlipVolvo · 翻转沃尔沃

- CODE 可用条件：dd≥48。
- CODE 消耗/收益：扣48；分支沃尔沃（威力24）/自杀；直接power函数48。
- CODE 次数/延迟/状态：量子选择器；记录为FlipVolvo。
- CODE 普通案例：`catalog-FlipVolvo` 对攒 → `PlayerWin`；P净DD=-48单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:157、289–292、433–481；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:149起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：与旋转三雷相同：不是独立任选分支的新规则。

### 18 · Shell · 扇贝

- CODE 可用条件：dd≥60。
- CODE 消耗/收益：扣60；威力60。
- CODE 次数/延迟/状态：不可挡/反弹/吸收；扇贝或小贝相遇Continue。
- CODE 普通案例：`catalog-Shell` 对攒 → `PlayerWin`；P净DD=-60单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:158、298、410–414；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:152起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI“唯一解法”非穷举：历强触发在其之前判定。

### 19 · Absorb · 吸收

- CODE 可用条件：dd≥6。
- CODE 消耗/收益：先扣6；对攒收益6净0；可吸攻击收益由dd_cost函数计算，不一定是对方实扣值。
- CODE 次数/延迟/状态：不获取炸药/雷电；对免费三雷/炸药Pragon可挡但收益0；张复制Pragon收益12；强化削收益2。
- CODE 普通案例：`catalog-Absorb` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:125–133、159、385–399、559–562；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:95起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI“两份攒”忽略先扣6；“不能吸炸药/强化削”有反例；“获得实际消耗DD”也不成立。

### 20 · NieXiang · 聂湘

- CODE 可用条件：nxCharge≥4（特殊分支不检查DD）。
- CODE 消耗/收益：扣4充能，DD0；威力21。
- CODE 次数/延迟/状态：可记录高阶；聂湘防/田立军挡，能反弹不能吸收。
- CODE 普通案例：`catalog-NieXiang` 对攒 → `PlayerWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:186–187、247、347–350、522–525；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:156起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI“防御攒4次”不精确：成功挡Bi两次即可4点；资源门槛是≥4。

### 21 · NieXiangDef · 聂湘防

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0。
- CODE 次数/延迟/状态：挡普通削/聂湘；不增加聂湘充能。
- CODE 普通案例：`catalog-NieXiangDef` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:326–350；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:159起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI写能挡Bi，代码不能。

### 22 · JuYan · 距喦

- CODE 可用条件：dd≥0。
- CODE 消耗/收益：0。
- CODE 次数/延迟/状态：设置juyanBuff=True，非叠加；直到声明削才清除；挡普通/强化削，挡不住Bi。
- CODE 普通案例：`catalog-JuYan` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:162、326–346、544–545、569–570；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:162起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI说挡Bi，与实现不符；“下回合削”与持久至下一次削并非同一限制。

### 23 · TianLiJun · 田立军

- CODE 可用条件：首次tianUses=0时dd≥0；之后dd≥3。
- CODE 消耗/收益：首次0，以后扣3；对攒清空对方全部DD。
- CODE 次数/延迟/状态：每次tianUses+1；无硬次数上限；防御不挡强化削/扇贝/小贝；遇反弹/吸收/云输。
- CODE 普通案例：`catalog-TianLiJun` 对攒 → `Continue`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:163、296–357、375–377、542–543、563–564；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:167起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI“除扇贝/小贝外都挡”漏强化削；AI估值注释608–610说一次性，不是合法性规则。

### 24 · ZhangXinWei · 张新伟

- CODE 可用条件：未zhangUsed且自身hasHighAttackRecord，无复制DD门槛。
- CODE 消耗/收益：DD0，其他资源0；effective=self.lastHighAttack。
- CODE 次数/延迟/状态：仅一次；取自身最近一次高阶有效招，不要求上一回合；不复制对手记录；声明后zhangUsed=True。
- CODE 普通案例：`catalog-ZhangXinWei` 对攒 → `PlayerWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:182–183、226–247、526–527、571–578；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:173起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI写对手上回合且需足DD，与代码三处不同；Bi不属可自然记录的高阶集合。

### 25 · LiQiang · 历强

- CODE 可用条件：未liqUsed，无DD门槛。
- CODE 消耗/收益：DD0；未触发作为攒，通常+6，仍受攒的克制。
- CODE 次数/延迟/状态：仅一次；当前effective比对对方lastMove，仅旧张新伟特殊映射；触发优先判胜。
- CODE 普通案例：`catalog-LiQiang` 对攒 → `Continue`；P净DD=+6单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:184–185、220–225、251–287、363–366、528–529、555–564；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:177起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：免费/炸药前后映射不对称；双方历强有P先算顺序效应，见CASES。

### 26 · BombPragon · 炸药·Pragon

- CODE 可用条件：bombLayers≥1（不检查DD）。
- CODE 消耗/收益：扣1炸药层，DD0；effective=Pragon，威力12。
- CODE 次数/延迟/状态：记录高阶Pragon，lastMove保留BombPragon。
- CODE 普通案例：`catalog-BombPragon` 对攒 → `PlayerWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:188–189、228–229、242、514–517、571–578；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:114起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI本项允许吸收，与吸收说明“不能吸炸药”冲突；可挡但不返DD。

### 27 · BombVolvo · 炸药·沃尔沃

- CODE 可用条件：bombLayers≥2（不检查DD）。
- CODE 消耗/收益：扣2炸药层，DD0；effective=Volvo，威力24。
- CODE 次数/延迟/状态：记录高阶Volvo，lastMove保留BombVolvo。
- CODE 普通案例：`catalog-BombVolvo` 对攒 → `PlayerWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:190–191、230–231、243、514–517、571–578；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:117起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：与GUI本项一致；不能吸收。

### 28 · BombFlipVolvo · 炸药·翻转沃尔沃

- CODE 可用条件：bombLayers≥4（不检查DD）。
- CODE 消耗/收益：扣4炸药层，DD0；effective=FlipVolvo，再分支沃尔沃/自杀。
- CODE 次数/延迟/状态：记录高阶FlipVolvo，lastMove保留BombFlipVolvo。
- CODE 普通案例：`catalog-BombFlipVolvo` 对攒 → `PlayerWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:192–193、232–233、244、289–292、514–517；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:120起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：GUI最有利分支说法需结合双量子选择器。

### 29 · FreeThree · 雷电·免费三雷

- CODE 可用条件：lightning≥3（不检查DD）。
- CODE 消耗/收益：扣3雷电，DD0；effective=Three，威力18。
- CODE 次数/延迟/状态：记录高阶Three，lastMove保留FreeThree。
- CODE 普通案例：`catalog-FreeThree` 对攒 → `PlayerWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:194–195、234–235、245、518–521、571–578；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:123起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：吸收可挡但返DD0；“免费”只指DD，仍需雷电。

### 30 · FreeRotateThree · 雷电·免费旋转三雷

- CODE 可用条件：lightning≥6（不检查DD）。
- CODE 消耗/收益：扣6雷电，DD0；effective=RotateThree，再分支三雷/自杀。
- CODE 次数/延迟/状态：记录高阶RotateThree，lastMove保留FreeRotateThree。
- CODE 普通案例：`catalog-FreeRotateThree` 对攒 → `PlayerWin`；P净DD=+0单位。全部输入、资源和状态见 observations.json。
- CODE 定位：deidei_env.py:196–197、236–237、246、289–292、518–521；通用成本139–171、合法性181–201、Action218–248、结算499–584。DOC：gui_deidei.py:126起该招说明；原文字段已保存在JSON的inventory.detail中。
- DOC/OPEN 说明核对：同样须保留量子选择器条件；并非无资源消耗。
