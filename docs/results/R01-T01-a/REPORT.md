# R01-T01-a｜游戏规则详细确认

状态：PARTIAL（本地取证完成；尚未上传PR，待Teddy明确授权push/创建PR）。不是ACCEPTED，没有进入b包或正式实现。

## 身份与输入

- input_ref：`plan/r01-v1`
- input_sha / tested_code_sha：`aeabaf681197eb110da919e310ad1f4833433bba`
- PRD-R01 1.0；ARC-R01 1.0；任务R01-T01-a 1.0。
- 执行分支：`work/r01-t01-a-rules`，独立worktree。
- 拟议PR目标：`docs/design-discussion-20260911`。开始时远端目标与快照SHA相同。
- 开始时远端main：`c42c07221f1b813b83feeba3036e4b6cfaab4134`；仅核验，未用作任务起点。
- 报告提交SHA：由最终交付消息给出，避免把提交自身SHA写入自身。
- PR URL：null，尚未创建；准备好的中文正文见 PR-BODY.md。

## 本包完成情况

| 条目 | 结果 | 证据及边界 |
| --- | --- | --- |
| RULE-01 | PASS | 31招、无重复、GUI对应完整；保留ALL_MOVES索引与枚举值，未重编号 |
| RULE-02 | PASS | MOVE-INVENTORY逐招有条件、费用/收益、状态、说明差异、文件行号与普通案例；source-hashes.json绑定文件内容 |
| RULE-03 | PASS（如实取证） | 原检查32项：31通过，1已知expectedFailure，0意外失败/错误；不是32项全部通过，也不是缺陷修复 |
| RULE-04 | PASS | 多人只保留已有口述证明部分；5类多人局面保持OPEN，无双人函数拼接 |
| RULE-05 | PASS | 只新增本包结果与实验目录，原源码、正式tests、模型、依赖、PRD/架构/计划均未改 |
| 工作包第6步远端提交 | NOT_RUN | 已整理本地报告与PR正文；附件的提交要求不单独作为远端写入授权 |
| Teddy原玩法确认 | WAITING_FOR_TEDDY | QUESTIONS共12道首批题，附录另列未决项；未收到新答复 |

## 主要事实

CODE不是高中原玩法的定稿；DOC不是运行证据；TEDDY口述仅按已存记录的明确范围引用。

1. 31招与预期数量一致。Gym动作索引从0开始，Move枚举值从NoMove=1开始，两者不可混淆；未更改映射。
2. 张新伟读取自身最近高阶记录，并不要求对手上回合出该招，也没有足DD门槛；与GUI说明不同。
3. 四专属防御与距喦都挡不住Bi；普通防御可挡。距喦后的强化削有dd≥2内部单位门槛，但合法后实扣0；buff不会因隔一回合攒而失效。
4. 吸收能挡强化削、炸药Pragon和免费三雷；收益不总等于对方实际扣费，张新伟复制也有差异。
5. 炸药T放、T+1末成熟、T+2初可用；既有浅复制会改写输入pending。同输入对象重复试算两次，第二次可凭被污染的pending多得一层。
6. 历强对免费招历史转换不对称；双方上回合都攒、当前都历强，程序因计算顺序只判P胜。已留具体案例，未修代码或添加正式预期失败。
7. 多人只确认一般全场出招、Bi能使正在攒的人出局等已有口述；其他玩家结果及整局平局没有被猜定。

## 实际验证

环境：macOS 27.0 / arm64；Python 3.13.7。仅标准库，无新依赖。

| 命令/检查 | 退出码/结果 | 留存证据 |
| --- | --- | --- |
| `python3 scripts/check.py`（写取证脚本前） | 0；语法9个Python文件，32测试含1预期失败 | 执行线程工具记录；非最终日志 |
| `python3 experiments/r01-t01-a/observe.py > docs/results/R01-T01-a/observations.json` | 0；93个双人观察案例，另有重复炸药试算 | observations.json |
| 再次调用observe.py并与已保存stdout逐字比较（Python标准库subprocess） | 0；完全一致，目录及案例ID校验通过 | verification.txt |
| `python3 scripts/check.py`（含最终取证脚本） | 0；语法10个Python文件，32测试含1预期失败 | check.txt |
| `git diff --check` | 0 | 本地执行记录 |
| 基线已跟踪文件diff与新增路径白名单核验 | 0；原文件无变化，新增路径均在允许范围 | verification.txt、source-hashes.json |

保留的唯一正式预期失败：`test_simulation_does_not_mutate_input_bomb_lists`，来源tests/test_known_regressions.py:10–16、docs/known-issues.md:3–7；原样未改。

未运行GUI、模型加载/训练、多人联机、Windows、安装包、离线运行验收；这些属于其他工作包或后续实现，不能凭本报告声称可用。仅静态读取GUI和Gym相关名称/映射，没有加载权重。

## 产物

- MOVE-INVENTORY.md：31招目录与逐招证据。
- CASES.md / observations.json：可读案例及完整原始状态输出。
- QUESTIONS.md：首批12题、多人边界与答复原文空位。
- check.txt / verification.txt：原测试及取证复跑记录。
- source-hashes.json：输入快照文件SHA-256（包含所有被跟踪原文件，未改模型）。
- manifest.json：输入、环境、命令、哈希、未运行事项；不自哈希，避免递归。
- experiments/r01-t01-a/observe.py / README.md：可重跑的标准库取证程序和运行说明。
- PR-BODY.md：待上传正文。结果仅本地保存，尚无远端存储保证。

## 返回ChatGPT与下一步

可以审查目录完整性、源码差异、复跑行为和提问质量；不能据此批准原玩法、完整多人算法或正式实现。Teddy回答可先保留原文，正式规则归纳和下一包仍由ChatGPT完成。无需等所有玩法题回答才交a包证据，但远端写入仍需明确授权。

Codex已自检路径、来源、案例与测试；未调用Kimi（暂停使用）。未push、创建PR、合入、部署或发布。
