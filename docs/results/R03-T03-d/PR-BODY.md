## 这次想解决什么

原Q01把限流前与主动断线、恢复后的room.seq相比较，误报正确候选。现在在不断线窗口检查限流无副作用，断线/恢复另验connected与版本变化，重放再以恢复后为起点比较。

## 改了什么，哪些没有涉及

只改faults.py、mutations.py、test_endurance.py及本任务结果。完整公开局面、配置、成员、精确deadline和原UUID重放检查保留；不限定连接变化恰好增加几个版本。不改产品、160原case_id/预期、历史c结果、规则、依赖或CI。

## 怎样验证

固定产品`d0c96408a3aa8c14174099da4247bcac953fb9f7`，工具`b26c0634e27e96482388faf2c73ffa31fa2d3948`（先提交再执行），规划`3cf98c40c9ec3c607b702a12875ce4ec830da27d`。

- 原Q01准确失败行保留；修订Q01通过，实测seq为5→5→6→7→7，未写死这些数值。
- 房间159PASS/0FAIL/1NOT_RUN（旧N35）；43故障、100固定seed、11真实server→desktop解码通过。
- 五类原变异5KILLED；限流扣序号/缓存拒绝/改变match三类新增变异3KILLED。8类均有正确候选正控PASS及语法/导入退出0。
- 独立规则192fixture/469resolve通过，旧2个session占位未测；工具30、core174、runtime23通过；根检查62含1项既有expected failure。
- 900秒976场使用规划者已执行证据，下载原CI artifact并逐字节核对；本次未再跑，不计入本机实测。

## 已知问题与未测

本次未发现新的产品故障。原生GUI、Windows、TLS、公网、跨电脑真人不属于本次实测通过结论。旧N35不借其他GUI证据改为通过。首次失败、全部测试命令/退出码、引用来源及文件摘要见本目录FIRST-FAILURES、REPORT、COMMANDS、candidate-recheck和MANIFEST。

## 提交者确认

- [x] 仅修改获准路径，旧PR27及历史证据未改。
- [x] 保留原失败和强断言，未降低时间精度或新增skip。
- [x] 仅自有回环服务与合成数据，无凭据、私密帧或用户路径进入结果。

已自审；未调用Kimi。未合并、部署或发布。
