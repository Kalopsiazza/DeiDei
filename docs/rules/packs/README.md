# 声明式规则包 v1

导入UTF-8 `.deidei-pack.json`，上限8 KiB、最多4预设。`fast-opening.deidei-pack.json`：每局1 DD开始、攒2 DD；双方同时攒后各3 DD。`certain-luck.deidei-pack.json`：100%单级幸运变招，用于可重复测试，不承诺平衡。

结构以这两份示例为准。ID限定小写ASCII字母开头、数字/点/短横线，长度≤64；版本规范major.minor.patch。名称≤40、作者≤60、说明≤120字符，作者自报。参数仅允许攒6/12/30 sixths、开局0/6、每game发放、0..10000整数基点概率和basic-attacks-v1。八技能必须完整布尔值。不能改费用、动作ID、胜负或结算顺序。

core纯编译器拒绝未知字段、能力、重复键、控制字符、URL/路径、超深嵌套和脚本声明。manifest全部内容（包括作者/文案、全部预设）进入规范JSON的SHA-256；同id/version不同内容不能覆盖。单场只选一个包内预设；房主将有界完整manifest交服务器重新编译，其他成员无需安装文件。活动对局冻结快照，删除本机包不改变已开场规则。

只存在两个摘要：pack `content_hash`与规则快照`rules_hash`。规范JSON使用UTF-8、对象键递归排序、数组保持原序、无空白/浮点，摘要前缀`sha256:`。共同黄金向量见`golden-vectors.json`，Python和桌面JS必须一致。

## 构建登记的原生能力

`deidei_core.rules.HOOKS`登记固定id/version；对应纯函数：`initial_resources`（opening-v1）、`skill_allowed`（skills-v1）、`action_transform`（basic-attacks-v1）、`charge_gain`（charge-v1）。输入为冻结快照/局面/预给token，输出受验证数据；本轮调用同一原生P1–P4，不运行下载Python/JS、dynamic import或eval。将来新动作/防御须定义相应P3等阶段并测试，登记名字本身不是可运行能力。

四内置预设schema1 / configured-1.0.0基于classic-1.0.1；显式规则使用CoreState schema2。未传快照的旧API继续schema1经典精确投影，未知版本拒绝。教程固定经典全开。贷款每game1 DD无需还款；幸运按原费用只升一级，BigBi封顶，复合招不抽，抽中未必更有利。
