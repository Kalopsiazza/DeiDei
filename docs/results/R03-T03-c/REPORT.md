# R03-T03-c 独立长期运行与故障验收

测试交付已完成，产品结论为 **BASELINE_ONLY / FAIL**。三次检查具名 T04 分支均不存在，见 candidate-checks.json。未取浮动工作区产品，未修改产品或依赖。

## 固定输入与边界

- input/tested_code_sha：`8a6f8b29f517ab4c5a16466f0894e86995f8a852`。
- plan_sha：`a1e01ee259c65d9241ad1c4daee7852faca366bf`；附件 SHA256 `f7225e78aa0c988a44d43f7b303f36e2a167189c78be7209d105dcceb5c284ad`；15项清单逐项验证，见 INPUT-PLAN-MANIFEST.json。
- 100种子与900秒运行使用已提交工具 `26d54ed3ad53e0816b7773ffd08d78d52c4e08d6`；其开始时的源码摘要、dirty=false、产品摘要均在结果JSON。最终独立故障使用 `3ca2d32c587ed0a7c46eec58a6bb98cbb89f2e9f`，dirty=false；最终GUI子进程回收补检工具提交为 `1a9358b11e3f4b6905bb2fce6276309a30c5501e`。初次开发态结果原样保留，不伪称干净提交。
- macOS27.0 arm64，Python3.13.7，websockets17.0.1，Node24.12.0。仅自有回环服务、临时合成档案；没有生产服务/真实用户。

## 结果

| 检查 | 实际结果 |
|---|---|
| 160原case_id、有界连接版本 | 156PASS / 3FAIL / 1NOT_RUN；N33限流、N36/N48真实钟失败，N35仍未由该驱动执行 |
| 原11交叉场景，真实socket→桌面readMessage | 11PASS，source_unchanged=true；不是Electron窗口证明 |
| 新故障/边界，Q01—Q20相关43子例 | 38PASS / 5FAIL；Q01、Q03、Q04三个阶段失败 |
| 固定seed0—99 | 100PASS；座位、观众数、提交顺序、丢回执后原请求重放/已确认重放变化；每序列低于2000动作 |
| 900秒真实钟 | 900.057秒，四房各244场，共976场；FAIL：SAME_SEQ_PUBLIC_CHANGED |
| 真实三Electron窗口 | PASS：房主/玩家/观众、取消、服务重启、另建新房、离线真实worker、连续关闭 |
| 五类变异 | 3KILLED；空限流ID/重算期限的正控已失败，2BASELINE_FAIL，不计检出能力 |
| 基础回归 | core174、runtime23、service61、desktop25、online28通过；规则192fixture/469resolve通过，2旧session项仍NOT_RUN；工具29通过；根检查61含1既有expected failure |

**没有放宽截止时间容差。** Q03独立wall读取每次递增1ms，Q04在selecting/revealing/host grace分别跳跃wall±一天；精确deadline与启动锚点公开时间应只随mono推进。当前基线在进入后续边界断言前已违反锚点投影；后续边界不冒称通过。Q01同理，空ID失败后不冒称last_seq/cache后置检查通过。

## 持续运行观察

4房×2玩家+1观众，连接峰值12。900秒后连接0、所属async任务泄漏0；每次ps采样子进程已wait。完成后的对局数为976，30秒采样持续推进。活跃阶段任务数54；RSS样本38,480—45,664KiB，包含同一进程内的服务与测试驱动，不是纯服务内存，也不宣称不存在任意长期泄漏。

51,057次命令测量：p50=1.529ms、p95=7.096ms、max=124.343ms。它们是本机这次合成负载的观察，不设“性能达标”结论。只有一次完整900秒测试；另有8秒开发冒烟。限流故障不会被吞掉；同seq字段漂移记录FAIL，同时继续运行以完成持久性观察。

## 测试前置修正与首次失败

1. 原160逐项运行启动后，发现原N33容量样本会保留65条连接，主动中断（没有完整JSON，退出码未采集）。为遵守本批最多48条，建房后断开每个临时房主；仍保留64房、手动时钟不推进、65房SERVER_BUSY及所有160个case_id/预期。只增加disconnect步骤，未改服务。初次完整有界运行工具dirty=true，最终提交版另复跑，见baseline-160-latest.json。
2. 手动钟的seed冒烟原先用真实轮询等待，额外sync消耗真实限流额度；改为准确推进300/1500ms并一次读取。修正后3条冒烟与100条固定种子通过。
3. Q11淘汰宽限：先等待服务观察断线，再推进30秒。初次未drain的TimeoutError保留在faults-first.json。Q16先在未认证的新连接尝试旧身份；失效房号按W12返回ROOM_ACCESS_DENIED，避免泄漏房间存在性。
4. GUI首次工具在应用关闭后再次取Playwright.process句柄报错，改为启动时保留自有进程句柄。第一次行为断言又额外要求内部snapshot立即null；源码确认unavailable已隐藏旧桌面，规范要求是不恢复/不可操作旧房，因此最终检验真实UI无牌、SERVER_RESTART、重连获得不同room_id。首次结果保留；没有降低原160断言。
5. 已复核b的PREVIOUS-CASE-MAP：UUID/policy入口、10秒默认、缺席/房主新策略来自W10/P20—22；身份错误优先来自W12；N19改Volvo是12dd6已满足Pragon前置；N33数字非法输入和逐ACK限流隔离队列；N38不再多进300ms；A13移除房主订阅与W10 remaining倒数；N10别名集合排序保留重复计数。这些都有规范/核心前置理由，未回退既有发现。

## 生命周期、队列与变异的证据边界

三张PNG为普通main.cjs、真实服务与真实核心的Electron画面，不是MOCK。HTML退出确认实际点击“留在房间”；原生关闭handler的取消/同意由测试脚本给dialog回调返回值，**不等于原生系统对话框人工视觉验收**。三个进程关闭耗时257/253/147ms，自有进程剩余0，关闭前观察到的10个所属子进程也全部退出。Windows未测；旧N35仍NOT_RUN，不能把新增GUI加到160计数里。

Q19内部使用实际Connection.put/writer配合阻塞send：精确32队列项、2MiB队列字节，超一个关闭1008/SLOW_CONSUMER；在途帧不计队列。快照只合并相邻项，不跨ACK。内部精确预算与N31真实socket慢读是两种不同证据。

变异在临时副本运行，控制组先通过，再要求语法/导入退出0，最后行为失败。重复应用故障明确在重复Charge请求路径注入额外6dd6，检验账目双加，不是声称真实实现有此错误。丢membership和观众秘密故障也被检出。产品原目录执行前后摘要一致。基线已坏的两类保留BASELINE_FAIL，待合格T04候选后再做正控/变异。

## 复跑与未测

COMMANDS.json记录测试命令、输出和实际退出码，路径使用变量；读取/定位类命令未逐条展开。命名候选最多检查3次，消费工具只接受固定字段/40位SHA/祖先关系/允许路径/受保护tree和依赖锁；不执行回执命令、URL或路径。无候选时没有候选验收结论。

在新的干净检出和已锁定环境中，可复跑当前最小失败集合：

```sh
"$PY" "$CHECKOUT/tests/rooms_endurance/run.py" --product "$PRODUCT" --sha 8a6f8b29f517ab4c5a16466f0894e86995f8a852 --mode faults --case Q01 --case Q03 --case Q04 --output "$OUT/recheck.json"
```

这些失败由固定动作/时钟输入触发，无需随机seed；case_id就是最小复现阶段。随机序列故障则用`--mode seeds --seed N`，结果逐条保存seed与阶段。不得把本报告FAIL解释成可发布；本PR只交测试、证据与复测入口。未调用Kimi，未合并、部署、发布。
