## 这次想解决什么

主菜单的好友联机原先只有未开放提示。本次增加好友房的桌面流程和主进程消息适配，保留原离线单人；没有服务配置时明确提示不可用。

## 改了什么，哪些没有涉及

- 新增 `online/`：loopback WebSocket、完整公开 DTO 校验、单意图串行、乱序/旧连接隔离、断线恢复和单调计时。
- 完成创建/加入、六席大厅、准备/角色切换、牌桌、观战/淘汰、暂停/重连、结果/下一场。33 牌保留三排11列，资格和费用读取服务，揭晓资源读取 ledger。
- preload 仅具名接口，不传 IPC event、临时凭证或任意 URL。原隔离/CSP/sender 检查和 ProfileStore 格式保留。
- fake transport 仅位于 tests-online；未改规则/core/runtime/server/packaging/原测试/CI/锁文件，没有部署或生成安装包。

## 怎样验证

受测代码 SHA：`f43f80f53a3f635d0b0de4730e545def60259488`。规划清单 SHA256：`4442d966b87b477c111f9b99ae9e3444ccfe94dd8338ab5a1910b4e3acd88684`；plan_sha=null。

- `python3 scripts/check.py`：40 项，保留原 1 项 expectedFailure。
- 原 `npm test`：25/25；新 `npm run test:online`：18/18；构建与类型检查通过。
- `npm run smoke:online`：实际 Electron 检查大厅、角色、提交、暂停/重连、结果、原生关窗；1366×768 / 1920×1080 卡牌布局通过。
- 原 `smoke-live.cjs`：真实单人两场、休整、中断恢复及档案保存回归通过。
- 汇总复现：`python3 docs/results/R03-T02-a/validate.py`；证据在 `docs/results/R03-T02-a/`。

## 对现有内容的影响

规则、招式编号、状态编码、已有模型和直接依赖均未改变。package-lock SHA256 仍为 `11eb5d1c6d1f6d3da7bf50d99f8fdc1303c05fe3591b360441b2e6a2ee9981b8`。

## 已知问题

所有房间窗口证据均清楚标记为 MOCK；未接任务01真实服务，不代表两人或六人真人联机。Windows、跨电脑、物理断网和干净机 NOT_RUN。网络已断时退出，以及系统关窗超过 3 秒未获离房确认时，原席位仍由服务按掉线策略处理。

Kimi 未调用，已完成聚焦自审；没有外部审查结论。等待后续集成包，不自动合入。

## 提交者确认

- [x] 我检查过本次改动，确认 AI 没有混入无关内容。
- [x] 我如实记录实际验证，没有删除或跳过新失败。
- [x] 没有提交凭据、真实个人材料或运行环境目录。
