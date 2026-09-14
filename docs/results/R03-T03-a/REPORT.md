# R03-T03-a 交付报告

本地样本与验收工具已交付：96 个样本覆盖 N01—N36，15 个工具自测方法通过。
真实房间服务 **NOT_RUN，0 项服务通过**；未以模拟对象替代服务验收。

## 输入和范围

- product/input_sha：`23520350393ba43384c20b60bef7d6dbd89fc142`，从该提交新建独立工作树。
- 分支：`codex/r03-t03-a-room-tests`；预定 PR base：`integration/r03`。
- `plan_sha=null`。完整规划只读自附件，清单 18 项大小和 SHA256 全部核对一致。
- PLAN-MANIFEST SHA256：`4442d966b87b477c111f9b99ae9e3444ccfe94dd8338ab5a1910b4e3acd88684`。
- 附件 SHA256：`300314729c3b14900119bc11e8f473e12bf198376b58bfdc8a821c9bbc842457`。
- 只读查询到的 context_plan_sha：`51432688cf1bbdb1765e59af3540342599a71bc4`（integration/r03）；
  只读查询的 main：`889162fc90000919004f498b27cffbd5fa4cbe45`。未用这两个浮动引用作为产品起点。
- 只新增 `tests/rooms_v1/**` 与本结果目录；保留原工作树、经典规则、旧样本占位、
  桌面、锁文件和总进度。未复制整批规划到产品仓库。

## 实现与验证

`author_cases.py` 独立编写消息和关键状态预期，展开为 JSON；`validate.py` 检查
完整协议字段、身份/私密边界、资源格式及样本覆盖。`run_acceptance.py` 通过 A08
工厂启动真实本机服务，并绑定指定核心/服务路径和 SHA；每条响应经过同一套检查。
`test_harness.py` 验证该工具能拒绝错误输入/输出。

自测包含 5 个实际传输缺陷回放：漏 ack、跨房快照、他人 self、秘密 entry 字段、
越权角色；另外检查旧 turn、重复奖励、旧 seq、撤销成员后的广播、错误字段、
样本漏项和路径错配。它们是工具自测，不是对真实服务器做了缺陷注入。
N21/N34 的完整核心预期另与指定产品基线核对，共涉及 4 个独立单轮预期与 C065 七拍。

实际命令、完整参数、退出码和输出见 `CHECKS.json`；逐样本状态见 `TEST-MATRIX.md`。
运行环境：macOS 27.0 arm64，Python 3.13.7。未安装 websockets；本地工具只用标准库。
真实服务需要在后续固定候选的 websockets 17.0.1 环境执行，安装/锁定/安全公告查询
尚未发生，不能声称该依赖已在本次验证。

## 规范问题和验证限度

- **权限错误码未逐项固定**：大厅 host 发送
  `room.role {room_id:<自己的房>, role:"spectator"}`，P03 明确拒绝，但 W07 没有
  HOST_CANNOT_SPECTATE 等专用错误，也未指定映射。本样本暂以 WRONG_PHASE 记录；
  spectator 的 room.ready 接受 NOT_ACTIVE/WRONG_PHASE 两种安全拒绝。
  必须拒绝且不改变状态是确定预期，具体码需规划者确认后再约束，不能按服务输出随意改。
- **不可解析消息的关联**：`{"v":1,"v":1}` 或 `{"v":NaN}` 没有有效 request_id。
  W07 要求安全拒绝，W01 未给无法提取 ID 的 ack 关联值。本工具检查错误封装和
  INVALID_MESSAGE，不自行要求一个臆造的原请求 UUID；需补充该处合同。
- **慢消费者队列**：N31 有真实连接暂停读取和有限消息序列，可检查另一个房继续
  响应及授权隔离。普通 snapshot 可合并，A08 不暴露队列，故不能据此证明
  32 条/2MiB 阈值或 ack 永不丢失；需后续有限可观测性/服务自测证据。
- 未运行 1024 连接、每 IP 加入失败限流负载、实际 Electron、跨机器真人或新包。
  六个本机连接不等于六位真人；N35 始终单列 NOT_RUN。
- `timeout_chooser(public_state, legal_options)` 按 A08 两个公开参数使用；合法入口可为
  字符串列表或 core Option 列表。若候选调用约定不同，应记录适配问题，不复制服务实现。

## 交付状态

`tested_code_sha`（真实服务）为 null；工具自测引用的核心 SHA 为上述 input_sha。
缺服务运行返回 2，全部 96 项列为 NOT_RUN。没有寻找或抄入其他线程的服务实现。
本地准备了 PR-BODY 和可分享结果包；附件中的发布操作未作为直接推送授权。
尚未 push、创建 PR、合并、发 b 包、发布或部署。后续联测须使用另一个固定版本包。

已做聚焦自审；Kimi 处于停用状态，本次未调用。
