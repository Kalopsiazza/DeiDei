# R02-T04-b 验证矩阵

`plan_sha=20312a2244ff0447593f22fde41b9b8bb960da9a`；`input_sha=980a019d9a1410bf3ee72263d90397023696f32b`；`tested_code_sha=9e8ab22cb19b59a4edb52194206d280119eeb960`。

## 本包要求

| ID | 自动测试与真实窗口依据 | 状态 |
| --- | --- | --- |
| F01 / B01 | 真实 Charge/Cloud、Charge/Absorb：取消标记保持，A 余额 0，无 A 收益行；Cloud 实际窗口前后截图 | PASS |
| B02：精确单位 | 普通 Charge +1 DD、Xiao -1/3 DD、Absorb -1 DD / +1 DD；ZengYi 清空 -1/2 DD 与 5000 位整数 | PASS |
| B02：零与清空 | BombPragon/Absorb 没有 DD 获益；Charge/Tian +1 与 -2又1/6 逐条保留；两位 Tian 同一目标仅一次非零清空 | PASS |
| B02：资源文案 | 放置炸药、强化削、放置次数、只读 C065 发奖链、C074 炸药成熟；无内部事件名 | PASS |
| B02：重开与保真 | C074 先显示 ledger 消耗/成熟，再解释存活者资源归零；所有摘要检查 deepcopy 和原 Resolution 哈希不变 | PASS |
| F02 / B03：同步 | 直接执行 renderer 真实处理函数；在 busy 闭包未重绘前阻止返回与第二次开场 | PASS_UNIT |
| F02 / B03：窗口 | 专用入口延迟 startSolo 成功/失败；准备页返回与标题 disabled；成功等待时真实鼠标点击二者仍留准备页 | PASS_GUI |
| F02 / B03：场景 | 延迟 preview；关闭按钮/标题 disabled，Esc 不离开弹窗；成功切换到明确标注的 fixture | PASS_GUI |
| B04：恢复 | 成功后正常离场；失败留准备页并显示原因，返回/标题恢复；分别直接重试、返回后重开，match ID 不复用 | PASS_GUI |
| B04：旧响应 | 同步异常释放标志；旧 generation 的成功或错误均丢弃；原 S09/S10 保留 | PASS_UNIT |
| B05 | npm test 默认 build + test.cjs + test-live.cjs + test-navigation.cjs，共 22 PASS | PASS |

runtime 新增 8 个测试方法（含子用例）；导航新增 4 项。真实窗口检查单独记录，不与单元测试加总。

## 既有回归与缺项

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| core 174、独立 192 / 469 resolve | PASS | core-self-tests.txt、independent-acceptance.txt |
| runtime 原 13 + 新 8 | 21 PASS | runtime-tests.txt |
| 原桌面 9 + 通信 9 + 新导航 4 | 22 PASS | desktop-tests.txt |
| 样本结构、工具自测 8 | PASS | fixture-validation.txt、harness-self-tests.txt |
| 根检查 40 | 39 PASS，原 #1 expectedFailure 1 | root-check.txt |
| 真实 Electron 原回归 | 6 组 PASS；两场各 5 拍至结果、再开场、资源详情、读失败、worker 中断、曾义自动休整、档案设置、fixture/观战 | live-regression.txt、regression/live-smoke.json、实际 ledger |
| 1366×768 / 1920×1080 | 两个开发视口，33 牌/三排/名称 ≥16px | regression/live-table-*.png、layout 数据 |
| b 专项窗口 | 4 组 PASS，真实截图与 DOM/鼠标断言 | window-after.json、window-after.txt |
| 原独立 session 2 项 | NOT_RUN，驱动未适配；未改原预期 | independent-acceptance.txt |
| 规划者独立 session 6 项 | 附件来源，不计本包 PASS 数 | provenance.json |
| Windows / Python 3.11 单独实机 | NOT_RUN，当前执行环境为 macOS/Python 3.13.7 | validation.json |
| 物理断网 / 用户手动对局 | NOT_RUN，未操作系统网络，也非用户手动测试 | 本次范围 |
| 免环境安装、Forge、签名、发布 | NOT_RUN，不在本包范围 | 本次范围 |
| 旧工具链告警 | INHERITED_OPEN：沿用 a 包 23 项，未重新审计 | a 包结果只读 |

## 复测入口

从根目录执行 `python3 docs/results/R02-T04-b/validate.py`，各命令/环境/退出码落在 validation.json。GUI 需要本机可用 Electron；缺 GUI 时应记录 PARTIAL，不能把单元结果替换为实机截图。本次两套真实窗口均执行成功。

人工复核可分别打开报告中的 F01 前后、F02 等待/失败恢复截图，再查看 JSON 的 disabled 与页面变更记录。需要重新取得修改前窗口证据时，在 input SHA 的独立工作树运行本包专用启动器 `smoke-live-b.cjs --before`，不要覆写已有 a 结果；该入口只用于测试。
