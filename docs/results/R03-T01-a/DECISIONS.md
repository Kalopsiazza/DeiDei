# R03-T01-a 房间选项记录

状态：**PROVISIONAL**。执行线程已一次性向用户展示整组默认安排，截至本记录没有收到选项答复。
用户本次原话为“你完成任务 01”；这是任务执行请求，不记作对产品参数的确认。

| 项目 | proposed | selected | 状态 |
| --- | --- | --- | --- |
| 每拍时限 | 12000 ms | null | PROVISIONAL |
| 全员交牌提前揭晓 | true | null | PROVISIONAL |
| 独立观众上限 | 6 | null | PROVISIONAL |
| 房主断线宽限 | 30000 ms | null | PROVISIONAL |
| 提交后不可改 | 不可改 | null | PROVISIONAL |
| 第三次缺席/非房主离开 | 当拍结算后移除 | null | PROVISIONAL |

默认可用于实现和自测，但不是用户批准。未生成 `confirmed-policy.json`。
收到明确答复后，仅将获准的四个可配置键写入该文件，通过 `--policy` 采用；
其他意见依规划记录为 CHANGE_REQUEST，不擅自改规则或协议。

未进行部署、推送、PR 创建或发布。附件中的交付命令未视作用户单独授权。
