# R03-T03-d 独立最终候选复核

本次完成测试工具修订与固定最终候选复核，产品代码未改。原Q01先复现失败，再按A01拆开限流、断线、恢复、重放的观察窗口；完整公开内容和精确时间断言保留。

## 准确版本

- 产品：`d0c96408a3aa8c14174099da4247bcac953fb9f7`，单独干净检出。
- 原工具/本分支起点：`baeff0bf476e1efd91358e9c3bb6350208d8a647`。
- 修订后实际测试工具：`b26c0634e27e96482388faf2c73ffa31fa2d3948`，先提交代码，再执行候选测试。
- 规划：`3cf98c40c9ec3c607b702a12875ce4ec830da27d`。
- 附件SHA256：`df3b2e9adce6ef01e8005abfcdc365edf87da0b5624a1bff2bc620a68f17c318`，14项清单通过；包内正式文档与规划提交逐项匹配。
- core/runtime tree、桌面和服务锁、旧打包与8a输入一致；产品及旧结果执行前后未改，详见MANIFEST.json。

## 本次实测

| 检查 | 结果 |
|---|---|
| 原Q01 | FAIL，faults.py:39；准确语句在original-q01.json |
| 修订Q01 / D01—D03 | PASS；限流窗口seq不变，连接变化有原因，原拒绝请求可复用 |
| 原160个房间case_id | 159PASS / 0FAIL / 1NOT_RUN；显式固定server/core/desktop路径及SHA |
| 真实服务→桌面解码交叉场景 | 11PASS，双方准确SHA、输入未变 |
| 新43故障子例 | 43PASS，未删减 |
| 固定seed0—99 | 100PASS |
| 五类原变异 / D05 | 正控5PASS、变异5KILLED；空限流ID、重算deadline、丢membership、重复应用、观众秘密 |
| 新增限流副作用 / D04 | 正控3PASS、变异3KILLED；扣业务序号、缓存拒绝、改match |
| 经典规则独立样本 | 192PASS，469次resolve；旧2个session占位仍NOT_RUN |
| 工具回归 | 30PASS（rooms19 + rules8 + endurance3） |
| 仓库根检查 | 62项，含1项既有expected failure；无新增skip或expectedFailure |
| 固定候选核心/runtime | 174PASS / 23PASS |

每个变异只存在于自有临时副本；先正确候选正控PASS，再语法/导入退出0，最后真实行为断言失败才计KILLED。本次所有8类均满足；CLI仅在全部检出时返回0。没有将语法错误或正控失败计成功。

原160样本、crosscheck、持续运行run.py均与baeff逐字节相同；仅faults.py、mutations.py、test_endurance.py改动。历史c包N33的有界连接前置继续保留，本次没有修改样本、玩法、消息或时间容差。

## 引用的900秒证据

**本次未重跑900秒。** 引用规划者固定d0产品、baeff工具的Linux运行：900.058秒、四房各244场，共976场；违规/失败集合空，连接峰值12，结束后连接0、所属任务泄漏0。引用输出独立存为referenced-endurance-900.json。

已从GitHub读取运行34931393604，核对其中`independent (endurance)` job104260156404成功；该run总体为failure，原因是另一个fast job失败，不能把整个run改称通过。下载artifact10382350926后，其中evidence/endurance.json与任务包文件SHA256完全相同：`5ec7f2c1ed9aaf02d7b581203d8bf5c1cc6089839b11170533cbb4388f465938`。

产品/核心摘要与本机固定检出吻合，run.py未改；本次修改的Q01和变异工具不在endurance运行分支中执行，因此不需要重复长跑。引用证据与本机实测分别列在candidate-recheck.json。

## 环境、边界与交付

本机独立venv按产品原hashlock安装websockets17.0.1，Node24.12.0，Python3.13.7。测试只使用自行启动的回环服务，单项有限动作，按样本连接数计算的并行上界44（小于48）；100seed完成后才启动变异，避免叠加超限。原生GUI/Windows/打包/TLS/公网/跨电脑真人均不在本次实测结论中；旧N35保持NOT_RUN。新增故障Q17窗口项不执行，Q18的100seed为本机实测、900秒为引用。

FIRST-FAILURES.md解释原失败与修订理由；COMMANDS.json记录实际命令和退出码；MANIFEST.json固定来源及文件摘要。没有新增产品故障。自审通过，未调用Kimi（暂停中）；未合并、部署或发布。

修订Q01最小复跑（完整批次命令见COMMANDS.json）：

```sh
"$PY" "$CHECKOUT/tests/rooms_endurance/run.py" --product "$PRODUCT" --sha d0c96408a3aa8c14174099da4247bcac953fb9f7 --mode faults --case Q01 --output "$OUT/q01.json"
```
