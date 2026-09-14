## 这次想解决什么

跟进 NET1.1：房主改时限只影响下一次选择阶段，缺席不暂停牌局；成员被服务移出后自动离开旧房页面。保留原 a 界面及原单人路径。

## 改了什么，哪些没有涉及

- rooms-1.1 精确 DTO、未来时限设置与 revision、独立房主恢复倒计时、pending_close、membership.ended 和迟到消息隔离；淘汰房主可管理，无权操作隐藏。
- 完整真实 Room/core 结果进入 readMessage；保持 to_game_id 字符串和对应关系，拒绝 null/私密字段。
- 新命名 IPC、局部提示样式及相关测试。服务、核心、runtime、依赖锁、模型、打包和CI未改。
- 本 PR 含未合入 a 祖先。只看 b 增量：`72266fbc63e4982738ae83eee99e9001a6872d6f..19e75c0d3f3ca8423733538a57ef071ad808a713`；之后提交仅结果文档/证据。

## 怎样验证

- 基础：40 项，保留 1 个历史 expectedFailure；原桌面 25/25；在线 28/28；构建/类型检查、Electron WebSocket 能力探测均 exit 0。
- 实际 macOS arm64 Electron MOCK 窗口验证新状态与原在线回归；原单人真实 worker/core 窗口通过。
- 10 个实际 Room/core 输出完整解码。采集的是任务01 b 未提交源码，来源 HEAD 与逐文件 SHA256 明确保留；会话/时钟容器为合成，未接 socket。
- `python3 docs/results/R03-T02-b/validate.py` 可复现六项检查，详见 REPORT、TEST-MATRIX、validation.json。
- 未验证真实socket/真人联机、Electron接真实服务、Windows、物理断网或发行包。本次不宣称整轮集成验收。

## 截图（实际 Electron / MOCK）

![调整前](https://raw.githubusercontent.com/Kalopsiazza/DeiDei/codex/r03-t02-b-online-desktop/docs/results/R03-T02-b/mock-limit-before.png)
![本拍10秒，之后5秒](https://raw.githubusercontent.com/Kalopsiazza/DeiDei/codex/r03-t02-b-online-desktop/docs/results/R03-T02-b/mock-limit-next5.png)
![房主缺席仍继续](https://raw.githubusercontent.com/Kalopsiazza/DeiDei/codex/r03-t02-b-online-desktop/docs/results/R03-T02-b/mock-host-continues.png)
![自动移出旧房](https://raw.githubusercontent.com/Kalopsiazza/DeiDei/codex/r03-t02-b-online-desktop/docs/results/R03-T02-b/mock-membership-ended.png)

截图及详细日志在本分支 `docs/results/R03-T02-b/`。

## 对现有内容的影响

- 规则/招式/状态/模型：未改变核心；客户端按 NET1.1 展示房间规则。
- 依赖/配置：无新增依赖或版本变化；开发URL、/rooms-v1、WebSocket子协议不变，hello要求rooms-1.1。
- 规划输入：R03-plan-1.1-b 附件清单26项校验通过，plan_sha未提供，保持null。

## 已知问题

真实服务候选仍需固定最终 SHA 做后续联调；本结果文件记录源码哈希与服务未提交状态，不能把服务a HEAD当作b修订版本。未调用 Kimi，保持暂停。没有自动合入、关闭旧 PR、部署或发布。

## 提交者确认

- [x] 已自审范围，未夹带无关改动。
- [x] 如实记录验证，没有删除断言或给新失败加 skip。
- [x] 未提交凭证、私人材料或环境目录。
