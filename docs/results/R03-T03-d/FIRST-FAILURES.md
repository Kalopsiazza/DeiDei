# 首次失败与观察时点修订

产品固定 `d0c96408a3aa8c14174099da4247bcac953fb9f7`；原工具固定 `baeff0bf476e1efd91358e9c3bb6350208d8a647`，两者干净。原函数实跑退出1：

```text
faults.py:39 — AssertionError
assert before['seq']==after['seq'] and before['view']['policy_revision']==after['view']['policy_revision']
```

原输出保留在original-q01.json。此失败发生在主动断线、恢复和重放之后；公开connected变化应有更新版本，不能将这个窗口的seq变化当作限流副作用。修订依据为本批ARC A01、PRD P02、D01—D03及验收F07。

修订工具先由仍在线的房主读取限流后的状态，再断线、等待服务观察、读取、恢复、读取、重放、读取。完整公开view（仅排除接收者各自self）逐窗口比较，因此match、members、policy、policy_revision和精确deadline均保留检查。断线/恢复只允许指定成员connected变化，版本必须增加但不限定恰好加1；两个无副作用窗口seq必须相等。

本次实际观察：5（before）→5（after_rate）→6（after_disconnect）→7（after_resume）→7（after_replay）。这组数值只是本次证据，不写死为测试答案。恢复last_command_seq未消费，原拒绝UUID与command_seq重放成功，见q01-fixed.json。

新增自检接受未变窗口及非固定幅度的合法连接版本变化，拒绝seq、match、配置、1ms截止时间、成员连接、房间身份的非法变化以及版本倒退。另在真实产品临时副本注入业务序号消耗、缓存拒绝、match改动，均先通过语法与导入，再被行为断言检出。

旧R03-T03-c全部结果和PR27未改。它们的8a基线FAIL与本次d0候选PASS分开保存；也不把规划者原43例42PASS/1FAIL改写为43PASS。本次43PASS来自修订工具另行执行。
