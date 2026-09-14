# R03-T01-b 参数记录

## 用户原话

> 1. 10s，我建议这个房主可以更改，而且可以在游戏当中更改，如果需要改架构和计划，交给 ChatGPT pro 下发任务工作包修正 提 pr 2.允许 注意，参战人员死了要保留参战席位，相当于观战有两种状态 3.房主掉线我们前面不是说由系统自动出三轮 deidei，如果第四轮仍然超时掉线则关闭房间吗？ 4.是的，不能改 5.是的，我觉得房主也是吧？

时间未知，记录为 null。用户本次指令是“完成任务 01 b”；附件提供实现约束，不等于用户逐项答复。

已按用户指示实现默认 10 秒、房主局中修改、淘汰留座、提交不可改和房主前三次代理／第四次截止关房。
普通玩家第三次缺席当拍后移除是本轮规划已采用内容。
下一选择阶段生效、固定 Charge（尊重休整）、不暂停全场、非参战恢复 30 秒是规划者细化。

用户在两项含义说明后回复：

> 按这个

确认状态为 APPROVED：host_leave_timing=after_turn，early_reveal=true，无剩余参数问题。
房主主动退出等当前一拍／揭晓结束，大厅或结算页立即关房；本拍需要选牌者全员提交后提前揭晓。
精确回复时间未知，保持 null。本次只确认已有默认行为，不修改服务逻辑。
`policy-effective.json` 仅四项可覆盖字段；host_leave_timing 使用独立 CLI 选项，未混入公共 policy。

```sh
PYTHONPATH=game/core:game/server game/server/.venv/bin/python -m deidei_server --policy docs/results/R03-T01-b/policy-effective.json --host-leave-timing after_turn
```

仅本地 loopback；没有部署、合并、发布或新增玩法授权。未调用 Kimi。
